import type { Category, Status } from "./api";

export function formatBaht(value: number): string {
  return `฿${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

const LABELS: Record<Status, { text: string; className: string }> = {
  DRAFT: { text: "Draft", className: "bg-secondary" },
  SUBMITTED: { text: "Submitted", className: "bg-warning text-dark" },
  APPROVED: { text: "Approved", className: "bg-success" },
  REJECTED: { text: "Rejected", className: "bg-danger" },
  CANCELLED: { text: "Cancelled", className: "bg-dark" },
};

// The status is always written out as text; colour is only a second cue.
export function StatusBadge({ status }: { status: Status }) {
  const label = LABELS[status];
  return <span data-testid="status-badge" className={`badge ${label.className}`}>{label.text}</span>;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  EQUIPMENT: "Equipment",
  SOFTWARE: "Software",
  FURNITURE: "Furniture",
  STATIONERY: "Stationery",
  OTHER: "Other",
};
