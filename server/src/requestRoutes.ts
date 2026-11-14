import { Router } from "express";
import { requireAuth, requireRole, type AuthedRequest } from "./auth.js";
import { asyncHandler, parseId } from "./http.js";
import { calculateTotalSatang } from "./money.js";
import { getPrisma } from "./prisma.js";
import { REQUEST_INCLUDE, serializeRequest } from "./requestView.js";
import { canTransition } from "./transitions.js";
import { validateRequestInput } from "./validation.js";

export const requestRouter = Router();

const notFound = { error: "Request not found.", code: "NOT_FOUND" };

// F-02: list of people a request can be sent to (active approvers, never the caller).
requestRouter.get(
  "/approvers",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const approvers = await getPrisma().user.findMany({
      where: { role: "APPROVER", isActive: true, id: { not: req.user!.id } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json({ approvers });
  })
);

// F-02: create a DRAFT. FR-02, BR-02.
requestRouter.post(
  "/requests",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = validateRequestInput(req.body);
    if (!parsed.ok) {
      return res.status(422).json({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fields: parsed.fields });
    }
    const { title, justification, items } = parsed.value;
    const prisma = getPrisma();
    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.purchaseRequest.create({
        data: {
          requesterId: req.user!.id,
          title,
          justification,
          status: "DRAFT",
          totalSatang: calculateTotalSatang(items),
          items: { create: items },
        },
      });
      await tx.requestHistory.create({
        data: { requestId: request.id, actorId: req.user!.id, action: "CREATED", fromStatus: null, toStatus: "DRAFT" },
      });
      return request;
    });
    const full = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id: created.id }, include: REQUEST_INCLUDE });
    res.status(201).json({ request: serializeRequest(full) });
  })
);

// F-02: submit a DRAFT to an approver. FR-03, BR-01, BR-04, BR-05, BR-09.
requestRouter.post(
  "/requests/:id/submit",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json(notFound);
    const prisma = getPrisma();
    const userId = req.user!.id;

    const existing = await prisma.purchaseRequest.findFirst({ where: { id, requesterId: userId } });
    if (!existing) return res.status(404).json(notFound);
    if (!canTransition(existing.status, "PENDING")) {
      return res.status(409).json({ error: "Only a draft can be submitted.", code: "ILLEGAL_TRANSITION" });
    }

    const approverId = req.body?.approverId;
    if (Number.isInteger(approverId) && approverId === userId) {
      return res.status(422).json({ error: "You cannot send a request to yourself for approval.", code: "SELF_REVIEW" });
    }
    const approver = Number.isInteger(approverId)
      ? await prisma.user.findFirst({ where: { id: approverId, role: "APPROVER", isActive: true } })
      : null;
    if (!approver) {
      return res.status(422).json({ error: "Choose an active approver.", code: "INVALID_APPROVER" });
    }

    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.purchaseRequest.updateMany({
        where: { id, requesterId: userId, status: "DRAFT" },
        data: { status: "PENDING", approverId: approver.id, submittedAt: new Date() },
      });
      if (result.count === 1) {
        await tx.requestHistory.create({
          data: { requestId: id, actorId: userId, action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING" },
        });
      }
      return result.count;
    });
    if (changed !== 1) return res.status(409).json({ error: "Only a draft can be submitted.", code: "ILLEGAL_TRANSITION" });

    const full = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id }, include: REQUEST_INCLUDE });
    res.json({ request: serializeRequest(full) });
  })
);

const MIN_REASON_LENGTH = 5;

// F-03: the assigned approver approves or rejects a PENDING request. FR-06, BR-01, BR-04 to BR-08.
// Check order: session (401), role (403), request exists (404), not the requester (403), assigned (403),
// valid decision and reason (422), then one conditional update that only succeeds while PENDING (409 otherwise).
requestRouter.post(
  "/requests/:id/decision",
  requireAuth,
  requireRole("APPROVER"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json(notFound);
    const prisma = getPrisma();
    const userId = req.user!.id;

    const existing = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json(notFound);
    if (existing.requesterId === userId) {
      return res.status(403).json({ error: "You cannot decide your own request.", code: "SELF_APPROVAL" });
    }
    if (existing.approverId !== userId) {
      return res.status(403).json({ error: "This request is not assigned to you.", code: "NOT_ASSIGNED" });
    }

    const decision = req.body?.decision;
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return res.status(422).json({
        error: "Decision must be APPROVED or REJECTED.",
        code: "VALIDATION_ERROR",
        fields: { decision: "Choose approve or reject." },
      });
    }
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    if (comment.length > 500) {
      return res.status(422).json({ error: "Comment must be at most 500 characters.", code: "VALIDATION_ERROR", fields: { comment: "Too long." } });
    }
    if (decision === "REJECTED" && comment.length < MIN_REASON_LENGTH) {
      return res.status(422).json({
        error: `A rejection needs a reason of at least ${MIN_REASON_LENGTH} characters.`,
        code: "REASON_REQUIRED",
        fields: { comment: `Reason is required (at least ${MIN_REASON_LENGTH} characters).` },
      });
    }
    if (!canTransition(existing.status, decision)) {
      return res.status(409).json({ error: "This request has already been decided.", code: "ILLEGAL_TRANSITION" });
    }

    const changed = await prisma.$transaction(async (tx) => {
      // The status condition makes two simultaneous decisions safe: only one update can match.
      const result = await tx.purchaseRequest.updateMany({
        where: { id, approverId: userId, status: "PENDING" },
        data: { status: decision, decidedAt: new Date(), decisionComment: comment || null },
      });
      if (result.count === 1) {
        await tx.requestHistory.create({
          data: { requestId: id, actorId: userId, action: decision, fromStatus: "PENDING", toStatus: decision, comment: comment || null },
        });
      }
      return result.count;
    });
    if (changed !== 1) {
      return res.status(409).json({ error: "This request has already been decided.", code: "ILLEGAL_TRANSITION" });
    }

    const full = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id }, include: REQUEST_INCLUDE });
    res.json({ request: serializeRequest(full) });
  })
);
