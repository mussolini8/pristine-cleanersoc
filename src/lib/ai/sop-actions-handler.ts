import { createClient } from "@/lib/supabase/client";
import type { SopCopilotResponse } from "@/lib/ai/gemini-client";
import { importedCommercialAccounts } from "@/lib/commercial-accounts-data";

export type SopActionResult = {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
};

/**
 * Apply a work occurrence / shift replacement (e.g., Field AI on August 22nd by Susana and Veronica)
 */
export async function applyOccurrenceOverrideAction(
  override: NonNullable<SopCopilotResponse["occurrenceOverride"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();

    // 1. Try to find the commercial account by name
    const { data: accounts, error: accErr } = await supabase
      .from("commercial_accounts")
      .select("id, name, user_id")
      .ilike("name", `%${override.accountName}%`)
      .limit(1);

    const accountId = accounts && accounts.length > 0 ? accounts[0].id : null;
    const accountName = accounts && accounts.length > 0 ? accounts[0].name : override.accountName;

    // 2. Prepare entry data mapping to commercial_hours_entries schema
    const entryData = {
      account_id: accountId,
      account_name: accountName,
      work_date: override.date, // Fixed: schema uses work_date
      team_name: override.cleanerTeam, // Fixed: schema uses team_name
      scheduled_hours: override.hours,
      completed_hours: override.hours,
      verified_hours: override.hours,
      status: "completed",
      verified: true,
      manual_entry: true,
      notes: override.notes || `Reemplazo de turno registrado por Copiloto IA (${override.cleanerTeam})`,
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      // Check if there is an existing entry for this account and date
      let existingEntry = null;
      if (accountId) {
        const { data: existing } = await supabase
          .from("commercial_hours_entries")
          .select("id")
          .eq("account_id", accountId)
          .eq("work_date", override.date)
          .limit(1)
          .maybeSingle();
        existingEntry = existing;
      }

      let data, error;
      if (existingEntry && existingEntry.id) {
        // Update existing entry
        const res = await supabase
          .from("commercial_hours_entries")
          .update(entryData)
          .eq("id", existingEntry.id)
          .select()
          .single();
        data = res.data;
        error = res.error;
      } else {
        // Insert new entry
        const res = await supabase
          .from("commercial_hours_entries")
          .insert(entryData)
          .select()
          .single();
        data = res.data;
        error = res.error;
      }

      if (!error && data) {
        return {
          success: true,
          message: `Turno ${existingEntry ? 'actualizado' : 'registrado'} exitosamente: ${accountName} el ${override.date} con el equipo de ${override.cleanerTeam} (${override.hours} hrs).`,
          data,
        };
      }
    }

    // Fallback: save to localStorage for offline / non-auth resilience
    const existingStr = localStorage.getItem("pristine_commercial_hours_entries") || "[]";
    const existing = JSON.parse(existingStr);
    
    // Remove old entry for same date and account if exists
    const filtered = existing.filter(
      (e: any) => !(e.account_name === accountName && (e.work_date === override.date || e.service_date === override.date))
    );
    
    const newEntry = { id: `entry-${Date.now()}`, ...entryData, created_at: new Date().toISOString() };
    filtered.unshift(newEntry);
    localStorage.setItem("pristine_commercial_hours_entries", JSON.stringify(filtered));

    return {
      success: true,
      message: `Turno registrado en el sistema local: ${accountName} el ${override.date} con ${override.cleanerTeam} (${override.hours} hrs).`,
      data: newEntry,
    };
  } catch (err: any) {
    console.error("Error applying occurrence override:", err);
    return {
      success: false,
      message: `No se pudo registrar el turno: ${err.message || String(err)}`,
      error: err.message,
    };
  }
}

/**
 * Apply adding a new staff member or cleaner
 */
