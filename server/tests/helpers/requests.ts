import type request from "supertest";
import { ORIGIN } from "./fixtures.js";

type Agent = ReturnType<typeof request.agent>;

export const SAMPLE_ITEMS = [
  { name: "A4 paper box", quantity: 2, unitPrice: 100.5 },
  { name: "Stapler", quantity: 3, unitPrice: 20 },
];

export async function createDraft(agent: Agent, overrides: Record<string, unknown> = {}) {
  const res = await agent
    .post("/api/requests")
    .set("Origin", ORIGIN)
    .send({ title: "Office supplies", justification: "Stock is low", items: SAMPLE_ITEMS, ...overrides });
  if (res.status !== 201) throw new Error(`createDraft failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.request as { id: number; status: string; total: number };
}

export function submitRequest(agent: Agent, id: number, approverId: number) {
  return agent.post(`/api/requests/${id}/submit`).set("Origin", ORIGIN).send({ approverId });
}

export async function createPending(agent: Agent, approverId: number, overrides: Record<string, unknown> = {}) {
  const draft = await createDraft(agent, overrides);
  const res = await submitRequest(agent, draft.id, approverId);
  if (res.status !== 200) throw new Error(`submit failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.request as { id: number; status: string; total: number };
}

export function decide(agent: Agent, id: number, decision: string, comment?: string) {
  return agent.post(`/api/requests/${id}/decision`).set("Origin", ORIGIN).send({ decision, comment });
}
