import { hashPassword } from "./auth.js";
import { getPrisma } from "./prisma.js";

export const DEMO_ACCOUNTS: { name: string; email: string; role: "REQUESTER" | "APPROVER" | "ADMIN" }[] = [
  { name: "Ploy", email: "ploy@purchaseflow.test", role: "REQUESTER" },
  { name: "Nattapong", email: "nattapong@purchaseflow.test", role: "REQUESTER" },
  { name: "Somchai", email: "somchai@purchaseflow.test", role: "APPROVER" },
  { name: "Malee", email: "malee@purchaseflow.test", role: "APPROVER" },
  { name: "Admin", email: "admin@purchaseflow.test", role: "ADMIN" },
];

// Idempotent: running it twice leaves the same five accounts. The password is a local demo value
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

// Production seeds run in the cloud with a password from Secret Manager. Refuse the published example value and short passwords
// there, and never print the password itself.
const EXAMPLE_SEED_PASSWORD = "ChangeMe123!";
export function assertSeedPasswordAllowed(password: string, nodeEnv: string | undefined): void {
  if (nodeEnv !== "production") return;
  if (password === EXAMPLE_SEED_PASSWORD) {
    throw new Error("SEED_DEFAULT_PASSWORD is the published example value. Set a real secret in production.");
  }
  if (password.length < 12) {
    throw new Error("SEED_DEFAULT_PASSWORD must be at least 12 characters in production.");
  }
}
