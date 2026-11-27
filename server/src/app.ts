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
import { adminRouter } from "./adminRoutes.js";
import { requestRouter } from "./requestRoutes.js";
import { dashboardRouter } from "./dashboardRoutes.js";
import { serveBuiltClient } from "./staticSite.js";

export const app = express();

// NFR-08: do not announce the technology, and send basic protective headers on every response.
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(requireSameOrigin);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// R-01: health route, public, no data.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Deployment: ready only when the database answers. Public, no data. The smoke test calls it after every deploy.
app.get("/api/ready", async (_req, res) => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    res.json({ status: "ready", db: "connected" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});

// Deployment: which commit is running. deploy/release.sh sets APP_COMMIT to the full commit SHA of the image.
// Anything that is not a hex SHA is reported as "unknown", so the route never echoes arbitrary text.
app.get("/api/version", (_req, res) => {
  const value = process.env.APP_COMMIT ?? "";
  res.json({ commit: /^[0-9a-f]{7,40}$/.test(value) ? value : "unknown" });
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

app.use("/api", requestRouter);
app.use("/api", dashboardRouter);
app.use("/api", adminRouter);

// Deployment: in the container STATIC_DIR points at the built client. Locally it is unset and Vite serves the client.
if (process.env.STATIC_DIR) serveBuiltClient(app, process.env.STATIC_DIR);

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
