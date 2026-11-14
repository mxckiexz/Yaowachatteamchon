import { vi } from "vitest";

export type Handler = (url: string, init?: RequestInit) => { status: number; body?: unknown } | undefined;

// Replaces fetch with a handler that returns canned API answers; unknown calls fail the test loudly.
export function mockApi(handler: Handler) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const answer = handler(url, init);
    if (!answer) throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${url}`);
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export const EMPLOYEE = { id: 1, name: "Ploy", email: "ploy@buyflow.test", role: "EMPLOYEE" };
export const APPROVER = { id: 2, name: "Somchai", email: "somchai@buyflow.test", role: "APPROVER" };