export async function applyAddStaffAction(
  staff: NonNullable<SopCopilotResponse["addStaff"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();

    const staffData = {
      name: staff.name,
      role: staff.role || "cleaner",
      display_role: staff.role === "lead" ? "Team Lead" : "Commercial Cleaner",
      hourly_rate: staff.hourlyRate || 20,
      email: staff.email || null,
      status: "active",
      team_scope: "commercial",
      active: true,
      notes: staff.phone ? `Tel: ${staff.phone}. ${staff.notes || ""}` : staff.notes || "Creado vía Copiloto IA",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      const { data, error } = await supabase
        .from("staff_members")
        .insert(staffData)
        .select()
        .single();

      if (!error && data) {
        return {
          success: true,
          message: `Personal añadido exitosamente: ${staff.name} ($${staff.hourlyRate || 20}/hr) como ${staff.role}.`,
          data,
        };
      }
    }

    // LocalStorage fallback
    const existingStr = localStorage.getItem("pristine_staff_members") || "[]";
    const existing = JSON.parse(existingStr);
    const newStaff = { id: `staff-${Date.now()}`, ...staffData };
    existing.unshift(newStaff);
    localStorage.setItem("pristine_staff_members", JSON.stringify(existing));

    return {
      success: true,
      message: `Personal añadido al sistema: ${staff.name} ($${staff.hourlyRate || 20}/hr).`,
      data: newStaff,
    };
  } catch (err: any) {
    console.error("Error adding staff:", err);
    return {
      success: false,
      message: `No se pudo añadir al personal: ${err.message || String(err)}`,
      error: err.message,
    };
  }
}

/**
 * Apply creating a new commercial account from a quote or prompt
 */
export async function applyCreateCommercialAccountAction(
  quote: NonNullable<SopCopilotResponse["commercialQuote"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();

    const accountName = quote.clientName || "Nueva Cuenta Comercial";
    const accountData = {
      name: accountName,
      city: quote.city || "Orange County",
      pricing_model: "Monthly",
      revenue: quote.suggestedMonthlyPrice,
      cost: quote.estimatedCleanerCost,
      hours: quote.estimatedHoursPerVisit,
      frequency: quote.frequency || "Weekly",
      has_supplies: false,
      has_keys: false,
      supplies_notes: `Cotización IA: ${quote.squareFeet || 0} sq ft, ${quote.bathrooms || 0} baños. Margen: ${quote.profitMarginPct.toFixed(1)}%`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      const { data, error } = await supabase
        .from("commercial_accounts")
        .insert(accountData)
        .select()
        .single();

      if (!error && data) {
        return {
          success: true,
          message: `Cuenta creada exitosamente: ${accountName} ($${quote.suggestedMonthlyPrice}/mes, Margen: ${quote.profitMarginPct.toFixed(1)}%).`,
          data,
        };
      }
    }

    const existingStr = localStorage.getItem("pristine_commercial_accounts") || "[]";
    const existing = JSON.parse(existingStr);
    const newAcc = { id: `acc-${Date.now()}`, ...accountData };
    existing.unshift(newAcc);
    localStorage.setItem("pristine_commercial_accounts", JSON.stringify(existing));

    return {
      success: true,
      message: `Cuenta comercial creada en el sistema: ${accountName} ($${quote.suggestedMonthlyPrice}/mes).`,
      data: newAcc,
    };
  } catch (err: any) {
    console.error("Error creating commercial account:", err);
    return {
      success: false,
      message: `No se pudo crear la cuenta comercial: ${err.message || String(err)}`,
      error: err.message,
    };
  }
}

/**
 * Apply ingesting a schedule parsed from a CleanGuru (or similar) screenshot.
 * Creates or updates the commercial account with schedule details and structured access instructions.
 */
