import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";
import type { Role } from "@prisma/client";

export const ORIGIN = "http://localhost:5173";
export const FIXTURE_PASSWORD = "Fixture-Pass1";

export async function createUser(
  email: string,
  overrides: { role?: Role; isActive?: boolean; name?: string; password?: string } = {}
) {
  const prisma = getPrisma();
  const passwordHash = await hashPassword(overrides.password ?? FIXTURE_PASSWORD);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: overrides.role ?? "EMPLOYEE", isActive: overrides.isActive ?? true },
    create: {
      name: overrides.name ?? email.split("@")[0],
      email,
      passwordHash,
      role: overrides.role ?? "EMPLOYEE",
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function loginAgent(email: string, password: string = FIXTURE_PASSWORD) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").set("Origin", ORIGIN).send({ email, password }).expect(200);
  return agent;
}

// Removes everything the fixture users created, in foreign-key order.
export async function cleanupUsers(emails: string[]) {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.requestHistory.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { request: { requesterId: { in: ids } } }] } });
  await prisma.purchaseRequest.deleteMany({ where: { OR: [{ requesterId: { in: ids } }, { approverId: { in: ids } }] } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
