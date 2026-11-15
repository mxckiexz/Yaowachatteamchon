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

// BR-01 to BR-04 and BR-15. Returns the cleaned fields, or a message per invalid field.
// A total, a status or a number sent by the client is never read.
export function validateRequestInput(body: any): { ok: true; value: RequestFields } | { ok: false; fields: Record<string, string> } {
  const fields: Record<string, string> = {};

  const itemName = typeof body?.itemName === "string" ? body.itemName.trim() : "";
  if (itemName.length < 1 || itemName.length > 100) fields.itemName = "Item name is required (at most 100 characters).";

  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (description.length < 1 || description.length > 1000) fields.description = "Description is required (at most 1000 characters).";

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
      reason = body.reason.trim();
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
