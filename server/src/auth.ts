import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { getPrisma } from "./prisma.js";

// System SDS section 6: bcrypt cost 12, 8-hour sessions, opaque session id in an HttpOnly cookie
// that is looked up in the database on every protected request.
export const SESSION_COOKIE_NAME = "buyflow_session";
const BCRYPT_COST = 12;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Login always performs one bcrypt comparison, even for an unknown e-mail, so response time does not
// reveal which e-mails exist. This is a fixed hash of an unrelated string, not a real account.
export const DUMMY_PASSWORD_HASH = "$2b$12$jQ7GdgpV1/pmC2b3.imBnu.ROg2P26bKYmLRMFevHxvIhp4jW5n3S";

export async function createSession(userId: number) {
  return getPrisma().session.create({
    data: { id: randomUUID(), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
}

// deleteMany: logging out with an unknown or already deleted session is not an error.
export async function deleteSession(sessionId: string): Promise<void> {
  await getPrisma().session.deleteMany({ where: { id: sessionId } });
}

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

// A missing, unknown or expired session, or an inactive user, are all "no session".
export async function getSessionUser(sessionId: string | undefined): Promise<AuthenticatedUser | null> {
  // Session ids are UUIDs. Anything else (empty, too long, null bytes, SQL text) is "no session" and never reaches the database.
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return null;
  const session = await getPrisma().session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.user.isActive) return null;
  const { id, name, email, role } = session.user;
  return { id, name, email, role };
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await getSessionUser(req.cookies?.[SESSION_COOKIE_NAME]);
    if (!user) return res.status(401).json({ error: "Authentication required." });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action.", code: "FORBIDDEN" });
    }
    next();
  };
}

// CSRF defence on top of SameSite=Lax: every state-changing request must come from the configured client origin.
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const stateChanging = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method);
  if (stateChanging && req.get("origin") !== CLIENT_ORIGIN) {
    return res.status(403).json({ error: "Request origin not allowed." });
  }
  next();
}
