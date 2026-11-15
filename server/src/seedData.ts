// Stub for the red phase of F-01.
export const DEMO_ACCOUNTS: { name: string; email: string; role: "REQUESTER" | "APPROVER" | "ADMIN" }[] = [
  { name: "Ploy", email: "ploy@purchaseflow.test", role: "REQUESTER" },
  { name: "Nattapong", email: "nattapong@purchaseflow.test", role: "REQUESTER" },
  { name: "Somchai", email: "somchai@purchaseflow.test", role: "APPROVER" },
  { name: "Malee", email: "malee@purchaseflow.test", role: "APPROVER" },
  { name: "Admin", email: "admin@purchaseflow.test", role: "ADMIN" },
];
export async function seedDemoData(_password: string): Promise<void> {
  // not implemented
}
