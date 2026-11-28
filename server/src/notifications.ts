import type { Prisma } from "@prisma/client";

// F-12, BR-27: notifications are written with the transaction client of the status change, so they are stored
// together with the new status and its history entry, or not at all.

// A submit tells every approver who is active at that moment, except the requester.
export async function notifyApprovers(tx: Prisma.TransactionClient, requestId: number, requesterId: number) {
  const approvers = await tx.user.findMany({
    where: { role: "APPROVER", isActive: true, id: { not: requesterId } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  await tx.notification.createMany({
    data: approvers.map((a) => ({ recipientId: a.id, requestId, actorId: requesterId, type: "SUBMITTED" as const })),
  });
}

// A decision or a return tells the requester.
export async function notifyRequester(
  tx: Prisma.TransactionClient,
  note: { requestId: number; requesterId: number; actorId: number; type: "APPROVED" | "REJECTED" | "RETURNED" }
) {
  const { requestId, requesterId, actorId, type } = note;
  await tx.notification.create({ data: { recipientId: requesterId, requestId, actorId, type } });
}
