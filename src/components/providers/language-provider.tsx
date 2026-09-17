"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

export type Language = "en" | "es";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  isEn: boolean;
  isEs: boolean;
  translateTaskTitle: (title: string) => string;
  translateCategory: (category: string) => string;
}

const STORAGE_KEY = "pristine_sop_language";
const COPILOT_LANG_KEY = "pristine_copilot_lang";

// Bilingual dictionary
const DICTIONARY: Record<string, { en: string; es: string }> = {
  // Navigation
  "nav.dashboard": { en: "Dashboard", es: "Panel Principal" },
  "nav.sales_track": { en: "Sales Track & AI Copilot", es: "Ventas y Copiloto IA" },
  "nav.task_reminders": { en: "Task Reminders", es: "Recordatorios de Tareas" },
  "nav.residential": { en: "Residential payments / commercial hours", es: "Pagos residenciales / horas comerciales" },
  "nav.schedules": { en: "Schedules (Comm & QC)", es: "Schedules (Comercial y QC)" },
  "nav.commercial_accounts": { en: "Commercial Accounts", es: "Cuentas Comerciales" },
  "nav.qc_inspections": { en: "QC Inspections", es: "Inspecciones de Calidad (QC)" },
  "nav.staff": { en: "Staff / Teams", es: "Personal / Equipos" },
  "nav.reports": { en: "Reports", es: "Reportes" },
  "nav.settings": { en: "Settings", es: "Configuración" },
  "nav.import_bookingkoala": { en: "Import BookingKoala", es: "Importar BookingKoala" },
  "nav.premium_sop": { en: "Premium cleaning SOP", es: "SOP de limpieza premium" },
  "nav.operations_sop": { en: "Operations SOP", es: "SOP de Operaciones" },
  "nav.signed_in": { en: "Signed in", es: "Conectado como" },
  "nav.sign_out": { en: "Sign out", es: "Cerrar sesión" },

  // SOP Tasks & Metrics
  "sop.pending": { en: "Pending", es: "Pendiente" },
  "sop.overdue": { en: "Overdue", es: "Vencida" },
  "sop.completed": { en: "Completed", es: "Completada" },
  "sop.all": { en: "All", es: "Todas" },
  "sop.open_reminders": { en: "Open reminders", es: "Recordatorios abiertos" },
  "sop.past_due": { en: "Past due", es: "Fuera de plazo" },
  "sop.closed_tasks": { en: "Closed tasks", es: "Tareas cerradas" },
  "sop.monthly_sop": { en: "Monthly SOP", es: "SOP Mensual" },
  "sop.search_reminders": { en: "Search reminders", es: "Buscar recordatorios" },
  "sop.all_sources": { en: "All sources", es: "Todas las fuentes" },
  "sop.clear": { en: "Clear", es: "Limpiar" },
  "sop.month": { en: "Month", es: "Mes" },
  "sop.day": { en: "Day", es: "Día" },
  "sop.list": { en: "List", es: "Lista" },
  "sop.task_list": { en: "Task list", es: "Lista de tareas" },
  "sop.tasks_by_day": { en: "Tasks by day", es: "Tareas por día" },
  "sop.task_calendar": { en: "Task calendar", es: "Calendario de tareas" },
  "sop.today": { en: "Today", es: "Hoy" },
  "sop.unassigned": { en: "Unassigned", es: "Sin asignar" },
  "sop.mark_completed": { en: "Mark completed", es: "Marcar completada" },
  "sop.edit_task": { en: "Edit task", es: "Editar tarea" },
  "sop.delete_task": { en: "Delete task", es: "Eliminar tarea" },
  "sop.generate_monthly_sop": { en: "Generate Monthly SOP", es: "Generar SOP Mensual" },
  "sop.generating": { en: "Generating...", es: "Generando..." },
  "sop.remove_duplicates": { en: "Remove duplicates", es: "Eliminar duplicados" },
  "sop.removing_duplicates": { en: "Removing duplicates...", es: "Eliminando duplicados..." },
  "sop.not_generated": { en: "Monthly SOP not generated for", es: "SOP mensual no generado para" },
  "sop.not_generated_sub": {
    en: "Generate the 56 recurring SOP task instances from active Monthly SOP templates.",
    es: "Genera las 56 instancias recurrentes del SOP desde las plantillas activas.",
  },

  // Schedules Actions & Drawer
  "schedule.drawer_title": { en: "Commercial Visit Details", es: "Detalles de la Visita Comercial" },
  "schedule.cleaner": { en: "Assigned Cleaner", es: "Cleaner Asignada" },
  "schedule.date_time": { en: "Date & Time", es: "Fecha y Hora" },
  "schedule.location": { en: "Location", es: "Ubicación" },
  "schedule.notes": { en: "Notes", es: "Notas" },
  "schedule.actions": { en: "Schedule Actions", es: "Acciones de Programación" },
  "schedule.reschedule": { en: "Reschedule", es: "Reagendar" },
  "schedule.reassign": { en: "Reassign Cleaner", es: "Reasignar Cleaner" },
  "schedule.cancel_visit": { en: "Cancel Visit", es: "Cancelar Visita" },
  "schedule.close_action_panel": { en: "Close action panel", es: "Cerrar panel de acción" },
  "schedule.new_date": { en: "New Date", es: "Nueva Fecha" },
  "schedule.reschedule_scope": { en: "Reschedule Scope", es: "Alcance del Reagendamiento" },
  "schedule.move_entire_schedule": { en: "Move entire schedule", es: "Mover todo el schedule" },
  "schedule.move_entire_sub": { en: "Re-anchors recurrence starting from this new date forward.", es: "Reancla la recurrencia desde esta nueva fecha en adelante." },
  "schedule.only_this_visit": { en: "Only this visit", es: "Solo esta visita" },
  "schedule.only_this_visit_sub": { en: "Moves only this specific visit date.", es: "Mueve únicamente la fecha de esta visita puntual." },
  "schedule.recurring_frequency": { en: "Recurring Frequency", es: "Frecuencia Recurrente" },
  "schedule.review_confirm_change": { en: "Review and Confirm Change", es: "Revisar y Confirmar Cambio" },
  "schedule.new_cleaner": { en: "New Cleaner / Assigned Team", es: "Nueva Cleaner / Equipo Asignado" },
  "schedule.select_cleaner": { en: "-- Select cleaner --", es: "-- Seleccionar cleaner --" },
  "schedule.assignment_scope": { en: "Assignment Scope", es: "Alcance del Cambio" },
  "schedule.permanent": { en: "Permanent", es: "Permanente" },
  "schedule.permanent_sub": { en: "Applies to all future visits in the schedule.", es: "Aplica a todas las visitas futuras del schedule." },
  "schedule.single_sub": { en: "Temporary replacement for this visit only.", es: "Reemplazo puntual solo para esta visita." },
  "schedule.review_confirm_assignment": { en: "Review and Confirm Assignment", es: "Revisar y Confirmar Asignación" },
  "schedule.cancellation_type": { en: "Cancellation Type", es: "Tipo de Cancelación" },
  "schedule.cancel_this_visit": { en: "Cancel only this visit", es: "Solo cancelar esta visita" },
  "schedule.cancel_this_visit_sub": { en: "Cancels visit for this specific date.", es: "Cancela la visita de esta fecha puntual." },
  "schedule.deactivate_account": { en: "Deactivate account", es: "Desprogramar cuenta" },
  "schedule.deactivate_account_sub": { en: "Ends schedule / contract starting from this date forward.", es: "Finaliza el contrato a partir de esta fecha en adelante." },
  "schedule.reason_optional": { en: "Reason / Note (optional)", es: "Motivo / Nota (opcional)" },
  "schedule.reason_placeholder": { en: "e.g. Client request, holiday, etc.", es: "Ej. Solicitud del cliente, feriado, etc." },
  "schedule.review_confirm_cancellation": { en: "Review and Confirm Cancellation", es: "Revisar y Confirmar Cancelación" },
  "schedule.confirmation_title": { en: "Schedule Operation Confirmation", es: "Confirmación de Operación en Schedule" },
  "schedule.account_label": { en: "Account:", es: "Cuenta:" },
  "schedule.action_label": { en: "Action:", es: "Acción:" },
  "schedule.confirm_execute": { en: "Confirm and Execute Now", es: "Confirmar y Ejecutar Ahora" },
  "schedule.saving_changes": { en: "Saving changes...", es: "Guardando cambios..." },
  "schedule.back": { en: "Back", es: "Volver" },
  "schedule.close": { en: "Close", es: "Cerrar" },
  "schedule.view_in_accounts": { en: "View in Commercial Accounts", es: "Ver en Cuentas Comerciales" },
  "schedule.view_hours_payments": { en: "View Hours / Payments", es: "Ver Horas / Pagos" },

  // AI Copilot & Modals
  "copilot.title": { en: "AI SOP & Operations Copilot (Gemini)", es: "Copiloto IA de SOP y Operaciones (Gemini)" },
  "copilot.upload_image": { en: "Upload Screenshot / Image", es: "Subir Captura / Imagen" },
  "copilot.voice_dictate": { en: "Voice Dictate", es: "Dictar por Voz" },
  "copilot.stop_mic": { en: "Stop Microphone", es: "Detener Micrófono" },
  "copilot.listening_en": { en: "Listening in English... speak now", es: "Listening in English... speak now" },
  "copilot.listening_es": { en: "Escuchando en español... habla ahora", es: "Escuchando en español... habla ahora" },
  "copilot.analyze_process": { en: "Analyze & Process", es: "Analizar & Procesar" },
  "copilot.analyzing": { en: "Analyzing with Gemini...", es: "Analizando con Gemini..." },
  "copilot.diagnosis": { en: "Gemini Diagnosis & Analysis", es: "Diagnóstico y Análisis de Gemini" },
  "copilot.detected_mods": { en: "Detected Operational / SOP Modifications", es: "Modificaciones Operativas / SOP Detectadas" },
  "copilot.delete_account": { en: "Delete Account", es: "Eliminar Cuenta" },
  "copilot.reschedule_action": { en: "Reschedule", es: "Reagendar" },
  "copilot.change_team": { en: "Change Team", es: "Cambiar Equipo" },
  "copilot.confirm_apply": { en: "Confirm & Apply to System", es: "Confirmar y Aplicar al Sistema" },
  "copilot.review_notice": {
    en: "Review details before confirming and applying changes to your system.",
    es: "Revisa los datos antes de confirmar y aplicarlos a tu sistema.",
  },
  "copilot.button": { en: "AI Copilot (Gemini)", es: "Copiloto IA (Gemini)" },

  // Frequencies
  "freq.one_time": { en: "One-time", es: "Una vez" },
  "freq.daily": { en: "Daily", es: "Diario" },
  "freq.weekly": { en: "Weekly", es: "Semanal" },
  "freq.every_2_weeks": { en: "Every 2 weeks", es: "Cada 2 semanas" },
  "freq.every_3_weeks": { en: "Every 3 weeks", es: "Cada 3 semanas" },
  "freq.every_15_days": { en: "Every 15 days", es: "Cada 15 días" },
  "freq.monthly": { en: "Monthly", es: "Mensual" },
  "freq.custom": { en: "Custom", es: "Personalizado" },
};

