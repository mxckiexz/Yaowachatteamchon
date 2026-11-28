import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, approveRequest, cancelRequest, getRequest, listUsers, rejectRequest, returnRequest, setApprovalSteps, submitRequest, updateRequest, type AdminUser, type RequestDetail as Detail } from "./api";
import Attachments from "./Attachments";
import { useAuth } from "./AuthContext";
import Comments from "./Comments";
import { CATEGORY_LABEL, formatBaht, formatDateTime, StatusBadge } from "./format";
import RequestForm from "./RequestForm";

const ACTION_TEXT: Record<string, string> = { CREATED: "Created", SUBMITTED: "Submitted", RETURNED: "Returned for editing", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled", STEP_APPROVED: "Approval step approved" };
const STEP_STATUS: Record<string, string> = { PLANNED: "Planned", WAITING: "Waiting", CURRENT: "Current", APPROVED: "Approved", REJECTED: "Rejected" };

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [request, setRequest] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedApproverIds, setSelectedApproverIds] = useState<number[]>([]);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [stepsBusy, setStepsBusy] = useState(false);

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
  useEffect(() => {
    if (user?.role !== "ADMIN" || request?.status !== "DRAFT") return;
    listUsers().then((result) => setAdminUsers(result.users.filter((u) => u.isActive && u.role === "APPROVER" && u.id !== request.requester.id))).catch(() => setAdminUsers([]));
  }, [user?.role, request?.status, request?.requester.id]);
  useEffect(() => {
    setSelectedApproverIds(request?.approvalSteps?.map((step) => step.approver.id) ?? []);
  }, [request?.id, request?.updatedAt]);

  if (notFound) return <p>Request not found.</p>;
  if (error) return <div role="alert" className="alert alert-danger">{error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={load}>Retry</button></div>;
  if (!request || !user) return <p>Loading...</p>;

  const isOwner = request.requester.id === user.id;
  const canEdit = isOwner && request.status === "DRAFT";
  const canCancel = isOwner && (request.status === "DRAFT" || request.status === "SUBMITTED");
  const currentStep = request.approvalSteps?.find((step) => step.status === "CURRENT");
  const hasApprovalChain = (request.approvalSteps?.length ?? 0) > 0;
  const isCurrentApprover = !hasApprovalChain || currentStep?.approver.id === user.id;
  const canDecide = user.role === "APPROVER" && request.status === "SUBMITTED" && !isOwner && isCurrentApprover;
  const canReturn = user.role === "APPROVER" && request.status === "SUBMITTED" && !isOwner && isCurrentApprover;
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
      {canCancel && <CancelPanel request={request} onDone={reload} />}
      {canDecide && <DecisionPanel request={request} onDone={reload} />}
      {canReturn && <ReturnPanel request={request} onReturned={() => navigate("/reviews", { state: { returnedRequestNumber: request.requestNumber } })} />}

      {user.role === "ADMIN" && request.status === "DRAFT" && (
        <section className="border rounded p-3 mb-3" aria-label="Configure approval steps">
          <h2 className="h6">Approval chain</h2>
          <p className="text-muted">Choose the approvers in order. The chain can contain up to five approvers.</p>
          {selectedApproverIds.map((approverId, index) => (
            <div className="d-flex align-items-end gap-2 mb-2" key={`${index}-${approverId}`}>
              <div className="flex-grow-1">
                <label className="form-label" htmlFor={`approval-step-${index}`}>Step {index + 1} approver</label>
                <select id={`approval-step-${index}`} className="form-select" value={approverId} onChange={(event) => {
                  const next = [...selectedApproverIds]; next[index] = Number(event.target.value); setSelectedApproverIds(next);
                }}>
                  <option value="">Choose an approver</option>
                  {adminUsers.filter((candidate) => candidate.id === approverId || !selectedApproverIds.includes(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.email})</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-outline-danger" onClick={() => setSelectedApproverIds(selectedApproverIds.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-outline-secondary" disabled={selectedApproverIds.length >= 5 || adminUsers.length <= selectedApproverIds.length} onClick={() => setSelectedApproverIds([...selectedApproverIds, adminUsers.find((candidate) => !selectedApproverIds.includes(candidate.id))?.id ?? 0])}>Add approver</button>
            <button type="button" className="btn btn-primary" disabled={stepsBusy || selectedApproverIds.some((approverId) => !approverId)} onClick={async () => {
              setStepsBusy(true); setStepsError(null);
              try { await setApprovalSteps(request.id, selectedApproverIds); await reload(); }
              catch (err) { setStepsError(err instanceof ApiError ? err.message : "Could not save the approval chain."); }
              finally { setStepsBusy(false); }
            }}>{stepsBusy ? "Saving..." : "Save approval chain"}</button>
            <button type="button" className="btn btn-outline-danger" disabled={stepsBusy || selectedApproverIds.length === 0} onClick={() => setSelectedApproverIds([])}>Clear</button>
          </div>
          {stepsError && <div role="alert" className="alert alert-danger mt-2 mb-0">{stepsError}</div>}
        </section>
      )}

      {request.approvalSteps && request.approvalSteps.length > 0 && <section className="border rounded p-3 mb-3" aria-label="Approval steps">
        <h2 className="h6">Approval steps</h2>
        <p className="mb-2">Step {Math.min(request.approvalSteps.filter((step) => step.status === "APPROVED").length + 1, request.approvalSteps.length)} of {request.approvalSteps.length}</p>
        <ol className="mb-0">{request.approvalSteps.map((step) => <li key={step.id}><strong>Step {step.stepNumber} of {request.approvalSteps!.length}:</strong> {step.approver.name} — <span className="badge text-bg-secondary">{STEP_STATUS[step.status]}</span>{step.decidedAt && <> <span className="text-muted">{formatDateTime(step.decidedAt)}</span></>}{step.decisionComment && <> — {step.decisionComment}</>}</li>)}</ol>
      </section>}

      <Attachments requestId={request.id} canChange={canEdit} />

      <h2 className="h6 mt-4">History</h2>
      <ol className="list-unstyled" data-testid="history">
        {(request.history ?? []).map((h) => (
          <li key={h.id} className="mb-1">
            <strong>{ACTION_TEXT[h.action] ?? h.action}</strong> by {h.actor.name}, {formatDateTime(h.createdAt)}
            {h.comment && <> ({h.comment})</>}
          </li>
        ))}
      </ol>

      <Comments key={request.id} requestId={request.id} canComment={user.role !== "ADMIN"} />
    </>
  );
}

function ReturnPanel({ request, onReturned }: { request: Detail; onReturned: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  async function confirm() {
    setBusy(true); setError(null);
    try {
      await returnRequest(request.id, reason);
      onReturned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not return the request.");
      setBusy(false);
    }
  }
  return <section className="border rounded p-3 mb-3" aria-label="Return for editing">
    <h2 className="h6">Return for editing</h2>
    {!open ? <button ref={actionButton} className="btn btn-outline-secondary" onClick={() => { setOpen(true); setTimeout(() => reasonRef.current?.focus(), 0); }}>Return for editing</button> : <>
      <label className="form-label" htmlFor="returnReason">Reason</label>
      <textarea ref={reasonRef} id="returnReason" className="form-control mb-2" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="d-flex gap-2"><button className="btn btn-warning" disabled={busy} onClick={confirm}>Confirm return</button><button className="btn btn-outline-secondary" disabled={busy} onClick={() => { setOpen(false); setError(null); setTimeout(() => actionButton.current?.focus(), 0); }}>Keep submitted</button></div>
    </>}
    {error && <div role="alert" className="alert alert-danger mt-2 mb-0">{error}</div>}
  </section>;
}

function CancelPanel({ request, onDone }: { request: Detail; onDone: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
  }, [confirming]);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelRequest(request.id);
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border rounded p-3 mb-3" aria-label="Cancel request">
      <h2 className="h6">Cancel request</h2>
      {!confirming ? (
        <button className="btn btn-outline-danger" onClick={() => setConfirming(true)}>Cancel request</button>
      ) : (
        <>
          <p className="mb-2">Cancel <strong>{request.requestNumber}</strong>? This cannot be undone.</p>
          <div className="d-flex gap-2">
            <button ref={confirmButton} className="btn btn-danger" disabled={busy} onClick={cancel}>Confirm cancellation</button>
            <button className="btn btn-outline-secondary" disabled={busy} onClick={() => { setConfirming(false); setError(null); }}>Keep request</button>
          </div>
        </>
      )}
      {error && <div role="alert" className="alert alert-danger mt-2 mb-0">{error}</div>}
    </section>
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
