type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const FRIENDLY_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/payment_amount|amount|greater than 0/i, "Payment amount must be greater than 0."],
  [/duplicate|unique/i, "This looks like a duplicate record."],
  [/status/i, "Status is not valid for this record."],
  [/schedule/i, "Commercial schedule is incomplete."],
  [/permission|policy|rls|unauthorized/i, "You do not have permission to save this change."],
  [/network|fetch/i, "Could not reach the server. Please try again."],
];

export function isMissingSchemaTableError(error: SupabaseErrorLike | null | undefined) {
  const message = String(error?.message ?? "").toLowerCase();
  return error?.code === "PGRST205" || (message.includes("schema cache") && message.includes("could not find the table"));
}

export function parseSupabaseError(error: SupabaseErrorLike | Error | null | undefined, fallback = "Could not save changes. Please try again.") {
  if (!error) return fallback;
  const rawMessage = error instanceof Error ? error.message : error.message;
  const message = String(rawMessage ?? "").trim();
  if (!message) return fallback;

  for (const [pattern, friendly] of FRIENDLY_ERROR_PATTERNS) {
    if (pattern.test(message)) return friendly;
  }

  return message;
}

export function errorMessage(error: unknown, fallback = "Could not save changes. Please try again.") {
  if (error instanceof Error) return parseSupabaseError(error, fallback);
  if (typeof error === "string") return error;
  return fallback;
}

export function validationMessage(issue: { message?: string } | null | undefined, fallback = "Please review the highlighted fields.") {
  return issue?.message ?? fallback;
}
