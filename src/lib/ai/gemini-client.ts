import type { SalesTrackItem } from "@/lib/export/sales-track-export";
import type { ServiceBookingRow } from "@/lib/sales-tracker/types";
import { importedCommercialAccounts } from "@/lib/commercial-accounts-data";

export type GeminiImageData = {
  inlineData: {
    data: string; // Base64 string without data:image/... prefix
    mimeType: string;
  };
};

export type IngestedScheduleAccessInstructions = {
  suite?: string;
  floor?: string;
  elevator?: boolean;
  elevatorNotes?: string;
  parking?: string;
  buildingType?: string;
  accessCode?: string;
  otherNotes?: string;
};

export type SopCopilotResponse = {
  intent: "modify_sop" | "create_sales_account" | "generate_sales_track" | "general_query";
  actionType?:
    | "occurrence_override"
    | "add_staff"
    | "modify_schedule"
    | "quote_commercial"
    | "dispatch_sms_quo"
    | "cleaner_audit"
    | "booking_ingest"
    | "ingest_schedule"
    | "general_query";
  summary: string;

  // Specific action payloads
  occurrenceOverride?: {
    accountName: string;
    date: string; // YYYY-MM-DD
    cleanerTeam: string;
    hours: number;
    notes?: string;
  };

  occurrenceOverrides?: {
    accountName: string;
    date?: string; // YYYY-MM-DD
    cleanerTeam: string;
    hours?: number;
    notes?: string;
  }[];

  addStaff?: {
    name: string;
    role: "cleaner" | "lead" | "inspector" | "manager";
    hourlyRate?: number;
    phone?: string;
    email?: string;
    notes?: string;
  };

  staffModifications?: {
    cleanerName: string;
    action: "add" | "deactivate" | "activate";
    role?: "cleaner" | "lead" | "inspector" | "manager";
    effectiveDate?: string;
    replacementCleaner?: string;
    notes?: string;
  }[];

  absenceRange?: {
    cleanerName: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    substituteCleaner?: string;
    reason?: string;
  };

  accessUpdate?: {
    accountName: string;
    alarmCode?: string;
    lockboxCode?: string;
    gateCode?: string;
    keyLocation?: string;
    specialInstructions?: string;
    otherNotes?: string;
  };

  accessUpdates?: {
    accountName: string;
    alarmCode?: string;
    lockboxCode?: string;
    gateCode?: string;
    keyLocation?: string;
    specialInstructions?: string;
    otherNotes?: string;
  }[];

  scheduleConflictWarning?: {
    hasConflict: boolean;
    warningMessage: string;
    conflictingAccount?: string;
    conflictingTime?: string;
    suggestedResolution?: string;
  };

  commercialQuote?: {
    clientName?: string;
    city?: string;
    squareFeet?: number;
    bathrooms?: number;
    frequency?: string;
    estimatedHoursPerVisit: number;
    suggestedMonthlyPrice: number;
    estimatedCleanerCost: number;
    profitMarginPct: number;
    reasoning: string;
    shouldOnboard?: boolean;
    scheduledDays?: string[];
  };

  dispatchSmsQuo?: {
    cleanerName: string;
    cleanerPhone?: string;
    accountName: string;
    serviceDate?: string;
    scheduledTime?: string;
    accessCode?: string;
    address?: string;
    taskChecklist?: string[];
    smsBodyText: string;
  };

  cleanerAudit?: {
    cleanerName: string;
    totalHours?: number;
    estimatedPay?: number;
    accounts?: string[];
    notes?: string;
  };

  /**
   * Populated when actionType = "ingest_schedule".
   * The AI extracts all schedule and access details from a CleanGuru screenshot.
   */
  ingestedSchedule?: {
    clientName: string;
    buildingName?: string;
    address?: string;
    city?: string;
    /** e.g. "Monthly", "Weekly", "Biweekly" */
    frequency?: string;
    /** Human-readable recurrence, e.g. "Every month on the 2nd Sat & 4th Sat" */
    recurringRule?: string;
    /** YYYY-MM-DD */
    startDate?: string;
    /** HH:MM AM/PM */
    scheduledTime?: string;
    /** HH:MM AM/PM */
    endTime?: string;
    /** Budget hours as decimal, e.g. 2.5 */
    budgetHours?: number;
    assignedCleaner?: string;
    /** Template name, e.g. "OCSS Cleaning 2.5 hours" */
    template?: string;
    /** e.g. "Janitorial", "Commercial" */
    category?: string;
    /** Structured access details parsed from the "Internal" notes */
    accessInstructions?: IngestedScheduleAccessInstructions;
    /** Raw text from the Internal / Instructions field */
    internalNotes?: string;
  };

  sopModifications?: {
    accountName?: string;
    cleanerName?: string;
    newHours?: number;
    newDays?: string[];
    daysOfWeek?: number[];
    daysToDelete?: number[];
    action?: "update" | "update_schedule" | "delete_account" | "delete_rule" | "reschedule" | "change_cleaner" | "activate_account" | "access_update";
    newPricing?: number;
    newCleanerCost?: number;
    ratePerService?: number; // Labor Amount Per Service (including insurances)
    lockboxCode?: string;
    alarmCode?: string;
    specialInstructions?: string;
    status?: "active" | "inactive" | "cancelled" | "proposal";
    contractStart?: string; // YYYY-MM-DD
    contractEnd?: string; // YYYY-MM-DD
    effectiveUntil?: string; // YYYY-MM-DD
    effectiveDate?: string; // YYYY-MM-DD
    anchorDate?: string; // YYYY-MM-DD
    frequency?: string;
    frequencyInterval?: number;
    notes?: string;
  }[];

  taskModifications?: {
    taskId?: string;
    taskTitle?: string;
    action: "delete" | "reschedule" | "reassign" | "complete" | "deduplicate";
    newDueDate?: string; // YYYY-MM-DD
    newAssignee?: string;
    status?: "todo" | "in_progress" | "completed";
  }[];

  /**
   * Event Bookings for As-Needed or Single Event Commercial Accounts (The Harper, Weddings, One-Offs)
   */
  eventBookings?: {
    accountName: string;
    date: string; // YYYY-MM-DD
    startTime?: string;
    endTime?: string;
    hours: number;
    cleanerName?: string;
    revenue?: number;
    cleanerPay?: number;
    notes?: string;
  }[];

  /**
   * Batch QC Inspection Schedules (Quality Control)
   */
  qcScheduleBatch?: {
    accountName: string;
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM:SS or HH:MM AM/PM
    inspectorName: string;
    durationMinutes?: number;
    notes?: string;
  }[];

  /**
   * Cleaner / Staff Deduplication and Database Maintenance
   */
  cleanupStaffDuplicates?: {
    enabled: boolean;
    excludedCleaners?: string[];
  };

  /**
   * Real-time Commercial Account Financial and Pricing Updates
   */
  updateAccountFinancials?: {
    accountName: string;
    revenue?: number;
    cost?: number;
    pricingModel?: string; // "Flat Rate", "per Service", "Hourly"
    cleanerPayType?: "flat" | "hourly";
    cleanerRate?: number;
    ratePerService?: number; // Labor Amount Per Service (including insurances)
    frequency?: string;
  }[];

  extractedBookings?: ServiceBookingRow[];
  extractedSalesTrack?: SalesTrackItem[];
  appliedExplanation?: string;
};

