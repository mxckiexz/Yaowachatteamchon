import { Navigate, Route, Routes } from "react-router-dom";
import AdminUsers from "./AdminUsers";
import { AuthProvider, useAuth } from "./AuthContext";
import Layout, { RequireRole } from "./Layout";
import Login from "./Login";
import NewRequest from "./NewRequest";
import Notifications from "./Notifications";
import RequestDetail from "./RequestDetail";
import Reports from "./Reports";
import RequestList from "./RequestList";
import { homePath } from "./routes";
import Dashboard from "./Dashboard";

function Fallback() {
  const { user } = useAuth();
  return <Navigate to={user ? homePath(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<RequireRole roles={["REQUESTER", "APPROVER"]}><Notifications /></RequireRole>} />
          <Route
            path="/requests"
            element={
              <RequireRole roles={["REQUESTER", "APPROVER"]}>
                <RequestList scope="mine" title="My requests" emptyText="You have no requests yet." dateLabel="created" withNewButton />
              </RequireRole>
            }
          />
          <Route path="/requests/new" element={<RequireRole roles={["REQUESTER", "APPROVER"]}><NewRequest /></RequireRole>} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route
            path="/reviews"
            element={
              <RequireRole roles={["APPROVER"]}>
                <RequestList scope="review" title="Review queue" emptyText="Nothing is waiting for you." showRequester dateLabel="submitted" />
              </RequireRole>
            }
          />
          <Route
            path="/all-requests"
            element={
              <RequireRole roles={["ADMIN"]}>
                <RequestList scope="all" title="All requests (read only)" emptyText="There are no requests yet." showRequester dateLabel="created" />
              </RequireRole>
            }
          />
          <Route path="/admin/users" element={<RequireRole roles={["ADMIN"]}><AdminUsers /></RequireRole>} />
        </Route>
        <Route path="*" element={<Fallback />} />
      </Routes>
    </AuthProvider>
  );
}
