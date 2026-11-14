import { PrismaClient } from "@prisma/client";

// Lazy singleton: the client is created on first use, not at import time.
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) client = new PrismaClient();
  return client;
}
