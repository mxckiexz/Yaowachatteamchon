import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Shell for every screen except login. The Review link is a convenience for approvers;
// the API enforces the same rule (System SDS section 3).
export default function Layout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return <p className="container mt-5">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
        <Link className="navbar-brand" to="/requests">BuyFlow</Link>
        <div className="navbar-nav me-auto">
          <Link className="nav-link" to="/requests">My requests</Link>
          {user.role === "APPROVER" && <Link className="nav-link" to="/reviews">Review queue</Link>}
        </div>
        <span className="navbar-text me-3" data-testid="current-user">
          {user.name} ({user.role === "APPROVER" ? "Approver" : "Employee"})
        </span>
        <button
          className="btn btn-outline-light btn-sm"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
        >
          Logout
        </button>
      </nav>
      <div className="container py-4">
        <Outlet />
      </div>
    </>
  );
}
