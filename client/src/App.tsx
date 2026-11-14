import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import Layout, { RequireApprover } from "./Layout";
import Login from "./Login";
import MyRequests from "./MyRequests";
import NewRequest from "./NewRequest";
import RequestDetail from "./RequestDetail";
import ReviewQueue from "./ReviewQueue";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/requests" element={<MyRequests />} />
          <Route path="/requests/new" element={<NewRequest />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/reviews" element={<RequireApprover><ReviewQueue /></RequireApprover>} />
        </Route>
        <Route path="*" element={<Navigate to="/requests" replace />} />
      </Routes>
    </AuthProvider>
  );
}
