import { Router, type Response } from "express";
import type { Prisma } from "@prisma/client";
import { requireAuth, type AuthedRequest, type AuthenticatedUser } from "./auth.js";
import { asyncHandler } from "./http.js";
import { satangToBaht } from "./money.js";
import { getPrisma } from "./prisma.js";
import { toCsv } from "./reportCsv.js";
import { CATEGORIES, STATUSES, bangkokDate, parseReportQuery } from "./reportRules.js";
import { visibilityWhere } from "./visibility.js";

// F-17: a summary of the requests the caller may see, and the same requests as a CSV file. Both only read.
export const reportRouter = Router();

const EXPORT_LIMIT = 5000;

// BR-40: what the caller may see (BR-12), narrowed by the filters. AND keeps a filter from replacing the rule.
function reportWhere(user: AuthenticatedUser, filters: Prisma.PurchaseRequestWhereInput): Prisma.PurchaseRequestWhereInput {
  return { AND: [visibilityWhere(user), filters] };
}

const refuse = (res: Response, fields: Record<string, string>) =>
  res.status(422).json({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fields });

interface Group {
  status: string;
  category: string | null;
  count: number;
  satang: bigint;
}

function totals(groups: Group[]) {
  return {
    count: groups.reduce((sum, g) => sum + g.count, 0),
    total: satangToBaht(groups.reduce((sum, g) => sum + g.satang, 0n)),
  };
}

reportRouter.get(
  "/reports/summary",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const query = parseReportQuery(req.query as Record<string, unknown>);
    if (!query.ok) return refuse(res, query.fields);
    // One query, so the two lists always describe the same rows.
    const rows = await getPrisma().purchaseRequest.groupBy({
      by: ["status", "category"],
      where: reportWhere(req.user!, query.where),
      _count: { _all: true },
      _sum: { totalSatang: true },
    });
    const groups: Group[] = rows.map((r) => ({ status: r.status, category: r.category, count: r._count._all, satang: r._sum.totalSatang ?? 0n }));
    res.json({
      summary: {
        ...totals(groups),
        byStatus: STATUSES.map((status) => ({ status, ...totals(groups.filter((g) => g.status === status)) })),
        byCategory: [...CATEGORIES, null].map((category) => ({ category, ...totals(groups.filter((g) => g.category === category)) })),
      },
    });
  })
);

reportRouter.get(
  "/reports/export.csv",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const query = parseReportQuery(req.query as Record<string, unknown>);
    if (!query.ok) return refuse(res, query.fields);
    // One more than the limit is enough to know that the file would be too large. Nothing is cut off silently.
    const rows = await getPrisma().purchaseRequest.findMany({
      where: reportWhere(req.user!, query.where),
      select: {
        requestNumber: true,
        itemName: true,
        category: true,
        status: true,
        quantity: true,
        unitPriceSatang: true,
        totalSatang: true,
        requester: { select: { name: true } },
        createdAt: true,
        submittedAt: true,
        decidedAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: EXPORT_LIMIT + 1,
    });
    if (rows.length > EXPORT_LIMIT) {
      return res.status(422).json({ error: "Too many requests to export. Narrow the filters.", code: "EXPORT_TOO_LARGE" });
    }
    // The file is complete before any header is set, so a failure still gives the normal JSON error.
    const file = Buffer.from(toCsv(rows), "utf8");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="purchase-requests-${bangkokDate(new Date())}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(file);
  })
);
