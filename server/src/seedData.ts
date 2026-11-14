import { hashPassword } from "./auth.js";
import { getPrisma } from "./prisma.js";

export const DEMO_ACCOUNTS: { name: string; email: string; role: "EMPLOYEE" | "APPROVER" }[] = [
  { name: "Somchai", email: "somchai@buyflow.test", role: "APPROVER" },
  { name: "Malee", email: "malee@buyflow.test", role: "APPROVER" },
  { name: "Ploy", email: "ploy@buyflow.test", role: "EMPLOYEE" },
  { name: "Nattapong", email: "nattapong@buyflow.test", role: "EMPLOYEE" },
];

// Idempotent: running it twice leaves the same four accounts. The password is a local demo value
// from the environment (SEED_DEFAULT_PASSWORD), never a real secret.
export async function seedDemoData(password: string): Promise<void> {
  const prisma = getPrisma();
  const passwordHash = await hashPassword(password);
  for (const account of DEMO_ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, role: account.role, isActive: true, passwordHash },
      create: { ...account, passwordHash },
    });
  }
}
