import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createRequest } from "./api";
import { formatBaht } from "./format";

interface Row {
  key: number;
  name: string;
  quantity: string;
  unitPrice: string;
}

let nextKey = 2;

// The estimated total is only a hint for the user. The server calculates the real total (BR-02).
export function estimateTotal(rows: Row[]): number {
  return rows.reduce((sum, r) => {
    const q = Number(r.quantity);
    const p = Number(r.unitPrice);
    return Number.isFinite(q) && Number.isFinite(p) ? sum + q * p : sum;
  }, 0);
}

export default function NewRequest() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [justification, setJustification] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: 1, name: "", quantity: "1", unitPrice: "" }]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const result = await createRequest({
        title,
        justification,
        items: rows.map((r) => ({ name: r.name, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) })),
      });
      navigate(`/requests/${result.request.id}`);
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

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="h4 mb-3">New purchase request</h1>
      {error && <div role="alert" className="alert alert-danger">{error}</div>}

      <div className="mb-3">
        <label htmlFor="title" className="form-label">Title</label>
        <input id="title" className={`form-control ${fields.title ? "is-invalid" : ""}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        {fields.title && <div className="invalid-feedback d-block">{fields.title}</div>}
      </div>
      <div className="mb-3">
        <label htmlFor="justification" className="form-label">Justification</label>
        <textarea id="justification" className="form-control" rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} />
        {fields.justification && <div className="invalid-feedback d-block">{fields.justification}</div>}
      </div>

      <h2 className="h6">Items</h2>
      {fields.items && <div className="text-danger mb-2">{fields.items}</div>}
      <table className="table align-middle">
        <thead>
          <tr><th>Item</th><th style={{ width: 120 }}>Quantity</th><th style={{ width: 160 }}>Unit price (THB)</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key}>
              <td>
                <input aria-label={`Item name ${index + 1}`} className={`form-control ${fields[`items.${index}.name`] ? "is-invalid" : ""}`} value={row.name} onChange={(e) => updateRow(row.key, { name: e.target.value })} />
                {fields[`items.${index}.name`] && <div className="invalid-feedback d-block">{fields[`items.${index}.name`]}</div>}
              </td>
              <td>
                <input aria-label={`Quantity ${index + 1}`} inputMode="numeric" className={`form-control ${fields[`items.${index}.quantity`] ? "is-invalid" : ""}`} value={row.quantity} onChange={(e) => updateRow(row.key, { quantity: e.target.value })} />
                {fields[`items.${index}.quantity`] && <div className="invalid-feedback d-block">{fields[`items.${index}.quantity`]}</div>}
              </td>
              <td>
                <input aria-label={`Unit price ${index + 1}`} inputMode="decimal" className={`form-control ${fields[`items.${index}.unitPrice`] ? "is-invalid" : ""}`} value={row.unitPrice} onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })} />
                {fields[`items.${index}.unitPrice`] && <div className="invalid-feedback d-block">{fields[`items.${index}.unitPrice`]}</div>}
              </td>
              <td>
                <button type="button" className="btn btn-outline-secondary btn-sm" aria-label={`Remove item ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows((c) => c.filter((r) => r.key !== row.key))}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline-primary btn-sm mb-3" onClick={() => setRows((c) => [...c, { key: nextKey++, name: "", quantity: "1", unitPrice: "" }])}>
        Add item
      </button>

      <p className="fs-5">Estimated total: <strong data-testid="estimate">{formatBaht(estimateTotal(rows))}</strong> <small className="text-muted">(the server calculates the final total)</small></p>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Save draft"}</button>
    </form>
  );
}
