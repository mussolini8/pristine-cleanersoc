import { createClient } from "@/lib/supabase/client";
import type { SopCopilotResponse, UniversalMutation } from "@/lib/ai/gemini-client";
import { importedCommercialAccounts } from "@/lib/commercial-accounts-data";

export type SopActionResult = {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
};

/**
 * Resolves colloquial aliases to official commercial account names
 */
export function resolveCanonicalAccountName(name: string): string {
  if (!name) return name;
  const norm = name.toLowerCase().trim();
  if (norm.includes("field day") || norm.includes("field ai") || norm.includes("fiel ai") || norm.includes("fieldday")) {
    return "Field AI";
  }
  if (norm === "the harper" || norm === "harper" || norm.includes("harper wedding")) return "The Harper";
  if (norm.includes("kott")) return "Kott Koatings";
  if (norm.includes("ocss") || norm.includes("spine and sport") || norm.includes("orange county spine")) return "Orange County Spine and Sports Physicians";
  if (norm.includes("wren")) return "Wren Spa";
  if (norm.includes("lsg")) return "LSG Sky Chefs";
  if (norm.includes("miracle minds") || norm.includes("miracle mind")) return "Miracle Minds";
  if (norm.includes("moxi3 costa") || norm.includes("moxi 3 costa") || norm.includes("moxi costa") || norm.includes("moxi3 cm")) return "MOXI3 Costa Mesa";
  if (norm.includes("moxi3 dana") || norm.includes("moxi 3 dana") || norm.includes("moxi dana") || norm.includes("moxi3 dp")) return "MOXI3 Dana Point";
  if (norm.includes("university park") || norm.includes("univ park") || norm.includes("university dental")) return "University Park Dental";
  if (norm.includes("mama") || norm.includes("mamas")) return "Mama's Restaurant";
  if (norm.includes("swing easy") || norm.includes("swing golf")) return "Swing Easy Golf Club";
  if (norm.includes("green leaf") || norm.includes("greenleaf")) return "Green Leaf Botanicals";
  if (norm.includes("sierra")) return "Sierra Analytical";
  if (norm.includes("kush")) return "Kush Fine Art";
  if (norm.includes("posh pooch") || norm.includes("pooch")) return "Posh Pooch";
  if (norm.includes("renewable")) return "Renewable Farms";
  if (norm.includes("ilg irvine")) return "ILG Irvine Office";
  if (norm.includes("ilg corona")) return "ILG Corona Office";
  if (norm.includes("ilg westlake")) return "ILG Westlake";
  if (norm.includes("ilg valencia")) return "ILG Valencia Office";
  if (norm.includes("elevate aerial") || norm.includes("elevate hb")) return "Elevate Aerial HB";
  if (norm.includes("vntr")) return "VNTR Fitness";
  if (norm.includes("miwa")) return "MIWA Office";
  if (norm.includes("13demarzo") || norm.includes("13 de marzo")) return "13demarzo";
  if (norm.includes("globar")) return "GLOBAR Medspa";
  if (norm.includes("cornerstone")) return "Cornerstone Rehab";
  if (norm.includes("lifted")) return "Lifted Dentistry";
  if (norm.includes("macarthur") || norm.includes("mac arthur")) return "MacArthur Dental Arts";
  if (norm.includes("steripax")) return "Steripax";
  return name;
}

/**
 * Apply access updates (Lockbox, Alarm Codes, Special Cleaning Instructions)
 */