export async function applyIngestScheduleAction(
  schedule: NonNullable<SopCopilotResponse["ingestedSchedule"]>
): Promise<SopActionResult> {
  const accountName = schedule.clientName || schedule.buildingName || "Nueva Cuenta";

  // Build structured notes from access instructions
  const ai = schedule.accessInstructions;
  const accessParts: string[] = [];
  if (ai?.buildingType) accessParts.push(`Tipo: ${ai.buildingType}`);
  if (ai?.suite) accessParts.push(`Suite: ${ai.suite}`);
  if (ai?.floor) accessParts.push(`Piso: ${ai.floor}`);
  if (ai?.elevator) accessParts.push(`Elevador: Sí${ai.elevatorNotes ? ` (${ai.elevatorNotes})` : ""}`);
  if (ai?.parking) accessParts.push(`Estacionamiento: ${ai.parking}`);
  if (ai?.accessCode) accessParts.push(`Código: ${ai.accessCode}`);
  if (ai?.otherNotes) accessParts.push(ai.otherNotes);
  const accessText = accessParts.join(" | ");

  const notes = [
    schedule.template ? `Plantilla: ${schedule.template}` : null,
    schedule.recurringRule ? `Recurrencia: ${schedule.recurringRule}` : null,
    schedule.startDate ? `Inicio: ${schedule.startDate}` : null,
    schedule.assignedCleaner ? `Cleaner: ${schedule.assignedCleaner}` : null,
    accessText || null,
    schedule.internalNotes ? `Notas: ${schedule.internalNotes}` : null,
  ].filter(Boolean).join("\n");

  // Use the correct commercial_accounts schema
  const accountData = {
    name: accountName,
    city: schedule.city || "Orange County",
    pricing_model: "per Service",
    cleaner_name: schedule.assignedCleaner || null,
    hours: schedule.budgetHours || null,
    frequency: schedule.frequency || "Monthly",
    has_supplies: false,
    has_keys: false,
    supplies_notes: notes || null,
    source_sheet: "CleanGuru Import",
    updated_at: new Date().toISOString(),
  };

  const successMsg = `✅ "${accountName}" guardado: ${schedule.recurringRule || schedule.frequency || ""}, ${schedule.scheduledTime || ""}${schedule.endTime ? `–${schedule.endTime}` : ""}, cleaner: ${schedule.assignedCleaner || "sin asignar"}.`;

  // 1. Try Supabase
  try {
    const supabase = createClient();

    // Check if account already exists
    const { data: existing, error: findErr } = await supabase
      .from("commercial_accounts")
      .select("id")
      .ilike("name", `%${accountName}%`)
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.warn("[IngestSchedule] Supabase find error:", findErr.message);
    }

    if (existing?.id) {
      const { data, error: updateErr } = await supabase
        .from("commercial_accounts")
        .update(accountData)
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        console.warn("[IngestSchedule] Supabase update error:", updateErr.message);
      } else if (data) {
        return { success: true, message: successMsg, data };
      }
    } else {
      const { data, error: insertErr } = await supabase
        .from("commercial_accounts")
        .insert({ ...accountData, revenue: null, cost: null, created_at: new Date().toISOString() })
        .select()
        .single();

      if (insertErr) {
        console.warn("[IngestSchedule] Supabase insert error:", insertErr.message);
      } else if (data) {
        return { success: true, message: successMsg, data };
      }
    }
  } catch (supabaseErr: any) {
    console.warn("[IngestSchedule] Supabase exception:", supabaseErr?.message);
  }

  // 2. Always-working localStorage fallback
  try {
    const key = "pristine_commercial_accounts";
    const existingStr = localStorage.getItem(key) || "[]";
    const existingList: any[] = JSON.parse(existingStr);

    // Avoid duplicates: remove existing entry with same name if any
    const filtered = existingList.filter(
      (e: any) => !e.name?.toLowerCase().includes(accountName.toLowerCase())
    );

    const newEntry = {
      id: `acc-${Date.now()}`,
      ...accountData,
      revenue: null,
      cost: null,
      created_at: new Date().toISOString(),
      _source: "cleanguru_image_import",
    };
    filtered.unshift(newEntry);
    localStorage.setItem(key, JSON.stringify(filtered));

    return {
      success: true,
      message: successMsg + " (guardado localmente)",
      data: newEntry,
    };
  } catch (lsErr: any) {
    console.error("[IngestSchedule] localStorage error:", lsErr?.message);
    return {
      success: false,
      message: `No se pudo guardar el schedule: ${lsErr?.message || "error desconocido"}`,
      error: lsErr?.message,
    };
  }
}

/**
 * Apply operational / SOP modifications (updating account hours, days, cleaner assignments, pricing)
 */
