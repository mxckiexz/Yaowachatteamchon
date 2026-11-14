// Stub for the red phase of F-01.
export const DEMO_ACCOUNTS: { name: string; email: string; role: "EMPLOYEE" | "APPROVER" }[] = [
  { name: "Somchai", email: "somchai@buyflow.test", role: "APPROVER" },
  { name: "Malee", email: "malee@buyflow.test", role: "APPROVER" },
  { name: "Ploy", email: "ploy@buyflow.test", role: "EMPLOYEE" },
  { name: "Nattapong", email: "nattapong@buyflow.test", role: "EMPLOYEE" },
];
export async function seedDemoData(_password: string): Promise<void> {
  // not implemented
}
