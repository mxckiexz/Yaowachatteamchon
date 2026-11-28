import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { requireAuth, requireRole, type AuthedRequest, type AuthenticatedUser } from "./auth.js";
import { asyncHandler, parseId } from "./http.js";
import { getPrisma } from "./prisma.js";
import { visibilityWhere } from "./visibility.js";

// F-12: in-app notifications. They are only listed and marked as read; no route creates, edits or deletes one.
export const notificationRouter = Router();

const LIST_LIMIT = 50;
const notFound = { error: "Notification not found.", code: "NOT_FOUND" };

// The fields of a notification in a response.
const SUMMARY = {
  id: true,
  type: true,
  createdAt: true,
  readAt: true,
  actor: { select: { id: true, name: true } },
  request: { select: { id: true, requestNumber: true, itemName: true } },
} satisfies Prisma.NotificationSelect;

// BR-28: the caller's own notifications, and only of requests the caller may see now (BR-12).
const visibleTo = (user: AuthenticatedUser): Prisma.NotificationWhereInput => ({
  recipientId: user.id,
  request: visibilityWhere(user),
});

const countUnread = (user: AuthenticatedUser) => getPrisma().notification.count({ where: { ...visibleTo(user), readAt: null } });

// Check order: session (401), role (403), then for one notification: it exists and is visible (404).
const recipientOnly = [requireAuth, requireRole("REQUESTER", "APPROVER")];

notificationRouter.get(
  "/notifications",
  ...recipientOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const [notifications, unreadCount] = await Promise.all([
      getPrisma().notification.findMany({
        where: visibleTo(req.user!),
        select: SUMMARY,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: LIST_LIMIT,
      }),
      countUnread(req.user!),
    ]);
    res.json({ notifications, unreadCount });
  })
);

notificationRouter.post(
  "/notifications/read-all",
  ...recipientOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    await getPrisma().notification.updateMany({ where: { ...visibleTo(req.user!), readAt: null }, data: { readAt: new Date() } });
    res.json({ unreadCount: await countUnread(req.user!) });
  })
);

notificationRouter.post(
  "/notifications/:id/read",
  ...recipientOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    const prisma = getPrisma();
    const found = id === null ? null : await prisma.notification.findFirst({ where: { ...visibleTo(req.user!), id }, select: { id: true } });
    if (!found) return res.status(404).json(notFound);
    // Only an unread row is changed, so a second call keeps the first "readAt".
    await prisma.notification.updateMany({ where: { id: found.id, readAt: null }, data: { readAt: new Date() } });
    const notification = await prisma.notification.findUniqueOrThrow({ where: { id: found.id }, select: SUMMARY });
    res.json({ notification });
  })
);
