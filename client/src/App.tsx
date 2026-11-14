import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import Layout from "./Layout";
import Login from "./Login";

function RequestsPlaceholder() {
  return <h1 className="h4">My requests</h1>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/requests" element={<RequestsPlaceholder />} />
        </Route>
        <Route path="*" element={<Navigate to="/requests" replace />} />
      </Routes>
    </AuthProvider>
  );
}
