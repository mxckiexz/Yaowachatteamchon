import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Layout, { RequireRole } from "./Layout";
import Login from "./Login";
import { homePath } from "./routes";

function Placeholder({ title }: { title: string }) {
  return <h1 className="h4">{title}</h1>;
}

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
          <Route path="/requests" element={<RequireRole roles={["REQUESTER", "APPROVER"]}><Placeholder title="My requests" /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole roles={["ADMIN"]}><Placeholder title="Users" /></RequireRole>} />
        </Route>
        <Route path="*" element={<Fallback />} />
      </Routes>
    </AuthProvider>
  );
}