// Task Title Translation dictionary for SOP tasks
const TASK_TRANSLATIONS: Record<string, string> = {
  "Draft all recurring invoices during the last week of the month": "Preparar todas las facturas recurrentes durante la última semana del mes",
  "Update monthly labor income tracker during the last week of the month": "Actualizar el registro mensual de ingresos laborales durante la última semana del mes",
  "Confirm all invoices were sent during the first week of the month": "Confirmar que todas las facturas fueron enviadas durante la primera semana del mes",
  "Conduct cleaner check-ins with every cleaning team on the 3rd Wednesday of the month": "Realizar revisiones con cada equipo de limpieza el 3er miércoles del mes",
  "Maintain communication logs and updates for all active accounts": "Mantener registros de comunicación y actualizaciones de todas las cuentas activas",
  "Keep CRM, Google Drive folders, and tracking sheets organized": "Mantener organizados el CRM, carpetas de Google Drive y hojas de seguimiento",
  "Create a list of current clients that could potentially add additional recurring services": "Crear lista de clientes actuales con potencial de servicios recurrentes adicionales",
  "Review accounts for upsell opportunities": "Revisar cuentas para oportunidades de ventas adicionales (upsell)",
  "Organize notes for follow-up conversations": "Organizar notas para conversaciones de seguimiento",
  "Contact Teams to configure monthly availability": "Contactar a los equipos para configurar disponibilidad mensual",
  "Gather pictures from team for Google Business Profile (GMB) post drafting": "Recopilar fotos del equipo para publicaciones de Google Business Profile (GMB)",
  "Draft GMB content/posts for review": "Redactar borradores de publicaciones de GMB para revisión",
  "Create a list of all client/customer messages that have not been responded to": "Crear lista de todos los mensajes de clientes sin responder",
  "Organize callbacks and follow-up priorities": "Organizar devoluciones de llamadas y prioridades de seguimiento",
  "Draft weekly geofence tracking report for all cleaners at every account": "Preparar informe semanal de seguimiento geofence de todas las cleaners en cada cuenta",
  "Include notes regarding attendance, timing irregularities, or concerns": "Incluir notas sobre asistencia, irregularidades de horarios o inquietudes",
  "Send full paragraph summary report to Jake": "Enviar informe de resumen completo por párrafo a Jake",
  "Confirm all QC check-ins are scheduled for every recurring account": "Confirmar que todas las revisiones de QC estén programadas para cada cuenta recurrente",
  "Organize QC calendar confirmations": "Organizar confirmaciones de calendario de QC",
  "Prepare drafted client reports for completed QC inspections": "Preparar borradores de reportes a clientes para inspecciones QC completadas",
  "Prepare drafted text messages/emails to send clients after QC completion": "Preparar borradores de SMS/emails para enviar a clientes tras completar QC",
  "Create/update recurring service add-on opportunity list for clients": "Crear/actualizar lista de oportunidades de servicios adicionales para clientes",
  "Check in with all cleaners regarding supply inventory needs": "Revisar con todas las cleaners las necesidades de inventario de suministros",
  "Create list of supplies needing replenishment": "Crear lista de suministros que necesitan reposición",
  "Confirm urgent inventory shortages": "Confirmar escasez urgente de inventario",
  "Send Jake an updated list of current potential commercial cleaners": "Enviar a Jake la lista actualizada de potenciales cleaners comerciales",
  "Send Jake an updated list of current potential residential cleaners": "Enviar a Jake la lista actualizada de potenciales cleaners residenciales",
  "Gather pictures for GMB content drafting": "Recopilar fotos para borradores de contenido GMB",
  "Draft GMB posts for review": "Redactar publicaciones de GMB para revisión",
  "Create list of all unanswered messages needing responses/callbacks": "Crear lista de mensajes no respondidos que requieren respuesta/llamada",
  "Include notes on attendance consistency and issues": "Incluir notas sobre consistencia de asistencia y problemas",
  "Conduct monthly cleaner check-ins with every cleaning team": "Realizar revisiones mensuales con cada equipo de limpieza",
  "Document cleaner feedback/issues": "Documentar comentarios/problemas de las cleaners",
  "Note staffing concerns or performance updates": "Anotar inquietudes del personal o actualizaciones de rendimiento",
  "Confirm morale and operational concerns are addressed": "Confirmar que las inquietudes operativas y de moral sean atendidas",
  "Create list of all unanswered client/customer messages": "Crear lista de mensajes de clientes sin responder",
  "Include notes regarding missed punches, late arrivals, or concerns": "Incluir notas sobre marcaciones perdidas, llegadas tarde o inquietudes",
  "Conduct second monthly supply inventory check-in with all cleaners": "Realizar segunda revisión mensual de inventario con todas las cleaners",
  "Create updated replenishment list": "Crear lista actualizada de reposición",
  "Confirm upcoming supply orders needed": "Confirmar pedidos de suministros necesarios próximamente",
  "Create list of all unanswered messages/callback opportunities": "Crear lista de mensajes no respondidos / oportunidades de llamada",
  "Draft all recurring invoices for next month": "Preparar todas las facturas recurrentes para el próximo mes",
  "Prepare next month SOP checklist template": "Preparar la plantilla de checklist del SOP para el próximo mes",
};

