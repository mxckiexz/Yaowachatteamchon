import express, { Router, type NextFunction, type Response } from "express";
import type { Prisma } from "@prisma/client";
import {
  MAX_ATTACHMENTS_PER_REQUEST,
  MAX_ATTACHMENT_BYTES,
  checkFile,
  contentDisposition,
  parseFileName,
} from "./attachmentRules.js";
import { requireAuth, type AuthedRequest } from "./auth.js";
import { asyncHandler, parseId } from "./http.js";
import { getPrisma } from "./prisma.js";
import { visibilityWhere } from "./visibility.js";

// F-09: files on a request. Reading follows BR-12; only the owner of a draft adds or removes (BR-23).
export const attachmentRouter = Router();

const notFound = { error: "Request not found.", code: "NOT_FOUND" };
const attachmentNotFound = { error: "Attachment not found.", code: "NOT_FOUND" };
const notEditable = { error: "Attachments can be changed only on a draft.", code: "NOT_EDITABLE" };
const limitReached = { error: `A request can have at most ${MAX_ATTACHMENTS_PER_REQUEST} attachments.`, code: "ATTACHMENT_LIMIT" };
const tooLarge = { error: "The file is larger than 5 MB.", code: "FILE_TOO_LARGE" };
const validationError = (fields: Record<string, string>) => ({
  error: "Please correct the highlighted fields.",
  code: "VALIDATION_ERROR",
  fields,
});

// Every field of an attachment except its content.
const SUMMARY = {
  id: true,
  fileName: true,
  fileType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.AttachmentSelect;

type RequestIdLocals = { requestId: number };

// The request must exist and the caller must be allowed to read it.
const readableRequest = asyncHandler(async (req: AuthedRequest, res, next) => {
  const id = parseId(req.params.id);
  const found = id === null ? null : await getPrisma().purchaseRequest.findFirst({ where: { AND: [{ id }, visibilityWhere(req.user!)] }, select: { id: true } });
  if (!found) return res.status(404).json(notFound);
  (res.locals as RequestIdLocals).requestId = found.id;
  next();
});

// For a change, the request must belong to the caller. Everyone else gets "not found", as when editing a draft.
const ownedRequest = asyncHandler(async (req: AuthedRequest, res, next) => {
  const id = parseId(req.params.id);
  const found = id === null ? null : await getPrisma().purchaseRequest.findFirst({ where: { id, requesterId: req.user!.id }, select: { id: true, status: true } });
  if (!found) return res.status(404).json(notFound);
  res.locals.requestId = found.id;
  res.locals.requestStatus = found.status;
  next();
});

// Locks the request row until the transaction ends, so a submit, a cancel or another upload has to wait,
// and returns the status as it is once the lock is held.
async function lockRequest(tx: Prisma.TransactionClient, requestId: number) {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status"::text AS status FROM "PurchaseRequest" WHERE "id" = ${requestId} FOR UPDATE`;
  return rows[0]?.status;
}

attachmentRouter.get(
  "/requests/:id/attachments",
  requireAuth,
  readableRequest,
  asyncHandler(async (_req, res) => {
    const attachments = await getPrisma().attachment.findMany({
      where: { requestId: res.locals.requestId },
      select: SUMMARY,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    res.json({ attachments });
  })
);

// These checks run before the body is read, so a caller who may not upload cannot make the server hold a file.
function draftAndOctetStream(req: AuthedRequest, res: Response, next: NextFunction) {
  if (res.locals.requestStatus !== "DRAFT") return res.status(409).json(notEditable);
  const type = (req.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/octet-stream") {
    return res.status(415).json({ error: "Send the file as application/octet-stream.", code: "UNSUPPORTED_MEDIA_TYPE" });
  }
  next();
}

const parseRawFile = express.raw({ type: () => true, limit: MAX_ATTACHMENT_BYTES });
function readFile(req: AuthedRequest, res: Response, next: NextFunction) {
  parseRawFile(req, res, (error?: any) => {
    if (error?.type === "entity.too.large") return res.status(413).json(tooLarge);
    next(error);
  });
}

attachmentRouter.post(
  "/requests/:id/attachments",
  requireAuth,
  ownedRequest,
  draftAndOctetStream,
  readFile,
  asyncHandler(async (req: AuthedRequest, res) => {
    const requestId: number = res.locals.requestId;
    // Without a body the parser leaves an empty object behind.
    const content = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const fileName = parseFileName(req.get("x-file-name"));
    if (fileName === null) {
      return res.status(422).json(validationError({ fileName: "Enter a file name of 1 to 100 characters without / or \\." }));
    }
    if (content.length === 0) return res.status(422).json(validationError({ file: "The file is empty." }));
    const fileType = checkFile(fileName, content);
    if (fileType === null) {
      return res.status(422).json(validationError({ file: "Only PDF, PNG or JPG files are allowed, and the content must match the file name." }));
    }

    const result = await getPrisma().$transaction(async (tx) => {
      if ((await lockRequest(tx, requestId)) !== "DRAFT") return { refused: notEditable };
      if ((await tx.attachment.count({ where: { requestId } })) >= MAX_ATTACHMENTS_PER_REQUEST) return { refused: limitReached };
      const attachment = await tx.attachment.create({
        data: { requestId, fileName, fileType, sizeBytes: content.length, content, uploadedById: req.user!.id },
        select: SUMMARY,
      });
      return { attachment };
    });
    if ("refused" in result) return res.status(409).json(result.refused);
    res.status(201).json({ attachment: result.attachment });
  })
);

attachmentRouter.get(
  "/requests/:id/attachments/:attachmentId",
  requireAuth,
  readableRequest,
  asyncHandler(async (req: AuthedRequest, res) => {
    const attachmentId = parseId(req.params.attachmentId);
    const file =
      attachmentId === null
        ? null
        : await getPrisma().attachment.findFirst({ where: { id: attachmentId, requestId: res.locals.requestId } });
    if (!file) return res.status(404).json(attachmentNotFound);
    res.setHeader("Content-Type", file.fileType);
    res.setHeader("Content-Disposition", contentDisposition(file.fileName, file.fileType));
    res.setHeader("Content-Length", String(file.content.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.end(file.content);
  })
);

attachmentRouter.delete(
  "/requests/:id/attachments/:attachmentId",
  requireAuth,
  ownedRequest,
  asyncHandler(async (req: AuthedRequest, res) => {
    const requestId: number = res.locals.requestId;
    const attachmentId = parseId(req.params.attachmentId);
    const exists =
      attachmentId === null
        ? 0
        : await getPrisma().attachment.count({ where: { id: attachmentId, requestId } });
    if (!exists) return res.status(404).json(attachmentNotFound);

    const outcome = await getPrisma().$transaction(async (tx) => {
      if ((await lockRequest(tx, requestId)) !== "DRAFT") return "NOT_EDITABLE" as const;
      const deleted = await tx.attachment.deleteMany({ where: { id: attachmentId!, requestId } });
      return deleted.count === 1 ? ("DELETED" as const) : ("GONE" as const);
    });
    if (outcome === "NOT_EDITABLE") return res.status(409).json(notEditable);
    if (outcome === "GONE") return res.status(404).json(attachmentNotFound);
    res.status(204).end();
  })
);
