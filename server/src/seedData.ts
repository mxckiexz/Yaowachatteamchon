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

// Which environment variables hold the passwords. SEED_DEFAULT_PASSWORD is ours; DEMO_USER_PASSWORD and ADMIN_PASSWORD are the
// names a managed environment (the CPE334 portal) hands to the migration job. The administrator never receives the demo
// password by accident and the demo accounts never receive the administrator password: with only ADMIN_PASSWORD set, only the
// administrator is seeded.
export function resolveSeedPasswords(env: Record<string, string | undefined>): { demo: string | undefined; admin: string | undefined } {
  const demo = env.SEED_DEFAULT_PASSWORD || env.DEMO_USER_PASSWORD || undefined;
  const admin = env.ADMIN_PASSWORD || demo;
  if (!demo && !admin) {
    throw new Error("No seed password is set. Set SEED_DEFAULT_PASSWORD (or DEMO_USER_PASSWORD and ADMIN_PASSWORD). See server/.env.example.");
  }
  return { demo, admin };
}

// Idempotent: running it twice leaves the same accounts. Passwords come from the environment, never from code.
// The administrator uses options.adminPassword when given, else the demo password. An account without a password is skipped.
export async function seedDemoData(
  password: string | undefined,
  options: { accounts?: SeedAccount[]; overwrite?: boolean; adminPassword?: string } = {}
): Promise<void> {
  const accounts = options.accounts ?? DEMO_ACCOUNTS;
  const overwrite = options.overwrite ?? defaultSeedOverwrite(process.env.NODE_ENV);
  const prisma = getPrisma();
  const hashes = new Map<string, string>();
  const hashOf = async (value: string) => {
    if (!hashes.has(value)) hashes.set(value, await hashPassword(value));
    return hashes.get(value)!;
  };
  for (const account of accounts) {
    const own = account.role === "ADMIN" ? options.adminPassword ?? password : password;
    if (!own) continue;
    const passwordHash = await hashOf(own);
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
