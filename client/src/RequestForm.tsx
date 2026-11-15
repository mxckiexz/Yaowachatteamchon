import { useState, type FormEvent } from "react";
import { ApiError, CATEGORIES, type RequestInput } from "./api";
import { CATEGORY_LABEL, formatBaht } from "./format";

export interface FormValues {
  itemName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  reason: string;
  category: string;
}

export const EMPTY_FORM: FormValues = { itemName: "", description: "", quantity: "1", unitPrice: "", reason: "", category: "" };

// The estimated total is only a hint for the user. The server calculates the real total (BR-05).
export function estimateTotal(quantity: string, unitPrice: string): number {
  const q = Number(quantity);
  const p = Number(unitPrice);
  if (quantity.trim() === "" || unitPrice.trim() === "" || !Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
}

interface Props {
  initial: FormValues;
  submitLabel: string;
  busyLabel: string;
  onSave: (input: RequestInput) => Promise<void>;
}

// Used by New request and by Edit draft. Server messages appear beside the fields they belong to.
export default function RequestForm({ initial, submitLabel, busyLabel, onSave }: Props) {
  const [values, setValues] = useState<FormValues>(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof FormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await onSave({
        itemName: values.itemName,
        description: values.description,
        quantity: Number(values.quantity),
        unitPrice: Number(values.unitPrice),
        reason: values.reason,
        category: values.category as RequestInput["category"],
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else {
        setError("Could not reach the server. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const invalid = (key: string) => (fields[key] ? "is-invalid" : "");
  const message = (key: string) => fields[key] && <div className="invalid-feedback d-block">{fields[key]}</div>;

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <div className="mb-3">
        <label htmlFor="itemName" className="form-label">Item name</label>
        <input id="itemName" className={`form-control ${invalid("itemName")}`} value={values.itemName} onChange={set("itemName")} />
        {message("itemName")}
      </div>
      <div className="mb-3">
        <label htmlFor="description" className="form-label">Description</label>
        <textarea id="description" rows={2} className={`form-control ${invalid("description")}`} value={values.description} onChange={set("description")} />
        {message("description")}
      </div>
      <div className="row">
        <div className="col-sm-6 mb-3">
          <label htmlFor="quantity" className="form-label">Quantity</label>
          <input id="quantity" inputMode="numeric" className={`form-control ${invalid("quantity")}`} value={values.quantity} onChange={set("quantity")} />
          {message("quantity")}
        </div>
        <div className="col-sm-6 mb-3">
          <label htmlFor="unitPrice" className="form-label">Unit price (THB)</label>
          <input id="unitPrice" inputMode="decimal" className={`form-control ${invalid("unitPrice")}`} value={values.unitPrice} onChange={set("unitPrice")} />
          {message("unitPrice")}
        </div>
      </div>
      <div className="mb-3">
        <label htmlFor="reason" className="form-label">Reason (needed to submit)</label>
        <textarea id="reason" rows={2} className={`form-control ${invalid("reason")}`} value={values.reason} onChange={set("reason")} />
        {message("reason")}
      </div>
      <div className="mb-3">
        <label htmlFor="category" className="form-label">Category (needed to submit)</label>
        <select id="category" className={`form-select ${invalid("category")}`} value={values.category} onChange={set("category")}>
          <option value="">Choose a category</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        {message("category")}
      </div>
      <p className="fs-5">
        Estimated total: <strong data-testid="estimate">{formatBaht(estimateTotal(values.quantity, values.unitPrice))}</strong>{" "}
        <small className="text-muted">(the server calculates the final total)</small>
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
    </form>
  );
}
