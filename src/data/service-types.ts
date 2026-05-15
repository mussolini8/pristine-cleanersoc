/**
 * Service Types for Pristine Cleaners / Pristine Janitorial
 * Defines all cleaning service types and their operational requirements
 */

export type ServiceCategory = "residential" | "commercial";
export type ServiceType =
  | "standard-residential"
  | "deep-residential"
  | "move-in-out"
  | "recurring-residential"
  | "office-cleaning"
  | "day-porter"
  | "restaurant-cleaning"
  | "retail-cleaning"
  | "post-construction"
  | "property-management"
  | "restroom-maintenance"
  | "breakroom-cleaning";

export interface ServiceTypeDefinition {
  id: ServiceType;
  label: string;
  category: ServiceCategory;
  description: string;
  includes: string[];
  checklistRequired: boolean;
  beforeAfterPhotosRequired: boolean;
  estimatedDuration: string;
  commonIssues: string[];
  qualityCheckpoints: string[];
  followUpSuggestion: string;
}

export const SERVICE_TYPES: Record<ServiceType, ServiceTypeDefinition> = {
  // ─── RESIDENTIAL ─────────────────────────────────────────────
  "standard-residential": {
    id: "standard-residential",
    label: "Standard Cleaning",
    category: "residential",
    description: "Regular home cleaning for maintained homes",
    includes: [
      "Kitchen surfaces and appliances",
      "Bathrooms (toilet, sink, tub/shower)",
      "Bedrooms and living areas dusting",
      "Floor vacuuming and mopping",
      "Trash removal",
      "Light fixtures and glass",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "2-3 hours",
    commonIssues: [
      "Missed high shelves or fans",
      "Incomplete bathroom cleaning",
      "Streaks on windows/glass",
      "Floor edges not reached",
    ],
    qualityCheckpoints: [
      "All surfaces dust-free",
      "Bathrooms sparkling",
      "Floors completely clean",
      "No missed spots",
    ],
    followUpSuggestion: "Request review after 3-5 days to ensure satisfaction",
  },

  "deep-residential": {
    id: "deep-residential",
    label: "Deep Cleaning",
    category: "residential",
    description: "Thorough cleaning including baseboards, details, and neglected areas",
    includes: [
      "All standard cleaning items",
      "Baseboards and door frames",
      "Cabinet fronts and pulls",
      "Light switch covers",
      "Detailed dusting (shelves, photo frames)",
      "Inside shower/tub buildup removal",
      "Appliance interiors if accessible",
      "Grout and tile detail work",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: true,
    estimatedDuration: "4-6 hours",
    commonIssues: [
      "Incomplete baseboard coverage",
      "Missed cabinet details",
      "Insufficient grout cleaning",
      "Time management on large homes",
    ],
    qualityCheckpoints: [
      "Baseboards completely clean",
      "Grout lines detailed",
      "All fixtures sparkling",
      "No dust on high shelves",
      "Details complete",
    ],
    followUpSuggestion: "Follow up within 24 hours to confirm satisfaction",
  },

  "move-in-out": {
    id: "move-in-out",
    label: "Move-In / Move-Out Cleaning",
    category: "residential",
    description: "Complete cleaning for property transitions",
    includes: [
      "Empty all cabinets and drawers (inside)",
      "Clean cabinet interiors",
      "Closet cleaning",
      "Baseboards and door frames",
      "Appliance interiors and exteriors",
      "Detailed bathroom cleaning",
      "Floor edges and corners",
      "Windows inside and outside if accessible",
      "Oven interior",
      "Refrigerator interior",
      "Final walkthrough with photos",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: true,
    estimatedDuration: "6-8 hours",
    commonIssues: [
      "Incomplete cabinet interior cleaning",
      "Missed closet spaces",
      "Oven not fully cleaned",
      "Time management on large homes",
    ],
    qualityCheckpoints: [
      "All cabinets empty and clean inside",
      "Appliances food-free inside",
      "Baseboards pristine",
      "Final walkthrough complete",
      "Photos documented",
    ],
    followUpSuggestion: "Provide move-in/move-out report with photos to client",
  },

  "recurring-residential": {
    id: "recurring-residential",
    label: "Recurring Cleaning",
    category: "residential",
    description: "Regular maintenance cleaning on recurring schedule",
    includes: [
      "Same as standard cleaning",
      "Client-specific preferences noted on account",
      "Familiar team assignment recommended",
      "Priority area attention",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "2-3 hours",
    commonIssues: [
      "Inconsistent cleaners between visits",
      "Overlooking client preferences",
      "Missed frequency adjustments",
    ],
    qualityCheckpoints: [
      "Same quality as first visit",
      "Client preferences honored",
      "No missed appointments",
    ],
    followUpSuggestion: "Monthly client satisfaction check-in",
  },

  // ─── COMMERCIAL ──────────────────────────────────────────────
  "office-cleaning": {
    id: "office-cleaning",
    label: "Office Cleaning",
    category: "commercial",
    description: "Professional office space cleaning",
    includes: [
      "Reception area",
      "Conference rooms",
      "Individual offices",
      "Restrooms",
      "Breakroom/kitchenette",
      "Common hallways",
      "Trash and recycling",
      "High-touch surfaces",
      "Floors (vacuum and mop)",
      "Doors and glass touchpoints",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "2-4 hours",
    commonIssues: [
      "Incomplete high-touch sanitization",
      "Trash not fully emptied",
      "Glass/doors left streaky",
      "Breakroom not restocked",
    ],
    qualityCheckpoints: [
      "All surfaces sanitized",
      "Trash completely removed",
      "Glass and mirrors streak-free",
      "Restrooms spotless",
    ],
    followUpSuggestion: "Weekly or bi-weekly consistent scheduling",
  },

  "day-porter": {
    id: "day-porter",
    label: "Day Porter Service",
    category: "commercial",
    description: "During-business-hours facility maintenance and cleaning",
    includes: [
      "Restroom checks and cleaning",
      "Trash and recycling management",
      "Lobby/common area resets",
      "Spill response",
      "Supply restocking",
      "High-traffic touchpoint sanitization",
      "Client-logged issues response",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "Hourly or as-needed",
    commonIssues: [
      "Missed restroom checks",
      "Slow response to spills",
      "Inconsistent supply restocking",
      "Client communication gaps",
    ],
    qualityCheckpoints: [
      "Restrooms checked hourly",
      "Spills cleaned immediately",
      "Supplies maintained",
      "Client issues logged",
    ],
    followUpSuggestion: "Daily end-of-day report to client contact",
  },

  "restaurant-cleaning": {
    id: "restaurant-cleaning",
    label: "Restaurant Cleaning",
    category: "commercial",
    description: "Specialized restaurant kitchen and facility cleaning",
    includes: [
      "Kitchen deep clean",
      "Grease removal",
      "Equipment cleaning",
      "Floor stripping if needed",
      "Grout and tile detail",
      "Dining area cleaning",
      "Restrooms (commercial-grade)",
      "Trash and grease trap area",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "4-6 hours (after hours typical)",
    commonIssues: [
      "Insufficient grease removal",
      "Equipment damage",
      "Incomplete floor cleaning",
      "Health code compliance gaps",
    ],
    qualityCheckpoints: [
      "Grease completely removed",
      "Equipment sanitized",
      "Floors clean and safe",
      "Health code standards met",
    ],
    followUpSuggestion: "Monthly health inspection readiness verification",
  },

  "retail-cleaning": {
    id: "retail-cleaning",
    label: "Retail Cleaning",
    category: "commercial",
    description: "Retail store and showroom cleaning",
    includes: [
      "Sales floor cleaning and organization",
      "Display cleaning",
      "Restrooms",
      "Breakroom/employee area",
      "Trash removal",
      "Windows and glass doors",
      "High-touch surfaces",
      "Floors (vacuum and mop)",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "2-4 hours",
    commonIssues: [
      "Display damage during cleaning",
      "Product disruption",
      "Missed high shelves",
      "Poor timing during operating hours",
    ],
    qualityCheckpoints: [
      "Displays pristine",
      "No product damage",
      "Floors spotless",
      "Windows clear",
    ],
    followUpSuggestion: "Ask manager for feedback on timing and coverage",
  },

  "post-construction": {
    id: "post-construction",
    label: "Post-Construction Cleaning",
    category: "commercial",
    description: "Cleanup after construction or renovation work",
    includes: [
      "Debris removal",
      "Dust cleanup",
      "Floor finish (based on spec)",
      "Window/glass cleanup",
      "Fixture polishing",
      "Final walkthrough",
      "Photo documentation",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: true,
    estimatedDuration: "Varies by project scope",
    commonIssues: [
      "Missed construction debris",
      "Dust in hard-to-reach places",
      "Floor finish inconsistency",
      "Timeline coordination with contractors",
    ],
    qualityCheckpoints: [
      "No construction debris visible",
      "Dust completely removed",
      "Surfaces match spec",
      "Photos approved",
    ],
    followUpSuggestion: "Deliver final photos and post-construction report",
  },

  "property-management": {
    id: "property-management",
    label: "Property Management Cleaning",
    category: "commercial",
    description: "Common areas and shared spaces in managed properties",
    includes: [
      "Common area cleaning",
      "Hallways and stairs",
      "Lobby/entrance",
      "Restrooms (common)",
      "Trash areas",
      "Landscaping cleanup if applicable",
      "Parking area sweep",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "2-3 hours",
    commonIssues: [
      "Inconsistent quality between visits",
      "Tenant complaints about timing",
      "Trash area overflow",
    ],
    qualityCheckpoints: [
      "Common areas immaculate",
      "Restrooms spotless",
      "Trash areas managed",
      "Lobby welcoming",
    ],
    followUpSuggestion: "Monthly property manager walkthrough and feedback",
  },

  "restroom-maintenance": {
    id: "restroom-maintenance",
    label: "Restroom Maintenance",
    category: "commercial",
    description: "Specialized restroom cleaning and sanitization",
    includes: [
      "Toilet cleaning and sanitization",
      "Sink and faucet cleaning",
      "Mirror and glass cleaning",
      "Floor sanitization",
      "Grout cleaning",
      "Supply restocking (soap, paper towels, etc.)",
      "Trash removal",
      "High-touch surface sanitization",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "30-60 minutes per restroom",
    commonIssues: [
      "Incomplete sanitization",
      "Supply stockouts",
      "Grout not cleaned",
      "Faucets left streaky",
    ],
    qualityCheckpoints: [
      "All surfaces sanitized per protocol",
      "Supplies fully stocked",
      "No odors",
      "Surfaces streak-free",
    ],
    followUpSuggestion: "Daily or weekly check-in depending on frequency",
  },

  "breakroom-cleaning": {
    id: "breakroom-cleaning",
    label: "Breakroom Cleaning",
    category: "commercial",
    description: "Kitchen and breakroom cleaning for offices and facilities",
    includes: [
      "Countertop cleaning and sanitization",
      "Appliance exterior and interior",
      "Sink cleaning",
      "Trash and recycling",
      "Refrigerator condenser coil",
      "Microwave interior and exterior",
      "Floor sweeping and mopping",
      "Supply restocking (coffee, cups, etc. if included)",
    ],
    checklistRequired: true,
    beforeAfterPhotosRequired: false,
    estimatedDuration: "45-90 minutes",
    commonIssues: [
      "Appliance interior overlooked",
      "Sticky floors",
      "Supplies not maintained",
      "Spill response time",
    ],
    qualityCheckpoints: [
      "All appliances clean inside/out",
      "Surfaces sanitized",
      "Floors spotless",
      "Supplies ready",
    ],
    followUpSuggestion: "Weekly checklist photo log for client",
  },
};

export function getServiceType(id: ServiceType): ServiceTypeDefinition | undefined {
  return SERVICE_TYPES[id];
}

export function getServiceTypesByCategory(category: ServiceCategory): ServiceTypeDefinition[] {
  return Object.values(SERVICE_TYPES).filter((st) => st.category === category);
}

export function getResidentialServices(): ServiceTypeDefinition[] {
  return getServiceTypesByCategory("residential");
}

export function getCommercialServices(): ServiceTypeDefinition[] {
  return getServiceTypesByCategory("commercial");
}
