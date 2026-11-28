// F-11 revises F-03 AC-31/TEST-46: a submitted request may be returned to DRAFT.
const ALLOWED: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}
