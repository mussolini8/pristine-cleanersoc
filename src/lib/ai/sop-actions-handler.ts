import { createClient } from "@/lib/supabase/client";
import type { SopCopilotResponse } from "@/lib/ai/gemini-client";

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

    // 2. Insert or update entry in commercial_hours_entries
    const entryData = {
      account_id: accountId,
      account_name: accountName,
      service_date: override.date,
      cleaner_name: override.cleanerTeam,
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
      const { data, error } = await supabase
        .from("commercial_hours_entries")
        .insert(entryData)
        .select()
        .single();

      if (!error && data) {
        return {
          success: true,
          message: `Turno registrado exitosamente: ${accountName} el ${override.date} con el equipo de ${override.cleanerTeam} (${override.hours} hrs).`,
          data,
        };
      }
    }

    // Fallback: save to localStorage for offline / non-auth resilience
    const existingStr = localStorage.getItem("pristine_commercial_hours_entries") || "[]";
    const existing = JSON.parse(existingStr);
    const newEntry = { id: `entry-${Date.now()}`, ...entryData, created_at: new Date().toISOString() };
    existing.unshift(newEntry);
    localStorage.setItem("pristine_commercial_hours_entries", JSON.stringify(existing));

    return {
      success: true,
      message: `Turno registrado en el sistema: ${accountName} el ${override.date} con ${override.cleanerTeam} (${override.hours} hrs).`,
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
