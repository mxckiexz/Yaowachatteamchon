import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { requireAuth, requireRole, type AuthedRequest } from "./auth.js";
import { MAX_COMMENT_LENGTH, parseCommentText } from "./commentRules.js";
import { asyncHandler, parseId } from "./http.js";
import { getPrisma } from "./prisma.js";
import { visibilityWhere } from "./visibility.js";

// F-10: comments on a request. Reading follows BR-12; a requester or approver who can see the request
// may add one (BR-24). There is deliberately no route that changes or removes a comment (BR-25).
export const commentRouter = Router();

const notFound = { error: "Request not found.", code: "NOT_FOUND" };

// The fields of a comment in a response.
const SUMMARY = {
  id: true,
  text: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.CommentSelect;

// The request must exist and the caller must be allowed to read it.
const readableRequest = asyncHandler(async (req: AuthedRequest, res, next) => {
  const id = parseId(req.params.id);
  const found = id === null ? null : await getPrisma().purchaseRequest.findFirst({ where: { AND: [{ id }, visibilityWhere(req.user!)] }, select: { id: true } });
  if (!found) return res.status(404).json(notFound);
  res.locals.requestId = found.id;
  next();
});

commentRouter.get(
  "/requests/:id/comments",
  requireAuth,
  readableRequest,
  asyncHandler(async (_req, res) => {
    const comments = await getPrisma().comment.findMany({
      where: { requestId: res.locals.requestId },
      select: SUMMARY,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    res.json({ comments });
  })
);

// Check order: session (401), role (403), the request is visible (404), the text (422).
commentRouter.post(
  "/requests/:id/comments",
  requireAuth,
  requireRole("REQUESTER", "APPROVER"),
  readableRequest,
  asyncHandler(async (req: AuthedRequest, res) => {
    const text = parseCommentText(req.body?.text);
    if (text === null) {
      return res.status(422).json({
        error: "Please correct the highlighted fields.",
        code: "VALIDATION_ERROR",
        fields: { text: `Enter a comment of 1 to ${MAX_COMMENT_LENGTH} characters.` },
      });
    }
    // One insert: the request row and its history are not touched. Only the text comes from the body.
    const comment = await getPrisma().comment.create({
      data: { requestId: res.locals.requestId, authorId: req.user!.id, text },
      select: SUMMARY,
    });
    res.status(201).json({ comment });
  })
);
