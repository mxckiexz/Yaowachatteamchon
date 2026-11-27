import { Router } from "express";
import { requireAuth, type AuthedRequest } from "./auth.js";
import { asyncHandler } from "./http.js";
import { getPrisma } from "./prisma.js";

export const dashboardRouter = Router();

const statuses = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as const;

async function countByStatus(where: object) {
  const rows = await getPrisma().purchaseRequest.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  return Object.fromEntries(statuses.map((status) => [status, rows.find((row) => row.status === status)?._count._all ?? 0]));
}

dashboardRouter.get("/dashboard", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = req.user!;
  const countsWhere = user.role === "ADMIN" ? {} : { requesterId: user.id };
  const counts = await countByStatus(countsWhere);
  if (user.role !== "APPROVER") return res.json({ counts });

  const waiting = await getPrisma().purchaseRequest.count({
    where: { status: "SUBMITTED", requesterId: { not: user.id } },
  });
  res.json({ counts, reviewWaiting: waiting });
}));
