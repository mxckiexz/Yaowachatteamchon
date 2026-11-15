// Stub for the red phase of F-02.
export interface RequestFields {
  itemName: string;
  description: string;
  quantity: number;
  unitPriceSatang: number;
  reason: string;
  category: string | null;
}
export function validateRequestInput(_body: unknown): { ok: true; value: RequestFields } | { ok: false; fields: Record<string, string> } {
  return { ok: true, value: { itemName: "", description: "", quantity: 0, unitPriceSatang: 0, reason: "", category: null } };
}
