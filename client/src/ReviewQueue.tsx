import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listReviews, type ReviewSummary } from "./api";
import { formatBaht, formatDateTime } from "./format";

export default function ReviewQueue() {
  const [requests, setRequests] = useState<ReviewSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setRequests(null);
    listReviews()
      .then((r) => setRequests(r.requests))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the queue."));
  }
  useEffect(load, []);

  return (
    <>
      <h1 className="h4 mb-3">Review queue</h1>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={load}>Retry</button>
        </div>
      )}
      {!error && requests === null && <p>Loading...</p>}
      {requests && requests.length === 0 && <p className="text-muted">Nothing is waiting for you.</p>}
      {requests && requests.length > 0 && (
        <table className="table align-middle">
          <thead>
            <tr><th>Title</th><th>Requester</th><th className="text-end">Total</th><th>Submitted</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td><Link to={`/requests/${r.id}`}>{r.title}</Link></td>
                <td>{r.requester.name}</td>
                <td className="text-end">{formatBaht(r.total)}</td>
                <td>{formatDateTime(r.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
