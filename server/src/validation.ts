import { bahtToSatang } from "./money.js";

export const CATEGORIES = ["EQUIPMENT", "SOFTWARE", "FURNITURE", "STATIONERY", "OTHER"] as const;
export type CategoryName = (typeof CATEGORIES)[number];

export interface RequestFields {
  itemName: string;
  description: string;
  quantity: number;
  unitPriceSatang: number;
  reason: string;
  category: CategoryName | null;
}

const MAX_PRICE_SATANG = 1_000_000 * 100;

// DEF-02 (UAT #68): String.prototype.trim() keeps invisible format characters such as ZERO WIDTH SPACE
// (U+200B), ZWNJ, ZWJ, WORD JOINER and the BOM (U+FEFF), so a text made only of them looked blank but passed.
const EDGE_INVISIBLE = /^[\s\p{Cf}]+|[\s\p{Cf}]+$/gu;
const INVISIBLE = /\p{Cf}/gu;

// Removes white space and invisible format characters at both ends. Characters inside the text are kept,
// so a joined emoji or a Thai word stays exactly as typed.
export function cleanText(value: string): string {
  return value.replace(EDGE_INVISIBLE, "");
}

// The number of characters a reader can see: invisible format characters are not counted.
export function visibleLength(value: string): number {
  return value.replace(INVISIBLE, "").length;
}

// BR-01 to BR-04 and BR-15. Returns the cleaned fields, or a message per invalid field.
// A total, a status or a number sent by the client is never read.
export function validateRequestInput(body: any): { ok: true; value: RequestFields } | { ok: false; fields: Record<string, string> } {
  const fields: Record<string, string> = {};

  const itemName = typeof body?.itemName === "string" ? cleanText(body.itemName) : "";
  if (visibleLength(itemName) < 1 || itemName.length > 100) fields.itemName = "Item name is required (at most 100 characters).";

  const description = typeof body?.description === "string" ? cleanText(body.description) : "";
  if (visibleLength(description) < 1 || description.length > 1000) fields.description = "Description is required (at most 1000 characters).";

  const quantity = body?.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) fields.quantity = "Quantity must be a whole number from 1 to 1000.";

  const unitPriceSatang = bahtToSatang(body?.unitPrice);
  if (unitPriceSatang === null || unitPriceSatang < 1 || unitPriceSatang > MAX_PRICE_SATANG) {
    fields.unitPrice = "Unit price must be more than 0 and at most 1,000,000 baht, with at most 2 decimals.";
  }

  let reason = "";
  if (body?.reason !== undefined && body?.reason !== null) {
    if (typeof body.reason !== "string") fields.reason = "Reason must be text.";
    else {
      reason = cleanText(body.reason);
      if (reason.length > 500) fields.reason = "Reason must be at most 500 characters.";
    }
  }

  let category: CategoryName | null = null;
  if (body?.category !== undefined && body?.category !== null && body?.category !== "") {
    if (!(CATEGORIES as readonly string[]).includes(body.category)) fields.category = `Category must be one of ${CATEGORIES.join(", ")}.`;
    else category = body.category;
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { itemName, description, quantity, unitPriceSatang: unitPriceSatang as number, reason, category } };
}
