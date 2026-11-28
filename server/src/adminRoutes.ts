import { Router } from "express";
import { requireAuth, requireRole, type AuthedRequest } from "./auth.js";
import { asyncHandler, parseId } from "./http.js";
import { getPrisma } from "./prisma.js";

export const adminRouter = Router();

const ROLES = ["REQUESTER", "APPROVER", "ADMIN"] as const;
const USER_SELECT = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true };

// F-05: list users (never the password hash). FR-15.
adminRouter.get(
  "/admin/users",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (_req: AuthedRequest, res) => {
    const users = await getPrisma().user.findMany({ select: USER_SELECT, orderBy: [{ name: "asc" }, { id: "asc" }] });
    res.json({ users });
  })
);

// F-05: activate or deactivate a user, or change the role. FR-15, BR-13, BR-16.
// Deactivation needs no session clean-up: every protected route refuses an inactive user.
adminRouter.patch(
  "/admin/users/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: "User not found.", code: "NOT_FOUND" });

    const body = req.body ?? {};
    const data: { isActive?: boolean; role?: (typeof ROLES)[number] } = {};
    const fields: Record<string, string> = {};
    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      if (typeof body.isActive === "boolean") data.isActive = body.isActive;
      else fields.isActive = "isActive must be true or false.";
    }
    if (Object.prototype.hasOwnProperty.call(body, "role")) {
      if ((ROLES as readonly string[]).includes(body.role)) data.role = body.role;
      else fields.role = `Role must be one of ${ROLES.join(", ")}.`;
    }
    if (Object.keys(fields).length === 0 && Object.keys(data).length === 0) fields.body = "Send isActive or role.";
    if (Object.keys(fields).length > 0) {
      return res.status(422).json({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fields });
    }

    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "User not found.", code: "NOT_FOUND" });
    if (id === req.user!.id) {
      return res.status(409).json({ error: "You cannot change your own account.", code: "SELF_CHANGE" });
    }
    if (data.isActive === false || data.role !== undefined) {
      const inUse = await prisma.approvalStep.findFirst({
        where: { approverId: id, status: { in: ["CURRENT", "WAITING"] }, request: { status: "SUBMITTED" } },
        select: { id: true },
      });
      if (inUse) return res.status(409).json({ error: "This approver is assigned to a submitted request.", code: "APPROVER_IN_USE" });
    }
    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
    res.json({ user });
  })
);
