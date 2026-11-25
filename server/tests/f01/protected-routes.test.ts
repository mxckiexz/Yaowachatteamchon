import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { ORIGIN } from "../helpers/fixtures.js";

// Written when the last protected route existed (the contract of F-01, AC-08).
const ROUTES: [string, string][] = [
  ["GET", "/api/auth/me"],
  ["POST", "/api/requests"],
  ["GET", "/api/requests"],
  ["GET", "/api/requests?scope=review"],
  ["GET", "/api/requests?scope=all"],
  ["GET", "/api/requests/1"],
  ["GET", "/api/requests/1/history"],
  ["PATCH", "/api/requests/1"],
  ["POST", "/api/requests/1/submit"],
  ["POST", "/api/requests/1/approve"],
  ["POST", "/api/requests/1/reject"],
  ["POST", "/api/requests/1/cancel"],
  ["GET", "/api/admin/users"],
  ["PATCH", "/api/admin/users/1"],
];

describe("NFR-01 anonymous access", () => {
  it("TEST-12 / AC-08: every protected route returns 401 with no data when there is no session", async () => {
    for (const [method, path] of ROUTES) {
      let call = request(app).get(path);
      if (method === "POST") call = request(app).post(path).set("Origin", ORIGIN).send({});
      if (method === "PATCH") call = request(app).patch(path).set("Origin", ORIGIN).send({});
      const res = await call;
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(Object.keys(res.body), `${method} ${path}`).toEqual(["error"]);
    }
  });
});
