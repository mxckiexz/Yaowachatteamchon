import type { Category, RequestStatus } from "@prisma/client";
import { bangkokDateTime } from "./reportRules.js";

// F-17: the export file. UTF-8 with a byte order mark, so spreadsheet programs read Thai text, and CR LF lines.

const HEADER = [
  "Request number",
  "Item name",
  "Category",
  "Status",
  "Quantity",
  "Unit price (THB)",
  "Total (THB)",
  "Requester",
  "Created at",
  "Submitted at",
  "Decided at",
];

// The same words as in the application.
const STATUS_LABEL: Record<RequestStatus, string> = { DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled" };
const CATEGORY_LABEL: Record<Category, string> = { EQUIPMENT: "Equipment", SOFTWARE: "Software", FURNITURE: "Furniture", STATIONERY: "Stationery", OTHER: "Other" };

// BR-41: a spreadsheet could run text with one of these first characters as a formula.
const FORMULA_START = /^[=+\-@\t\r\n]/;
export const safeText = (value: string) => (FORMULA_START.test(value) ? `'${value}` : value);

const quoted = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

// Written from the whole number of satang, so no rounding can happen.
export function money(satang: number | bigint) {
  const value = BigInt(satang);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

export interface ExportRow {
  requestNumber: string;
  itemName: string;
  category: Category | null;
  status: RequestStatus;
  quantity: number;
  unitPriceSatang: number;
  totalSatang: bigint;
  requester: { name: string };
  createdAt: Date;
  submittedAt: Date | null;
  decidedAt: Date | null;
}

export function toCsv(rows: ExportRow[]) {
  const lines = rows.map((r) => [
    r.requestNumber,
    safeText(r.itemName),
    r.category ? CATEGORY_LABEL[r.category] : "",
    STATUS_LABEL[r.status],
    String(r.quantity),
    money(r.unitPriceSatang),
    money(r.totalSatang),
    safeText(r.requester.name),
    bangkokDateTime(r.createdAt),
    bangkokDateTime(r.submittedAt),
    bangkokDateTime(r.decidedAt),
  ]);
  return `\uFEFF${[HEADER, ...lines].map((line) => line.map(quoted).join(",")).join("\r\n")}\r\n`;
}
