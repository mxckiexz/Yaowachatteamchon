import type request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { ORIGIN } from "./fixtures.js";

type Agent = ReturnType<typeof request.agent>;

export const VALID = {
  itemName: "Laser printer",
  description: "Office printer for floor 2",
  quantity: 2,
  unitPrice: 100.5,
  reason: "The old one broke",
  category: "EQUIPMENT",
};

export function createBody(over: Record<string, unknown> = {}) {
  return { ...VALID, ...over };
}

export async function createDraft(agent: Agent, over: Record<string, unknown> = {}) {
  const res = await agent.post("/api/requests").set("Origin", ORIGIN).send(createBody(over));
  if (res.status !== 201) throw new Error(`createDraft failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.request as { id: number; requestNumber: string; status: string; total: number };
}

export function submit(agent: Agent, id: number) {
  return agent.post(`/api/requests/${id}/submit`).set("Origin", ORIGIN).send({});
}

export async function createSubmitted(agent: Agent, over: Record<string, unknown> = {}) {
  const draft = await createDraft(agent, over);
  const res = await submit(agent, draft.id);
  if (res.status !== 200) throw new Error(`submit failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.request as { id: number; requestNumber: string; status: string; total: number };
}

export function approve(agent: Agent, id: number, comment?: string) {
  return agent.post(`/api/requests/${id}/approve`).set("Origin", ORIGIN).send({ comment });
}

export function reject(agent: Agent, id: number, reason?: string) {
  return agent.post(`/api/requests/${id}/reject`).set("Origin", ORIGIN).send({ reason });
}

export function cancel(agent: Agent, id: number) {
  return agent.post(`/api/requests/${id}/cancel`).set("Origin", ORIGIN).send({});
}

export async function loadRequest(id: number) {
  return getPrisma().purchaseRequest.findUniqueOrThrow({ where: { id }, include: { history: { orderBy: { id: "asc" } } } });
}
