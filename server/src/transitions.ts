// BR-01: the only legal status changes in Sprint 1.
const ALLOWED: Record<string, string[]> = {
  DRAFT: ["PENDING"],
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}
