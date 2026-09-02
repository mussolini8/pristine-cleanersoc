/**
 * Official Cleaner Contacts & Phone Directory
 * Extracted from official staff schedules.
 * Note: Jake Ivan-Pal and Juan Romero are intentionally excluded from this list per operational instruction.
 */

export type CleanerContact = {
  name: string;
  phone: string;
  status: "Active" | "Inactive";
  type: "Location-Based" | "Staff/Support";
};

export const CLEANER_CONTACTS: CleanerContact[] = [
  { name: "Emmi Guerra", phone: "747-218-8351", status: "Active", type: "Location-Based" },
  { name: "Kassandra Valentin", phone: "714-715-9147", status: "Active", type: "Location-Based" },
  { name: "Lesbia Vasquez", phone: "714-312-9183", status: "Active", type: "Location-Based" },
  { name: "Lucia Portillo", phone: "714-660-8440", status: "Active", type: "Location-Based" },
  { name: "Luz Uribe", phone: "951-622-4922", status: "Active", type: "Location-Based" },
  { name: "Maria Lopez", phone: "714-499-0339", status: "Active", type: "Staff/Support" },
  { name: "Maria Mejia", phone: "951-407-2157", status: "Active", type: "Location-Based" },
  { name: "Mirna Contreras", phone: "657-397-3158", status: "Active", type: "Location-Based" },
  { name: "Rossy Legorreta", phone: "714-757-5641", status: "Active", type: "Location-Based" },
  { name: "Sandra Hernandez", phone: "714-483-5971", status: "Active", type: "Location-Based" },
];

export const CLEANER_PHONE_DIRECTORY: Record<string, string> = {
  "emmi guerra": "747-218-8351",
  "kassandra valentin": "714-715-9147",
  "lesbia vasquez": "714-312-9183",
  "lucia portillo": "714-660-8440",
  "luz uribe": "951-622-4922",
  "maria lopez": "714-499-0339",
  "maria mejia": "951-407-2157",
  "mirna contreras": "657-397-3158",
  "rossy legorreta": "714-757-5641",
  "sandra hernandez": "714-483-5971",
};

export function getCleanerPhone(name: string | null | undefined): string | null {
  if (!name) return null;
  const norm = name.trim().toLowerCase();
  for (const [key, phone] of Object.entries(CLEANER_PHONE_DIRECTORY)) {
    if (norm.includes(key) || key.includes(norm)) return phone;
  }
  return null;
}
