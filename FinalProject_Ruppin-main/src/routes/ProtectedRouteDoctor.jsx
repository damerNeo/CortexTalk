import { Navigate } from "react-router-dom";

export default function ProtectedRouteDoctor({ children }) {
  const doctorId = localStorage.getItem("doctorId");
  if (!doctorId) return <Navigate to="/loginDoctor" replace />;
  return children;
}