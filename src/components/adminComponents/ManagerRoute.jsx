import { Navigate } from "react-router-dom";

function ManagerRoute({ children }) {
  const token = localStorage.getItem("manager_token");

  let user = null;

  try {
    user = JSON.parse(
      localStorage.getItem("manager_user") || "null"
    );
  } catch {
    return <Navigate to="/admin" replace />;
  }

  if (!token || user?.role !== "store_manager") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export default ManagerRoute;