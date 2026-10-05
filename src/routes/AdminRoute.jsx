import { Navigate } from "react-router-dom";

function AdminRoute({ children }) {
  const adminToken = localStorage.getItem("admin_token");
  const managerToken = localStorage.getItem("manager_token");

  let adminUser = null;
  let managerUser = null;

  try {
    adminUser = JSON.parse(
      localStorage.getItem("admin_user") || "null"
    );
  } catch {
    adminUser = null;
  }

  try {
    managerUser = JSON.parse(
      localStorage.getItem("manager_user") || "null"
    );
  } catch {
    managerUser = null;
  }

  const isAdmin =
    Boolean(adminToken) && adminUser?.role === "admin";

  const isManager =
    Boolean(managerToken) &&
    managerUser?.role === "store_manager";

  if (!isAdmin && !isManager) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export default AdminRoute;