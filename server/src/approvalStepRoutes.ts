import { Router } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth, requireRole, type AuthedRequest } from "./auth.js";
import { asyncHandler, parseId } from "./http.js";
import { getPrisma } from "./prisma.js";
import { visibilityWhere } from "./visibility.js";

export const approvalStepRouter = Router();
const notFound = { error: "Request not found.", code: "NOT_FOUND" };
const invalid = (fields: Record<string, string>) => ({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fields });
const serialize = (s: any) => ({ id: s.id, stepNumber: s.stepNumber, approver: { id: s.approver.id, name: s.approver.name }, status: s.status, decidedAt: s.decidedAt, decisionComment: s.decisionComment });

export async function activateApprovalSteps(tx: any, requestId: number) {
  const steps = await tx.approvalStep.findMany({ where: { requestId, status: "PLANNED" }, orderBy: { stepNumber: "asc" } });
  if (!steps.length) return { configured: false, valid: true };
  // Share-lock planned approvers while checking them. F-05 takes an update lock
  // before changing a user, so submit and role/deactivation cannot pass each other.
  const approverIds = steps.map((step: any) => step.approverId);
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${Prisma.join(approverIds)}) FOR SHARE`;
  const users = await tx.user.findMany({ where: { id: { in: steps.map((s: any) => s.approverId) } }, select: { id: true, role: true, isActive: true } });
  if (users.length !== steps.length || users.some((u: any) => u.role !== "APPROVER" || !u.isActive)) return { configured: true, valid: false };
  await tx.approvalStep.updateMany({ where: { requestId, status: "PLANNED" }, data: { status: "WAITING", decidedAt: null, decisionComment: null } });
  await tx.approvalStep.update({ where: { id: steps[0].id }, data: { status: "CURRENT" } });
  return { configured: true, valid: true };
}

approvalStepRouter.get("/requests/:id/approval-steps", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(404).json(notFound);
  const prisma = getPrisma();
  const request = await prisma.purchaseRequest.findFirst({ where: { AND: [{ id }, visibilityWhere(req.user!)] }, select: { id: true } });
  if (!request) return res.status(404).json(notFound);
  const steps = await prisma.approvalStep.findMany({ where: { requestId: id }, include: { approver: { select: { id: true, name: true } } }, orderBy: { stepNumber: "asc" } });
  res.json({ steps: steps.map(serialize) });
}));

approvalStepRouter.put("/requests/:id/approval-steps", requireAuth, requireRole("ADMIN"), asyncHandler(async (req: AuthedRequest, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(404).json(notFound);
  const prisma = getPrisma();
  const request = await prisma.purchaseRequest.findUnique({ where: { id }, select: { id: true, status: true, requesterId: true } });
  if (!request) return res.status(404).json(notFound);
  if (request.status !== "DRAFT") return res.status(409).json({ error: "Approval steps can only be changed on a draft.", code: "NOT_EDITABLE" });
  const ids = req.body?.approverIds;
  if (!Array.isArray(ids) || ids.length > 5 || ids.some((v: unknown) => !Number.isInteger(v) || (v as number) <= 0)) return res.status(422).json(invalid({ approverIds: "Use an array of at most 5 user ids." }));
  if (new Set(ids).size !== ids.length) return res.status(422).json(invalid({ approverIds: "Each approver may appear only once." }));
  const users = await prisma.user.findMany({ where: { id: { in: ids as number[] } }, select: { id: true, name: true, role: true, isActive: true } });
  if (users.length !== ids.length || users.some((u) => u.role !== "APPROVER" || !u.isActive || u.id === request.requesterId)) return res.status(422).json(invalid({ approverIds: "Approvers must be distinct active APPROVER users and cannot be the requester." }));
  const steps = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ${id} FOR UPDATE`;
    const locked = await tx.purchaseRequest.findUnique({ where: { id }, select: { status: true } });
    if (!locked) return { kind: "not_found" as const };
    if (locked.status !== "DRAFT") return { kind: "not_editable" as const };
    await tx.approvalStep.deleteMany({ where: { requestId: id } });
    if (ids.length) await tx.approvalStep.createMany({ data: (ids as number[]).map((approverId, i) => ({ requestId: id, approverId, stepNumber: i + 1, status: "PLANNED" as const })) });
    return { kind: "ok" as const, rows: await tx.approvalStep.findMany({ where: { requestId: id }, include: { approver: { select: { id: true, name: true } } }, orderBy: { stepNumber: "asc" } }) };
  });
  if (steps.kind === "not_found") return res.status(404).json(notFound);
  if (steps.kind === "not_editable") return res.status(409).json({ error: "Approval steps can only be changed on a draft.", code: "NOT_EDITABLE" });
  res.json({ steps: steps.rows.map(serialize) });
}));
