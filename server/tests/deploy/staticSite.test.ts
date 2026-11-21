import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { serveBuiltClient } from "../../src/staticSite.js";

let site: express.Express;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "pf-site-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><html><body><div id=\"root\"></div></body></html>");
  writeFileSync(join(dir, "assets", "app-abc123.js"), "console.log('app')");
  writeFileSync(join(tmpdir(), "pf-secret.txt"), "outside the site folder");
  site = express();
  site.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  serveBuiltClient(site, dir);
});

describe("serving the built client from the API container", () => {
  it("serves index.html at /", async () => {
    const res = await request(site).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('id="root"');
  });

  it("serves a client route (/requests/5) as index.html so a page reload works", async () => {
    const res = await request(site).get("/requests/5").set("Accept", "text/html");
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="root"');
  });

  it("serves a built asset, cached for a long time because its name carries a hash", async () => {
    const res = await request(site).get("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toMatch(/max-age=\d{6,}/);
  });

  it("never serves index.html for an unknown /api path: a JSON 404 instead", async () => {
    const res = await request(site).get("/api/nothing-here");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toHaveProperty("error");
  });

  it("keeps API routes defined before it working", async () => {
    const res = await request(site).get("/api/health");
    expect(res.body).toEqual({ status: "ok" });
  });

  it("does not let a path escape the site folder", async () => {
    const res = await request(site).get("/..%2fpf-secret.txt");
    expect(res.text).not.toContain("outside the site folder");
  });

  it("does not answer POST with the page", async () => {
    const res = await request(site).post("/requests/5").send({});
    expect(res.status).toBe(404);
  });
});
