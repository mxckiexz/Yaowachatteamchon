import type { Role } from "./api";

// The first screen of each role.
export function homePath(role: Role): string {
  return role === "ADMIN" ? "/admin/users" : "/requests";
}
