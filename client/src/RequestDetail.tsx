import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, approveRequest, getRequest, rejectRequest, submitRequest, updateRequest, type RequestDetail as Detail } from "./api";
import { useAuth } from "./AuthContext";
import { CATEGORY_LABEL, formatBaht, formatDateTime, StatusBadge } from "./format";
import RequestForm from "./RequestForm";

const ACTION_TEXT: Record<string, string> = { CREATED: "Created", SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled" };

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    getRequest(id!)
      .then((r) => setRequest(r.request))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Could not load the request.");
      });
  }
  useEffect(load, [id]);

  if (notFound) return <p>Request not found.</p>;
  if (error) return <div role="alert" className="alert alert-danger">{error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={load}>Retry</button></div>;
  if (!request || !user) return <p>Loading...</p>;

  const isOwner = request.requester.id === user.id;
  const canEdit = isOwner && request.status === "DRAFT";
  const canDecide = user.role === "APPROVER" && request.status === "SUBMITTED" && !isOwner;
  // After a change the server's version, with its history, is loaded again.
  const reload = () => getRequest(request.id).then((r) => setRequest(r.request));

  return (
    <>
      <div className="d-flex align-items-center gap-3 flex-wrap mb-2">
        <h1 className="h4 mb-0">{request.requestNumber}: {request.itemName}</h1>
        <StatusBadge status={request.status} />
      </div>
      <p className="text-muted mb-1">Requested by {request.requester.name} on {formatDateTime(request.createdAt)}</p>

      {!canEdit && (
        <>
          <div className="table-responsive">
            <table className="table table-sm w-auto">
              <tbody>
                <tr><th scope="row">Description</th><td>{request.description}</td></tr>
                <tr><th scope="row">Quantity</th><td>{request.quantity}</td></tr>
                <tr><th scope="row">Unit price</th><td>{formatBaht(request.unitPrice)}</td></tr>
                <tr><th scope="row">Total</th><td data-testid="total">{formatBaht(request.total)}</td></tr>
                <tr><th scope="row">Reason</th><td>{request.reason || <span className="text-muted">none</span>}</td></tr>
                <tr><th scope="row">Category</th><td>{request.category ? CATEGORY_LABEL[request.category] : <span className="text-muted">none</span>}</td></tr>
              </tbody>
            </table>
          </div>
          {request.rejectionReason && <p><strong>Rejection reason:</strong> <span data-testid="rejection-reason">{request.rejectionReason}</span></p>}
        </>
      )}

      {canEdit && (
        <section className="border rounded p-3 mb-3" aria-label="Edit draft">
          <h2 className="h6">Edit draft</h2>
          <RequestForm
            key={request.updatedAt}
            initial={{
              itemName: request.itemName,
              description: request.description,
              quantity: String(request.quantity),
              unitPrice: String(request.unitPrice),
              reason: request.reason,
              category: request.category ?? "",
            }}
            submitLabel="Save changes"
            busyLabel="Saving..."
            onSave={async (input) => {
              await updateRequest(request.id, input);
              await reload();
            }}
          />
        </section>
      )}
      {canEdit && <SubmitPanel request={request} onDone={reload} />}
      {canDecide && <DecisionPanel request={request} onDone={reload} />}

      <h2 className="h6 mt-4">History</h2>
      <ol className="list-unstyled" data-testid="history">
        {(request.history ?? []).map((h) => (
          <li key={h.id} className="mb-1">
            <strong>{ACTION_TEXT[h.action] ?? h.action}</strong> by {h.actor.name}, {formatDateTime(h.createdAt)}
            {h.comment && <> ({h.comment})</>}
          </li>
        ))}
      </ol>
    </>
  );
}

function SubmitPanel({ request, onDone }: { request: Detail; onDone: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await submitRequest(request.id);
      await onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else setError("Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border rounded p-3 mb-3" aria-label="Submit for approval">
      <h2 className="h6">Submit for approval</h2>
      <p className="mb-2">Submitting sends the request to the approvers. After that it can no longer be edited.</p>
      <button className="btn btn-success" disabled={busy} onClick={submit}>Submit request</button>
      {error && (
        <div role="alert" className="alert alert-danger mt-2 mb-0">
          {error}
          {Object.values(fields).length > 0 && <ul className="mb-0">{Object.entries(fields).map(([k, v]) => <li key={k}>{v}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}

function DecisionPanel({ request, onDone }: { request: Detail; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<null | "APPROVED" | "REJECTED">(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "APPROVED") await approveRequest(request.id, text);
      else await rejectRequest(request.id, text);
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the decision.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border rounded p-3 mb-3" aria-label="Decision">
      <h2 className="h6">Your decision</h2>
      {!mode && (
        <div className="d-flex gap-2">
          <button className="btn btn-success" onClick={() => setMode("APPROVED")}>Approve</button>
          <button className="btn btn-danger" onClick={() => setMode("REJECTED")}>Reject</button>
        </div>
      )}
      {mode && (
        <>
          <p className="mb-2">
            {mode === "APPROVED" ? "Approve" : "Reject"} <strong>{request.requestNumber}</strong>, {request.itemName}, for <strong>{formatBaht(request.total)}</strong>?
          </p>
          <label htmlFor="decisionText" className="form-label">
            {mode === "REJECTED" ? "Reason (required, at least 5 characters)" : "Comment (optional)"}
          </label>
          <textarea id="decisionText" className="form-control mb-2" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="d-flex gap-2">
            <button className={`btn ${mode === "APPROVED" ? "btn-success" : "btn-danger"}`} disabled={busy} onClick={confirm}>
              Confirm {mode === "APPROVED" ? "approval" : "rejection"}
            </button>
            <button className="btn btn-outline-secondary" disabled={busy} onClick={() => { setMode(null); setError(null); }}>Cancel</button>
          </div>
        </>
      )}
      {error && <div role="alert" className="alert alert-danger mt-2 mb-0">{error}</div>}
    </section>
  );
}
