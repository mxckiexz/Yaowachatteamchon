import { getPrisma } from "../src/prisma.js";

// Local development only: removes the purchase requests of the four demo accounts so that the evidence
// pictures start from an empty list. Accounts are kept. Never run this against a shared database.
const prisma = getPrisma();
const demo = await prisma.user.findMany({ where: { email: { endsWith: "@buyflow.test" } }, select: { id: true } });
const ids = demo.map((u) => u.id);
await prisma.requestHistory.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { request: { requesterId: { in: ids } } }] } });
const removed = await prisma.purchaseRequest.deleteMany({ where: { OR: [{ requesterId: { in: ids } }, { approverId: { in: ids } }] } });
console.log(`Removed ${removed.count} demo requests.`);
await prisma.$disconnect();
