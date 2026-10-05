import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRoute from "./routes/AdminRoute";
import Categories from "./pages/admin/Categories";
import Stores from "./pages/admin/Stores";
import Products from "./pages/admin/Products";
import Inventory from "./pages/admin/Inventory";
import Orders from "./pages/admin/Orders";
import Customers from "./pages/admin/Customers";
import DeliveryPartners from "./pages/admin/DeliveryPartners";
import StoreManagers from "./pages/admin/StoreManagers";
import Profile from "./pages/admin/Profile";

import Home from "./pages/customer/Home";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Main Website */}
        <Route
          path="/"
          element={<Home />}
        />

        {/* Shared Login */}
        <Route
          path="/admin"
          element={
            localStorage.getItem("admin_token") ||
              localStorage.getItem("manager_token") ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <AdminLogin />
            )
          }
        />

        <Route
          path="/admin/profile"
          element={<AdminRoute>
            <Profile />
          </AdminRoute>}
        />

        {/* Shared Dashboard */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />



        <Route path="/admin/categories" element={<AdminRoute>  <Categories /> </AdminRoute>} />
        <Route
          path="/admin/stores"
          element={
            <AdminRoute>
              <Stores />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/inventory"
          element={
            <AdminRoute>
              <Inventory />
            </AdminRoute>
          }

        />

        <Route
          path="/admin/orders"
          element={
            <AdminRoute>
              <Orders />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/customers"
          element={<AdminRoute> <Customers /> </AdminRoute>}
        />

        <Route
          path="/admin/delivery-partners"
          element={<AdminRoute> <DeliveryPartners /> </AdminRoute>}
        />

        <Route
          path="/admin/products"
          element={<AdminRoute><Products /></AdminRoute>}
        />

        <Route
          path="/admin/store-managers"
          element={<AdminRoute> <StoreManagers /> </AdminRoute>}
        />

        {/* Unknown admin URL */}
        <Route
          path="/admin/*"
          element={<Navigate to="/admin" replace />}
        />

        {/* Unknown website URL */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;