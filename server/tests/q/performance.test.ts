import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { SAMPLE_ITEMS } from "../helpers/requests.js";

const PERF = "q-perf@test.local";
const CONC = "q-conc@test.local";
let perfId = 0;
let concId = 0;

beforeAll(async () => {
  perfId = (await createUser(PERF, { role: "EMPLOYEE" })).id;
  concId = (await createUser(CONC, { role: "EMPLOYEE" })).id;
});
afterAll(async () => {
  await cleanupUsers([PERF, CONC]);
  await getPrisma().$disconnect();
});

describe("NFR-07 early smoke checks (this is not a load test)", () => {
  it("TEST-59 / AC-44: the list of 200 requests has a median response time under 500 ms", async () => {
    const prisma = getPrisma();
    for (let i = 0; i < 200; i++) {
      await prisma.purchaseRequest.create({
        data: {
          requesterId: perfId,
          title: `Perf request ${i}`,
          status: "DRAFT",
          totalSatang: 26100,
          items: { create: [{ name: "Item A", quantity: 2, unitPriceSatang: 10050 }, { name: "Item B", quantity: 3, unitPriceSatang: 2000 }] },
        },
      });
    }
    const agent = await loginAgent(PERF);
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const res = await agent.get("/api/requests");
      times.push(performance.now() - start);
      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(200);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    console.log(`TEST-59 measured median ${median.toFixed(1)} ms, max ${times[times.length - 1].toFixed(1)} ms over 20 calls, 200 requests`);
    expect(median).toBeLessThan(500);
  });

  it("TEST-60 / AC-45: 50 simultaneous list calls and 20 simultaneous creates all succeed and exactly 20 are stored", async () => {
    const agent = await loginAgent(CONC);
    const start = performance.now();
    const reads = Array.from({ length: 50 }, () => agent.get("/api/requests"));
    const writes = Array.from({ length: 20 }, (_, i) =>
      agent.post("/api/requests").set("Origin", ORIGIN).send({ title: `Concurrent ${i}`, items: SAMPLE_ITEMS })
    );
    const results = await Promise.all([...reads, ...writes]);
    const elapsed = performance.now() - start;
    console.log(`TEST-60 70 simultaneous calls finished in ${elapsed.toFixed(0)} ms`);
    expect(results.slice(0, 50).every((r) => r.status === 200)).toBe(true);
    expect(results.slice(50).every((r) => r.status === 201)).toBe(true);
    expect(results.some((r) => r.status >= 500)).toBe(false);
    expect(await getPrisma().purchaseRequest.count({ where: { requesterId: concId } })).toBe(20);
  });
});
