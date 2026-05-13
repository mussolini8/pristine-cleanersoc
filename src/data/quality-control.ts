/**
 * Quality Control System for Pristine Cleaners / Pristine Janitorial
 * Defines quality checkpoints, standards, and processes
 */

export type QCStatus = "pending" | "passed" | "needs_review" | "re_clean_required" | "resolved";
export type QCSeverity = "minor" | "moderate" | "major";

export interface QCCheckpoint {
  id: string;
  label: string;
  description: string;
  category: "safety" | "cleanliness" | "client-satisfaction" | "documentation";
  required: boolean;
}

export interface QCIssue {
  id: string;
  jobId: string;
  area: string;
  severity: QCSeverity;
  description: string;
  photosProvided: boolean;
  dateReported: string;
  resolvedDate?: string;
  resolutionNotes?: string;
}

export interface QCResult {
  jobId: string;
  status: QCStatus;
  scorePercentage: number;
  checklistCompletion: number;
  clientFeedback?: string;
  issues: QCIssue[];
  managerNotes: string;
  dateChecked: string;
  re_cleanScheduled?: string;
}

// ─── Quality Standards by Service Type ────────────────────────────────────

export const RESIDENTIAL_QC_STANDARDS: QCCheckpoint[] = [
  {
    id: "res-dust-free",
    label: "All surfaces dust-free",
    description: "Shelves, furniture, baseboards, and fixtures should be free of visible dust",
    category: "cleanliness",
    required: true,
  },
  {
    id: "res-bathrooms",
    label: "Bathrooms sparkling clean",
    description:
      "Toilets, sinks, tubs, showers cleaned thoroughly. No stains or residue visible",
    category: "cleanliness",
    required: true,
  },
  {
    id: "res-floors",
    label: "Floors completely clean",
    description:
      "No debris, dust, or streaks. Edges and corners included. All rooms covered",
    category: "cleanliness",
    required: true,
  },
  {
    id: "res-appliances",
    label: "Kitchen appliances clean",
    description: "Countertops, stove, refrigerator exterior, microwave exterior clean",
    category: "cleanliness",
    required: true,
  },
  {
    id: "res-client-satisfaction",
    label: "Client satisfied with results",
    description: "Follow up with client to confirm satisfaction within 24 hours",
    category: "client-satisfaction",
    required: true,
  },
  {
    id: "res-trash-empty",
    label: "All trash removed",
    description: "Trash bins emptied and liners replaced if applicable",
    category: "cleanliness",
    required: true,
  },
];

export const DEEP_CLEAN_QC_STANDARDS: QCCheckpoint[] = [
  ...RESIDENTIAL_QC_STANDARDS,
  {
    id: "deep-baseboards",
    label: "Baseboards spotless",
    description: "All baseboards dust-free and clean. No missed areas",
    category: "cleanliness",
    required: true,
  },
  {
    id: "deep-grout",
    label: "Grout and tile detailed",
    description: "Visible grout lines cleaned. Tile detail work complete",
    category: "cleanliness",
    required: true,
  },
  {
    id: "deep-appliance-interiors",
    label: "Appliance interiors clean if accessible",
    description:
      "Oven interior, refrigerator interior, microwave interior cleaned per standard",
    category: "cleanliness",
    required: false,
  },
  {
    id: "deep-before-after",
    label: "Before/after photos documented",
    description: "Photos taken and provided to client showing quality of work",
    category: "documentation",
    required: true,
  },
];

export const COMMERCIAL_QC_STANDARDS: QCCheckpoint[] = [
  {
    id: "com-reception",
    label: "Reception area immaculate",
    description: "Entrance and reception areas set the tone. Must be pristine",
    category: "cleanliness",
    required: true,
  },
  {
    id: "com-restrooms",
    label: "Restrooms sanitized",
    description: "All surfaces sanitized. High-touch areas prioritized",
    category: "safety",
    required: true,
  },
  {
    id: "com-glass-clean",
    label: "Glass and doors streak-free",
    description: "All glass surfaces, mirrors, and doors cleaned and polished",
    category: "cleanliness",
    required: true,
  },
  {
    id: "com-trash-removed",
    label: "All trash removed",
    description: "Trash bins emptied completely. Recycling organized",
    category: "cleanliness",
    required: true,
  },
  {
    id: "com-high-touch",
    label: "High-touch surfaces sanitized",
    description: "Door handles, light switches, desks, railings sanitized",
    category: "safety",
    required: true,
  },
  {
    id: "com-floor-clean",
    label: "Floors clean and safe",
    description: "No hazards, debris, or spills. Properly mopped if applicable",
    category: "safety",
    required: true,
  },
  {
    id: "com-manager-approval",
    label: "Manager/client approval obtained",
    description: "Final walkthrough or communication with client representative",
    category: "client-satisfaction",
    required: true,
  },
];

