import { bahtToSatang } from "./money.js";

export interface ValidItem {
  name: string;
  quantity: number;
  unitPriceSatang: number;
}
export interface ValidRequest {
  title: string;
  justification: string;
  items: ValidItem[];
}

const MAX_PRICE_SATANG = 1_000_000 * 100;

// BR-02. Returns the cleaned request, or a message per invalid field. A total sent by the client is never read.
export function validateRequestInput(body: any): { ok: true; value: ValidRequest } | { ok: false; fields: Record<string, string> } {
  const fields: Record<string, string> = {};

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (title.length < 3 || title.length > 120) fields.title = "Title must be 3 to 120 characters.";

  const justification = typeof body?.justification === "string" ? body.justification.trim() : "";
  if (body?.justification !== undefined && typeof body.justification !== "string") fields.justification = "Justification must be text.";
  else if (justification.length > 1000) fields.justification = "Justification must be at most 1000 characters.";

  const items: ValidItem[] = [];
  if (!Array.isArray(body?.items) || body.items.length < 1) {
    fields.items = "Add at least one item.";
  } else if (body.items.length > 50) {
    fields.items = "A request can have at most 50 items.";
  } else {
    body.items.forEach((raw: any, index: number) => {
      const name = typeof raw?.name === "string" ? raw.name.trim() : "";
      if (name.length < 1 || name.length > 100) fields[`items.${index}.name`] = "Item name must be 1 to 100 characters.";
      const quantity = raw?.quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
        fields[`items.${index}.quantity`] = "Quantity must be a whole number from 1 to 1000.";
      }
      const satang = bahtToSatang(raw?.unitPrice);
      if (satang === null || satang < 1 || satang > MAX_PRICE_SATANG) {
        fields[`items.${index}.unitPrice`] = "Unit price must be more than 0 and at most 1,000,000 baht, with at most 2 decimals.";
      }
      if (!fields[`items.${index}.name`] && !fields[`items.${index}.quantity`] && !fields[`items.${index}.unitPrice`]) {
        items.push({ name, quantity, unitPriceSatang: satang as number });
      }
    });
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { title, justification, items } };
}
