import type { Category, Prisma, RequestStatus } from "@prisma/client";

// F-17: the filters of a report, and Thailand time. Bangkok is UTC+7 all year, so the offset is written out
// and the result does not depend on the time zone of the server.

export const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as const satisfies readonly RequestStatus[];
export const CATEGORIES = ["EQUIPMENT", "SOFTWARE", "FURNITURE", "STATIONERY", "OTHER"] as const satisfies readonly Category[];

const PARAMETERS = ["from", "to", "status", "category"] as const;
const BANGKOK = "+07:00";
const BANGKOK_MS = 7 * 60 * 60 * 1000;

type Name = (typeof PARAMETERS)[number];
export type ReportQuery = { ok: true; where: Prisma.PurchaseRequestWhereInput } | { ok: false; fields: Record<string, string> };

// A real calendar date written as YYYY-MM-DD, with a year from 2000 to 2999.
function isCalendarDate(value: string) {
  if (!/^2\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function parseReportQuery(query: Record<string, unknown>): ReportQuery {
  // A repeated parameter is reported first, on its own.
  const repeated = PARAMETERS.filter((name) => Array.isArray(query[name]));
  if (repeated.length > 0) {
    return { ok: false, fields: Object.fromEntries(repeated.map((name) => [name, "This parameter may be supplied only once."])) };
  }

  const fields: Record<string, string> = {};
  const values: Partial<Record<Name, string>> = {};
  for (const name of PARAMETERS) {
    const raw = query[name];
    // An empty value counts as absent. Anything that is not plain text, such as from[a]=1, is wrong.
    if (raw !== undefined && raw !== "") values[name] = typeof raw === "string" ? raw : "?";
  }
  const { from, to, status, category } = values;
  for (const name of ["from", "to"] as const) {
    const value = values[name];
    if (value !== undefined && !isCalendarDate(value)) fields[name] = "Enter a date as YYYY-MM-DD, in the years 2000 to 2999.";
  }
  if (status !== undefined && !(STATUSES as readonly string[]).includes(status)) fields.status = "Unknown status.";
  if (category !== undefined && !(CATEGORIES as readonly string[]).includes(category)) fields.category = "Unknown category.";
  if (from && to && !fields.from && !fields.to && from > to) fields.to = "The end date is before the start date.";
  if (Object.keys(fields).length > 0) return { ok: false, fields };

  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00.000${BANGKOK}`);
  if (to) createdAt.lte = new Date(`${to}T23:59:59.999${BANGKOK}`);
  return {
    ok: true,
    where: {
      ...(from || to ? { createdAt } : {}),
      ...(status ? { status: status as RequestStatus } : {}),
      ...(category ? { category: category as Category } : {}),
    },
  };
}

// "YYYY-MM-DD HH:mm" in Bangkok, or an empty field.
export function bangkokDateTime(value: Date | null) {
  return value ? new Date(value.getTime() + BANGKOK_MS).toISOString().slice(0, 16).replace("T", " ") : "";
}

export const bangkokDate = (value: Date) => bangkokDateTime(value).slice(0, 10);
