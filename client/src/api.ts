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
export async function api<T>(path: string, options: { method?: string; body?: unknown; file?: File } = {}): Promise<T> {
  let headers: Record<string, string> | undefined;
  let body: BodyInit | undefined;
  if (options.file) {
    headers = { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(options.file.name) };
    body = options.file;
  } else if (options.body !== undefined) {
    headers = { "Content-Type": "application/json" };
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`/api${path}`, { method: options.method ?? "GET", credentials: "include", headers, body });
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
export interface RequestFilters {
  q?: string;
  status?: Status | "";
  category?: Category | "";
}
export const listRequests = (scope: Scope = "mine", filters: RequestFilters = {}) => {
  const params = new URLSearchParams({ scope });
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  return api<{ requests: RequestSummary[] }>(`/requests?${params.toString()}`);
};
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

// F-09: the file goes as the raw body and its name in a header, so the name is not part of a URL.
export interface Attachment {
  id: number;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  uploadedBy: { id: number; name: string };
  createdAt: string;
}
export const attachmentUrl = (requestId: number, attachmentId: number) => `/api/requests/${requestId}/attachments/${attachmentId}`;
export const listAttachments = (requestId: number) => api<{ attachments: Attachment[] }>(`/requests/${requestId}/attachments`);
export const deleteAttachment = (requestId: number, attachmentId: number) =>
  api<void>(`/requests/${requestId}/attachments/${attachmentId}`, { method: "DELETE" });
export const uploadAttachment = (requestId: number, file: File) =>
  api<{ attachment: Attachment }>(`/requests/${requestId}/attachments`, { method: "POST", file });
