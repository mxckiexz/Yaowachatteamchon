import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, getDashboard, type DashboardResponse, type Role, type Status } from "./api";
import { useAuth } from "./AuthContext";

const statuses: Status[] = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"];

function cardLink(role: Role, status: Status) {
  return role === "ADMIN" ? `/all-requests?status=${status}` : `/requests?status=${status}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading dashboard counts");

  function load() {
    setLoading(true);
    setError(null);
    setMessage("Loading dashboard counts");
    getDashboard().then((result) => {
      setData(result);
      setMessage("Dashboard counts loaded");
    }).catch((e) => {
      const text = e instanceof ApiError ? e.message : "Unable to load dashboard counts.";
      setError(text);
      setMessage(text);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const cards = statuses.map((status) => (
    <Link className="text-decoration-none" to={cardLink(user!.role, status)} key={status}>
      <div className="card h-100">
        <div className="card-body">
          <h2 className="h6 card-title">{status}</h2>
          <p className="display-6 mb-0">{loading || !data ? "…" : data.counts[status]}</p>
        </div>
      </div>
    </Link>
  ));

  return <section aria-labelledby="dashboard-heading">
    <h1 id="dashboard-heading" className="h4">Dashboard</h1>
    <p className="text-muted">Counts for your visible requests.</p>
    <p className="visually-hidden" role="status" aria-live="polite">{message}</p>
    {error && <div role="alert" className="alert alert-danger">Unable to load dashboard counts. <button className="btn btn-sm btn-outline-danger" onClick={load}>Retry</button></div>}
    {loading && !data && !error && <p>Loading...</p>}
    {!error && <>
      {user?.role === "APPROVER" && <h2 className="h5 mt-4">My requests</h2>}
      <div className="row row-cols-1 row-cols-md-2 row-cols-xl-5 g-3">{cards}</div>
      {user?.role === "APPROVER" && data && <div className="mt-4">
        <h2 className="h5">Waiting for review</h2>
        <Link className="text-decoration-none" to="/reviews"><div className="card"><div className="card-body"><h3 className="h6">SUBMITTED from other users</h3><p className="display-6 mb-0">{data.reviewWaiting ?? 0}</p></div></div></Link>
      </div>}
    </>}
  </section>;
}
