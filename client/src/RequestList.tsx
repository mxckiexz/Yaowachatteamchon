import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { CATEGORIES, listRequests, type Category, type RequestSummary, type Scope, type Status } from "./api";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") ?? "") as Status | "";
  const category = (searchParams.get("category") ?? "") as Category | "";
  const hasFilters = Boolean(q || status || category);
  const [draft, setDraft] = useState({ q, status, category });
  const [requests, setRequests] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setRequests(null);
    listRequests(scope, { q, status, category })
      .then((r) => setRequests(r.requests))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the list."));
  }
  useEffect(() => {
    setDraft({ q, status, category });
    load();
  }, [scope, q, status, category]);

  function applyFilters(event?: FormEvent) {
    event?.preventDefault();
    const next = new URLSearchParams();
    if (draft.q.trim()) next.set("q", draft.q.trim());
    if (scope !== "review" && draft.status) next.set("status", draft.status);
    if (draft.category) next.set("category", draft.category);
    setSearchParams(next);
  }

  function clearFilters() {
    setDraft({ q: "", status: "", category: "" });
    setSearchParams({});
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">{title}</h1>
        {withNewButton && <Link className="btn btn-primary" to="/requests/new">New request</Link>}
      </div>
      <form className="row g-2 align-items-end mb-3" aria-label="Filter requests" onSubmit={applyFilters}>
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`request-search-${scope}`}>Search text</label>
          <input id={`request-search-${scope}`} className="form-control" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </div>
        {scope !== "review" && <div className="col-12 col-md-3">
          <label className="form-label" htmlFor={`request-status-${scope}`}>Status</label>
          <select id={`request-status-${scope}`} className="form-select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status | "" })}>
            <option value="">All statuses</option>
            {(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as Status[]).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>}
        <div className="col-12 col-md-3">
          <label className="form-label" htmlFor={`request-category-${scope}`}>Category</label>
          <select id={`request-category-${scope}`} className="form-select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category | "" })}>
            <option value="">All categories</option>
            {CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-auto d-flex gap-2">
          <button className="btn btn-primary" type="submit">Apply filters</button>
          <button className="btn btn-outline-secondary" type="button" onClick={clearFilters}>Clear filters</button>
        </div>
      </form>
      <p className="visually-hidden" role="status" aria-live="polite">{requests == null ? "Loading results" : requests.length ? `${requests.length} results` : "0 results"}</p>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={load}>Retry</button>
        </div>
      )}
      {!error && requests === null && <p>Loading...</p>}
      {requests && requests.length === 0 && <p className="text-muted">{hasFilters ? "No requests match these filters." : emptyText}</p>}
      {requests && requests.length > 0 && <RequestTable requests={requests} showRequester={showRequester} dateLabel={dateLabel} />}
    </>
  );
}
