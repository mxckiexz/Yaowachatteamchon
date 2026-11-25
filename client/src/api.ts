export type Role = "REQUESTER" | "APPROVER" | "ADMIN";
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

export type Status = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type Category = "EQUIPMENT" | "SOFTWARE" | "FURNITURE" | "STATIONERY" | "OTHER";
export const CATEGORIES: Category[] = ["EQUIPMENT", "SOFTWARE", "FURNITURE", "STATIONERY", "OTHER"];

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
  requestNumber: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason: string;
  category: Category | null;
  status: Status;
  rejectionReason: string | null;
  requester: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  history?: HistoryEntry[];
}
export interface RequestSummary {
  id: number;
  requestNumber: string;
  itemName: string;
  quantity: number;
  total: number;
  category: Category | null;
  status: Status;
  createdAt: string;
  submittedAt: string | null;
  requester: { id: number; name: string };
}
export interface RequestInput {
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  reason: string;
  category: Category | "";
}
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export type Scope = "mine" | "review" | "all";
export const listRequests = (scope: Scope = "mine") => api<{ requests: RequestSummary[] }>(`/requests?scope=${scope}`);
export const getRequest = (id: string | number) => api<{ request: RequestDetail }>(`/requests/${id}`);
export const createRequest = (body: RequestInput) => api<{ request: RequestDetail }>("/requests", { method: "POST", body });
export const updateRequest = (id: number, body: RequestInput) => api<{ request: RequestDetail }>(`/requests/${id}`, { method: "PATCH", body });
export const submitRequest = (id: number) => api<{ request: RequestDetail }>(`/requests/${id}/submit`, { method: "POST", body: {} });
export const approveRequest = (id: number, comment: string) =>
  api<{ request: RequestDetail }>(`/requests/${id}/approve`, { method: "POST", body: { comment } });
export const rejectRequest = (id: number, reason: string) =>
  api<{ request: RequestDetail }>(`/requests/${id}/reject`, { method: "POST", body: { reason } });
export const cancelRequest = (id: number) =>
  api<{ request: RequestDetail }>(`/requests/${id}/cancel`, { method: "POST", body: {} });
export const listUsers = () => api<{ users: AdminUser[] }>("/admin/users");
export const updateUser = (id: number, patch: { isActive?: boolean; role?: Role }) =>
  api<{ user: AdminUser }>(`/admin/users/${id}`, { method: "PATCH", body: patch });