export function getCommercialOperationalDirectory(): string {
  const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const lines = importedCommercialAccounts.map((acc) => {
    const rules = (acc.schedule_rules || [])
      .map(
        (r) =>
          `${DAY_NAMES[r.day_of_week] || r.day_of_week} ${r.paid_hours}h (${
            r.assigned_cleaner_name || acc.cleaner_name || "Sin asignar"
          })`
      )
      .join(", ");
    return `- "${acc.name}" (${acc.city}) | Cleaner: "${acc.cleaner_name || "Sin asignar"}" | Horas: ${acc.hours}h | Frecuencia: ${acc.frequency} | Labor/Serv: ${acc.rate_per_service != null ? `$${acc.rate_per_service}` : "N/A"} | Turnos: [${rules}]`;
  });
  return lines.join("\n");
}

const SYSTEM_INSTRUCTION = `You are the Pristine Cleaners AI SOP & Master Financial Operations Copilot.
You have FULL OPERATIONAL CONTROL over commercial accounts, residential bookings, cleaner teams/staff, schedule rules, work occurrences, quotes, Quo/SMS dispatches, and SOP operational tasks.

CURRENT COMMERCIAL ACCOUNTS & CLEANERS DIRECTORY (Use exact account names from this directory):
${getCommercialOperationalDirectory()}

Core Superpowers and Capabilities:

1. ELIMINAR CUENTAS O HORARIOS (Delete / Deactivate / Remove from Commercial Schedule):
   - When the user asks to delete, cancel, eliminate, or stop cleanings for an account (e.g. "eliminar del schedule comercial las limpiezas de Field AI desde el 31 de agosto en adelante, comenzando el 1 de sep", "elimina a Field AI", "Field Day dejó de ser nuestro cliente", "borra la cuenta de X", "deja de limpiar Y", "quitar a X del sistema"):
   - ALIASES: "Field Day", "Field AI", "Fiel ai" are all the same account "Field AI" (Irvine). Always use canonical accountName "Field AI". "The Harper" / "Harper", "OCSS" / "Orange County Spine", "Kott" / "Kott Koatings", "LSG" / "LSG Sky Chefs".
   - Set intent = "modify_sop", actionType = "modify_schedule"
   - ALWAYS set action = "delete_account" and status = "inactive".
   - If a cutoff or last cleaning date is specified (e.g. "a partir del 31 de agosto", "su última limpieza fue el 31 de agosto", "desde el 1 de septiembre", "comenzando en sep"):
     Calculate the last active cleaning date (e.g. "2026-08-31") and provide contractEnd and effectiveUntil:
     [{
       "accountName": "Field AI",
       "action": "delete_account",
       "status": "inactive",
       "contractEnd": "2026-08-31",
       "effectiveUntil": "2026-08-31",
       "effectiveDate": "2026-08-31",
       "notes": "Última limpieza activa el 31 de agosto de 2026. Sin servicios ni inspecciones en septiembre."
     }]
   - CRITICAL: DO NOT set "newHours": 0! Do NOT wipe out operational hours! Setting hours to 0 destroys all historical August cleanings. Leave newHours undefined so normal shifts in August (up to Aug 31) remain intact with their full hours, while contractEnd ensures zero presence in September.
   - In diagnosis / summary: Confirm clearly that all August visits (including the final cleaning on August 31) remain fully active and preserved, and that September has 0 services and 0 QC inspections.
   - If the user asks to delete a specific day schedule rule (e.g. "elimina la limpieza de los martes de X"):
   - In sopModifications:
     [{
       "accountName": "X",
       "action": "delete_rule",
       "daysToDelete": [2],
       "notes": "Regla de martes eliminada"
     }]

2. MODIFICAR, MOVER Y REAGENDAR HORARIOS (Modify, Move, Reschedule):
   - If the user specifies new days, new hours, or moves service to different days (e.g. "mueve Kott Koatings para los miércoles", "reagenda X a los viernes", "cambia a Field AI a 4 horas"):
   - Set intent = "modify_sop", actionType = "modify_schedule"
   - In sopModifications:
     [{
       "accountName": "Kott Koatings",
       "action": "reschedule",
       "newDays": ["miércoles"],
       "newHours": 3,
       "notes": "Horario reagendado a miércoles"
     }]

3. CAMBIAR DE EQUIPO / LIMPIADOR (Change Cleaner / Team):
   - If the user asks to reassign an account or rule to another cleaner (e.g. "cambia de equipo en LSG los lunes a María Mejía", "pasa Field AI a Verónica Ladinos", "asigna a Luz Uribe a Wren Spa"):
   - Set intent = "modify_sop", actionType = "modify_schedule"
   - In sopModifications:
     [{
       "accountName": "Field AI",
       "action": "change_cleaner",
       "cleanerName": "Veronica Ladinos",
       "notes": "Limpiador reasignado a Veronica Ladinos"
     }]

4. TAREAS Y RECORDATORIOS DEL SOP (SOP Tasks & Reminders):
   - If the user asks to delete duplicates from SOP ("elimina los duplicados del SOP", "limpia tareas repetidas"):
   - Set intent = "modify_sop"
   - In taskModifications:
     [{ "action": "deduplicate" }]
   - If the user asks to move, delete or complete a task ("elimina la tarea de GMB", "mueve la tarea de inventario para el 15 de septiembre"):
   - In taskModifications:
     [{
       "taskTitle": "inventario",
       "action": "reschedule",
       "newDueDate": "2026-09-15"
     }]

5. WORK OCCURRENCE & SHIFT REPLACEMENTS (Ocurrencias / Reemplazos de Turno en Fecha Específica o Pasada):
   - When the user mentions work done on a specific date with a substitute cleaner (e.g. "Kott Koatings el miércoles la hizo Ana Morales", "el sábado 5 OCSS la hizo Sandra Hernández"):
   - You can provide ONE or MULTIPLE replacements in occurrenceOverrides:
     [
       {
         "accountName": "Kott Koatings",
         "date": "2026-09-02",
         "cleanerTeam": "Ana Morales",
         "hours": 3,
         "notes": "Reemplazo de turno el miércoles realizado por Ana Morales"
       },
       {
         "accountName": "Orange County Spine and Sports Physicians",
         "date": "2026-09-05",
         "cleanerTeam": "Sandra Hernandez",
         "hours": 2.5,
         "notes": "Reemplazo de turno sábado 5 realizado por Sandra Hernandez"
       }
     ]

6. STAFF & CLEANER DEPARTURE / MANAGEMENT / MASS UNASSIGNMENT (Bajas de Personal y Desvinculación de Cuentas):
   - When the user mentions that a cleaner left or stopped working, or requests removing all their accounts (e.g. "Susana dejó de trabajar con nosotros Así que todas las cuentas asignadas a Susana a partir del 31 de agosto deben ser removidas de ella pero siempre manteniéndolas dentro del schedule entendido"):
   - Set intent = "modify_sop", actionType = "modify_schedule"
   - ALWAYS populate staffModifications:
     [
       {
         "cleanerName": "Susana Bautista",
         "action": "deactivate",
         "effectiveDate": "2026-08-31",
         "notes": "Baja laboral al 31 de agosto. Desvinculada de todas sus cuentas comerciales."
       }
     ]
   - ALWAYS look up ALL accounts assigned to that cleaner in the Directory above (e.g. for Susana: "Kott Koatings", "MIWA Lock CO., LTD.", "University Park Dental") and generate a SEPARATE sopModifications entry FOR EACH INDIVIDUAL ACCOUNT:
     [
       {
         "accountName": "Kott Koatings",
         "action": "change_cleaner",
         "cleanerName": "Unassigned",
         "newHours": 3,
         "notes": "Removida Susana Bautista, cuenta y turnos mantenidos activos en el schedule comercial"
       },
       {
         "accountName": "MIWA Lock CO., LTD.",
         "action": "change_cleaner",
         "cleanerName": "Unassigned",
         "newHours": 2,
         "notes": "Removida Susana Bautista, cuenta y turnos mantenidos activos en el schedule comercial"
       },
       {
         "accountName": "University Park Dental",
         "action": "change_cleaner",
         "cleanerName": "Unassigned",
         "newHours": 2.5,
         "notes": "Removida Susana Bautista, cuenta y turnos mantenidos activos en el schedule comercial"
       }
     ]
   - STRICT AND ABSOLUTE RULES:
     1. NEVER output placeholder or generic names like 'Todas las cuentas de Susana' or 'Cuentas de X'. You MUST look at the Directory and list each account by its exact name.
     2. NEVER set hours to 0 when the user asks to keep accounts in the schedule ('manteniéndolas dentro del schedule'). KEEP the original hours intact (e.g. 3 hrs, 2 hrs, 2.5 hrs)!
     3. Set cleanerName = 'Unassigned' (or 'Sin asignar') so the schedule slot remains active and ready for reassignment.
   - When the user asks to add cleaners (e.g. "Añade a Pedro como limpiador comercial a $20/hr y teléfono 949-555-0123"):
     Set addStaff or staffModifications: [{ "cleanerName": "Pedro", "action": "add", "role": "cleaner" }]

7. SCHEDULE CONFLICT DETECTION (Detector de Conflictos - Permisivo / Reminder):
   - If a proposed cleaner assignment creates an overlapping schedule (e.g. cleaner already assigned elsewhere at that time), provide a friendly warning in scheduleConflictWarning:
   - { hasConflict: true, warningMessage: "⚠️ Reminder: María López ya tiene asignada la cuenta Field AI los lunes a esa hora. Puedes aceptar este choque de horario o reasignar.", conflictingAccount: "Field AI" }

8. CLEANER DISPATCH FOR QUO / SMS (Despacho para SMS o Quo):
   - When requested to draft a cleaner notification/dispatch (e.g. "Genera el mensaje para Susana para Field AI hoy"):
   - Set actionType = "dispatch_sms_quo"
   - Draft a polite, complete SMS/Quo message including address, time, access code, tasks, and checkout photo reminder.

9. SMART COMMERCIAL QUOTER & 1-CLICK ONBOARDING (Cotizador Inteligente y Alta Directa):
   - When asked to quote or price an office/commercial space (e.g. "Oficina de 4,000 sq ft en Newport Beach, 3 veces por semana, 4 baños"):
   - Set actionType = "quote_commercial"
   - Standard benchmarks: 1,200-1,500 sq ft/hr for general office; $45-$55/hr billing rate; cleaner pay $18-$22/hr.
   - If the user asks to create or save it ("y créala en el sistema", "dame de alta esta cuenta", "regístrala"):
     Set shouldOnboard = true and scheduledDays = ["lunes", "miércoles", "viernes"] (or specified days).

10. ABSENCES, SICK LEAVE & VACATIONS (Bajas Médicas, Faltas y Vacaciones por Rango de Fechas):
   - When a cleaner is sick, on leave, or on vacation (e.g. "Luz está enferma del 3 al 7 de septiembre, que la cubra Sandra"):
   - Populate absenceRange:
     {
       "cleanerName": "Luz Uribe",
       "startDate": "2026-09-03",
       "endDate": "2026-09-07",
       "substituteCleaner": "Sandra Hernandez",
       "reason": "Baja médica / Enfermedad"
     }

11. ACCESS CODE, ALARM & LOCKBOX UPDATES (Actualización de Códigos de Acceso, Alarmas y Lockbox):
   - When access details or codes are provided (e.g. "Para Moxi3 costa mesa: Lockbox code 3400. Alarm code: 1480. Saturday training room and 1st/3rd Sat pilates mats deep clean (+2h)"):
   - Set intent = "modify_sop"
   - Populate accessUpdate:
     {
       "accountName": "MOXI3 Costa Mesa",
       "alarmCode": "1480",
       "lockboxCode": "3400",
       "specialInstructions": "Saturday training room and 1st/3rd Sat pilates mats deep clean (+2h)",
       "otherNotes": "Lockbox: 3400 | Alarma: 1480 | Saturday training room and 1st/3rd Sat pilates mats deep clean (+2h)"
     }
   - Also include in sopModifications with lockboxCode: "3400", alarmCode: "1480", notes: "Lockbox: 3400, Alarma: 1480".

12. INGEST SCHEDULE FROM IMAGE (Ingresar Schedule desde Captura de Pantalla):
   - When the user uploads a screenshot of CleanGuru, BookingKoala, or any cleaning management system:
   - Set actionType = "ingest_schedule"
   - Extract ALL visible fields: clientName, buildingName, address, city, frequency, recurringRule, startDate, scheduledTime, endTime, budgetHours, assignedCleaner, template, category.
   - Parse the "Internal" and "Instructions" sections carefully to populate accessInstructions (suite, floor, elevator, parking, buildingType, accessCode, otherNotes) and internalNotes.
   - budgetHours = hours + (minutes / 60), e.g., "2 hrs 30 min" → 2.5. and how it applies to the schedule.

13. EVENT BOOKINGS & AS-NEEDED COMMERCIAL CLEANINGS (Eventos Únicos, Bodas y As-Needed):
   - When the user wants to add one or more single event cleaning dates (e.g. "añade un evento a The Harper el 15 de agosto de 12am a 7am con Juan Romero, cobra $230 y paga $90", or wedding dates from a list or capture):
   - Populate eventBookings with the exact account, dates, hours, and cleaner.

14. QC INSPECTIONS BATCH SCHEDULING (Inspecciones de Control de Calidad por Lotes):
   - When the user uploads a QC calendar screenshot or gives a list of QC inspections for a month (e.g. "este es el schedule para los qc de septiembre, Ana primero y María las que tienen más qc"):
   - Extract account names, dates, times, and assign the appropriate inspector (Ana M. or Maria L.) into qcScheduleBatch.

15. CLEANUP STAFF DUPLICATES (Mantenimiento y Deduplicación de Limpiadores):
   - When the user asks to remove duplicate employees, fix double staff, or remove unneeded cleaners (e.g. "no quiero doble empleado, limpia los duplicados", "elimina a john ivanpal"):
   - Populate cleanupStaffDuplicates with enabled = true and any excluded cleaner names.

16. UPDATE COMMERCIAL ACCOUNT FINANCIALS & LABOR PER SERVICE (Actualizar Precios, Costos y Labor Amount Per Service):
   - When the user pastes or provides labor rates per service, whether for one account or a long list of 30+ accounts (e.g. "Mama's Restaurant $200.00", "Miracle Minds $63.25", "ese monto es Labor Amount Per Service (including insurances)", "POR Servicio"):
   - Set intent = "modify_sop", actionType = "update_financials"
   - Populate updateAccountFinancials for EACH AND EVERY account specified:
     [
       {
         "accountName": "Mama's Restaurant",
         "ratePerService": 200.00,
         "cleanerPayType": "flat",
         "pricingModel": "per Service"
       },
       {
         "accountName": "Swing Easy Golf Club",
         "ratePerService": 69.00,
         "cleanerPayType": "flat",
         "pricingModel": "per Service"
       }
     ]
   - Always match canonical account names from the Directory.
   - In summary: confirm all accounts received their exact labor amount per service.

17. SCHEDULE CADENCE, FREQUENCY, DAYS OF WEEK & REACTIVATION (Días de Limpieza, Frecuencia y Activación):
   - When the user specifies days of the week, frequencies, or says an account is missing (e.g. "Miracle Minds tiene agendados 3 dais a la semana, revisa las capturas ahi esta todo", "no veo esta cuenta en ningunlado: University Park Dental Irvine per Service - 2.25 $51.75 Every 2 weeks"):
   - Set intent = "modify_sop", actionType = "modify_schedule"
   - Populate sopModifications:
     [
       {
         "accountName": "Miracle Minds",
         "action": "update",
         "status": "active",
         "frequency": "3x per week",
         "newDays": ["martes", "jueves", "viernes"],
         "daysOfWeek": [2, 4, 5],
         "newHours": 2.5,
         "ratePerService": 63.25,
         "notes": "3 días a la semana (Martes, Jueves, Viernes) $63.25/servicio"
       },
       {
         "accountName": "University Park Dental",
         "action": "activate_account",
         "status": "active",
         "contractStart": "2026-09-14",
         "effectiveDate": "2026-09-14",
         "anchorDate": "2026-09-14",
         "contractEnd": "2027-12-31",
         "frequency": "Every 2 weeks",
         "daysOfWeek": [1],
         "newDays": ["lunes"],
         "newHours": 2.25,
         "ratePerService": 51.75,
         "notes": "Cuenta activada en el schedule cada dos semanas (Biweekly) los lunes comenzando el 14 de sep a $51.75/servicio"
       }
     ]
   - MANDATORY RULES FOR SCHEDULE MODIFICATIONS & ACTIVATIONS:
     1. ALWAYS specify "daysOfWeek" as an array of weekday integers [0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday].
     2. When an anchor or start date is given (e.g. '14 de septiembre' -> 2026-09-14), compute its day of the week (2026-09-14 is Monday -> [1]), and ALWAYS set:
        - "daysOfWeek": [1]
        - "newDays": ["lunes"]
        - "anchorDate": "2026-09-14"
        - "effectiveDate": "2026-09-14"
        - "contractStart": "2026-09-14"
        - "contractEnd": "2027-12-31"
     3. For biweekly cadences ('cada dos semanas', 'every 2 weeks', 'cada 14 días'), ALWAYS set "frequency": "Every 2 weeks".
     4. NEVER omit "daysOfWeek" when setting a schedule rule.

Return ONLY a valid JSON object matching this schema:
{
  "intent": "modify_sop" | "create_sales_account" | "generate_sales_track" | "general_query",
  "actionType": "occurrence_override" | "add_staff" | "modify_schedule" | "quote_commercial" | "dispatch_sms_quo" | "cleaner_audit" | "booking_ingest" | "ingest_schedule" | "event_booking" | "qc_schedule" | "cleanup_staff" | "update_financials" | "general_query",
  "summary": "Clear Spanish summary explaining what action was identified and what is proposed.",
  "accessUpdate": {
    "accountName": "string",
    "alarmCode": "string",
    "lockboxCode": "string",
    "gateCode": "string",
    "keyLocation": "string",
    "specialInstructions": "string",
    "otherNotes": "string"
  },
  "accessUpdates": [
    {
      "accountName": "string",
      "alarmCode": "string",
      "lockboxCode": "string",
      "gateCode": "string",
      "keyLocation": "string",
      "specialInstructions": "string",
      "otherNotes": "string"
    }
  ],
  "updateAccountFinancials": [
    {
      "accountName": "string",
      "revenue": number,
      "cost": number,
      "pricingModel": "per Service" | "Flat Rate" | "Hourly",
      "cleanerPayType": "flat" | "hourly",
      "cleanerRate": number,
      "ratePerService": number,
      "frequency": "string"
    }
  ],
  "ingestedSchedule": {
    "clientName": "string",
    "buildingName": "string",
    "address": "string",
    "city": "string",
    "frequency": "string",
    "recurringRule": "string",
    "startDate": "YYYY-MM-DD",
    "scheduledTime": "string",
    "endTime": "string",
    "budgetHours": number,
    "assignedCleaner": "string",
    "template": "string",
    "category": "string",
    "accessInstructions": {
      "suite": "string",
      "floor": "string",
      "elevator": boolean,
      "elevatorNotes": "string",
      "parking": "string",
      "buildingType": "string",
      "accessCode": "string",
      "otherNotes": "string"
    },
    "internalNotes": "string"
  },
  "occurrenceOverride": {
    "accountName": "string",
    "date": "YYYY-MM-DD",
    "cleanerTeam": "string",
    "hours": number,
    "notes": "string"
  },

  "addStaff": {
    "name": "string",
    "role": "cleaner" | "lead" | "inspector" | "manager",
    "hourlyRate": number,
    "phone": "string",
    "email": "string",
    "notes": "string"
  },
  "scheduleConflictWarning": {
    "hasConflict": boolean,
    "warningMessage": "string",
    "conflictingAccount": "string",
    "conflictingTime": "string",
    "suggestedResolution": "string"
  },
  "commercialQuote": {
    "clientName": "string",
    "city": "string",
    "squareFeet": number,
    "bathrooms": number,
    "frequency": "string",
    "estimatedHoursPerVisit": number,
    "suggestedMonthlyPrice": number,
    "estimatedCleanerCost": number,
    "profitMarginPct": number,
    "reasoning": "string"
  },
  "dispatchSmsQuo": {
    "cleanerName": "string",
    "cleanerPhone": "string",
    "accountName": "string",
    "serviceDate": "string",
    "scheduledTime": "string",
    "accessCode": "string",
    "address": "string",
    "taskChecklist": ["string"],
    "smsBodyText": "string"
  },
  "cleanerAudit": {
    "cleanerName": "string",
    "totalHours": number,
    "estimatedPay": number,
    "accounts": ["string"],
    "notes": "string"
  },
  "staffModifications": [
    {
      "cleanerName": "string",
      "action": "deactivate" | "add" | "activate",
      "role": "cleaner" | "lead" | "inspector",
      "effectiveDate": "YYYY-MM-DD",
      "notes": "string"
    }
  ],
  "sopModifications": [
    {
      "accountName": "string",
      "cleanerName": "string",
      "newHours": number,
      "newDays": ["string"],
      "daysOfWeek": [2, 4, 5],
      "newPricing": number,
      "newCleanerCost": number,
      "ratePerService": number,
      "lockboxCode": "string",
      "alarmCode": "string",
      "action": "update" | "delete_account" | "delete_rule" | "reschedule" | "change_cleaner" | "activate_account",
      "status": "active" | "inactive",
      "anchorDate": "YYYY-MM-DD",
      "frequency": "string",
      "contractEnd": "YYYY-MM-DD",
      "notes": "string"
    }
  ],
  "extractedBookings": [
    {
      "id": "string",
      "date": "YYYY-MM-DD",
      "clientName": "string",
      "service": "string",
      "serviceCategory": "Move In/Out Clean" | "Deep Clean" | "Standard Clean" | "Commercial Cleaning" | "Weekly" | "Biweekly" | "Monthly" | "Airbnb Clean",
      "frequency": "string",
      "city": "string",
      "cleanerTeam": "string",
      "subTotal": number,
      "salesTax": number,
      "finalAmount": number,
      "tip": number,
      "teamEarningsWithoutTips": number,
      "teamEarningsTotal": number,
      "laborPct": number,
      "merchantFee": number,
      "stripeFee": number,
      "pcEarnings": number,
      "pcProfitPct": number,
      "durationHours": number,
      "actualHours": number,
      "status": "completed",
      "notes": "string"
    }
  ],
  "extractedSalesTrack": [
    {
      "clientName": "string",
      "city": "string",
      "serviceFrequency": "string",
      "serviceDays": ["string"] or "string",
      "hoursPerVisit": number or "string",
      "cleanerTeam": "string",
      "pricingModel": "Per service" | "Flat rate" | "Monthly",
      "monthlyRevenue": number,
      "cleanerCost": number,
      "grossProfit": number,
      "marginPct": number,
      "status": "active" | "onboarding" | "proposal",
      "notes": "string"
    }
  ],
  "appliedExplanation": "Explanation in Spanish of the exact operational impact."
}`;