export async function applyAccessUpdateAction(
  update: NonNullable<SopCopilotResponse["accessUpdate"]> | NonNullable<SopCopilotResponse["accessUpdates"]>
): Promise<SopActionResult> {
  const updates = Array.isArray(update) ? update : [update];
  if (updates.length === 0) {
    return { success: false, message: "No se encontraron códigos de acceso para actualizar." };
  }

  const results: string[] = [];
  const supabase = createClient();

  for (const item of updates) {
    if (!item.accountName) continue;
    const canonicalName = resolveCanonicalAccountName(item.accountName);

    const codeParts: string[] = [];
    if (item.lockboxCode) codeParts.push(`Lockbox: ${item.lockboxCode}`);
    if (item.alarmCode) codeParts.push(`Alarm: ${item.alarmCode}`);
    if (item.gateCode) codeParts.push(`Gate: ${item.gateCode}`);
    if (item.keyLocation) codeParts.push(`Keys: ${item.keyLocation}`);
    if (item.specialInstructions) codeParts.push(`Instrucciones: ${item.specialInstructions}`);
    if (item.otherNotes && !codeParts.some((p) => item.otherNotes!.includes(p))) codeParts.push(item.otherNotes);
    const accessText = codeParts.join(" | ");

    if (supabase) {
      try {
        const { data: accounts } = await supabase
          .from("commercial_accounts")
          .select("id, name, supplies_notes")
          .ilike("name", `%${canonicalName}%`)
          .limit(1);

        if (accounts && accounts.length > 0) {
          const acc = accounts[0];
          const existingNotes = acc.supplies_notes || "";
          const newNotes = existingNotes.includes(accessText)
            ? existingNotes
            : existingNotes ? `${existingNotes}\n${accessText}` : accessText;

          await supabase
            .from("commercial_accounts")
            .update({
              supplies_notes: newNotes,
              has_keys: Boolean(item.lockboxCode || item.keyLocation || item.alarmCode),
              updated_at: new Date().toISOString(),
            })
            .eq("id", acc.id);
        }
      } catch (err) {
        console.warn("[applyAccessUpdateAction] Supabase error:", err);
      }
    }

    if (typeof window !== "undefined") {
      try {
        const key = "pristine_commercial_accounts";
        const existingStr = localStorage.getItem(key) || "[]";
        const existingList: any[] = JSON.parse(existingStr);
        const idx = existingList.findIndex(
          (e: any) => e.name?.toLowerCase().includes(canonicalName.toLowerCase())
        );

        if (idx !== -1) {
          const acc = existingList[idx];
          const existingNotes = acc.supplies_notes || "";
          const newNotes = existingNotes.includes(accessText)
            ? existingNotes
            : existingNotes ? `${existingNotes}\n${accessText}` : accessText;

          existingList[idx] = {
            ...acc,
            supplies_notes: newNotes,
            has_keys: true,
            updated_at: new Date().toISOString(),
          };
          localStorage.setItem(key, JSON.stringify(existingList));
        }

        const accessCodesKey = "pristine_access_codes";
        const rawCodes = localStorage.getItem(accessCodesKey) || "{}";
        const codesMap = JSON.parse(rawCodes);
        codesMap[canonicalName.toLowerCase()] = {
          accountName: canonicalName,
          lockboxCode: item.lockboxCode,
          alarmCode: item.alarmCode,
          gateCode: item.gateCode,
          specialInstructions: item.specialInstructions,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(accessCodesKey, JSON.stringify(codesMap));
      } catch {}
    }

    results.push(
      `"${canonicalName}": ${item.lockboxCode ? `Lockbox ${item.lockboxCode}` : ""}${
        item.alarmCode ? ` | Alarma ${item.alarmCode}` : ""
      }${item.specialInstructions ? ` | ${item.specialInstructions}` : ""}`
    );
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pristine:data-updated"));
  }

  return {
    success: true,
    message: `Códigos de acceso y notas actualizados con éxito:\n${results.join("\n")}`,
    data: updates,
  };
}

/**
 * Apply a work occurrence / shift replacement (e.g., Field AI on August 22nd by Susana and Veronica)
 */
export async function applyOccurrenceOverrideAction(
  override: NonNullable<SopCopilotResponse["occurrenceOverride"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();

    const targetAccountName = resolveCanonicalAccountName(override.accountName);

    // 1. Try to find the commercial account by name
    const { data: accounts, error: accErr } = await supabase
      .from("commercial_accounts")
      .select("id, name, user_id")
      .ilike("name", `%${targetAccountName}%`)
      .limit(1);

    const accountId = accounts && accounts.length > 0 ? accounts[0].id : null;
    const accountName = accounts && accounts.length > 0 ? accounts[0].name : targetAccountName;

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

      const canonicalAccName = resolveCanonicalAccountName(mod.accountName);

      // Check if this is a deactivation / deletion from schedule
      const isDeactivation =
        mod.action === "delete_account" ||
        mod.status === "inactive" ||
        mod.status === "cancelled" ||
        (mod.notes && /eliminad[ao]|cancelad[ao]|desactivad[ao]/i.test(mod.notes));

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (mod.cleanerName !== undefined) updateData.cleaner_name = mod.cleanerName;
      if (typeof mod.newHours === "number" && !isDeactivation) updateData.hours = mod.newHours;
      if (typeof mod.newPricing === "number") updateData.revenue = mod.newPricing;
      if (typeof mod.newCleanerCost === "number") updateData.cost = mod.newCleanerCost;
      if (typeof mod.ratePerService === "number") {
        updateData.rate_per_service = mod.ratePerService;
        updateData.cleaner_flat_rate = mod.ratePerService;
        updateData.cost = mod.ratePerService;
        updateData.cleaner_pay_type = "flat";
      }
      if (mod.frequency) updateData.frequency = mod.frequency;
      if (mod.city) updateData.city = mod.city;
      if (mod.newName) updateData.name = mod.newName;
      if (mod.pricingModel) updateData.pricing_model = mod.pricingModel;
      if (mod.paymentMethod) updateData.payment_method = mod.paymentMethod;
      if (mod.hasSupplies !== undefined) updateData.has_supplies = mod.hasSupplies;
      if (mod.hasKeys !== undefined) updateData.has_keys = mod.hasKeys;
      if (mod.suppliesNotes) updateData.supplies_notes = mod.suppliesNotes;
      if (mod.cleanerPayType) updateData.cleaner_pay_type = mod.cleanerPayType;
      if (mod.cleanerHourlyRate !== undefined) updateData.cleaner_hourly_rate = mod.cleanerHourlyRate;
      if (mod.cleanerFlatRate !== undefined) updateData.cleaner_flat_rate = mod.cleanerFlatRate;
      if (mod.lockboxCode || mod.alarmCode || mod.gateCode || mod.keyLocation) {
        updateData.has_keys = true;
      }
      if (mod.notes) updateData.supplies_notes = mod.notes;
      if (isDeactivation) {
        updateData.contract_end = cutoffDate || "2026-08-31";
      } else {
        if (mod.contractEnd !== undefined) {
          updateData.contract_end = mod.contractEnd;
        } else if (
          mod.anchorDate ||
          mod.effectiveDate ||
          mod.action === "activate_account" ||
          mod.action === "update_schedule" ||
          mod.action === "reschedule" ||
          mod.status === "active"
        ) {
          updateData.contract_end = null;
          if (mod.anchorDate || mod.effectiveDate) {
            updateData.contract_start = mod.anchorDate || mod.effectiveDate;
          }
        }
      }

      // Save to localStorage deactivated list for instant client-side isolation
      if (typeof window !== "undefined") {
        try {
          const key = "pristine_deactivated_accounts";
          const raw = localStorage.getItem(key) || "[]";
          const list: any[] = JSON.parse(raw);
          const nameNorm = canonicalAccName.toLowerCase().trim();
          const existingIdx = list.findIndex(
            (item: any) => (typeof item === "string" ? item : item.name || "").toLowerCase().trim() === nameNorm
          );
          const entry = {
            name: canonicalAccName,
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
      let accountName: string = canonicalAccName;

      if (supabase) {
        const { data: accounts } = await supabase
          .from("commercial_accounts")
          .select("id, name, supplies_notes, hours, contract_end")
          .or(`name.ilike.%${canonicalAccName}%,name.ilike.%${mod.accountName}%`)
          .limit(1);

        if (accounts && accounts.length > 0) {
          accountId = accounts[0].id;
          accountName = accounts[0].name;

          if (mod.action === "delete_permanently") {
            await supabase.from("commercial_account_schedule_rules").delete().eq("commercial_account_id", accountId);
            await supabase.from("commercial_accounts").delete().eq("id", accountId);
            appliedSupabase = true;
            results.push(`"${accountName}" fue eliminada permanentemente del sistema.`);
            continue;
          }
        } else {
          // If not in commercial_accounts yet, check importedCommercialAccounts or create brand new
          const imp = importedCommercialAccounts.find(
            (a) =>
              a.name.toLowerCase().trim() === canonicalAccName.toLowerCase().trim() ||
              a.name.toLowerCase().includes(canonicalAccName.toLowerCase().trim()) ||
              canonicalAccName.toLowerCase().trim().includes(a.name.toLowerCase().trim())
          );
          const effectiveEnd = isDeactivation
            ? (cutoffDate || "2026-08-31")
            : (mod.contractEnd || "2027-12-31");
          const effectiveStart = !isDeactivation
            ? (mod.anchorDate || mod.effectiveDate || mod.contractStart || imp?.contract_start || new Date().toISOString().split("T")[0])
            : (imp?.contract_start || null);
          const freq = mod.frequency || imp?.frequency || "Weekly";
          const { data: inserted } = await supabase
            .from("commercial_accounts")
            .insert({
              name: mod.newName || (imp ? imp.name : canonicalAccName),
              city: mod.city || imp?.city || "Orange County",
              cleaner_name: mod.cleanerName || imp?.cleaner_name || null,
              hours: mod.newHours !== undefined && !isDeactivation ? mod.newHours : Number(imp?.hours) || 2.5,
              frequency: freq,
              revenue: mod.newPricing !== undefined ? mod.newPricing : imp?.revenue || null,
              cost: mod.newCleanerCost !== undefined ? mod.newCleanerCost : imp?.cost || null,
              pricing_model: mod.pricingModel || imp?.pricing_model || "Monthly",
              payment_method: mod.paymentMethod || imp?.payment_method || "ACH",
              contract_start: effectiveStart,
              contract_end: effectiveEnd || null,
              has_supplies: mod.hasSupplies ?? imp?.has_supplies ?? false,
              has_keys: mod.hasKeys ?? imp?.has_keys ?? Boolean(mod.lockboxCode || mod.alarmCode),
              supplies_notes: mod.notes ? `${imp?.supplies_notes || ""}; ${mod.notes}` : (mod.suppliesNotes || imp?.supplies_notes || null),
              rate_per_service: mod.ratePerService ?? imp?.rate_per_service ?? null,
              cleaner_flat_rate: mod.cleanerFlatRate ?? mod.ratePerService ?? imp?.cleaner_flat_rate ?? null,
              cleaner_hourly_rate: mod.cleanerHourlyRate ?? (imp as any)?.cleaner_hourly_rate ?? null,
              cleaner_pay_type: mod.cleanerPayType ?? (imp as any)?.cleaner_pay_type ?? "hourly",
            })
            .select()
            .single();

          if (inserted) {
            accountId = inserted.id;
            accountName = inserted.name;
            results.push(`Cuenta "${accountName}" creada en la base de datos.`);
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
                active: true,
                effective_until: effectiveEnd,
                effective_end_date: effectiveEnd,
                updated_at: new Date().toISOString(),
              })
              .eq("commercial_account_id", accountId);

            // Clean up any future QC inspection schedules
            try {
              await supabase
                .from("qc_inspection_schedules")
                .delete()
                .ilike("account_name", `%${accountName}%`)
                .gte("specific_date", effectiveEnd);
            } catch {}

            // Clean up any future commercial hours entries
            try {
              await supabase
                .from("commercial_hours_entries")
                .delete()
                .ilike("account_name", `%${accountName}%`)
                .gt("work_date", effectiveEnd);
            } catch {}

            appliedSupabase = true;
            results.push(`"${accountName}" completó su ciclo con fecha final ${effectiveEnd}. Visitas previas preservadas y desprogramada a partir de septiembre.`);
          } else if (mod.action === "delete_rule" && mod.daysToDelete?.length) {
            for (const d of mod.daysToDelete) {
              await supabase
                .from("commercial_account_schedule_rules")
                .delete()
                .eq("commercial_account_id", accountId)
                .eq("day_of_week", d);
            }
            appliedSupabase = true;
            results.push(`Regla(s) de días eliminadas para "${accountName}".`);
          } else {
            const anchor = mod.anchorDate || mod.effectiveDate || null;
            const DAY_MAP: Record<string, number> = {
              domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
              jueves: 4, viernes: 5, sabado: 6, sábado: 6,
              sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
              sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
              lun: 1, mar: 2, mie: 3, mié: 3, jue: 4, vie: 5, sab: 6, sáb: 6, dom: 0,
            };
            let targetDays: number[] = [];
            if (mod.scheduleRules && mod.scheduleRules.length > 0) {
              targetDays = mod.scheduleRules.map((r) => r.dayOfWeek);
            } else if (mod.daysOfWeek && mod.daysOfWeek.length > 0) {
              targetDays = mod.daysOfWeek;
            } else {
              targetDays = (mod.newDays || [])
                .map((d) => DAY_MAP[d.toLowerCase().trim()])
                .filter((n) => typeof n === "number");
            }

            // Fallback 1: Derive day of week from anchorDate or effectiveDate
            if (targetDays.length === 0 && anchor) {
              const d = new Date(anchor + "T12:00:00");
              if (!isNaN(d.getTime())) {
                targetDays = [d.getDay()];
              }
            }

            // Fallback 2: Check importedCommercialAccounts schedule rules
            if (targetDays.length === 0) {
              const imp = importedCommercialAccounts.find(
                (a) =>
                  a.name.toLowerCase().trim() === canonicalAccName.toLowerCase().trim() ||
                  a.name.toLowerCase().includes(canonicalAccName.toLowerCase().trim()) ||
                  canonicalAccName.toLowerCase().trim().includes(a.name.toLowerCase().trim())
              );
              if (imp?.schedule_rules && imp.schedule_rules.length > 0) {
                targetDays = imp.schedule_rules.map((r: any) => Number(r.day_of_week)).filter((n: number) => !isNaN(n));
              }
            }

            // Fallback 3: Check existing DB rules for this account
            if (targetDays.length === 0) {
              const { data: dbRules } = await supabase
                .from("commercial_account_schedule_rules")
                .select("day_of_week")
                .eq("commercial_account_id", accountId);
              if (dbRules && dbRules.length > 0) {
                targetDays = dbRules.map((r: any) => Number(r.day_of_week)).filter((n: number) => !isNaN(n));
              }
            }

            // Fallback 4: Default to Monday (1)
            if (targetDays.length === 0) {
              targetDays = [1];
            }

            const isBiweekly =
              mod.frequency?.toLowerCase().includes("biweekly") ||
              mod.frequency?.toLowerCase().includes("2 weeks") ||
              mod.frequency?.toLowerCase().includes("cada 2 semanas") ||
              mod.frequency?.toLowerCase().includes("cada dos semanas") ||
              mod.frequencyInterval === 2;
            const freqType = isBiweekly ? "biweekly" : (mod.frequency?.toLowerCase().includes("monthly") ? "monthly" : "weekly");
            const freqInterval = isBiweekly ? 2 : 1;

            const defaultHours = typeof mod.newHours === "number" ? mod.newHours : (updateData.hours || 2.5);
            const defaultCleaner = mod.cleanerName || updateData.cleaner_name || "Sin asignar";

            // Map day_of_week -> custom scheduleRule if provided
            const ruleMap = new Map<number, { hours: number; cleanerName?: string; notes?: string }>();
            if (mod.scheduleRules && mod.scheduleRules.length > 0) {
              for (const r of mod.scheduleRules) {
                ruleMap.set(r.dayOfWeek, {
                  hours: r.hours,
                  cleanerName: r.cleanerName,
                  notes: r.notes,
                });
              }
            }

            // When specific targetDays are provided, purge obsolete rules for non-selected days!
            if (targetDays.length > 0) {
              await supabase
                .from("commercial_account_schedule_rules")
                .delete()
                .eq("commercial_account_id", accountId)
                .not("day_of_week", "in", `(${targetDays.join(",")})`);

              // Clean up unverified, non-manual entries on removed days
              try {
                const { data: existingEntries } = await supabase
                  .from("commercial_hours_entries")
                  .select("id, work_date, status, verified, manual_entry")
                  .eq("account_id", accountId)
                  .is("deleted_at", null);

                for (const entry of existingEntries || []) {
                  if (entry.manual_entry === false && !entry.verified && entry.status !== "paid" && entry.status !== "approved") {
                    const entryDate = new Date(entry.work_date + "T12:00:00");
                    if (!isNaN(entryDate.getTime())) {
                      if (!targetDays.includes(entryDate.getDay())) {
                        await supabase
                          .from("commercial_hours_entries")
                          .delete()
                          .eq("id", entry.id);
                      }
                    }
                  }
                }
              } catch (cleanupErr) {
                console.warn("Could not clean up obsolete commercial_hours_entries:", cleanupErr);
              }

              // Also purge from localStorage
              if (typeof window !== "undefined") {
                try {
                  const storedRaw = localStorage.getItem("pristine_commercial_hours_entries");
                  if (storedRaw) {
                    const storedList: any[] = JSON.parse(storedRaw);
                    const filtered = storedList.filter((e) => {
                      const matchesAccount = e.account_id === accountId || (accountName && e.account_name?.toLowerCase().includes(accountName.toLowerCase()));
                      if (!matchesAccount) return true;
                      if (e.manual_entry || e.verified || e.status === "paid" || e.status === "approved") return true;
                      const d = new Date(e.work_date + "T12:00:00");
                      return isNaN(d.getTime()) || targetDays.includes(d.getDay());
                    });
                    localStorage.setItem("pristine_commercial_hours_entries", JSON.stringify(filtered));
                  }
                } catch {}
              }
            }

            for (const day of targetDays) {
              const ruleConfig = ruleMap.get(day);
              const ruleHours = ruleConfig?.hours ?? defaultHours;
              const ruleCleaner = ruleConfig?.cleanerName ?? defaultCleaner;

              const { data: existingRule } = await supabase
                .from("commercial_account_schedule_rules")
                .select("id")
                .eq("commercial_account_id", accountId)
                .eq("day_of_week", day)
                .limit(1)
                .maybeSingle();

              if (existingRule?.id) {
                await supabase
                  .from("commercial_account_schedule_rules")
                  .update({
                    active: true,
                    paid_hours: ruleHours,
                    scheduled_hours: ruleHours,
                    assigned_cleaner_name: ruleCleaner,
                    anchor_date: anchor,
                    effective_start_date: anchor,
                    effective_from: anchor,
                    effective_until: null,
                    effective_end_date: null,
                    frequency_type: freqType,
                    frequency_interval: freqInterval,
                    notes: ruleConfig?.notes || null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", existingRule.id);
              } else {
                await supabase
                  .from("commercial_account_schedule_rules")
                  .insert({
                    commercial_account_id: accountId,
                    day_of_week: day,
                    paid_hours: ruleHours,
                    scheduled_hours: ruleHours,
                    assigned_cleaner_name: ruleCleaner,
                    active: true,
                    frequency_type: freqType,
                    frequency_interval: freqInterval,
                    anchor_date: anchor,
                    effective_start_date: anchor,
                    effective_from: anchor,
                    notes: ruleConfig?.notes || null,
                    created_at: new Date().toISOString(),
                  });
              }
            }

            // If variable hours per day were provided (e.g. scheduleRules), update account cost & hours in commercial_accounts!
            if (ruleMap.size > 0) {
              const uniqueRuleHours = new Set(Array.from(ruleMap.values()).map((r) => r.hours));
              if (uniqueRuleHours.size > 1) {
                const weeklyHours = Array.from(ruleMap.values()).reduce((sum, r) => sum + r.hours, 0);
                const hourlyRate = mod.cleanerHourlyRate || updateData.cleaner_hourly_rate || 18;
                const calculatedMonthlyCost = Number((weeklyHours * hourlyRate * 4.33).toFixed(2));
                await supabase
                  .from("commercial_accounts")
                  .update({
                    cost: mod.newCleanerCost ?? calculatedMonthlyCost,
                    rate_per_service: null,
                    cleaner_flat_rate: null,
                    cleaner_hourly_rate: hourlyRate,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", accountId);

                // Update updateData for local storage fallback consistency
                updateData.cost = mod.newCleanerCost ?? calculatedMonthlyCost;
                updateData.rate_per_service = null;
                updateData.cleaner_flat_rate = null;
              }
            }

            appliedSupabase = true;
            const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
            const daysFormatted = targetDays.map((d) => dayNames[d] || `Día ${d}`).join(", ");
            results.push(
              `Modificado "${accountName}": ${typeof mod.newHours === "number" ? `${mod.newHours} hrs ` : ""}${
                mod.ratePerService ? `($${mod.ratePerService}/serv) ` : ""
              }${mod.cleanerName ? `(Cleaner: ${mod.cleanerName}) ` : ""}${
                mod.frequency ? `[${mod.frequency}] ` : ""
              }[Días: ${daysFormatted}]${anchor ? ` (Inicio: ${anchor})` : ""}`
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

        // ── Sync last_qcc_date on commercial_accounts ──────────────
        // Find the account by name (fuzzy match) and update its last_qcc_date
        const normAccName = item.accountName.toLowerCase().trim();
        const { data: matchedAccounts } = await supabase
          .from("commercial_accounts")
          .select("id, name, last_qcc_date")
          .ilike("name", `%${normAccName.split(" ").slice(0, 2).join("%")}%`)
          .limit(5);

        if (matchedAccounts && matchedAccounts.length > 0) {
          // Pick the best match
          const best = matchedAccounts.find((a: any) =>
            a.name.toLowerCase().includes(normAccName) ||
            normAccName.includes(a.name.toLowerCase().substring(0, 6))
          ) ?? matchedAccounts[0];

          // Only update if the new date is more recent or not yet set
          const existingDate = best.last_qcc_date;
          const shouldUpdate = !existingDate || item.date > existingDate;
          if (shouldUpdate) {
            await supabase
              .from("commercial_accounts")
              .update({ last_qcc_date: item.date, updated_at: new Date().toISOString() })
              .eq("id", best.id);

            // Also patch the localStorage cache if available
            if (typeof window !== "undefined") {
              try {
                const key = "pristine_commercial_accounts";
                const stored = localStorage.getItem(key);
                if (stored) {
                  const cached: any[] = JSON.parse(stored);
                  const updated = cached.map((a: any) =>
                    a.id === best.id ? { ...a, last_qcc_date: item.date } : a
                  );
                  localStorage.setItem(key, JSON.stringify(updated));
                }
              } catch {}
            }
          }
        }
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
      window.dispatchEvent(new CustomEvent("commercial-accounts-updated"));
    }

    return {
      success: true,
      message: `Se registraron ${count} inspecciones de Control de Calidad y se actualizó la fecha de "Last QC Check" en las cuentas correspondientes:\n${details.join("\n")}`,
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

    // Local storage map for quick client-side lookup
    const localRateMap: Record<string, number> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("pristine_rate_per_service_map") || "{}";
        Object.assign(localRateMap, JSON.parse(raw));
      } catch {}
    }

    for (const upd of updates) {
      if (!upd.accountName) continue;
      const canonicalName = resolveCanonicalAccountName(upd.accountName);

      const payload: any = { updated_at: new Date().toISOString() };
      if (upd.revenue !== undefined) payload.revenue = upd.revenue;
      if (upd.cost !== undefined) payload.cost = upd.cost;
      if (upd.pricingModel) payload.pricing_model = upd.pricingModel;
      if (upd.cleanerPayType) payload.cleaner_pay_type = upd.cleanerPayType;
      if (upd.cleanerRate !== undefined) payload.cleaner_hourly_rate = upd.cleanerRate;
      if (upd.frequency) payload.frequency = upd.frequency;

      if (upd.hours !== undefined) payload.hours = upd.hours;
      if (upd.cleanerName) payload.cleaner_name = upd.cleanerName;
      if (upd.city) payload.city = upd.city;

      if (upd.ratePerService !== undefined && upd.ratePerService !== null) {
        payload.cleaner_flat_rate = upd.ratePerService;
        const normLower = canonicalName.toLowerCase();
        const isFixedFlat = normLower.includes("mama") || normLower.includes("green leaf");
        if (isFixedFlat) {
          payload.cleaner_pay_type = "flat";
        }
        if (payload.cost === undefined) {
          if (normLower.includes("steripax")) {
            // Regla Steripax: Horas trabajadas se calculan manualmente y en base a eso el costo total
            payload.cost = 3386.06;
          } else {
            // If cost was not explicitly specified, calculate monthly cost
            const visits = getVisitsPerMonth(upd.frequency || "Weekly");
            payload.cost = Number((upd.ratePerService * visits).toFixed(2));
          }
        }
        if (!payload.pricing_model) payload.pricing_model = "per Service";
        localRateMap[canonicalName.toLowerCase()] = upd.ratePerService;
      }

      let accountUpdatedInDb = false;

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("commercial_accounts")
            .update(payload)
            .ilike("name", `%${canonicalName}%`)
            .select("name, revenue, cost, pricing_model, cleaner_flat_rate, hours, cleaner_name");

          if (!error && data && data.length > 0) {
            accountUpdatedInDb = true;
            updatedCount++;
            const item = data[0];
            const rateMsg = upd.ratePerService !== undefined ? `Labor/Serv: $${upd.ratePerService}` : `Rev: $${item.revenue}, Costo: $${item.cost}`;
            const hrsMsg = upd.hours !== undefined ? `, ${upd.hours}h` : "";
            const clMsg = upd.cleanerName ? `, Cleaner: ${upd.cleanerName}` : "";
            messages.push(`${item.name} (${rateMsg}${hrsMsg}${clMsg})`);
          } else {
            // If not found in commercial_accounts table yet, materialize from importedCommercialAccounts
            const imp = importedCommercialAccounts.find(
              (a) => a.name.toLowerCase().includes(canonicalName.toLowerCase()) || canonicalName.toLowerCase().includes(a.name.toLowerCase())
            );
            if (imp) {
              const { data: inserted } = await supabase
                .from("commercial_accounts")
                .insert({
                  name: imp.name,
                  city: upd.city || imp.city || "Orange County",
                  cleaner_name: upd.cleanerName || imp.cleaner_name || null,
                  hours: upd.hours !== undefined ? upd.hours : (Number(imp.hours) || 2.5),
                  frequency: upd.frequency || imp.frequency || "Weekly",
                  revenue: upd.revenue !== undefined ? upd.revenue : imp.revenue,
                  cost: payload.cost !== undefined ? payload.cost : imp.cost,
                  cleaner_flat_rate: upd.ratePerService !== undefined ? upd.ratePerService : imp.rate_per_service,
                  pricing_model: upd.pricingModel || imp.pricing_model || "per Service",
                  cleaner_pay_type: payload.cleaner_pay_type || "hourly",
                  cleaner_hourly_rate: upd.cleanerRate !== undefined ? upd.cleanerRate : 18,
                  contract_start: imp.contract_start || null,
                  contract_end: imp.contract_end || "2027-12-31",
                })
                .select()
                .single();

              if (inserted) {
                accountUpdatedInDb = true;
                updatedCount++;
                messages.push(`${inserted.name} (Labor/Serv: $${upd.ratePerService || inserted.cost})`);
              }
            }
          }

          if (accountUpdatedInDb && (upd.cleanerName || upd.hours !== undefined)) {
            const ruleSyncPayload: Record<string, any> = { updated_at: new Date().toISOString() };
            if (upd.cleanerName) ruleSyncPayload.assigned_cleaner_name = upd.cleanerName;
            if (upd.hours !== undefined) {
              ruleSyncPayload.paid_hours = upd.hours;
              ruleSyncPayload.scheduled_hours = upd.hours;
            }
            const { data: matchedAccs } = await supabase
              .from("commercial_accounts")
              .select("id")
              .ilike("name", `%${canonicalName}%`);
            for (const ma of matchedAccs || []) {
              await supabase
                .from("commercial_account_schedule_rules")
                .update(ruleSyncPayload)
                .eq("commercial_account_id", ma.id);
            }
          }
        } catch (dbErr) {
          console.warn("[applyUpdateAccountFinancialsAction] Supabase error:", dbErr);
        }
      }

      // Also update in importedCommercialAccounts in-memory
      const impMatch = importedCommercialAccounts.find(
        (a) => a.name.toLowerCase().includes(canonicalName.toLowerCase()) || canonicalName.toLowerCase().includes(a.name.toLowerCase())
      );
      if (impMatch) {
        if (upd.ratePerService !== undefined) impMatch.rate_per_service = upd.ratePerService;
        if (upd.hours !== undefined) impMatch.hours = upd.hours;
        if (upd.cleanerName) impMatch.cleaner_name = upd.cleanerName;
        if (payload.cost !== undefined) impMatch.cost = payload.cost;
      }

      // Fallback/sync in localStorage
      if (typeof window !== "undefined") {
        try {
          const key = "pristine_commercial_accounts";
          const raw = localStorage.getItem(key) || "[]";
          const list: any[] = JSON.parse(raw);
          const idx = list.findIndex(
            (e: any) => e.name?.toLowerCase().includes(canonicalName.toLowerCase())
          );

          if (idx !== -1) {
            list[idx] = {
              ...list[idx],
              ...payload,
              rate_per_service: upd.ratePerService !== undefined ? upd.ratePerService : list[idx].rate_per_service,
            };
            localStorage.setItem(key, JSON.stringify(list));
            if (!accountUpdatedInDb) {
              updatedCount++;
              messages.push(`${list[idx].name} (Actualizado localmente: Labor/Serv $${upd.ratePerService})`);
            }
          } else {
            // Add new entry
            const newEntry = {
              id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: canonicalName,
              city: upd.city || impMatch?.city || "Orange County",
              cleaner_name: upd.cleanerName || impMatch?.cleaner_name || null,
              hours: upd.hours !== undefined ? upd.hours : (impMatch?.hours || 2.5),
              frequency: upd.frequency || impMatch?.frequency || "Weekly",
              revenue: upd.revenue || impMatch?.revenue || 0,
              cost: payload.cost || impMatch?.cost || 0,
              rate_per_service: upd.ratePerService,
              cleaner_flat_rate: upd.ratePerService,
              cleaner_pay_type: payload.cleaner_pay_type || "hourly",
              cleaner_hourly_rate: upd.cleanerRate || 18,
              pricing_model: upd.pricingModel || "per Service",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            list.unshift(newEntry);
            localStorage.setItem(key, JSON.stringify(list));
            if (!accountUpdatedInDb) {
              updatedCount++;
              messages.push(`${newEntry.name} (Creado localmente: Labor/Serv $${upd.ratePerService})`);
            }
          }
        } catch {}
      }
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pristine_rate_per_service_map", JSON.stringify(localRateMap));
      } catch {}
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
      window.dispatchEvent(new CustomEvent("commercial-accounts-updated"));
    }

    return {
      success: true,
      message: `Finanzas y Labor por Servicio actualizados para ${updatedCount} cuenta(s):\n${messages.join("\n")}`,
      data: { updatedCount },
    };
  } catch (err: any) {
    return { success: false, message: `Error al actualizar finanzas: ${err.message}` };
  }
}

function getVisitsPerMonth(frequency: string | null | undefined): number {
  if (!frequency) return 4.33;
  const f = frequency.toLowerCase();
  if (f.includes("7x") || f.includes("daily")) return 30.4;
  if (f.includes("6x")) return 26;
  if (f.includes("5x")) return 21.67;
  if (f.includes("4x")) return 17.33;
  if (f.includes("3x")) return 13;
  if (f.includes("2x") || f.includes("twice")) return 8.66;
  if (f.includes("biweekly") || f.includes("every 2 weeks") || f.includes("every 14 days")) return 2.17;
  if (f.includes("every 21 days") || f.includes("every 3 weeks")) return 1.44;
  if (f.includes("monthly") || f.includes("month on")) return 1;
  return 4.33;
}

/**
 * Apply bulk hourly rate updates to all accounts with exclusions
 */
export async function applyBulkHourlyRateUpdateAction(
  bulk: NonNullable<SopCopilotResponse["bulkHourlyRateUpdate"]>
): Promise<SopActionResult> {
  try {
    const supabase = createClient();
    const hourlyRate = bulk.hourlyRate || 18;
    const exclusions = (bulk.excludedAccounts || ["mama", "green leaf", "steripax"]).map((e) => e.toLowerCase());

    const updatedAccounts: string[] = [];
    const localRateMap: Record<string, number> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("pristine_rate_per_service_map") || "{}";
        Object.assign(localRateMap, JSON.parse(raw));
      } catch {}
    }

    if (supabase) {
      const { data: accounts, error } = await supabase.from("commercial_accounts").select("*");
      if (!error && accounts) {
        for (const acc of accounts) {
          const norm = acc.name.toLowerCase();
          const isExcluded = exclusions.some((exc) => norm.includes(exc));
          if (isExcluded) continue;

          const hours = Number(acc.hours) || 2.5;
          const newRatePerService = Number((hours * hourlyRate).toFixed(2));
          const visits = getVisitsPerMonth(acc.frequency);
          const newCost = Number((newRatePerService * visits).toFixed(2));

          const patch: any = {
            cleaner_hourly_rate: hourlyRate,
            cost: newCost,
            updated_at: new Date().toISOString(),
          };
          if (acc.cleaner_flat_rate && Number(acc.cleaner_flat_rate) > 0) {
            patch.cleaner_flat_rate = newRatePerService;
          }

          await supabase.from("commercial_accounts").update(patch).eq("id", acc.id);
          localRateMap[acc.name.toLowerCase()] = newRatePerService;
          updatedAccounts.push(`${acc.name} ($${newRatePerService}/serv)`);
        }
      }
    }

    // In-memory update
    for (const imp of importedCommercialAccounts) {
      const norm = imp.name.toLowerCase();
      if (!exclusions.some((exc) => norm.includes(exc))) {
        const h = Number(imp.hours) || 2.5;
        const rps = Number((h * hourlyRate).toFixed(2));
        imp.rate_per_service = rps;
        imp.cleaner_flat_rate = rps;
        imp.cost = Number((rps * getVisitsPerMonth(imp.frequency)).toFixed(2));
      }
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pristine_rate_per_service_map", JSON.stringify(localRateMap));
      } catch {}
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
      window.dispatchEvent(new CustomEvent("commercial-accounts-updated"));
    }

    return {
      success: true,
      message: `Tarifa de $${hourlyRate}/hr aplicada a ${updatedAccounts.length} cuenta(s) (exclusiones: ${bulk.excludedAccounts?.join(", ") || "Mama's, Green Leaf"}).`,
      data: { updatedCount: updatedAccounts.length, accounts: updatedAccounts },
    };
  } catch (err: any) {
    return { success: false, message: `Error al aplicar tarifa masiva: ${err?.message || err}` };
  }
}

/**
 * Universal Task Modifications Handler (Create, Delete, Update, Reschedule, Complete)
 */
export async function applyTaskModificationsAction(
  tasks: NonNullable<SopCopilotResponse["taskModifications"]>
): Promise<SopActionResult> {
  if (!tasks || tasks.length === 0) {
    return { success: true, message: "No se requirieron modificaciones de tareas." };
  }

  const supabase = createClient();
  const results: string[] = [];

  for (const t of tasks) {
    try {
      if (t.action === "create") {
        if (supabase) {
          await supabase.from("operation_tasks").insert({
            title: t.taskTitle || "Nueva tarea operativa",
            due_date: t.newDueDate || new Date().toISOString().split("T")[0],
            assignee: t.newAssignee || "Unassigned",
            priority: t.priority || "medium",
            status: t.status || "todo",
            category: t.category || "Operations",
            account_name: t.accountName || null,
            notes: t.notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        results.push(`Tarea creada: "${t.taskTitle}" asignada a ${t.newAssignee || "Unassigned"}.`);
      } else if (t.action === "delete" && (t.taskId || t.taskTitle)) {
        if (supabase) {
          let q = supabase.from("operation_tasks").delete();
          if (t.taskId) q = q.eq("id", t.taskId);
          else if (t.taskTitle) q = q.ilike("title", `%${t.taskTitle}%`);
          await q;
        }
        results.push(`Tarea eliminada: "${t.taskTitle || t.taskId}".`);
      } else if ((t.action === "complete" || t.action === "reschedule" || t.action === "reassign" || t.action === "update") && (t.taskId || t.taskTitle)) {
        if (supabase) {
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (t.action === "complete" || t.status === "completed") updates.status = "completed";
          if (t.newDueDate) updates.due_date = t.newDueDate;
          if (t.newAssignee) updates.assignee = t.newAssignee;
          if (t.priority) updates.priority = t.priority;
          if (t.notes) updates.notes = t.notes;

          let q = supabase.from("operation_tasks").update(updates);
          if (t.taskId) q = q.eq("id", t.taskId);
          else if (t.taskTitle) q = q.ilike("title", `%${t.taskTitle}%`);
          await q;
        }
        results.push(`Tarea actualizada: "${t.taskTitle || t.taskId}".`);
      }
    } catch (err: any) {
      console.error("Error modifying task:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    window.dispatchEvent(new CustomEvent("tasks:updated"));
  }

  return {
    success: true,
    message: results.join("\n"),
  };
}

/**
 * Universal Mutations Handler - Supreme Power to mutate any table/entity directly
 */
export async function applyUniversalMutationsAction(
  mutations: NonNullable<SopCopilotResponse["universalMutations"]>
): Promise<SopActionResult> {
  if (!mutations || mutations.length === 0) {
    return { success: true, message: "No se requirieron mutaciones universales." };
  }

  const supabase = createClient();
  const results: string[] = [];

  for (const m of mutations) {
    try {
      if (!supabase) {
        results.push(`[Local] ${m.description || `${m.action} on ${m.entity}`}`);
        continue;
      }

      const table = m.entity;
      if (m.action === "create" || m.action === "upsert") {
        await supabase.from(table).insert({
          ...(m.fields || {}),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        results.push(`[${table}] Creado: ${m.description || m.targetIdentifier}`);
      } else if (m.action === "update") {
        let q = supabase.from(table).update({
          ...(m.fields || {}),
          updated_at: new Date().toISOString(),
        });
        if (m.targetIdentifier) {
          if (table === "commercial_accounts" || table === "staff_members") {
            q = q.ilike("name", `%${m.targetIdentifier}%`);
          } else if (table === "operation_tasks") {
            q = q.ilike("title", `%${m.targetIdentifier}%`);
          } else if (table === "qc_inspection_schedules") {
            q = q.ilike("account_name", `%${m.targetIdentifier}%`);
          } else {
            q = q.eq("id", m.targetIdentifier);
          }
        }
        await q;
        results.push(`[${table}] Actualizado: ${m.description || m.targetIdentifier}`);
      } else if (m.action === "delete") {
        let q = supabase.from(table).delete();
        if (m.targetIdentifier) {
          if (table === "commercial_accounts" || table === "staff_members") {
            q = q.ilike("name", `%${m.targetIdentifier}%`);
          } else if (table === "operation_tasks") {
            q = q.ilike("title", `%${m.targetIdentifier}%`);
          } else if (table === "qc_inspection_schedules") {
            q = q.ilike("account_name", `%${m.targetIdentifier}%`);
          } else {
            q = q.eq("id", m.targetIdentifier);
          }
        }
        await q;
        results.push(`[${table}] Eliminado: ${m.description || m.targetIdentifier}`);
      }
    } catch (err: any) {
      console.error(`Error in universal mutation for ${m.entity}:`, err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("commercial-accounts-updated"));
    window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    window.dispatchEvent(new CustomEvent("tasks:updated"));
    window.dispatchEvent(new CustomEvent("staff:updated"));
  }

  return {
    success: true,
    message: results.join("\n"),
  };
}

/**
 * MASTER SUPREME EXECUTION ENGINE:
 * Executes ALL actionable operations staged in a SopCopilotResponse with Supreme Power.
 */
export async function applyUniversalSupremeAction(
  response: SopCopilotResponse
): Promise<SopActionResult> {
  const executedActions: string[] = [];

  // 1. Bulk Hourly Rate
  if (response.bulkHourlyRateUpdate) {
    const res = await applyBulkHourlyRateUpdateAction(response.bulkHourlyRateUpdate);
    if (res.message) executedActions.push(res.message);
  }

  // 2. Commercial Account Financials / Rates
  if (response.updateAccountFinancials && response.updateAccountFinancials.length > 0) {
    const res = await applyUpdateAccountFinancialsAction(response.updateAccountFinancials);
    if (res.message) executedActions.push(res.message);
  }

  // 3. Access Updates (Alarm, Lockbox, Gate)
  if (response.accessUpdate || (response.accessUpdates && response.accessUpdates.length > 0)) {
    const res = await applyAccessUpdateAction(response.accessUpdates || [response.accessUpdate!]);
    if (res.message) executedActions.push(res.message);
  }

  // 4. SOP & Commercial Account / Schedule Modifications
  if (response.sopModifications && response.sopModifications.length > 0) {
    const res = await applySopModificationsAction(response.sopModifications);
    if (res.message) executedActions.push(res.message);
  }

  // 5. Ingested Schedule from CleanGuru
  if (response.ingestedSchedule) {
    const res = await applyIngestScheduleAction(response.ingestedSchedule);
    if (res.message) executedActions.push(res.message);
  }

  // 6. QC Inspection Schedules
  if (response.qcScheduleBatch && response.qcScheduleBatch.length > 0) {
    const res = await applyQcScheduleBatchAction(response.qcScheduleBatch);
    if (res.message) executedActions.push(res.message);
  }

  // 7. Cleaning Occurrence Overrides
  if (response.occurrenceOverride || (response.occurrenceOverrides && response.occurrenceOverrides.length > 0)) {
    const overrides = response.occurrenceOverrides || [response.occurrenceOverride!];
    for (const occ of overrides) {
      if (!occ.accountName) continue;
      const res = await applyOccurrenceOverrideAction({
        accountName: occ.accountName,
        date: occ.date || new Date().toISOString().split("T")[0],
        cleanerTeam: occ.cleanerTeam || "Unassigned",
        hours: occ.hours ?? 2.5,
        notes: occ.notes,
      });
      if (res.message) executedActions.push(res.message);
    }
  }

  // 8. Staff / Cleaner Modifications
  if (response.staffModifications && response.staffModifications.length > 0) {
    const res = await applyStaffModificationsAction(response.staffModifications);
    if (res.message) executedActions.push(res.message);
  }

  // 9. Add Staff
  if (response.addStaff) {
    const res = await applyAddStaffAction(response.addStaff);
    if (res.message) executedActions.push(res.message);
  }

  // 10. Staff Deduplication
  if (response.cleanupStaffDuplicates?.enabled) {
    const res = await applyCleanupStaffDuplicatesAction(response.cleanupStaffDuplicates);
    if (res.message) executedActions.push(res.message);
  }

  // 11. Event Bookings
  if (response.eventBookings && response.eventBookings.length > 0) {
    const res = await applyEventBookingsAction(response.eventBookings);
    if (res.message) executedActions.push(res.message);
  }

  // 12. Task Modifications
  if (response.taskModifications && response.taskModifications.length > 0) {
    const res = await applyTaskModificationsAction(response.taskModifications);
    if (res.message) executedActions.push(res.message);
  }

  // 13. Universal Mutations
  if (response.universalMutations && response.universalMutations.length > 0) {
    const res = await applyUniversalMutationsAction(response.universalMutations);
    if (res.message) executedActions.push(res.message);
  }

  // 14. Residential Modifications
  if (response.residentialModifications && response.residentialModifications.length > 0) {
    const res = await applyResidentialModificationsAction(response.residentialModifications);
    if (res.message) executedActions.push(res.message);
  }

  // 15. Payroll Action
  if (response.payrollAction) {
    const res = await applyPayrollAction(response.payrollAction);
    if (res.message) executedActions.push(res.message);
  }

  // 16. Payment Modifications
  if (response.paymentModifications && response.paymentModifications.length > 0) {
    const res = await applyPaymentModificationsAction(response.paymentModifications);
    if (res.message) executedActions.push(res.message);
  }

  // Log Copilot Action to audit table
  const finalMessage = executedActions.length > 0
    ? `⚡ Poder Supremo Ejecutado con Éxito:\n${executedActions.join("\n")}`
    : "Todos los cambios fueron aplicados al sistema con Poder Supremo.";

  await logCopilotAction({
    actionType: response.actionType || "universal_supreme",
    intent: response.intent || "modify_sop",
    payload: response,
    result: finalMessage,
    success: true,
  });

  // Final event broadcast
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("commercial-accounts-updated"));
    window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    window.dispatchEvent(new CustomEvent("tasks:updated"));
    window.dispatchEvent(new CustomEvent("staff:updated"));
  }

  return {
    success: true,
    message: finalMessage,
  };
}

export async function logCopilotAction({
  conversationId,
  prompt,
  actionType,
  intent,
  payload,
  snapshotBefore,
  result,
  success = true,
  durationMs,
}: {
  conversationId?: string;
  prompt?: string;
  actionType?: string;
  intent?: string;
  payload?: any;
  snapshotBefore?: any;
  result?: string;
  success?: boolean;
  durationMs?: number;
}): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from("copilot_action_log").insert({
      conversation_id: conversationId || null,
      prompt: prompt || null,
      action_type: actionType || null,
      intent: intent || null,
      payload: payload || null,
      snapshot_before: snapshotBefore || null,
      result: result || null,
      success,
      duration_ms: durationMs || null,
    });
  } catch (err) {
    console.warn("[Copilot Action Log] Non-fatal log failure:", err);
  }
}

export async function reverseLastCopilotAction(logId?: string): Promise<SopActionResult> {
  const supabase = createClient();
  try {
    let query = supabase
      .from("copilot_action_log")
      .select("*")
      .eq("success", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (logId) {
      query = supabase.from("copilot_action_log").select("*").eq("id", logId).limit(1);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return { success: false, message: "No se encontró registro previo para revertir." };
    }

    const log = data[0];
    const snapshot = log.snapshot_before;
    if (!snapshot) {
      return { success: false, message: "El registro no cuenta con snapshot previo para restaurar." };
    }

    const restored: string[] = [];

    if (snapshot.commercial_accounts && Array.isArray(snapshot.commercial_accounts)) {
      for (const acc of snapshot.commercial_accounts) {
        if (!acc.id) continue;
        await supabase.from("commercial_accounts").upsert(acc);
        restored.push(`Cuenta: ${acc.name}`);
      }
    }

    if (snapshot.schedule_rules && Array.isArray(snapshot.schedule_rules)) {
      for (const rule of snapshot.schedule_rules) {
        if (!rule.id) continue;
        await supabase.from("commercial_account_schedule_rules").upsert(rule);
        restored.push(`Regla horario: ${rule.assigned_cleaner_name || rule.day_of_week}`);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("commercial-accounts-updated"));
      window.dispatchEvent(new CustomEvent("pristine:data-updated"));
    }

    return {
      success: true,
      message: `↩ Cambio revertido con éxito (${log.action_type || "acción"}). Restaurado:\n${restored.join(", ") || "estado previo"}`,
    };
  } catch (err: any) {
    return { success: false, message: `Error al revertir: ${err?.message}` };
  }
}

export async function applyResidentialModificationsAction(
  mods: {
    accountName: string;
    action: "create" | "update" | "deactivate" | "log_work";
    teamName?: string;
    scheduledHours?: number;
    frequency?: string;
    dayOfWeek?: string;
    workDate?: string;
    hoursWorked?: number;
    notes?: string;
    city?: string;
  }[]
): Promise<SopActionResult> {
  const supabase = createClient();
  const results: string[] = [];

  for (const m of mods) {
    try {
      if (m.action === "log_work") {
        const { error } = await supabase.from("residential_work_logs").insert({
          account_name: m.accountName,
          team_name: m.teamName || "Equipo Residencial",
          work_date: m.workDate || new Date().toISOString().split("T")[0],
          hours_worked: m.hoursWorked || m.scheduledHours || 3.0,
          notes: m.notes || "Registrado por Copiloto SOP",
          status: "pending",
        });
        if (error) throw error;
        results.push(`✓ Trabajo residencial registrado: ${m.accountName} (${m.hoursWorked || 3}h) por ${m.teamName || "Equipo"}`);
      } else if (m.action === "create" || m.action === "update") {
        const payload: Record<string, any> = {
          account_name: m.accountName,
          active: true,
          scheduled_hours: m.scheduledHours || 3.0,
          frequency: m.frequency || "weekly",
          assigned_team_name: m.teamName || "Carlos Lopez",
        };
        if (m.dayOfWeek) payload.day_of_week = m.dayOfWeek;
        if (m.city) payload.city = m.city;
        if (m.notes) payload.notes = m.notes;

        const { error } = await supabase.from("residential_recurring_cleaning_accounts").upsert(payload, { onConflict: "account_name" });
        if (error) throw error;
        results.push(`✓ Cuenta residencial ${m.action === "create" ? "creada" : "actualizada"}: ${m.accountName}`);
      } else if (m.action === "deactivate") {
        const { error } = await supabase
          .from("residential_recurring_cleaning_accounts")
          .update({ active: false, deleted_at: new Date().toISOString() })
          .ilike("account_name", `%${m.accountName}%`);
        if (error) throw error;
        results.push(`✓ Cuenta residencial desactivada: ${m.accountName}`);
      }
    } catch (e: any) {
      results.push(`✗ Error en ${m.accountName}: ${e?.message}`);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pristine:data-updated"));
  }

  return { success: true, message: results.join("\n") };
}

export async function applyPayrollAction(action: {
  action: "generate_period" | "approve_entry" | "add_adjustment" | "close_period";
  startDate?: string;
  endDate?: string;
  periodLabel?: string;
  cleanerName?: string;
  accountName?: string;
  adjustmentType?: string;
  hoursDelta?: number;
  amountDelta?: number;
  reason?: string;
  entryId?: string;
}): Promise<SopActionResult> {
  const supabase = createClient();
  try {
    if (action.action === "approve_entry" && action.entryId) {
      const { error } = await supabase
        .from("commercial_payroll_entries")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", action.entryId);
      if (error) throw error;
      return { success: true, message: `✓ Entrada de nómina aprobada (${action.entryId}).` };
    }

    if (action.action === "generate_period" && action.startDate && action.endDate) {
      const label = action.periodLabel || `${action.startDate} al ${action.endDate}`;
      const { data: period, error } = await supabase
        .from("commercial_pay_periods")
        .insert({
          start_date: action.startDate,
          end_date: action.endDate,
          label,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, message: `✓ Período de nómina creado: ${label} (ID: ${period.id}).` };
    }

    return { success: true, message: `Acción de nómina procesada (${action.action}).` };
  } catch (err: any) {
    return { success: false, message: `Error en nómina: ${err?.message}` };
  }
}

export async function applyPaymentModificationsAction(
  mods: {
    cleanerName: string;
    monthKey?: string;
    weekIndex?: number;
    amount?: number;
    status?: "pending" | "verified" | "paid";
    notes?: string;
    paymentType?: string;
  }[]
): Promise<SopActionResult> {
  const supabase = createClient();
  const results: string[] = [];

  for (const m of mods) {
    try {
      const { error } = await supabase.from("payment_entries").insert({
        cleaner_name: m.cleanerName,
        month_key: m.monthKey || new Date().toISOString().slice(0, 7),
        week_index: m.weekIndex ?? 1,
        payment_amount: m.amount || 0,
        status: m.status || "pending",
        notes: m.notes || "Creado por Copiloto SOP",
        payment_type: m.paymentType || "commercial",
      });
      if (error) throw error;
      results.push(`✓ Pago registrado para ${m.cleanerName}: $${m.amount || 0} (${m.status || "pending"})`);
    } catch (e: any) {
      results.push(`✗ Error en pago para ${m.cleanerName}: ${e?.message}`);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pristine:data-updated"));
  }

  return { success: true, message: results.join("\n") };
}

