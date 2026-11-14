// Money is stored as integer satang (1 baht = 100 satang) so totals never suffer rounding errors.

// Converts a baht amount (number or numeric string with at most 2 decimals) to satang.
// Returns null when the value is not a valid amount. Range checks are done by the caller.
export function bahtToSatang(value: unknown): number | null {
  if (typeof value === "string") {
    if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) return null;
    return Math.round(Number(value) * 100);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const satang = Math.round(value * 100);
  // More than two decimals (for example 10.505) is not a valid price.
  if (Math.abs(value * 100 - satang) > 1e-6) return null;
  return satang;
}

export function satangToBaht(satang: number): number {
  return satang / 100;
}

export function calculateTotalSatang(items: { quantity: number; unitPriceSatang: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPriceSatang, 0);
}