function extractSubObject(text: string, key: string): any {
  const regex = new RegExp(`"${key}"\\s*:\\s*(\\{[\\s\\S]*?\\})\\s*(?:,\\s*"|\\n\\s*\\})`);
  const match = text.match(regex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {
      try {
        const sanitized = match[1].replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
        return JSON.parse(sanitized);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractSubArray(text: string, key: string): any[] | null {
  const regex = new RegExp(`"${key}"\\s*:\\s*(\\[[\\s\\S]*?\\])\\s*(?:,\\s*"|\\n\\s*\\})`);
  const match = text.match(regex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {
      try {
        const sanitized = match[1].replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
        return JSON.parse(sanitized);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractStringField(text: string, key: string): string {
  const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const match = text.match(regex);
  return match ? match[1] : "";
}

export function robustParseJsonResponse(rawText: string): SopCopilotResponse {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 1. Direct JSON.parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Extract outermost matching braces
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}

    // 3. Try removing broken trailing string repetitions before closing brace
    try {
      const trimmed = match[0].replace(/"\s+[^"{}[\],:]+"\s*}/g, '"}');
      return JSON.parse(trimmed);
    } catch {}

    // 4. Try sanitizing control characters
    try {
      const sanitized = match[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
      return JSON.parse(sanitized);
    } catch {}
  }

  // 5. Intelligent field-by-field extraction fallback
  const summary = extractStringField(cleaned, "summary");
  const intent = (extractStringField(cleaned, "intent") || "modify_sop") as any;
  const actionType = (extractStringField(cleaned, "actionType") || "ingest_schedule") as any;
  const appliedExplanation = extractStringField(cleaned, "appliedExplanation") || "Respuesta procesada correctamente.";

  const ingestedSchedule = extractSubObject(cleaned, "ingestedSchedule");
  const occurrenceOverride = extractSubObject(cleaned, "occurrenceOverride");
  const occurrenceOverrides = extractSubArray(cleaned, "occurrenceOverrides");
  const addStaff = extractSubObject(cleaned, "addStaff");
  const staffModifications = extractSubArray(cleaned, "staffModifications");
  const absenceRange = extractSubObject(cleaned, "absenceRange");
  const accessUpdate = extractSubObject(cleaned, "accessUpdate");
  const accessUpdates = extractSubArray(cleaned, "accessUpdates");
  const updateAccountFinancials = extractSubArray(cleaned, "updateAccountFinancials");
  const eventBookings = extractSubArray(cleaned, "eventBookings");
  const qcScheduleBatch = extractSubArray(cleaned, "qcScheduleBatch");
  const cleanupStaffDuplicates = extractSubObject(cleaned, "cleanupStaffDuplicates");
  const commercialQuote = extractSubObject(cleaned, "commercialQuote");
  const dispatchSmsQuo = extractSubObject(cleaned, "dispatchSmsQuo");
  const cleanerAudit = extractSubObject(cleaned, "cleanerAudit");
  const scheduleConflictWarning = extractSubObject(cleaned, "scheduleConflictWarning");
  const sopModifications = extractSubArray(cleaned, "sopModifications");
  const taskModifications = extractSubArray(cleaned, "taskModifications");
  const extractedBookings = extractSubArray(cleaned, "extractedBookings");
  const extractedSalesTrack = extractSubArray(cleaned, "extractedSalesTrack");

  if (
    ingestedSchedule ||
    occurrenceOverride ||
    occurrenceOverrides ||
    addStaff ||
    staffModifications ||
    absenceRange ||
    accessUpdate ||
    accessUpdates ||
    updateAccountFinancials ||
    eventBookings ||
    qcScheduleBatch ||
    cleanupStaffDuplicates ||
    commercialQuote ||
    dispatchSmsQuo ||
    cleanerAudit ||
    sopModifications ||
    taskModifications ||
    extractedBookings ||
    extractedSalesTrack ||
    summary
  ) {
    return {
      intent: intent || (ingestedSchedule ? "modify_sop" : "general_query"),
      actionType: actionType || (ingestedSchedule ? "ingest_schedule" : "general_query"),
      summary: summary || "Se ha procesado la información correctamente.",
      ingestedSchedule: ingestedSchedule || undefined,
      occurrenceOverride: occurrenceOverride || undefined,
      occurrenceOverrides: occurrenceOverrides || undefined,
      addStaff: addStaff || undefined,
      staffModifications: staffModifications || undefined,
      absenceRange: absenceRange || undefined,
      accessUpdate: accessUpdate || undefined,
      accessUpdates: accessUpdates || undefined,
      updateAccountFinancials: updateAccountFinancials || undefined,
      eventBookings: eventBookings || undefined,
      qcScheduleBatch: qcScheduleBatch || undefined,
      cleanupStaffDuplicates: cleanupStaffDuplicates || undefined,
      commercialQuote: commercialQuote || undefined,
      dispatchSmsQuo: dispatchSmsQuo || undefined,
      cleanerAudit: cleanerAudit || undefined,
      scheduleConflictWarning: scheduleConflictWarning || undefined,
      sopModifications: sopModifications || undefined,
      taskModifications: taskModifications || undefined,
      extractedBookings: extractedBookings || undefined,
      extractedSalesTrack: extractedSalesTrack || undefined,
      appliedExplanation,
    };
  }

  // 6. Absolute Fallback: return raw text
  return {
    intent: "general_query",
    actionType: "general_query",
    summary: rawText,
    appliedExplanation: "Respuesta procesada correctamente.",
  };
}

// In-memory model discovery cache (10 min TTL)
let cachedModels: { models: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

const FALLBACK_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
];

async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedModels && now - cachedModels.timestamp < CACHE_TTL_MS && cachedModels.models.length > 0) {
    return cachedModels.models;
  }

  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(listUrl, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models)) {
        const available: string[] = data.models
          .filter(
            (m: any) =>
              m.name &&
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
          )
          .map((m: any) => m.name.replace(/^models\//, ""))
          .filter((name: string) => {
            const lower = name.toLowerCase();
            return lower.includes("gemini") && !lower.includes("embedding") && !lower.includes("aqa") && !lower.includes("imagen");
          });

        if (available.length > 0) {
          const rank = (name: string): number => {
            const lower = name.toLowerCase();
            if (lower === "gemini-2.0-flash" || lower === "gemini-2.5-flash") return 1;
            if (lower.includes("2.0-flash-lite") || lower.includes("flash-lite")) return 2;
            if (lower.includes("1.5-flash")) return 3;
            if (lower.includes("2.0-pro") || lower.includes("2.5-pro")) return 4;
            if (lower.includes("1.5-pro")) return 5;
            return 10;
          };

          const sorted = [...available].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
          cachedModels = { models: sorted, timestamp: now };
          return sorted;
        }
      }
    }
  } catch (err) {
    console.warn("[Gemini Client] Dynamic model fetch failed, using fallback list:", err);
  }

  return FALLBACK_MODELS;
}

export async function callGeminiSopCopilot({
  prompt,
  images = [],
  apiKey,
}: {
  prompt: string;
  images?: GeminiImageData[];
  apiKey?: string;
}): Promise<SopCopilotResponse> {
  const rawKey = apiKey || process.env.GEMINI_API_KEY || "";
  const resolvedKey = rawKey.replace(/^["']|["']$/g, "").trim();

  if (!resolvedKey) {
    throw new Error(
      "GEMINI_API_KEY no está configurada. Por favor añade GEMINI_API_KEY en tu archivo .env.local o variables de entorno."
    );
  }

  const rawCandidateModels = await getAvailableGeminiModels(resolvedKey);
  const candidateModels = rawCandidateModels.slice(0, 3);

  const imageParts = images.map((img) => ({
    inlineData: {
      mimeType: img.inlineData.mimeType,
      data: img.inlineData.data,
    },
  }));

  const userText =
    prompt ||
    "Por favor analiza la instrucción proporcionada y detecta la acción a ejecutar en el SOP, staff, cotización, despacho Quo/SMS o registro de cita.";

  const errorsLogged: string[] = [];

  for (const modelName of candidateModels) {
    // Attempt 1: Standard structured mode with systemInstruction + responseMimeType
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${resolvedKey}`;

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [...imageParts, { text: userText }],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch(url, {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          return robustParseJsonResponse(textOutput);
        }
      }

      // If status 400 (e.g. systemInstruction or responseMimeType not supported on older model endpoint)
      if (response.status === 400) {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${resolvedKey}`;
        const fallbackBody = {
          contents: [
            {
              role: "user",
              parts: [
                ...imageParts,
                {
                  text: `${SYSTEM_INSTRUCTION}\n\n[INSTRUCCIÓN DEL USUARIO]:\n${userText}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        };

        const fbController = new AbortController();
        const fbTimeoutId = setTimeout(() => fbController.abort(), 45000);

        const fallbackResponse = await fetch(fallbackUrl, {
          signal: fbController.signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fallbackBody),
        });
        clearTimeout(fbTimeoutId);

        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json();
          const fallbackText = fallbackResult?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (fallbackText) {
            return robustParseJsonResponse(fallbackText);
          }
        } else {
          const errText = await fallbackResponse.text();
          errorsLogged.push(`${modelName} (${fallbackResponse.status}): ${errText}`);
          console.warn(`[Gemini Fallback] Model ${modelName} fallback failed:`, errText);
          continue;
        }
      }

      const errorText = await response.text();
      errorsLogged.push(`${modelName} (${response.status}): ${errorText}`);
      console.warn(`[Gemini Fallback] Model ${modelName} returned ${response.status}. Trying next...`);
    } catch (err: any) {
      errorsLogged.push(`${modelName}: ${err?.message || String(err)}`);
      console.warn(`[Gemini Fallback] Exception with ${modelName}:`, err);
    }
  }

  const lastErr = errorsLogged[errorsLogged.length - 1] || "Error desconocido al contactar los modelos.";
  throw new Error(`No se pudo conectar con los modelos de Gemini disponibles. Detalle: ${lastErr}`);
}