export const JANITORIAL_QC_STANDARDS: QCCheckpoint[] = [
  {
    id: "jan-restroom-check",
    label: "Restrooms checked and maintained",
    description: "Restrooms checked at scheduled intervals. Fully stocked and clean",
    category: "cleanliness",
    required: true,
  },
  {
    id: "jan-trash-managed",
    label: "Trash managed",
    description: "Trash bins checked and emptied as scheduled. Bags replaced",
    category: "cleanliness",
    required: true,
  },
  {
    id: "jan-spill-response",
    label: "Spills cleaned immediately",
    description: "Quick response to spills. Floors kept safe for occupants",
    category: "safety",
    required: true,
  },
  {
    id: "jan-high-touch",
    label: "High-touch surfaces sanitized",
    description: "Door handles, railings, light switches sanitized per schedule",
    category: "safety",
    required: true,
  },
  {
    id: "jan-supply-stocked",
    label: "Supplies restocked",
    description: "Soap, paper towels, toilet paper, etc. maintained at acceptable levels",
    category: "cleanliness",
    required: true,
  },
  {
    id: "jan-client-contact",
    label: "Client contact logged",
    description: "Any client issues or requests logged and communicated",
    category: "client-satisfaction",
    required: true,
  },
];

// ─── Common QC Issues (for reference/training) ────────────────────────────

export const COMMON_QC_ISSUES = {
  residential: [
    "Dust missed on high shelves or ceiling fans",
    "Incomplete bathroom cleaning (grout, behind toilet)",
    "Streaks or residue on mirrors/windows",
    "Baseboards not cleaned",
    "Floor edges and corners not reached",
    "Trash bags not replaced",
    "Client-identified problem areas overlooked",
  ],
  commercial: [
    "High-touch surfaces not sanitized properly",
    "Trash bins not completely emptied",
    "Glass left with streaks or smudges",
    "Restroom supplies not restocked",
    "Floor hazards (wet areas unmarked)",
    "Time management (leaving work incomplete)",
    "Client-reported missed areas",
  ],
  janitorial: [
    "Missed restroom checks at scheduled time",
    "Supply stockouts",
    "Slow response to reported spills",
    "Incomplete high-touch sanitization",
    "Trash overflow before scheduled pickup",
    "Client communication logs not updated",
    "Inconsistency between visits",
  ],
};

// ─── QC Scoring ──────────────────────────────────────────────────────────

export function calculateQCScore(
  passedCheckpoints: number,
  totalCheckpoints: number,
  issueCount: number
): { score: number; status: QCStatus } {
  const baseScore = (passedCheckpoints / totalCheckpoints) * 100;
  const issueDeduction = Math.min(issueCount * 5, 20);
  const finalScore = Math.max(0, baseScore - issueDeduction);

  let status: QCStatus = "pending";
  if (finalScore >= 95) status = "passed";
  else if (finalScore >= 80 && issueCount === 0) status = "passed";
  else if (finalScore < 80 || issueCount > 2) status = "re_clean_required";
  else status = "needs_review";

  return { score: Math.round(finalScore), status };
}

// ─── QC Process Flow ─────────────────────────────────────────────────────

export const QC_PROCESS_FLOW = [
  {
    step: 1,
    title: "Job Completed",
    description: "Cleaner completes job and marks as completed in system",
  },
  {
    step: 2,
    title: "Quality Check Initiated",
    description: "Manager or QC specialist pulls job details and checklist",
  },
  {
    step: 3,
    title: "Checklist Review",
    description: "Review job against service-specific quality checklist",
  },
  {
    step: 4,
    title: "Client Feedback",
    description: "Contact client to confirm satisfaction (24-48 hours post-service)",
  },
  {
    step: 5,
    title: "Issue Documentation",
    description: "Document any issues found with photos and detailed notes",
  },
  {
    step: 6,
    title: "Resolution Decision",
    description: "Determine if job passes, needs review, or requires re-clean",
  },
  {
    step: 7,
    title: "Re-clean if Needed",
    description: "Schedule re-clean with same or different team member",
  },
  {
    step: 8,
    title: "Follow-up Verification",
    description: "Verify re-clean completed satisfactorily or close ticket",
  },
  {
    step: 9,
    title: "Documentation Complete",
    description: "Archive QC record with final score and learnings noted",
  },
];

// ─── Cleaner Coaching Based on QC Issues ────────────────────────────────

export function getCoachingNotes(issues: QCIssue[]): string[] {
  const notes: string[] = [];

  for (const issue of issues) {
    if (issue.area.toLowerCase().includes("dust")) {
      notes.push("Reminder: Check high surfaces, ceiling fans, and shelf tops");
    }
    if (issue.area.toLowerCase().includes("bathroom")) {
      notes.push(
        "Bathroom checklist: grout lines, behind toilet, corners, baseboards"
      );
    }
    if (issue.area.toLowerCase().includes("floor")) {
      notes.push("Floors: Pay special attention to edges, corners, and transitions");
    }
    if (issue.area.toLowerCase().includes("glass") ||
      issue.area.toLowerCase().includes("mirror")) {
      notes.push("Glass/mirrors: Use proper technique to avoid streaks. Dry completely");
    }
    if (issue.area.toLowerCase().includes("baseboards")) {
      notes.push("Baseboards: Wipe from top to bottom. Check for missed sections");
    }
  }

  return [...new Set(notes)]; // Remove duplicates
}
