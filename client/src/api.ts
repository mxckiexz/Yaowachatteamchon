export type Role = "EMPLOYEE" | "APPROVER";
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  constructor(status: number, message: string, code?: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// All calls go to /api on the same origin (Vite proxies to the API in development).
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? "Something went wrong.", data?.code, data?.fields);
  }
  return data as T;
}

export const login = (email: string, password: string) =>
  api<{ user: User }>("/auth/login", { method: "POST", body: { email, password } });
export const logout = () => api<void>("/auth/logout", { method: "POST" });
export const getMe = () => api<{ user: User }>("/auth/me");

export type Status = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
export interface Item {
  id?: number;
  name: string;
  quantity: number;
  unitPrice: number;
}
export interface HistoryEntry {
  id: number;
  action: string;
  fromStatus: Status | null;
  toStatus: Status;
  comment: string | null;
  createdAt: string;
  actor: { id: number; name: string };
}
export interface RequestDetail {
  id: number;
  title: string;
  justification: string;
  status: Status;
  total: number;
  items: Item[];
  requester: { id: number; name: string };
  approver: { id: number; name: string } | null;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  history?: HistoryEntry[];
}
export interface RequestSummary {
  id: number;
  title: string;
  status: Status;
  total: number;
  createdAt: string;
  approver: { id: number; name: string } | null;
}
export interface ReviewSummary {
  id: number;
  title: string;
  status: Status;
  total: number;
  submittedAt: string;
  requester: { id: number; name: string };
}

export const listRequests = () => api<{ requests: RequestSummary[] }>("/requests");
export const listReviews = () => api<{ requests: ReviewSummary[] }>("/reviews");
export const getRequest = (id: string | number) => api<{ request: RequestDetail }>(`/requests/${id}`);
export const listApprovers = () => api<{ approvers: { id: number; name: string }[] }>("/approvers");
export const createRequest = (body: { title: string; justification: string; items: Item[] }) =>
  api<{ request: RequestDetail }>("/requests", { method: "POST", body });
export const submitRequest = (id: number, approverId: number) =>
  api<{ request: RequestDetail }>(`/requests/${id}/submit`, { method: "POST", body: { approverId } });
export const decideRequest = (id: number, decision: "APPROVED" | "REJECTED", comment: string) =>
  api<{ request: RequestDetail }>(`/requests/${id}/decision`, { method: "POST", body: { decision, comment } });
