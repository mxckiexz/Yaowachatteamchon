// F-04: who may read a request (BR-12). The owner; an approver for every request that is not a draft;
// the administrator for all. Everyone else gets "not found".
export function visibilityWhere(user: { id: number; role: string }) {
  if (user.role === "ADMIN") return {};
  if (user.role === "APPROVER") return { OR: [{ requesterId: user.id }, { status: { not: "DRAFT" as const } }] };
  return { requesterId: user.id };
}
