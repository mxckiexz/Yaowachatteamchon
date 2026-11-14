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
