import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRequests, type RequestSummary } from "./api";
import { formatBaht, formatDateTime, StatusBadge } from "./format";

export default function MyRequests() {
  const [requests, setRequests] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setRequests(null);
    listRequests()
      .then((r) => setRequests(r.requests))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load requests."));
  }
  useEffect(load, []);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">My requests</h1>
        <Link className="btn btn-primary" to="/requests/new">New request</Link>
      </div>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={load}>Retry</button>
        </div>
      )}
      {!error && requests === null && <p>Loading...</p>}
      {requests && requests.length === 0 && <p className="text-muted">You have no requests yet.</p>}
      {requests && requests.length > 0 && (
        <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr><th>Title</th><th>Status</th><th className="text-end">Total</th><th>Approver</th><th>Created</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td><Link to={`/requests/${r.id}`}>{r.title}</Link></td>
                <td><StatusBadge status={r.status} /></td>
                <td className="text-end">{formatBaht(r.total)}</td>
                <td>{r.approver?.name ?? "Not sent yet"}</td>
                <td>{formatDateTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  );
}
