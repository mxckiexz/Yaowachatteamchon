import { join, resolve, sep } from "node:path";
import express, { type Express } from "express";

// Serves the built React app from the same container as the API, so one Cloud Run service holds both.
// Call it after every API route: unknown /api paths get a JSON 404, any other GET gets index.html so a reload on a client route works.
export function serveBuiltClient(app: Express, dir: string): void {
  const root = resolve(dir);
  app.use(
    express.static(root, {
      index: false,
      setHeaders(res, filePath) {
        // Vite puts a content hash in every file name under /assets, so those files can be cached for a year.
        const hashed = filePath.includes(`${sep}assets${sep}`);
        res.setHeader("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "no-cache");
      },
    })
  );
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path === "/api" || req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
    res.sendFile(join(root, "index.html"), { headers: { "Cache-Control": "no-cache" } });
  });
}
