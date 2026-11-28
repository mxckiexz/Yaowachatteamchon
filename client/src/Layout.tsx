import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { listNotifications, type Role } from "./api";
import { homePath } from "./routes";

const ROLE_LABEL: Record<Role, string> = { REQUESTER: "Requester", APPROVER: "Approver", ADMIN: "Administrator" };

// What a page inside the shell can ask for.
export interface LayoutContext {
  refreshUnread: () => void;
}

// F-12: the unread count in the navigation. It is null while unknown, also when loading it fails,
// so the rest of the page is not affected.
function useUnreadCount(role: Role | undefined) {
  const [unread, setUnread] = useState<number | null>(null);
  const latest = useRef(0);
  const location = useLocation();
  const enabled = role === "REQUESTER" || role === "APPROVER";

  const refreshUnread = useCallback(() => {
    if (!enabled) return;
    // Only the answer to the newest call counts, so a slow older one cannot bring back an old number.
    const call = ++latest.current;
    listNotifications()
      .then((r) => call === latest.current && setUnread(r.unreadCount))
      .catch(() => call === latest.current && setUnread(null));
  }, [enabled]);

  useEffect(refreshUnread, [refreshUnread, location.key]);
  return { unread: enabled ? unread : null, refreshUnread };
}

// Shell for every screen except login. The links shown depend on the role; this is a convenience,
// the API enforces the same rules (System SDS section 3).
export default function Layout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { unread, refreshUnread } = useUnreadCount(user?.role);

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
          <Link className="nav-link" to="/dashboard">Dashboard</Link>
          {user.role !== "ADMIN" && (
            <Link className="nav-link" to="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
              Notifications
              {unread ? <span className="badge rounded-pill text-bg-light ms-1">{unread}</span> : null}
            </Link>
          )}
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
        <Outlet context={{ refreshUnread } satisfies LayoutContext} />
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
