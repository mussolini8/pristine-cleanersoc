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
  { name: "Ana Morales", phone: "714-715-9147", status: "Active", type: "Location-Based" },
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

/**
 * Official Residential Cleaner Contacts & Phone Directory
 */
export const RESIDENTIAL_CLEANER_CONTACTS: CleanerContact[] = [
  { name: "Maria Tolentino", phone: "(714) 770-2778", status: "Active", type: "Location-Based" },
  { name: "Sofia Diaz", phone: "(310) 346-6672", status: "Active", type: "Location-Based" },
  { name: "Miriam Lopez", phone: "(949) 903-4038", status: "Active", type: "Location-Based" },
  { name: "Lorena Benitez", phone: "714-439-6223", status: "Active", type: "Location-Based" },
  { name: "Jasmine Cardenas", phone: "657-425-9072", status: "Active", type: "Location-Based" },
  { name: "Juan Romero", phone: "840-239-9108", status: "Active", type: "Location-Based" },
  { name: "Rosa Calderon", phone: "714-659-9949", status: "Active", type: "Location-Based" },
  { name: "Blanca Garcia", phone: "714-615-8757", status: "Active", type: "Location-Based" },
];

export const CLEANER_PHONE_DIRECTORY: Record<string, string> = {
  "ana morales": "714-715-9147",
  "emmi guerra": "747-218-8351",
  "emmi garcia": "747-218-8351",
  "kassandra valentin": "714-715-9147",
  "lesbia vasquez": "714-312-9183",
  "lucia portillo": "714-660-8440",
  "luz uribe": "951-622-4922",
  "maria lopez": "714-499-0339",
  "maria mejia": "951-407-2157",
  "maria mejias": "951-407-2157",
  "mirna contreras": "657-397-3158",
  "rossy legorreta": "714-757-5641",
  "sandra hernandez": "714-483-5971",
  "maria tolentino": "714-770-2778",
  "sofia diaz": "310-346-6672",
  "miriam lopez": "949-903-4038",
  "lorena benitez": "714-439-6223",
  "jasmine cardenas": "657-425-9072",
  "juan romero": "840-239-9108",
  "rosa calderon": "714-659-9949",
  "blanca garcia": "714-615-8757",
};

export function getCleanerPhone(name: string | null | undefined): string | null {
  if (!name) return null;
  const norm = name.trim().toLowerCase();
  for (const [key, phone] of Object.entries(CLEANER_PHONE_DIRECTORY)) {
    if (norm.includes(key) || key.includes(norm)) return phone;
  }
  return null;
}
