import type { PurchaseRequest, RequestItem, RequestHistory, User } from "@prisma/client";
import { satangToBaht } from "./money.js";

export type RequestWithRelations = PurchaseRequest & {
  items: RequestItem[];
  requester: Pick<User, "id" | "name">;
  approver: Pick<User, "id" | "name"> | null;
  history?: (RequestHistory & { actor: Pick<User, "id" | "name"> })[];
};

export const REQUEST_INCLUDE = {
  items: { orderBy: { id: "asc" as const } },
  requester: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true } },
};

// Shape of a request in API responses: money in baht, dates as ISO strings.
export function serializeRequest(r: RequestWithRelations) {
  return {
    id: r.id,
    title: r.title,
    justification: r.justification,
    status: r.status,
    total: satangToBaht(r.totalSatang),
    items: r.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, unitPrice: satangToBaht(i.unitPriceSatang) })),
    requester: r.requester,
    approver: r.approver,
    createdAt: r.createdAt,
    submittedAt: r.submittedAt,
    decidedAt: r.decidedAt,
    decisionComment: r.decisionComment,
    ...(r.history
      ? {
          history: r.history.map((h) => ({
            id: h.id,
            action: h.action,
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            comment: h.comment,
            createdAt: h.createdAt,
            actor: h.actor,
          })),
        }
      : {}),
  };
}
