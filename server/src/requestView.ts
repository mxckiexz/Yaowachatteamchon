import type { PurchaseRequest, RequestHistory, User } from "@prisma/client";
import { satangToBaht } from "./money.js";

export type RequestWithRelations = PurchaseRequest & {
  requester: Pick<User, "id" | "name">;
  history?: (RequestHistory & { actor: Pick<User, "id" | "name"> })[];
};

export const REQUEST_INCLUDE = {
  requester: { select: { id: true, name: true } },
};

export const HISTORY_INCLUDE = {
  history: { include: { actor: { select: { id: true, name: true } } }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
};

export function serializeHistory(h: RequestHistory & { actor: Pick<User, "id" | "name"> }) {
  return {
    id: h.id,
    action: h.action,
    fromStatus: h.fromStatus,
    toStatus: h.toStatus,
    comment: h.comment,
    createdAt: h.createdAt,
    actor: h.actor,
  };
}

// Shape of a request in API responses: money in baht, dates as ISO strings.
export function serializeRequest(r: RequestWithRelations) {
  return {
    id: r.id,
    requestNumber: r.requestNumber,
    itemName: r.itemName,
    description: r.description,
    quantity: r.quantity,
    unitPrice: satangToBaht(r.unitPriceSatang),
    total: satangToBaht(r.totalSatang),
    reason: r.reason,
    category: r.category,
    status: r.status,
    rejectionReason: r.rejectionReason,
    requester: r.requester,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    submittedAt: r.submittedAt,
    decidedAt: r.decidedAt,
    ...(r.history ? { history: r.history.map(serializeHistory) } : {}),
  };
}
