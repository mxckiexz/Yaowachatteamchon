import { Router } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth, requireRole, type AuthedRequest } from "./auth.js";
import { asyncHandler, parseId } from "./http.js";
import { calculateTotalSatang, satangToBaht } from "./money.js";
import { getPrisma } from "./prisma.js";
import { HISTORY_INCLUDE, REQUEST_INCLUDE, serializeHistory, serializeRequest } from "./requestView.js";
import { canTransition } from "./transitions.js";
import { validateRequestInput } from "./validation.js";
import { visibilityWhere } from "./visibility.js";

export const requestRouter = Router();

const notFound = { error: "Request not found.", code: "NOT_FOUND" };
const validationError = (fields: Record<string, string>) => ({
  error: "Please correct the highlighted fields.",
  code: "VALIDATION_ERROR",
  fields,
});

// F-02: create a DRAFT. FR-01, BR-01 to BR-05, BR-14, BR-15.
requestRouter.post(
  "/requests",
  requireAuth,
  requireRole("REQUESTER", "APPROVER"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = validateRequestInput(req.body);
    if (!parsed.ok) return res.status(422).json(validationError(parsed.fields));
    const v = parsed.value;
    const prisma = getPrisma();
    const created = await prisma.$transaction(async (tx) => {
      // BR-14: the number comes from a database sequence, so simultaneous creates never share one.
      const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('request_number_seq') AS n`;
      const requestNumber = `PR-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`;
      const request = await tx.purchaseRequest.create({
        data: {
          requestNumber,
          requesterId: req.user!.id,
          itemName: v.itemName,
          description: v.description,
          quantity: v.quantity,
          unitPriceSatang: v.unitPriceSatang,
          totalSatang: BigInt(calculateTotalSatang(v.quantity, v.unitPriceSatang)),
          reason: v.reason,
          category: v.category,
          status: "DRAFT",
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

// F-02: the owner edits a DRAFT. FR-02, BR-10, BR-18. For everyone else the request is "not found".
requestRouter.patch(
  "/requests/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json(notFound);
    const prisma = getPrisma();
    const existing = await prisma.purchaseRequest.findFirst({ where: { id, requesterId: req.user!.id } });
    if (!existing) return res.status(404).json(notFound);
    if (existing.status !== "DRAFT") {
      return res.status(409).json({ error: "Only a draft can be edited.", code: "NOT_EDITABLE" });
    }

    const body = req.body ?? {};
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const merged = {
      itemName: has("itemName") ? body.itemName : existing.itemName,
      description: has("description") ? body.description : existing.description,
      quantity: has("quantity") ? body.quantity : existing.quantity,
      unitPrice: has("unitPrice") ? body.unitPrice : satangToBaht(existing.unitPriceSatang),
      reason: has("reason") ? body.reason : existing.reason,
      category: has("category") ? body.category : existing.category,
    };
    const parsed = validateRequestInput(merged);
    if (!parsed.ok) return res.status(422).json(validationError(parsed.fields));
    const v = parsed.value;

    const result = await prisma.purchaseRequest.updateMany({
      where: { id, requesterId: req.user!.id, status: "DRAFT" },
      data: {
        itemName: v.itemName,
        description: v.description,
        quantity: v.quantity,
        unitPriceSatang: v.unitPriceSatang,
        totalSatang: BigInt(calculateTotalSatang(v.quantity, v.unitPriceSatang)),
        reason: v.reason,
        category: v.category,
      },
    });
    if (result.count !== 1) return res.status(409).json({ error: "Only a draft can be edited.", code: "NOT_EDITABLE" });
    const full = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id }, include: REQUEST_INCLUDE });
    res.json({ request: serializeRequest(full) });
  })
);

// F-02: the owner submits a complete DRAFT. FR-03, BR-06, BR-18.
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
    if (!canTransition(existing.status, "SUBMITTED")) {
      return res.status(409).json({ error: "Only a draft can be submitted.", code: "ILLEGAL_TRANSITION" });
    }

    const missing: Record<string, string> = {};
    if (existing.reason.trim() === "") missing.reason = "Reason is required to submit.";
    if (existing.category === null) missing.category = "Category is required to submit.";
    if (Object.keys(missing).length > 0) {
      return res.status(422).json({ error: "The request is incomplete.", code: "INCOMPLETE", fields: missing });
    }

    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.purchaseRequest.updateMany({
        where: { id, requesterId: userId, status: "DRAFT" },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      if (result.count === 1) {
        await tx.requestHistory.create({
          data: { requestId: id, actorId: userId, action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "SUBMITTED" },
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
const MAX_TEXT_LENGTH = 500;

// F-03: approve or reject a SUBMITTED request. FR-07 to FR-09, FR-11, FR-13, BR-07 to BR-09, BR-11, BR-17.
// Check order: session (401), role APPROVER (403), the request exists and is visible (404; another user's
// draft is never visible to an approver), not the requester (403), the reason of a rejection (422), then one
// conditional update that only succeeds while the request is SUBMITTED (409 otherwise).
function decisionHandler(decision: "APPROVED" | "REJECTED") {
  return asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json(notFound);
    const prisma = getPrisma();
    const userId = req.user!.id;

    const existing = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json(notFound);
    if (existing.requesterId === userId) {
      return res.status(403).json({ error: "You cannot decide your own request.", code: "SELF_APPROVAL" });
    }
    if (existing.status === "DRAFT") return res.status(404).json(notFound);

    const raw = decision === "REJECTED" ? req.body?.reason : req.body?.comment;
    const text = typeof raw === "string" ? raw.trim() : "";
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return res.status(422).json({ error: "The text must be a string.", code: "VALIDATION_ERROR", fields: { text: "Must be text." } });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(422).json({ error: "The text is too long (at most 500 characters).", code: "VALIDATION_ERROR", fields: { text: "Too long." } });
    }
    if (decision === "REJECTED" && text.length < MIN_REASON_LENGTH) {
      return res.status(422).json({
        error: `A rejection needs a reason of at least ${MIN_REASON_LENGTH} characters.`,
        code: "REASON_REQUIRED",
        fields: { reason: `Reason is required (at least ${MIN_REASON_LENGTH} characters).` },
      });
    }
    if (!canTransition(existing.status, decision)) {
      return res.status(409).json({ error: "This request has already been decided or cannot be decided.", code: "ILLEGAL_TRANSITION" });
    }

    const changed = await prisma.$transaction(async (tx) => {
      // The status condition makes two simultaneous decisions safe: only one update can match (BR-17).
      const result = await tx.purchaseRequest.updateMany({
        where: { id, status: "SUBMITTED" },
        data: { status: decision, decidedAt: new Date(), rejectionReason: decision === "REJECTED" ? text : null },
      });
      if (result.count === 1) {
        await tx.requestHistory.create({
          data: { requestId: id, actorId: userId, action: decision, fromStatus: "SUBMITTED", toStatus: decision, comment: text || null },
        });
      }
      return result.count;
    });
    if (changed !== 1) {
      return res.status(409).json({ error: "This request has already been decided or cannot be decided.", code: "ILLEGAL_TRANSITION" });
    }

    const full = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id }, include: REQUEST_INCLUDE });
    res.json({ request: serializeRequest(full) });
  });
}

requestRouter.post("/requests/:id/approve", requireAuth, requireRole("APPROVER"), decisionHandler("APPROVED"));
requestRouter.post("/requests/:id/reject", requireAuth, requireRole("APPROVER"), decisionHandler("REJECTED"));

// F-06: the owner cancels an eligible request. FR-05, BR-11, BR-12, BR-17, BR-21.
// The conditional update makes cancellation race-safe with another cancel or a decision.
requestRouter.post(
  "/requests/:id/cancel",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json(notFound);
    const prisma = getPrisma();
    const userId = req.user!.id;
    const existing = await prisma.purchaseRequest.findFirst({ where: { id, requesterId: userId } });
    if (!existing) return res.status(404).json(notFound);
    if (existing.status !== "DRAFT" && existing.status !== "SUBMITTED") {
      return res.status(409).json({ error: "This request cannot be cancelled.", code: "ILLEGAL_TRANSITION" });
    }

    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.purchaseRequest.updateMany({
        // Match the status read before the transaction so the history fromStatus
        // cannot become stale if submit races with cancellation.
        where: { id, requesterId: userId, status: existing.status },
        data: { status: "CANCELLED" },
      });
      if (result.count === 1) {
        await tx.requestHistory.create({
          data: { requestId: id, actorId: userId, action: "CANCELLED", fromStatus: existing.status, toStatus: "CANCELLED" },
        });
      }
      return result.count;
    });
    if (changed !== 1) {
      return res.status(409).json({ error: "This request cannot be cancelled.", code: "ILLEGAL_TRANSITION" });
    }

    const full = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id }, include: { ...REQUEST_INCLUDE, ...HISTORY_INCLUDE } });
    res.json({ request: serializeRequest(full) });
  })
);

// F-04: lists. scope=mine (default), scope=review (approvers: submitted requests of others), scope=all (administrator).
requestRouter.get(
  "/requests",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const single = (name: string): { value?: string; repeated: boolean } => {
      const raw = req.query[name];
      if (raw === undefined) return { repeated: false };
      if (Array.isArray(raw)) return { repeated: true };
      return { value: String(raw), repeated: false };
    };
    const scopeParam = single("scope");
    const statusParam = single("status");
    const categoryParam = single("category");
    const qParam = single("q");
    const scope = scopeParam.value === undefined ? "mine" : scopeParam.value;
    const repeatedFields: Record<string, string> = {};
    if (scopeParam.repeated) repeatedFields.scope = "This parameter may be supplied only once.";
    if (statusParam.repeated) repeatedFields.status = "This parameter may be supplied only once.";
    if (categoryParam.repeated) repeatedFields.category = "This parameter may be supplied only once.";
    if (qParam.repeated) repeatedFields.q = "This parameter may be supplied only once.";
    if (Object.keys(repeatedFields).length > 0) return res.status(422).json(validationError(repeatedFields));
    const statusValues = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as const;
    const categoryValues = ["EQUIPMENT", "SOFTWARE", "FURNITURE", "STATIONERY", "OTHER"] as const;
    const status = statusParam.value === "" ? undefined : statusParam.value;
    const category = categoryParam.value === "" ? undefined : categoryParam.value;
    const q = qParam.value?.trim() || undefined;
    const fields: Record<string, string> = {};
    if (!["mine", "review", "all"].includes(scope)) fields.scope = "Unknown scope.";
    if (status !== undefined && !(statusValues as readonly string[]).includes(status)) fields.status = "Unknown status.";
    if (category !== undefined && !(categoryValues as readonly string[]).includes(category)) fields.category = "Unknown category.";
    if (q !== undefined && q.length > 100) fields.q = "Search text must be at most 100 characters.";
    if (Object.keys(fields).length > 0) return res.status(422).json(validationError(fields));
    const user = req.user!;
    let where: object;
    let orderBy: object[];
    if (scope === "mine") {
      where = { requesterId: user.id };
      orderBy = [{ createdAt: "desc" }, { id: "desc" }];
    } else if (scope === "review") {
      if (user.role !== "APPROVER") return res.status(403).json({ error: "You do not have permission to perform this action.", code: "FORBIDDEN" });
      where = { status: "SUBMITTED", requesterId: { not: user.id } };
      orderBy = [{ submittedAt: "asc" }, { id: "asc" }];
    } else if (scope === "all") {
      if (user.role !== "ADMIN") return res.status(403).json({ error: "You do not have permission to perform this action.", code: "FORBIDDEN" });
      where = {};
      orderBy = [{ createdAt: "desc" }, { id: "desc" }];
    } else {
      return res.status(422).json({ error: "scope must be mine, review or all.", code: "VALIDATION_ERROR", fields: { scope: "Unknown scope." } });
    }
    const conditions: any[] = [where];
    if (status !== undefined) conditions.push({ status });
    if (category !== undefined) conditions.push({ category });
    const prisma = getPrisma();
    let ids: number[] | undefined;
    if (q !== undefined) {
      const candidates = await prisma.purchaseRequest.findMany({ where: { AND: conditions }, select: { id: true } });
      if (candidates.length === 0) return res.json({ requests: [] });
      const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
      const pattern = `%${escaped}%`;
      const matches = await prisma.$queryRaw<{ id: number }[]>`
        SELECT "id" FROM "PurchaseRequest"
        WHERE "id" IN (${Prisma.join(candidates.map((candidate) => candidate.id))})
          AND (
            COALESCE("requestNumber", '') ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE("itemName", '') ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE("description", '') ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE("reason", '') ILIKE ${pattern} ESCAPE '\\'
          )`;
      ids = matches.map((match) => match.id);
      if (ids.length === 0) return res.json({ requests: [] });
    }
    const filters = { AND: [...conditions, ...(ids ? [{ id: { in: ids } }] : [])] };
    const rows = await prisma.purchaseRequest.findMany({ where: filters, include: REQUEST_INCLUDE, orderBy: orderBy as any });
    res.json({
      requests: rows.map((r) => {
        const s = serializeRequest(r);
        return {
          id: s.id,
          requestNumber: s.requestNumber,
          itemName: s.itemName,
          quantity: s.quantity,
          total: s.total,
          category: s.category,
          status: s.status,
          createdAt: s.createdAt,
          submittedAt: s.submittedAt,
          requester: s.requester,
        };
      }),
    });
  })
);

// F-04: one request with its history. FR-04, FR-06, FR-10, FR-11, FR-12, BR-12.
requestRouter.get(
  "/requests/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json(notFound);
    const row = await getPrisma().purchaseRequest.findFirst({
      where: { id, ...visibilityWhere(req.user!) },
      include: { ...REQUEST_INCLUDE, ...HISTORY_INCLUDE },
    });
    if (!row) return res.status(404).json(notFound);
    res.json({ request: serializeRequest(row) });
  })
);

// F-04: the history alone, same visibility as the detail. FR-11.
requestRouter.get(
  "/requests/:id/history",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json(notFound);
    const row = await getPrisma().purchaseRequest.findFirst({
      where: { id, ...visibilityWhere(req.user!) },
      include: HISTORY_INCLUDE,
    });
    if (!row) return res.status(404).json(notFound);
    res.json({ history: (row.history ?? []).map(serializeHistory) });
  })
);