export async function applySopModificationsAction(
  modifications: NonNullable<SopCopilotResponse["sopModifications"]>
): Promise<SopActionResult> {
  if (!modifications || modifications.length === 0) {
    return { success: true, message: "No se requirieron modificaciones operativas." };
  }

  const results: string[] = [];
  try {
    const supabase = createClient();

    for (const mod of modifications) {
      if (!mod.accountName) continue;

      // Detect cleaner mass unassignment (e.g. "Todas las cuentas de Susana", "Cuentas de Susana", or direct cleaner name)
      const cleanerBatchMatch = mod.accountName.match(/(?:todas\s+las\s+cuentas\s+de|cuentas\s+de)\s+([A-Za-z\s]+)/i);
      const isKnownCleaner = ["susana", "susana bautista", "veronica", "veronica ladinos", "sandra", "sandra hernandez", "juan romero", "luz uribe", "maria lopez", "emmi guerra", "lucia portillo", "kassandra valentin"].includes(mod.accountName.toLowerCase().trim());
      const batchCleanerName = cleanerBatchMatch ? cleanerBatchMatch[1].trim() : (isKnownCleaner ? mod.accountName.trim() : null);

      if (batchCleanerName) {
        const cleanerNorm = batchCleanerName.toLowerCase().trim();
        const substituteCleaner = mod.cleanerName && !mod.cleanerName.toLowerCase().includes("sin asignar") && !mod.cleanerName.toLowerCase().includes("unassigned") && !mod.cleanerName.toLowerCase().includes("pendiente") ? mod.cleanerName : "Unassigned";

        if (supabase) {
          try {
            await supabase.from("staff_members").update({ active: false, status: "inactive", updated_at: new Date().toISOString() }).ilike("name", `%${cleanerNorm}%`);
          } catch {}

          const { data: matchedAccs } = await supabase
            .from("commercial_accounts")
            .select("id, name, cleaner_name, hours")
            .ilike("cleaner_name", `%${cleanerNorm}%`);

          for (const a of matchedAccs || []) {
            await supabase.from("commercial_accounts").update({ cleaner_name: substituteCleaner, updated_at: new Date().toISOString() }).eq("id", a.id);
            await supabase.from("commercial_account_schedule_rules").update({ assigned_cleaner_name: substituteCleaner, updated_at: new Date().toISOString() }).eq("commercial_account_id", a.id);
            results.push(`"${a.name}": desvinculada de ${batchCleanerName} -> "${substituteCleaner}" (turnos en schedule activos).`);
          }

          await supabase
            .from("commercial_account_schedule_rules")
            .update({ assigned_cleaner_name: substituteCleaner, updated_at: new Date().toISOString() })
            .ilike("assigned_cleaner_name", `%${cleanerNorm}%`);
        }

        const matchingImported = importedCommercialAccounts.filter(
          (a) =>
            (a.cleaner_name || "").toLowerCase().includes(cleanerNorm) ||
            (a.schedule_rules || []).some((r: any) => (r.assigned_cleaner_name || "").toLowerCase().includes(cleanerNorm))
        );
        for (const imp of matchingImported) {
          results.push(`"${imp.name}": turnos desvinculados de ${batchCleanerName} y mantenidos en el schedule como "${substituteCleaner}".`);
        }

        if (typeof window !== "undefined") {
          try {
            const key = "pristine_cleaner_unassignments";
            const raw = localStorage.getItem(key) || "{}";
            const unassignments = JSON.parse(raw);
            unassignments[cleanerNorm] = substituteCleaner;
            if (cleanerNorm.includes("susana")) {
              unassignments["susana"] = substituteCleaner;
              unassignments["susana bautista"] = substituteCleaner;
            }
            localStorage.setItem(key, JSON.stringify(unassignments));

            const staffKey = "pristine_deactivated_staff";
            const rawStaff = localStorage.getItem(staffKey) || "[]";
            const staffList = JSON.parse(rawStaff);
            if (!staffList.includes(cleanerNorm)) staffList.push(cleanerNorm);
            localStorage.setItem(staffKey, JSON.stringify(staffList));
          } catch {}
        }

        continue;
      }

      // Detect date cutoff if present
      let cutoffDate: string | null = mod.contractEnd || mod.effectiveUntil || mod.effectiveDate || null;
      if (!cutoffDate && mod.notes) {
        const isoMatch = mod.notes.match(/\b\d{4}-\d{2}-\d{2}\b/);
        if (isoMatch) {
          cutoffDate = isoMatch[0];
        } else if (mod.notes.toLowerCase().includes("31 de agosto") || mod.notes.toLowerCase().includes("31 ago")) {
          cutoffDate = "2026-08-31";
        } else if (mod.notes.toLowerCase().includes("1 de sep") || mod.notes.toLowerCase().includes("1 sep")) {
          cutoffDate = "2026-08-31";
        }
      }

      // Check if this is a deactivation / deletion from schedule
      const isDeactivation =
        mod.action === "delete_account" ||
        mod.status === "inactive" ||
        mod.status === "cancelled" ||
        mod.newHours === 0 ||
        (mod.notes && /eliminad[ao]|cancelad[ao]|desactivad[ao]/i.test(mod.notes));

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (mod.cleanerName !== undefined) updateData.cleaner_name = mod.cleanerName;
      if (typeof mod.newHours === "number") updateData.hours = mod.newHours;
      if (typeof mod.newPricing === "number") updateData.revenue = mod.newPricing;
      if (typeof mod.newCleanerCost === "number") updateData.cost = mod.newCleanerCost;
      if (mod.notes) updateData.supplies_notes = mod.notes;
      if (isDeactivation) {
        updateData.contract_end = cutoffDate || "2026-08-31";
        updateData.hours = 0;
      }

      // Save to localStorage deactivated list for instant client-side isolation
      if (typeof window !== "undefined") {
        try {
          const key = "pristine_deactivated_accounts";
          const raw = localStorage.getItem(key) || "[]";
          const list: any[] = JSON.parse(raw);
          const nameNorm = mod.accountName.toLowerCase().trim();
          const existingIdx = list.findIndex(
            (item: any) => (typeof item === "string" ? item : item.name || "").toLowerCase().trim() === nameNorm
          );
          const entry = {
            name: mod.accountName,
            contractEnd: cutoffDate || "2026-08-31",
            deactivatedAt: new Date().toISOString(),
          };
          if (isDeactivation) {
            if (existingIdx >= 0) list[existingIdx] = entry;
            else list.push(entry);
          } else if (existingIdx >= 0) {
            list.splice(existingIdx, 1);
          }
          localStorage.setItem(key, JSON.stringify(list));
        } catch {}
      }

      let appliedSupabase = false;
      let accountId: string | null = null;
      let accountName: string = mod.accountName;

      if (supabase) {
        const { data: accounts } = await supabase
          .from("commercial_accounts")
          .select("id, name, supplies_notes, hours, contract_end")
          .ilike("name", `%${mod.accountName}%`)
          .limit(1);

        if (accounts && accounts.length > 0) {
          accountId = accounts[0].id;
          accountName = accounts[0].name;
        } else {
          // If not in commercial_accounts yet, check importedCommercialAccounts and materialize
          const imp = importedCommercialAccounts.find(
            (a) =>
              a.name.toLowerCase().trim() === mod.accountName!.toLowerCase().trim() ||
              a.name.toLowerCase().includes(mod.accountName!.toLowerCase().trim()) ||
              mod.accountName!.toLowerCase().trim().includes(a.name.toLowerCase().trim())
          );
          if (imp) {
            const effectiveEnd = isDeactivation ? (cutoffDate || "2026-08-31") : imp.contract_end;
            const { data: inserted } = await supabase
              .from("commercial_accounts")
              .insert({
                name: imp.name,
                city: imp.city || "Orange County",
                cleaner_name: mod.cleanerName || imp.cleaner_name || null,
                hours: isDeactivation ? 0 : (mod.newHours !== undefined ? mod.newHours : Number(imp.hours) || 0),
                frequency: imp.frequency,
                revenue: mod.newPricing !== undefined ? mod.newPricing : imp.revenue,
                cost: mod.newCleanerCost !== undefined ? mod.newCleanerCost : imp.cost,
                pricing_model: imp.pricing_model,
                contract_start: imp.contract_start || null,
                contract_end: effectiveEnd || null,
                supplies_notes: mod.notes ? `${imp.supplies_notes || ""}; ${mod.notes}` : imp.supplies_notes,
              })
              .select()
              .single();

            if (inserted) {
              accountId = inserted.id;
              accountName = inserted.name;
            }
          }
        }

        if (accountId) {
          // Update commercial_accounts
          const safeUpdate: Record<string, any> = { ...updateData };
          delete safeUpdate.status; // status is not a column in commercial_accounts schema, avoid error
          delete safeUpdate.active;

          await supabase
            .from("commercial_accounts")
            .update(safeUpdate)
            .eq("id", accountId);

          // Update commercial_account_schedule_rules
          if (isDeactivation) {
            const effectiveEnd = cutoffDate || "2026-08-31";
            await supabase
              .from("commercial_account_schedule_rules")
              .update({
                active: false,
                effective_until: effectiveEnd,
                effective_end_date: effectiveEnd,
                updated_at: new Date().toISOString(),
              })
              .eq("commercial_account_id", accountId);

            appliedSupabase = true;
            results.push(`"${accountName}" eliminada del schedule comercial a partir de ${effectiveEnd}.`);
          } else if (mod.action === "delete_rule" && mod.daysToDelete?.length) {
            for (const d of mod.daysToDelete) {
              await supabase
                .from("commercial_account_schedule_rules")
                .update({ active: false, updated_at: new Date().toISOString() })
                .eq("commercial_account_id", accountId)
                .eq("day_of_week", d);
            }
            appliedSupabase = true;
            results.push(`Regla(s) de días eliminadas para "${accountName}".`);
          } else {
            const ruleUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
            if (typeof mod.newHours === "number") {
              ruleUpdates.paid_hours = mod.newHours;
              ruleUpdates.scheduled_hours = mod.newHours;
            }
            if (mod.cleanerName) {
              ruleUpdates.assigned_cleaner_name = mod.cleanerName;
            }
            if (Object.keys(ruleUpdates).length > 1) {
              await supabase
                .from("commercial_account_schedule_rules")
                .update(ruleUpdates)
                .eq("commercial_account_id", accountId);
            }
            appliedSupabase = true;
            results.push(
              `Modificado "${accountName}": ${typeof mod.newHours === "number" ? `${mod.newHours} hrs ` : ""}${
                mod.cleanerName ? `(Cleaner: ${mod.cleanerName})` : ""
              }`
            );
          }
        }
      }

      // Fallback/resilience in localStorage
      if (typeof window !== "undefined") {
        try {
          const key = "pristine_commercial_accounts";
          const existingStr = localStorage.getItem(key) || "[]";
          const existingList: any[] = JSON.parse(existingStr);
          const idx = existingList.findIndex(
            (e: any) => e.name?.toLowerCase().includes(mod.accountName!.toLowerCase())
          );

          if (idx !== -1) {
            existingList[idx] = { ...existingList[idx], ...updateData };
            localStorage.setItem(key, JSON.stringify(existingList));
            if (!appliedSupabase) {
              results.push(`Modificado "${existingList[idx].name}" en almacenamiento local.`);
            }
          }
        } catch {}
      }
    }

    // Broadcast refresh event so all schedule/operations views update automatically
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    }

    return {
      success: true,
      message: results.length > 0
        ? `Modificaciones operativas aplicadas con éxito:\n${results.join("\n")}`
        : "Se procesaron las modificaciones operativas.",
    };
  } catch (err: any) {
    console.error("Error applying SOP modifications:", err);
    return {
      success: false,
      message: `Error al aplicar modificaciones: ${err.message || String(err)}`,
      error: err.message,
    };
  }
}

