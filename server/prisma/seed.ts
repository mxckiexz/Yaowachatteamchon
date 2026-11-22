import { getPrisma } from "../src/prisma.js";
import { assertSeedPasswordAllowed, resolveSeedPasswords, seedDemoData } from "../src/seedData.js";

let passwords: ReturnType<typeof resolveSeedPasswords>;
try {
  passwords = resolveSeedPasswords(process.env);
  for (const value of new Set([passwords.demo, passwords.admin])) {
    if (value) assertSeedPasswordAllowed(value, process.env.NODE_ENV);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Seed password check failed.");
  process.exit(1);
}

seedDemoData(passwords.demo, { adminPassword: passwords.admin })
  .then(() => console.log(passwords.demo ? "Seeded demo accounts." : "Seeded the administrator only (no demo password is set)."))
  .finally(() => getPrisma().$disconnect());
