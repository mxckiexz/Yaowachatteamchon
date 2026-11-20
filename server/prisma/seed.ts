import { getPrisma } from "../src/prisma.js";
import { assertSeedPasswordAllowed, seedDemoData } from "../src/seedData.js";

const password = process.env.SEED_DEFAULT_PASSWORD;
if (!password) {
  console.error("SEED_DEFAULT_PASSWORD is not set. Copy server/.env.example to server/.env first.");
  process.exit(1);
}

assertSeedPasswordAllowed(password, process.env.NODE_ENV);

seedDemoData(password)
  .then(() => console.log("Seeded demo accounts."))
  .finally(() => getPrisma().$disconnect());
