import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  CLIENT_ORIGIN,
  DUMMY_PASSWORD_HASH,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSession,
  deleteSession,
  requireAuth,
  requireSameOrigin,
  verifyPassword,
  type AuthedRequest,
} from "./auth.js";
import { getPrisma } from "./prisma.js";

export const app = express();

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(requireSameOrigin);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// R-01: health route, public, no data.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// F-01: authentication.
const INVALID_LOGIN = { error: "Invalid email or password." };

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) {
      const fields: Record<string, string> = {};
      if (!email) fields.email = "E-mail is required.";
      if (!password) fields.password = "Password is required.";
      return res.status(422).json({ error: "E-mail and password are required.", code: "VALIDATION_ERROR", fields });
    }

    const user = await getPrisma().user.findUnique({ where: { email } });
    // One bcrypt comparison in every case (unknown user, inactive user, wrong password).
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.isActive || !passwordOk) {
      return res.status(401).json(INVALID_LOGIN);
    }

    const session = await createSession(user.id);
    res.cookie(SESSION_COOKIE_NAME, session.id, { ...SESSION_COOKIE_OPTIONS, expires: session.expiresAt });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
    if (sessionId) await deleteSession(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, { ...SESSION_COOKIE_OPTIONS });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

// R-02: safe error handling. No stack traces, SQL or file paths reach the client.
app.use((error: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (error.type === "entity.parse.failed" || error instanceof SyntaxError) {
    return res.status(400).json({ error: "Malformed request body." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});