export async function applyStaffModificationsAction(
  modifications: NonNullable<SopCopilotResponse["staffModifications"]>
): Promise<SopActionResult> {
  if (!modifications || modifications.length === 0) {
    return { success: true, message: "No se requirieron modificaciones de personal." };
  }

  const results: string[] = [];
  try {
    const supabase = createClient();

    for (const smod of modifications) {
      if (!smod.cleanerName) continue;
      const cname = smod.cleanerName.trim();
      const cleanerNorm = cname.toLowerCase().trim();
      const replacement = smod.replacementCleaner || "Unassigned";

      if (smod.action === "deactivate") {
        if (supabase) {
          try {
            await supabase
              .from("staff_members")
              .update({ active: false, status: "inactive", updated_at: new Date().toISOString() })
              .ilike("name", `%${cleanerNorm}%`);
          } catch {}

          // Reassign all commercial accounts belonging to this cleaner
          const { data: dbAccs } = await supabase
            .from("commercial_accounts")
            .select("id, name")
            .ilike("cleaner_name", `%${cleanerNorm}%`);

          for (const a of dbAccs || []) {
            await supabase.from("commercial_accounts").update({ cleaner_name: replacement, updated_at: new Date().toISOString() }).eq("id", a.id);
            await supabase.from("commercial_account_schedule_rules").update({ assigned_cleaner_name: replacement, updated_at: new Date().toISOString() }).eq("commercial_account_id", a.id);
            results.push(`"${a.name}": desvinculada de ${cname} -> "${replacement}" (turnos en schedule mantenidos).`);
          }

          await supabase
            .from("commercial_account_schedule_rules")
            .update({ assigned_cleaner_name: replacement, updated_at: new Date().toISOString() })
            .ilike("assigned_cleaner_name", `%${cleanerNorm}%`);
        }

        // Also check importedCommercialAccounts
        const matchingImported = importedCommercialAccounts.filter(
          (a) =>
            (a.cleaner_name || "").toLowerCase().includes(cleanerNorm) ||
            (a.schedule_rules || []).some((r: any) => (r.assigned_cleaner_name || "").toLowerCase().includes(cleanerNorm))
        );
        for (const imp of matchingImported) {
          results.push(`"${imp.name}": desvinculada de ${cname} y mantenida activa en el schedule como "${replacement}".`);
        }

        if (typeof window !== "undefined") {
          try {
            const key = "pristine_cleaner_unassignments";
            const raw = localStorage.getItem(key) || "{}";
            const unassignments = JSON.parse(raw);
            unassignments[cleanerNorm] = replacement;
            if (cleanerNorm.includes("susana")) {
              unassignments["susana"] = replacement;
              unassignments["susana bautista"] = replacement;
            }
            localStorage.setItem(key, JSON.stringify(unassignments));

            const staffKey = "pristine_deactivated_staff";
            const rawStaff = localStorage.getItem(staffKey) || "[]";
            const staffList = JSON.parse(rawStaff);
            if (!staffList.includes(cleanerNorm)) staffList.push(cleanerNorm);
            localStorage.setItem(staffKey, JSON.stringify(staffList));
          } catch {}
        }

        results.push(`Baja procesada para ${cname} (efectiva: ${smod.effectiveDate || "31 de agosto"}). Todas sus cuentas se mantienen en el schedule pendientes de reasignación.`);
      } else if (smod.action === "add") {
        if (supabase) {
          try {
            await supabase.from("staff_members").insert({
              name: cname,
              role: smod.role || "cleaner",
              active: true,
              status: "active",
            });
            results.push(`Personal añadido: ${cname} (${smod.role || "cleaner"})`);
          } catch {}
        }
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    }

    return {
      success: true,
      message: results.length > 0 ? results.join("\n") : "Modificaciones de personal aplicadas con éxito.",
    };
  } catch (err: any) {
    console.error("Error applying staff modifications:", err);
    return {
      success: false,
      message: `Error al aplicar modificaciones de personal: ${err.message || String(err)}`,
      error: err.message,
    };
  }
}

/**
 * Apply Event Bookings for As-Needed or Single Event Commercial Accounts (e.g. The Harper, Weddings)
 */
export async function applyEventBookingsAction(
  events: NonNullable<SopCopilotResponse["eventBookings"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();
    if (!events || events.length === 0) {
      return { success: false, message: "No hay eventos para registrar." };
    }

    const { data: accounts } = await supabase
      .from("commercial_accounts")
      .select("id, name");

    let count = 0;
    const insertedDates: string[] = [];

    for (const evt of events) {
      const match = (accounts || []).find((a: any) =>
        a.name.toLowerCase().includes(evt.accountName.toLowerCase().trim()) ||
        evt.accountName.toLowerCase().includes(a.name.toLowerCase().trim())
      );

      const accountId = match?.id || null;
      const accountName = match?.name || evt.accountName;

      const { error } = await supabase
        .from("commercial_hours_entries")
        .upsert(
          {
            account_id: accountId,
            account_name: accountName,
            work_date: evt.date,
            team_name: evt.cleanerName || "Unassigned",
            scheduled_hours: evt.hours || 5,
            completed_hours: evt.hours || 5,
            verified_hours: evt.hours || 5,
            status: "completed",
            verified: true,
            manual_entry: true,
            notes: evt.notes || `Evento registrado por Copiloto IA (${evt.cleanerName || "Sin asignar"})`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "account_id,work_date" }
        );

      if (!error) {
        count++;
        insertedDates.push(`${accountName} (${evt.date})`);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    }

    return {
      success: true,
      message: `Se registraron ${count} evento(s) de limpieza exitosamente:\n${insertedDates.join(", ")}`,
      data: { count, events },
    };
  } catch (err: any) {
    return { success: false, message: `Error al registrar eventos: ${err.message}` };
  }
}

/**
 * Apply Batch QC Inspection Schedules to qc_inspection_schedules
 */
export async function applyQcScheduleBatchAction(
  schedules: NonNullable<SopCopilotResponse["qcScheduleBatch"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();
    if (!schedules || schedules.length === 0) {
      return { success: false, message: "No hay inspecciones de QC para programar." };
    }

    const { data: existingInspectors } = await supabase
      .from("qc_inspectors")
      .select("*");

    let count = 0;
    const details: string[] = [];

    for (const item of schedules) {
      const normInsp = item.inspectorName.toLowerCase().trim();
      let inspector = (existingInspectors || []).find((i: any) =>
        i.name.toLowerCase().includes(normInsp) || normInsp.includes(i.name.toLowerCase())
      );

      if (!inspector) {
        const isAna = normInsp.includes("ana");
        const { data: newInsp } = await supabase
          .from("qc_inspectors")
          .insert({
            name: item.inspectorName,
            email: `${normInsp.replace(/[^a-z0-9]+/g, ".")}@pristine.local`,
            color: isAna ? "#6366f1" : "#10b981",
            status: "active",
            notes: "Creado por Copiloto IA",
          })
          .select()
          .single();
        if (newInsp) inspector = newInsp;
      }

      const inspectorId = inspector?.id;
      if (!inspectorId) continue;

      await supabase
        .from("qc_inspection_schedules")
        .delete()
        .eq("account_name", item.accountName)
        .eq("specific_date", item.date);

      const { error } = await supabase.from("qc_inspection_schedules").insert({
        inspector_id: inspectorId,
        account_name: item.accountName,
        frequency_type: "one_off",
        specific_date: item.date,
        scheduled_time: item.time || "10:00:00",
        duration_minutes: item.durationMinutes || 60,
        notes: item.notes || `${item.accountName} QC`,
        active: true,
      });

      if (!error) {
        count++;
        details.push(`${item.accountName} [${item.date} ${item.time || ""}] → ${inspector.name}`);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    }

    return {
      success: true,
      message: `Se programaron ${count} inspecciones de Control de Calidad exitosamente:\n${details.join("\n")}`,
      data: { count },
    };
  } catch (err: any) {
    return { success: false, message: `Error al programar inspecciones de QC: ${err.message}` };
  }
}

/**
 * Deduplicate and Clean Staff Directory in Database
 */
export async function applyCleanupStaffDuplicatesAction(
  options?: NonNullable<SopCopilotResponse["cleanupStaffDuplicates"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();
    const { data: staff, error } = await supabase
      .from("staff_members")
      .select("*")
      .order("name");

    if (error || !staff) {
      return { success: false, message: `No se pudo leer el personal: ${error?.message}` };
    }

    const excluded = (options?.excludedCleaners || []).map((e) => e.toLowerCase().trim());
    let deletedCount = 0;

    for (const s of staff) {
      const norm = s.name.trim().toLowerCase();
      if (excluded.some((ex) => norm.includes(ex)) || norm.includes("john ivanpal")) {
        await supabase.from("staff_members").delete().eq("id", s.id);
        deletedCount++;
      }
    }

    const byName = new Map<string, any[]>();
    for (const s of staff) {
      const norm = s.name.trim().toLowerCase();
      if (norm.includes("john ivanpal") || excluded.some((ex) => norm.includes(ex))) continue;
      if (!byName.has(norm)) byName.set(norm, []);
      byName.get(norm)!.push(s);
    }

    for (const [, rows] of byName.entries()) {
      if (rows.length > 1) {
        rows.sort((a, b) => {
          const aScore = (a.active ? 10 : 0) + (a.notes?.includes("Tel") ? 20 : 0) + (a.team_scope === "mixed" ? 5 : 0);
          const bScore = (b.active ? 10 : 0) + (b.notes?.includes("Tel") ? 20 : 0) + (b.team_scope === "mixed" ? 5 : 0);
          return bScore - aScore;
        });
        const dups = rows.slice(1);
        for (const dup of dups) {
          const { error: delErr } = await supabase.from("staff_members").delete().eq("id", dup.id);
          if (!delErr) deletedCount++;
        }
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    }

    return {
      success: true,
      message: `Limpieza de personal completada. Se eliminaron ${deletedCount} registros duplicados o no requeridos.`,
      data: { deletedCount },
    };
  } catch (err: any) {
    return { success: false, message: `Error en la limpieza de personal: ${err.message}` };
  }
}

/**
 * Update Commercial Account Financials and Pricing Models
 */
export async function applyUpdateAccountFinancialsAction(
  updates: NonNullable<SopCopilotResponse["updateAccountFinancials"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();
    if (!updates || updates.length === 0) {
      return { success: false, message: "No hay finanzas para actualizar." };
    }

    let updatedCount = 0;
    const messages: string[] = [];

    for (const upd of updates) {
      const payload: any = { updated_at: new Date().toISOString() };
      if (upd.revenue !== undefined) payload.revenue = upd.revenue;
      if (upd.cost !== undefined) payload.cost = upd.cost;
      if (upd.pricingModel) payload.pricing_model = upd.pricingModel;
      if (upd.cleanerPayType) payload.cleaner_pay_type = upd.cleanerPayType;
      if (upd.cleanerRate !== undefined) payload.cleaner_hourly_rate = upd.cleanerRate;
      if (upd.frequency) payload.frequency = upd.frequency;

      const { data, error } = await supabase
        .from("commercial_accounts")
        .update(payload)
        .ilike("name", `%${upd.accountName}%`)
        .select("name, revenue, cost, pricing_model");

      if (!error && data && data.length > 0) {
        updatedCount++;
        messages.push(`${data[0].name}: Rev $${data[0].revenue}, Costo $${data[0].cost} (${data[0].pricing_model})`);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    }

    return {
      success: true,
      message: `Finanzas actualizadas para ${updatedCount} cuenta(s):\n${messages.join("\n")}`,
      data: { updatedCount },
    };
  } catch (err: any) {
    return { success: false, message: `Error al actualizar finanzas: ${err.message}` };
  }
}

