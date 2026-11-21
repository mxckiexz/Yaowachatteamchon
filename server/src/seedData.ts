import { hashPassword } from "./auth.js";
import { getPrisma } from "./prisma.js";

export const DEMO_ACCOUNTS: { name: string; email: string; role: "REQUESTER" | "APPROVER" | "ADMIN" }[] = [
  { name: "Ploy", email: "ploy@purchaseflow.test", role: "REQUESTER" },
  { name: "Nattapong", email: "nattapong@purchaseflow.test", role: "REQUESTER" },
  { name: "Somchai", email: "somchai@purchaseflow.test", role: "APPROVER" },
  { name: "Malee", email: "malee@purchaseflow.test", role: "APPROVER" },
  { name: "Admin", email: "admin@purchaseflow.test", role: "ADMIN" },
];

type SeedAccount = (typeof DEMO_ACCOUNTS)[number];

// Local development resets the demo accounts on every run. Production never does: a later release must not undo a role change,
// a deactivation or a changed password, so there the seed only creates what is missing.
export function defaultSeedOverwrite(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}

// Idempotent: running it twice leaves the same accounts. The password comes from the environment (SEED_DEFAULT_PASSWORD),
// never from code and never a real secret.
export async function seedDemoData(
  password: string,
  options: { accounts?: SeedAccount[]; overwrite?: boolean } = {}
): Promise<void> {
  const accounts = options.accounts ?? DEMO_ACCOUNTS;
  const overwrite = options.overwrite ?? defaultSeedOverwrite(process.env.NODE_ENV);
  const prisma = getPrisma();
  const passwordHash = await hashPassword(password);
  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: overwrite ? { name: account.name, role: account.role, isActive: true, passwordHash } : {},
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
