import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRequests, type RequestSummary, type Scope } from "./api";
import RequestTable from "./RequestTable";

interface Props {
  scope: Scope;
  title: string;
  emptyText: string;
  showRequester?: boolean;
  dateLabel: "created" | "submitted";
  withNewButton?: boolean;
}

// One component for My requests, the review queue and All requests: loading, empty and error states included.
export default function RequestList({ scope, title, emptyText, showRequester, dateLabel, withNewButton }: Props) {
  const [requests, setRequests] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setRequests(null);
    listRequests(scope)
      .then((r) => setRequests(r.requests))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the list."));
  }
  useEffect(load, [scope]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">{title}</h1>
        {withNewButton && <Link className="btn btn-primary" to="/requests/new">New request</Link>}
      </div>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={load}>Retry</button>
        </div>
      )}
      {!error && requests === null && <p>Loading...</p>}
      {requests && requests.length === 0 && <p className="text-muted">{emptyText}</p>}
      {requests && requests.length > 0 && <RequestTable requests={requests} showRequester={showRequester} dateLabel={dateLabel} />}
    </>
  );
}