// Category translation dictionary
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Billing": "Facturación",
  "Billing / Reporting": "Facturación / Reportes",
  "Client Follow-Up": "Seguimiento a Clientes",
  "Cleaner Coordination": "Coordinación de Cleaners",
  "Quality Control": "Control de Calidad (QC)",
  "Inventory": "Inventario",
  "Marketing": "Marketing",
  "Reporting": "Reportes",
  "Admin / CRM": "Administración / CRM",
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
  isEn: true,
  isEs: false,
  translateTaskTitle: (t: string) => t,
  translateCategory: (c: string) => c,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to English as requested
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === "en" || stored === "es") {
        setLanguageState(stored);
      } else {
        // Enforce English as default
        setLanguageState("en");
        localStorage.setItem(STORAGE_KEY, "en");
      }
    } catch {
      setLanguageState("en");
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      localStorage.setItem(COPILOT_LANG_KEY, lang === "en" ? "en-US" : "es-US");
      window.dispatchEvent(new Event("languagechange"));
    } catch {}
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "es" : "en");
  }, [language, setLanguage]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const entry = DICTIONARY[key];
      if (entry) {
        return entry[language] || entry.en;
      }
      return fallback || key;
    },
    [language]
  );

  const translateTaskTitle = useCallback(
    (title: string): string => {
      if (language === "en") return title;
      return TASK_TRANSLATIONS[title] || title;
    },
    [language]
  );

  const translateCategory = useCallback(
    (category: string): string => {
      if (language === "en") return category;
      return CATEGORY_TRANSLATIONS[category] || category;
    },
    [language]
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
      isEn: language === "en",
      isEs: language === "es",
      translateTaskTitle,
      translateCategory,
    }),
    [language, setLanguage, toggleLanguage, t, translateTaskTitle, translateCategory]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Modern header toggle button for English / Spanish
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, isEn } = useLanguage();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-border/70 bg-card/80 p-0.5 shadow-2xs backdrop-blur-md",
        className
      )}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all duration-150 cursor-pointer",
          isEn
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
        )}
        title="Switch to English"
      >
        <span>🇺🇸</span>
        <span>EN</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage("es")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all duration-150 cursor-pointer",
          !isEn
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
        )}
        title="Cambiar a Español"
      >
        <span>🇪🇸</span>
        <span>ES</span>
      </button>
    </div>
  );
}
