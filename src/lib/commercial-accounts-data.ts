export type ImportedCommercialAccount = {
  id: string;
  name: string;
  city: string | null;
  pricing_model: string | null;
  cleaner_name: string | null;
  hours: number | string | null;
  frequency: string | null;
  revenue: number | null;
  cost: number | null;
  payment_method: string | null;
  contract_start: string | null;
  contract_end: string | null;
  last_contact_date: string | null;
  last_qcc_date: string | null;
  has_supplies: boolean;
  has_keys: boolean;
  supply_delivery_date: string | null;
  estimated_fill_date: string | null;
  supplies_notes: string | null;
  source_sheet: string;
  schedule_rules?: ImportedCommercialScheduleRule[];
};


export type ImportedCommercialScheduleRule = {
  day_of_week: number;
  paid_hours: number;
  assigned_cleaner_name?: string | null;
  active?: boolean;
  frequency_type?: "monthly" | "weekly" | "custom" | "biweekly" | null;
  frequency_interval?: number | null;
  anchor_date?: string | null;
  notes?: string | null;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
};

export const importedCommercialAccounts: ImportedCommercialAccount[] = [
  { id: "import-13demarzo-irvine-31", name: "13demarzo", city: "Irvine", pricing_model: "flat rate", cleaner_name: "Sandra Hernandez", hours: 2.5, frequency: "2x per week", revenue: 950, cost: 499, payment_method: "Credit Card", contract_start: "2026-02-08", contract_end: "2027-02-02", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-14", has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 1, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08" },
    { day_of_week: 2, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08" },
    { day_of_week: 3, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08" },
    { day_of_week: 4, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08" },
    { day_of_week: 5, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08" },
    { day_of_week: 1, paid_hours: 2.5, assigned_cleaner_name: "Sandra Hernandez", effective_start_date: "2026-08-09" },
    { day_of_week: 4, paid_hours: 2.5, assigned_cleaner_name: "Sandra Hernandez", effective_start_date: "2026-08-09" },
  ] },
  { id: "import-888-on-main-santa-ana-2", name: "888 On Main", city: "Santa Ana", pricing_model: "Flat rate", cleaner_name: "Ana Morales", hours: 8, frequency: "5x per week", revenue: 4660, cost: 3680, payment_method: "Check", contract_start: "2024-01-02", contract_end: "2026-01-02", last_contact_date: null, last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Imported from hidden Accounts row; Mop, for renewal farms; Account sheet flag: Y", source_sheet: "Accounts hidden row" },
  { id: "import-besst-labs-orange-7", name: "Besst Labs", city: "Orange", pricing_model: "Per Service", cleaner_name: "Sandra Hernandez", hours: 4.5, frequency: "Weekly", revenue: 1095, cost: 439, payment_method: "ACH", contract_start: "2024-03-25", contract_end: "2026-03-25", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-14", has_supplies: true, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Account sheet flag: N", source_sheet: "Accounts" },
  { id: "import-cornerstone-rehab-santa-ana", name: "Cornerstone Rehab", city: "Santa Ana", pricing_model: "Flat Rate", cleaner_name: "Kassandra Valentin", hours: 7, frequency: "3x per week", revenue: 2850, cost: 1943.5, payment_method: "Credit card", contract_start: "2026-08-01", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts" },
  { id: "import-dr-bagheri-office-irvine-23", name: "Dr. Bagheri Office", city: "Irvine", pricing_model: "per Service", cleaner_name: "Mirna Contreras", hours: 3, frequency: "1x per week", revenue: 563.33, cost: 299.33, payment_method: "Credit Card", contract_start: "2025-11-07", contract_end: "2026-11-01", last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-elements-dentistry-fountain-valley-17", name: "Elements Dentistry", city: "Fountain Valley", pricing_model: "per Service", cleaner_name: null, hours: 2.5, frequency: "Weekly", revenue: 563, cost: 325, payment_method: null, contract_start: null, contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Imported from hidden Accounts row", source_sheet: "Accounts hidden row" },
  { id: "import-elevate-aerial-hb-huntington-beach-22", name: "Elevate Aerial HB", city: "Huntington Beach", pricing_model: "Flat rate", cleaner_name: "Luz Uribe", hours: 6, frequency: "1x per week", revenue: 800, cost: 498, payment_method: "Check", contract_start: "2025-12-07", contract_end: "2026-12-01", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-14", has_supplies: true, has_keys: false, supply_delivery_date: "2025-11-17", estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-field-ai-irvine-30", name: "Field AI", city: "Irvine", pricing_model: "flate rate", cleaner_name: "Ana Morales", hours: "3 for trash 6 for full cleaning", frequency: "5x per week", revenue: 3390, cost: 2093, payment_method: "ACH", contract_start: "2026-01-16", contract_end: "2027-01-12", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-14", has_supplies: true, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Extension cord, for vacuum", source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 1, paid_hours: 6, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-07-22" },
    { day_of_week: 2, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-07-22" },
    { day_of_week: 3, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-07-22" },
    { day_of_week: 4, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-07-22" },
    { day_of_week: 5, paid_hours: 2, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-07-22" },
    { day_of_week: 1, paid_hours: 6, assigned_cleaner_name: "Ana Morales", effective_start_date: "2026-07-23" },
    { day_of_week: 2, paid_hours: 3, assigned_cleaner_name: "Ana Morales", effective_start_date: "2026-07-23" },
    { day_of_week: 3, paid_hours: 3, assigned_cleaner_name: "Ana Morales", effective_start_date: "2026-07-23" },
    { day_of_week: 4, paid_hours: 3, assigned_cleaner_name: "Ana Morales", effective_start_date: "2026-07-23" },
    { day_of_week: 5, paid_hours: 3, assigned_cleaner_name: "Ana Morales", effective_start_date: "2026-07-23" },
  ] },
  { id: "import-flex-fitness-oc-laguna-hills-28", name: "Flex Fitness OC", city: "Laguna Hills", pricing_model: "flat rate", cleaner_name: null, hours: 5, frequency: "3x per week", revenue: 1680, cost: 997, payment_method: null, contract_start: null, contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Imported from hidden Accounts row", source_sheet: "Accounts hidden row" },
  { id: "import-globar-medspa-costa-mesa-35", name: "GLOBAR Medspa", city: "Costa Mesa", pricing_model: "flat rate", cleaner_name: "Juan Romero", hours: 3, frequency: "2x per week", revenue: 1450, cost: 468, payment_method: "Zelle", contract_start: "2026-04-01", contract_end: null, last_contact_date: null, last_qcc_date: "2026-04-14", has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Step ladder, duster extension", source_sheet: "Accounts" },
  { id: "import-green-leaf-botanicals-whittier-8", name: "Green Leaf Botanicals", city: "Whittier", pricing_model: "per Service", cleaner_name: "Lorena Benitez", hours: null, frequency: "Monthly", revenue: 238, cost: 119, payment_method: "Credit Card", contract_start: "2024-06-04", contract_end: "2026-06-04", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Account sheet flag: N", source_sheet: "Accounts" },
  { id: "import-hurst-siebert-san-clemente-25", name: "Hurst & Siebert", city: "San Clemente", pricing_model: "Flat rate", cleaner_name: null, hours: null, frequency: "1x per week", revenue: 779, cost: 380.64, payment_method: null, contract_start: null, contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Imported from hidden Accounts row", source_sheet: "Accounts hidden row" },
  { id: "import-ilg-corona-office-corona-19", name: "ILG Corona Office", city: "Corona", pricing_model: "Flat rate", cleaner_name: "Sandra Hernandez", hours: 3, frequency: "3x per week", revenue: 1163, cost: 897, payment_method: "Check", contract_start: "2025-12-01", contract_end: "2026-12-01", last_contact_date: "2026-02-18", last_qcc_date: "2026-03-11", has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-ilg-irvine-office-irvine-18", name: "ILG Irvine Office", city: "Irvine", pricing_model: "Flat rate", cleaner_name: "Maria Lopez", hours: 4, frequency: "3x per week", revenue: 1800, cost: 1196, payment_method: "Check", contract_start: "2025-12-01", contract_end: "2026-12-01", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-14", has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-ilg-valencia-office-valencia-21", name: "ILG Valencia Office", city: "Valencia", pricing_model: "Flat rate", cleaner_name: "Emmi Guerra", hours: 4.5, frequency: "3x per week", revenue: 1890, cost: 1345.5, payment_method: "Check", contract_start: "2026-02-02", contract_end: "2027-02-02", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts" },
  { id: "import-ilg-westlake-westlake-village-20", name: "ILG Westlake", city: "Westlake Village", pricing_model: "Flat rate", cleaner_name: "Emmi Guerra", hours: 2.5, frequency: "3x per week", revenue: 1130, cost: 747.5, payment_method: "Check", contract_start: "2026-02-02", contract_end: "2027-02-02", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts" },
  { id: "import-kott-koatings-lake-forest-13", name: "Kott Koatings", city: "Lake Forest", pricing_model: "per Service", cleaner_name: "Susana Bautista", hours: 3, frequency: "Every week", revenue: 606.67, cost: 299, payment_method: "Check", contract_start: "2025-07-28", contract_end: "2026-07-11", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: "2026-01-21", estimated_fill_date: null, supplies_notes: "Step Ladder (3 steps) Stainless steel cleaner 1 bottle Extended duster.; 2 vac, 2 buckets. full supplies; Account sheet flag: N", source_sheet: "Accounts" },
  { id: "import-kush-fine-art-laguna-beach-14", name: "Kush Fine Art", city: "Laguna Beach", pricing_model: "per Service", cleaner_name: "Sandra Hernandez", hours: 3, frequency: "Every 3 weeks", revenue: 340, cost: 95.31, payment_method: "Credit Card", contract_start: "2025-07-29", contract_end: "2026-07-11", last_contact_date: null, last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: "2025-08-26", estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-la-model-unit-cleaning-compton-11", name: "LA Model Unit Cleaning", city: "Compton", pricing_model: "per Service", cleaner_name: "Esperanza Youseff", hours: null, frequency: "Weekly", revenue: 1451, cost: 736, payment_method: "Check", contract_start: "2025-07-11", contract_end: "2026-07-11", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Team supplies sheet cleaner: Esperanza Yoseff; Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-lifted-dentistry-irvine", name: "Lifted Dentistry", city: "Irvine", pricing_model: "per service", cleaner_name: null, hours: 3, frequency: "every other week", revenue: 335, cost: 149, payment_method: "Zelle", contract_start: "2026-08-01", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts" },
  { id: "import-lsg-sky-chefs-costa-mesa", name: "LSG Sky Chefs", city: "Costa Mesa", pricing_model: "Flat Rate", cleaner_name: "Luz and Maria", hours: 10, frequency: "7x per week", revenue: 10750, cost: 7495, payment_method: "ACH", contract_start: "2026-06-01", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 0, paid_hours: 10, assigned_cleaner_name: "Maria Mejia", effective_start_date: "2026-07-09" },
    { day_of_week: 1, paid_hours: 10, assigned_cleaner_name: "Maria Mejia", effective_start_date: "2026-07-09" },
    { day_of_week: 2, paid_hours: 10, assigned_cleaner_name: "Luz Uribe", effective_start_date: "2026-07-09" },
    { day_of_week: 3, paid_hours: 10, assigned_cleaner_name: "Maria Mejia", effective_start_date: "2026-07-09" },
    { day_of_week: 4, paid_hours: 10, assigned_cleaner_name: "Maria Mejia", effective_start_date: "2026-07-09" },
    { day_of_week: 5, paid_hours: 10, assigned_cleaner_name: "Luz Uribe", effective_start_date: "2026-07-09" },
    { day_of_week: 6, paid_hours: 10, assigned_cleaner_name: "Luz Uribe", effective_start_date: "2026-07-09" },
  ] },
  { id: "import-macarthur-dental-arts-irvine-37", name: "MacArthur Dental Arts", city: "Irvine", pricing_model: "Flat Rate", cleaner_name: "Kassandra Valentin", hours: 1.5, frequency: "4x per week", revenue: 1060, cost: 746.92, payment_method: "Credit card", contract_start: "2026-04-12", contract_end: null, last_contact_date: null, last_qcc_date: "2026-04-14", has_supplies: true, has_keys: true, supply_delivery_date: "2025-04-12", estimated_fill_date: null, supplies_notes: "Alarm code: TO ARM: 7897 ARM TO DISARM: 7897 DISARM. Lockbox code: 8544. The dumpster is on the right side of the parking lot. Internal: Monday to Wednesday, light cleaning and trash removal. We give the keys to the operating services team once a week. Floor mopping is once a week, on Thursdays.", source_sheet: "Accounts" },
  { id: "import-mama-s-restaurant-huntington-beach-3", name: "Mama's Restaurant", city: "Huntington Beach", pricing_model: "Per Service", cleaner_name: "Juan Romero", hours: 11.11, frequency: "Weekly (Fri)", revenue: 1898, cost: 902, payment_method: "Check", contract_start: "2024-04-01", contract_end: "2026-04-01", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-10", has_supplies: false, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Internal: No alarm, the team has keys. Enfesis bathrooms, kitchen floor, the manager's contact information is important. (we provide him with an additional mop bucket.; Account sheet flag: Y). Rate per service: $200.00 ($44/hr).", source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 5, paid_hours: 4, assigned_cleaner_name: "Juan Romero", effective_start_date: "2024-04-01" },
  ] },
  { id: "import-mama-s-restaurant-los-alamitos-4", name: "Mama's Restaurant", city: "Los Alamitos", pricing_model: "Per Service", cleaner_name: "Juan Romero", hours: 4, frequency: "1x per week (Fri)", revenue: 2028, cost: 858, payment_method: "Check", contract_start: "2026-04-09", contract_end: "2025-12-01", last_contact_date: "2026-02-18", last_qcc_date: "2026-04-16", has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 5, paid_hours: 4, assigned_cleaner_name: "Juan Romero", effective_start_date: "2024-04-01" },
  ] },
  { id: "import-miracle-minds-newport-32", name: "Miracle Minds", city: "Newport", pricing_model: "flate rate", cleaner_name: "Luz Uribe", hours: 2.75, frequency: "2x per week", revenue: 1750, cost: 822.25, payment_method: "Credit Card", contract_start: "2026-02-10", contract_end: "2027-02-02", last_contact_date: "2026-02-18", last_qcc_date: "2026-03-10", has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts" },
  { id: "import-miwa-office-irvine-27", name: "MIWA Office", city: "Irvine", pricing_model: "per Service", cleaner_name: "Susana Bautista", hours: 2, frequency: "1x per week", revenue: 480, cost: 239, payment_method: "ACH", contract_start: "2025-12-26", contract_end: "2026-12-01", last_contact_date: null, last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: "2026-01-21", estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-moxi3-costa-mesa", name: "MOXI3 Costa Mesa", city: "Costa Mesa", pricing_model: "Flat Rate", cleaner_name: "Luz Uribe", hours: 3.5, frequency: "3x per week", revenue: 1100, cost: 642, payment_method: "Credit card", contract_start: "2026-08-13", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Lockbox code 3400. ALARM CODE: 1480. Internal: Dumpster around the back of the building. Ensuring lock is completely lock in front and back door. Making sure we dont unplug the sound system or any cables in the gym. Saturday cleanings are only for the training room, flooring and mirrors in the training room. We steam clean the pilates mats 2x per month on the first and 3rd Saturday.", source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 1, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
    { day_of_week: 4, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
    { day_of_week: 6, paid_hours: 3.5, assigned_cleaner_name: "Luz Uribe" },
  ] },
  { id: "import-moxi3-dana-point", name: "MOXI3 Dana Point", city: "Dana Point", pricing_model: "Flat Rate", cleaner_name: "Ana Morales", hours: 3, frequency: "2x per week", revenue: 1000, cost: 642, payment_method: "Credit card", contract_start: "2026-06-01", contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts" },
  { id: "import-ocss-office-huntington-beach-29", name: "OCSS Office", city: "Huntington Beach", pricing_model: "flat rate", cleaner_name: "Mirna Contreras", hours: 2.5, frequency: "Twice a month", revenue: 380, cost: 125, payment_method: "Credit Card", contract_start: "2026-01-12", contract_end: "2027-01-12", last_contact_date: null, last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts" },
  { id: "import-orange-county-dermatology-team-supplies-20", name: "Orange County Dermatology", city: null, pricing_model: null, cleaner_name: "Mirna Contreras", hours: null, frequency: null, revenue: null, cost: null, payment_method: null, contract_start: null, contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: "2026-01-30", estimated_fill_date: null, supplies_notes: "Full set, plus dry mop and dust extender, and bunch of towels; Flat dust mop, standup vacuum.", source_sheet: "Team supplies" },
  { id: "import-posh-pooch-seal-beach-15", name: "Posh Pooch", city: "Seal Beach", pricing_model: "per Service", cleaner_name: "Luz Uribe", hours: 4, frequency: "Every month on 2nd Mon", revenue: 338, cost: 92, payment_method: "Credit Card", contract_start: "2026-08-12", contract_end: "2026-08-25", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: true, has_keys: true, supply_delivery_date: "2025-08-26", estimated_fill_date: null, supplies_notes: "Address: 350 Main Street, Seal Beach, CA 90740. Time: 3:00 PM - 8:15 PM. Internal: Only cleaning the Posh Pooch suite. Key is given and separate vacuum is left at the job. We dont clean the cages, everything else is done in detail, especially pet wash area for dog hair. We go when closed on Sunday or Monday.", source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 1, paid_hours: 4, assigned_cleaner_name: "Luz Uribe", frequency_type: "monthly", anchor_date: "2026-08-10", notes: "1x per month on Monday (2nd Monday: Aug 10, Sep 14)" }
  ] },
  { id: "import-renewable-farms-aliso-viejo-16", name: "Renewable Farms", city: "Aliso Viejo", pricing_model: "per Service", cleaner_name: "Ana Morales", hours: 3, frequency: "As needed", revenue: 720, cost: 396, payment_method: "Credit Card", contract_start: "2025-11-01", contract_end: "2026-11-01", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-revive-real-estate-irvine-24", name: "Revive Real Estate", city: "Irvine", pricing_model: "per Service", cleaner_name: "Sandra Hernandez", hours: 4, frequency: "Every 2 weeks", revenue: 498.33, cost: 199.34, payment_method: "Check", contract_start: "2025-12-01", contract_end: "2026-12-01", last_contact_date: null, last_qcc_date: null, has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Imported from hidden Accounts row; Account sheet flag: Y", source_sheet: "Accounts hidden row" },
  { id: "import-sierra-analytical-aliso-viejo-9", name: "Sierra Analytical Lab", city: "Laguna Hills", pricing_model: "per Service", cleaner_name: "Luz Uribe", hours: 6, frequency: "Every 14 days", revenue: 533, cost: 292.5, payment_method: "Check", contract_start: "2026-07-09", contract_end: "2026-04-29", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: "2025-07-07", estimated_fill_date: null, supplies_notes: "Address: 26052 Merit Circle, Laguna Hills, CA 92653. Internal: Cleaning around glass vials on countertops, detailed cleaning in front lobby area, desks, and all surfaces in offices. Bathroom details important & front lobby dusting. Dumpster through back door (prop open so it doesn't lock). Trash bags under sink in kitchen.", source_sheet: "Accounts" },
  { id: "import-stance-gym-cleaning-san-clemente-12", name: "Stance Gym Cleaning", city: "San Clemente", pricing_model: "per Service", cleaner_name: "Sandra Hernandez", hours: 3, frequency: "3x per week", revenue: 1560, cost: 897, payment_method: "Credit Card", contract_start: "2024-11-12", contract_end: "2026-11-12", last_contact_date: "2026-02-18", last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Imported from hidden Accounts row; Account sheet flag: Y/N Need drew", source_sheet: "Accounts hidden row" },
  { id: "import-steripax-huntington-beach-36", name: "Steripax", city: "Huntington Beach", pricing_model: "flat rate", cleaner_name: "Lucia Portillo", hours: "6 and 8", frequency: "5x per week", revenue: 5152.7, cost: 3386.06, payment_method: "ACH", contract_start: "2026-04-01", contract_end: null, last_contact_date: null, last_qcc_date: "2026-04-13", has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts", schedule_rules: [
    { day_of_week: 1, paid_hours: 5.75, assigned_cleaner_name: "Lucia Portillo" },
    { day_of_week: 2, paid_hours: 5.75, assigned_cleaner_name: "Lucia Portillo" },
    { day_of_week: 3, paid_hours: 7.517, assigned_cleaner_name: "Lucia Portillo" },
    { day_of_week: 4, paid_hours: 7.517, assigned_cleaner_name: "Lucia Portillo" },
    { day_of_week: 5, paid_hours: 5.75, assigned_cleaner_name: "Lucia Portillo" },
  ] },
  { id: "import-surf-city-endo-team-supplies-14", name: "Surf City Endo", city: null, pricing_model: null, cleaner_name: "Mirna Contreras", hours: null, frequency: null, revenue: null, cost: null, payment_method: null, contract_start: null, contract_end: null, last_contact_date: null, last_qcc_date: null, has_supplies: true, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Imported from Team supplies sheet only", source_sheet: "Team supplies" },
  { id: "import-swing-easy-golf-club-costa-mesa-5", name: "Swing Easy Golf Club Costa Mesa", city: "Costa Mesa", pricing_model: "Flat rate", cleaner_name: "Sandra Hernandez", hours: 3, frequency: "Every week on Wed", revenue: 520, cost: 299, payment_method: "Credit Card", contract_start: "2025-12-03", contract_end: "2026-05-01", last_contact_date: "2026-04-15", last_qcc_date: "2026-03-12", has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Address: 2960 Airway Avenue, Costa Mesa, CA 92626. Internal: Key given, dumpster in parking lot back. Important to dust monitors and keyboards in hitting bay. Supplies either in bathroom for trash bags or under bar area.", source_sheet: "Accounts" },
  { id: "import-swing-easy-golf-club-yorba-linda-6", name: "Swing Easy Golf Club Yorba Linda", city: "Yorba Linda", pricing_model: "Flat rate", cleaner_name: "Sandra Hernandez", hours: 3, frequency: "Every 14 days", revenue: 486, cost: 200, payment_method: "Credit Card", contract_start: "2025-12-04", contract_end: "2026-04-11", last_contact_date: "2026-04-15", last_qcc_date: "2026-03-12", has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "Address: 22755 Savi Ranch Parkway, Yorba Linda, CA 92887. Internal: Dumpster for trash in parking lot, supplies in bathroom & bar area, lobby dusting important as well hitting bay monitors, tables, keyboards. Cubbies in left side of building dusting important.", source_sheet: "Accounts" },
  { id: "import-the-harper-wedding-venue-costa-mesa-33", name: "The Harper Wedding Venue", city: "Costa Mesa", pricing_model: "per Service", cleaner_name: "Juan Romero", hours: 5, frequency: "As needed", revenue: 2990, cost: 1170, payment_method: "Check", contract_start: "2026-02-01", contract_end: "2027-02-01", last_contact_date: null, last_qcc_date: "2026-04-18", has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: "mop bucket; $90.00 payment to Juan Romero per event, $230.00 charged", source_sheet: "Accounts" },
  { id: "import-university-park-dental-irvine-10", name: "University Park Dental", city: "Irvine", pricing_model: "per Service", cleaner_name: "Susana Bautista", hours: 2.25, frequency: "Every 2 weeks", revenue: 325, cost: 112.13, payment_method: "Credit Card", contract_start: "2025-06-07", contract_end: "2026-06-07", last_contact_date: null, last_qcc_date: "2026-04-13", has_supplies: true, has_keys: false, supply_delivery_date: "2025-07-07", estimated_fill_date: null, supplies_notes: "Account sheet flag: Y", source_sheet: "Accounts" },
  { id: "import-vntr-fitness-rancho-santa-margarita-26", name: "VNTR Fitness", city: "Rancho Santa Margarita", pricing_model: "flat rate", cleaner_name: "Ana Morales", hours: 2.5, frequency: "3x per week", revenue: 1258, cost: 858, payment_method: "Credit Card", contract_start: "2026-01-12", contract_end: "2027-01-12", last_contact_date: null, last_qcc_date: "2026-04-20", has_supplies: true, has_keys: true, supply_delivery_date: "2025-01-10", estimated_fill_date: "Only vacuum", supplies_notes: "Team supplies sheet cleaner: Ana Morales", source_sheet: "Accounts" },
  { id: "import-wren-spa-costa-mesa-34", name: "Wren Spa", city: "Costa Mesa", pricing_model: "flat rate", cleaner_name: "Luz Uribe", hours: 4, frequency: "1x per week", revenue: 740, cost: 399, payment_method: "Credit card", contract_start: "2026-03-01", contract_end: "2026-06-01", last_contact_date: null, last_qcc_date: "2026-04-09", has_supplies: true, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, supplies_notes: null, source_sheet: "Accounts" },
  { 
    id: "import-13demarzo-new", 
    name: "13deMarzo", 
    city: "Irvine", 
    pricing_model: "flat rate", 
    cleaner_name: "Sandra Hernandez", 
    hours: 2.5, 
    frequency: "5x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-08-01", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Dumpster in front of the building to the right of Capital Seafood Restaurant. Park vehicle in the main parking lot. Take special emphasis on all surfaces.", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-interior-logic-corona-new", 
    name: "Interior Logic Group - Corona Office", 
    city: "Corona", 
    pricing_model: "flat rate", 
    cleaner_name: "Sandra Hernandez", 
    hours: 3, 
    frequency: "3x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2025-11-22", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Look at the alarm code. Call Jake with any questions. Alarm: TO TURN THE ALARM OFF (WHITE ALARM AROUND CORNER ON THE LEFT) 49001 (OFF) TO SET WHEN FINISHED 49002 (AWAY) DO NOT PRESS 3 (STAY BUTTON)", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-interior-logic-irvine-new", 
    name: "Interior Logic Group - Irvine Office", 
    city: "Irvine", 
    pricing_model: "flat rate", 
    cleaner_name: "Maria Lopez", 
    hours: 2.5, 
    frequency: "3x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2025-11-19", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Use keys to clean Suite 100 and Suite 110. Internal: Only cleaning suite 100 from now on. Details on front surface door are important. No bathroom or outside hallway cleaning needed. Two different keys, one for main entrance and one for the suite 100.", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-moxi3-dana-point-new", 
    name: "MOXI3", 
    city: "Dana Point", 
    pricing_model: "flat rate", 
    cleaner_name: null, 
    hours: 3, 
    frequency: "2x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-06-12", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Lockbox code 5464. Supplies (toilet paper, trash bags, liners) are in supply closet, when running low please let us know. ALARM CODE: 1480. Internal: Floor details around machines are super important. Lockbox is either on the right side gate, or around the left corner of the building.", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-cornerstone-southern-california-new", 
    name: "Cornerstone Southern California", 
    city: "Santa Ana", 
    pricing_model: "flat rate", 
    cleaner_name: "Kassandra Valentin", 
    hours: 6.5, 
    frequency: "3x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-08-16", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Comments: Alarm code 0505. Internal: Detailed dusting is super important. Multiple keys are given, one for office door, one for supply closet door. Restocking supplies is super important... Leave individual offices locked after cleaning.", 
    source_sheet: "Manual Upload" 
  }
,

  { 
    id: "import-field-ai-irvine-new", 
    name: "Field AI", 
    city: "Irvine", 
    pricing_model: "flat rate", 
    cleaner_name: "Veronica Ladinos", 
    hours: 6, 
    frequency: "5x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-01-13", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Monday through Friday Trash. Monday full office cleaning. Be sure all toilet paper dispensers have at least 1 FULL roll. Kitchen cleaning needs coffee machine detailed cleaning...", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-glo-bar-medspa-costa-mesa-new", 
    name: "GLO Bar MedSpa", 
    city: "Costa Mesa", 
    pricing_model: "flat rate", 
    cleaner_name: "Juan Romero", 
    hours: 3, 
    frequency: "2x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-04-02", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: true, has_keys: true, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Door code: 5436. Alarm code: 2891. Internal: Details around staff kitchen and baseboards, chair details in all operatory rooms... Key is given and dumpster is outside the back door to the right.", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-kush-fine-art-laguna-beach-new", 
    name: "Kush Fine Art", 
    city: "Laguna Beach", 
    pricing_model: "flat rate", 
    cleaner_name: null, 
    hours: 3, 
    frequency: "Every 21 days", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2025-12-22", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Internal: Detailed dusting not touching sculptures or pieces. Bathroom cleaning necessary. Cobweb cleaning is a must. Parking is the hardest part. Parking near the library or on side streets...", 
    source_sheet: "Manual Upload" 
  },
  { 
    id: "import-kott-koatings-lake-forest-new", 
    name: "Kott Koatings", 
    city: "Lake Forest", 
    pricing_model: "flat rate", 
    cleaner_name: "Susana Bautista", 
    hours: 3, 
    frequency: "1x per week", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-08-25", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Instructions: Cleaning the front lobby, 2 bathrooms, and offices to the left and to the right of the lobby. Not cleaning anything in the back area... Internal: Alfredo is the man that will allow them in... No key or alarm needed.", 
    source_sheet: "Manual Upload" 
  },
  {
    id: "import-oc-spine-sports-physicians", 
    name: "Orange County Spine and Sports Physicians", 
    city: "Huntington Beach", 
    pricing_model: "flat rate", 
    cleaner_name: "Mirna Contreras", 
    hours: 2.5, 
    frequency: "2nd & 4th Sat of Month", 
    revenue: null, cost: null, payment_method: null, 
    contract_start: "2026-01-31", 
    contract_end: null, last_contact_date: null, last_qcc_date: null, 
    has_supplies: false, has_keys: false, supply_delivery_date: null, estimated_fill_date: null, 
    supplies_notes: "Address: 18800 Delaware Street, Huntington Beach, CA 92648. Time: 9:00 AM - 11:20 AM. Internal: Building is at the top of a business center. Dumpsters are in the parking lot below. Street parking is necessary because parking lot adjacent to building is paid. Suite 1000 is on the 10th floor entered by elevator. Door for suite 1000 is to the left from elevator.", 
    source_sheet: "Manual Upload" 
  },
];
