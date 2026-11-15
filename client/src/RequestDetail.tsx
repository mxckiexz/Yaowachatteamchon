import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, decideRequest, getRequest, listApprovers, submitRequest, type RequestDetail as Detail } from "./api";
import { useAuth } from "./AuthContext";
import { formatBaht, formatDateTime, StatusBadge } from "./format";

const ACTION_TEXT: Record<string, string> = { CREATED: "Created", SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected" };

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
  const canDecide = request.status === "PENDING" && request.approver?.id === user.id && !isOwner;

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-2">
        <h1 className="h4 mb-0">{request.title}</h1>
        <StatusBadge status={request.status} />
      </div>
      <p className="text-muted mb-1">Requested by {request.requester.name} on {formatDateTime(request.createdAt)}</p>
      <p className="mb-1">Approver: {request.approver?.name ?? "Not sent yet"}</p>
      {request.justification && <p>{request.justification}</p>}

      <div className="table-responsive">
      <table className="table table-sm w-auto">
        <thead><tr><th>Item</th><th className="text-end">Quantity</th><th className="text-end">Unit price</th><th className="text-end">Line total</th></tr></thead>
        <tbody>
          {request.items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td className="text-end">{i.quantity}</td>
              <td className="text-end">{formatBaht(i.unitPrice)}</td>
              <td className="text-end">{formatBaht(i.quantity * i.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={3} className="text-end">Total</th><th className="text-end" data-testid="total">{formatBaht(request.total)}</th></tr></tfoot>
      </table>
      </div>

      {request.decisionComment && (
        <p><strong>Decision comment:</strong> <span data-testid="decision-comment">{request.decisionComment}</span></p>
      )}

      {isOwner && request.status === "DRAFT" && <SubmitPanel request={request} onDone={setRequest} />}
      {canDecide && <DecisionPanel request={request} onDone={setRequest} />}

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

function SubmitPanel({ request, onDone }: { request: Detail; onDone: (r: Detail) => void }) {
  const [approvers, setApprovers] = useState<{ id: number; name: string }[]>([]);
  const [approverId, setApproverId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listApprovers().then((r) => setApprovers(r.approvers)).catch(() => setError("Could not load approvers."));
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await submitRequest(request.id, Number(approverId));
      // Reload for the history entry written by the server.
      const full = await getRequest(result.request.id);
      onDone(full.request);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border rounded p-3 mb-3" aria-label="Submit for approval">
      <h2 className="h6">Submit for approval</h2>
      <div className="d-flex gap-2 align-items-end">
        <div>
          <label htmlFor="approver" className="form-label">Approver</label>
          <select id="approver" className="form-select" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
            <option value="">Choose an approver</option>
            {approvers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={!approverId || busy} onClick={submit}>Submit</button>
      </div>
      {error && <div role="alert" className="alert alert-danger mt-2 mb-0">{error}</div>}
    </section>
  );
}

function DecisionPanel({ request, onDone }: { request: Detail; onDone: (r: Detail) => void }) {
  const [mode, setMode] = useState<null | "APPROVED" | "REJECTED">(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      await decideRequest(request.id, mode, comment);
      const full = await getRequest(request.id);
      onDone(full.request);
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
            {mode === "APPROVED" ? "Approve" : "Reject"} <strong>{request.title}</strong> for <strong>{formatBaht(request.total)}</strong>?
          </p>
          <label htmlFor="comment" className="form-label">
            {mode === "REJECTED" ? "Reason (required, at least 5 characters)" : "Comment (optional)"}
          </label>
          <textarea id="comment" className="form-control mb-2" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
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
