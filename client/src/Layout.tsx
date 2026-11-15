import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "./api";
import { homePath } from "./routes";

const ROLE_LABEL: Record<Role, string> = { REQUESTER: "Requester", APPROVER: "Approver", ADMIN: "Administrator" };

// Shell for every screen except login. The links shown depend on the role; this is a convenience,
// the API enforces the same rules (System SDS section 3).
export default function Layout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return <p className="container mt-5">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <nav className="navbar navbar-expand navbar-dark bg-dark px-3 flex-wrap gap-1">
        <Link className="navbar-brand" to={homePath(user.role)}>PurchaseFlow</Link>
        <div className="navbar-nav me-auto flex-wrap">
          {user.role !== "ADMIN" && <Link className="nav-link" to="/requests">My requests</Link>}
          {user.role === "APPROVER" && <Link className="nav-link" to="/reviews">Review queue</Link>}
          {user.role === "ADMIN" && <Link className="nav-link" to="/all-requests">All requests</Link>}
          {user.role === "ADMIN" && <Link className="nav-link" to="/admin/users">Users</Link>}
        </div>
        <span className="navbar-text me-3" data-testid="current-user">
          {user.name} ({ROLE_LABEL[user.role]})
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

// UI convenience only: the API returns 403 for other roles on its own.
export function RequireRole({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to={user ? homePath(user.role) : "/login"} replace />;
  return children;
}
