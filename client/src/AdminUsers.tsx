import { useEffect, useState } from "react";
import { ApiError, listUsers, updateUser, type AdminUser, type Role } from "./api";
import { useAuth } from "./AuthContext";
import { formatDateTime } from "./format";

const ROLE_LABEL: Record<Role, string> = { REQUESTER: "Requester", APPROVER: "Approver", ADMIN: "Administrator" };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    setError(null);
    listUsers()
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load users."));
  }
  useEffect(load, []);

  async function change(target: AdminUser, patch: { isActive?: boolean; role?: Role }) {
    setMessage(null);
    try {
      const result = await updateUser(target.id, patch);
      setUsers((list) => (list ?? []).map((u) => (u.id === target.id ? result.user : u)));
      setMessage(`${result.user.name} updated.`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not update the user.");
    }
  }

  return (
    <>
      <h1 className="h4 mb-3">Users</h1>
      {error && <div role="alert" className="alert alert-danger">{error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={load}>Retry</button></div>}
      {message && <div role="status" className="alert alert-info">{message}</div>}
      {!error && users === null && <p>Loading...</p>}
      {users && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Name</th><th>E-mail</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => {
                const own = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      {own ? ROLE_LABEL[u.role] : (
                        <select className="form-select form-select-sm" aria-label={`Role of ${u.name}`} value={u.role} onChange={(e) => change(u, { role: e.target.value as Role })}>
                          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      )}
                    </td>
                    <td data-testid={`status-${u.id}`}>{u.isActive ? "Active" : "Inactive"}</td>
                    <td>{formatDateTime(u.createdAt)}</td>
                    <td>
                      {own ? (
                        <span className="text-muted">Your own account cannot be changed</span>
                      ) : (
                        <button className={`btn btn-sm ${u.isActive ? "btn-outline-danger" : "btn-outline-success"}`} aria-label={`${u.isActive ? "Deactivate" : "Activate"} ${u.name}`} onClick={() => change(u, { isActive: !u.isActive })}>
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
