import { useState, useEffect, useCallback, useRef } from "react";
import { getAdminDashboard } from "../../services/dashboardService";
import { getAdminStores } from "../../services/storeService";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
function readStoredData(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function AdminDashboard() {
  const [session] = useState(() => {
    const user = localStorage.getItem("admin_token")
      ? readStoredData("admin_user")
      : localStorage.getItem("manager_token")
        ? readStoredData("manager_user")
        : null;
    return { user, store: readStoredData("manager_store") };
  });
  const user = session.user;
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "store_manager";
  const assignedStore = isManager ? session.store : null;
  const assignedStoreId = assignedStore?.id
    ? String(assignedStore.id)
    : null;

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [storesError, setStoresError] = useState("");
  const [stores, setStores] = useState(isManager && assignedStore ? [assignedStore] : []);
  const [storesLoading, setStoresLoading] = useState(isAdmin);
  const [selectedStore, setSelectedStore] = useState(isAdmin ? "all" : assignedStoreId || "");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const latestDashboardRequest = useRef(0);
  const latestStoresRequest = useRef(0);

  const fetchStores = useCallback(async () => {
    if (!isAdmin) return;
    const requestId = ++latestStoresRequest.current;
    setStoresLoading(true);
    setStoresError("");
    try {
      const response = await getAdminStores();
      if (requestId !== latestStoresRequest.current) return;
      if (!response.success) throw new Error(response.message || "Failed to load stores");
      setStores(response.data?.stores || []);
    } catch (err) {
      if (requestId === latestStoresRequest.current) {
        setStoresError(err.response?.data?.message || err.message || "Failed to load stores");
      }
    } finally {
      if (requestId === latestStoresRequest.current) setStoresLoading(false);
    }
  }, [isAdmin]);

  const fetchDashboard = useCallback(async (storeId, isRefresh = false) => {
    const requestId = ++latestDashboardRequest.current;
    // Every manager request uses their assigned store, including retries.
    const effectiveStoreId = isManager ? assignedStoreId : storeId || "all";
    if ((!isAdmin && !isManager) || (isManager && !assignedStoreId)) {
      setError(isManager
        ? "Assigned store not found. Please login again."
        : "Invalid login session. Please login again.");
      setLoading(false);
      setDashboardRefreshing(false);
      return;
    }
    setError("");
    if (isRefresh) setDashboardRefreshing(true);
    else setLoading(true);
    try {
      const response = await getAdminDashboard(effectiveStoreId);
      if (requestId !== latestDashboardRequest.current) return;
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to load dashboard");
      }
      setDashboard(response.data);
    } catch (err) {
      if (requestId === latestDashboardRequest.current) {
        setError(err.response?.data?.message || err.message || "Failed to load dashboard data");
      }
    } finally {
      if (requestId === latestDashboardRequest.current) {
        setLoading(false);
        setDashboardRefreshing(false);
      }
    }
  }, [isAdmin, isManager, assignedStoreId]);

  useEffect(() => {
    if (isAdmin) fetchStores();
    fetchDashboard(isAdmin ? "all" : assignedStoreId);
    return () => {
      latestDashboardRequest.current += 1;
      latestStoresRequest.current += 1;
    };
  }, [isAdmin, assignedStoreId, fetchStores, fetchDashboard]);

  const handleStoreChange = (event) => {
    if (!isAdmin) return;
    const storeId = event.target.value;
    setSelectedStore(storeId);
    fetchDashboard(storeId, true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0fdf4] p-8">
        <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
        <p className="mt-3 text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-[#f0fdf4] p-8">
        <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
        <p role="alert" className="mt-3 text-red-600">{error || "Dashboard data not available."}</p>
        <button type="button" onClick={() => fetchDashboard(selectedStore)}
          className="mt-4 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white">
          Retry
        </button>
        <button
          type="button"
          onClick={() => {
            [
              "admin_token",
              "admin_user",
              "manager_token",
              "manager_user",
              "manager_store",
            ].forEach((key) => localStorage.removeItem(key));

            window.location.href = "/admin";
          }}
          className="ml-3 mt-4 rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-600 hover:bg-red-50"
        >
          Logout / Switch Account
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f0fdf4]">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col">
      {/* <div className="flex min-h-screen flex-col"> */}
        {/* Header */}
        <Header
          onMenuClick={() => setSidebarOpen(true)}
        />
        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Page Heading */}
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="mb-1 text-sm font-semibold text-green-600">
                Overview
              </p>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Welcome back,{" "}
                <span className="font-semibold text-slate-700">
                  {user?.full_name || (isAdmin ? "Admin" : "Store Manager")}
                </span>
                . Here's what's happening with TAAZLY today.
              </p>
            </div>
            {/* Store selector is available only to the admin. */}
            <div className="flex flex-wrap items-center gap-3">
              {dashboardRefreshing && <span className="text-xs font-medium text-green-600">Updating...</span>}
              {isAdmin ? (
                <select aria-label="Select store" value={selectedStore}
                  onChange={handleStoreChange} disabled={storesLoading || dashboardRefreshing}
                  className="rounded-xl border border-green-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-green-500 disabled:opacity-60">
                  <option value="all">All Stores</option>
                  {stores.map((store) => (
                    <option key={store.id} value={String(store.id)}>{store.name}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-xl border border-green-100 bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Assigned Store</p>
                  <p className="text-sm font-semibold text-green-700">{assignedStore?.name}</p>
                </div>
              )}
              <button type="button" disabled={dashboardRefreshing}
                onClick={() => fetchDashboard(selectedStore, true)}
                className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                {dashboardRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          {storesError && (
            <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {storesError}
              <button type="button" onClick={() => fetchStores()} className="ml-3 font-semibold underline">Retry stores</button>
            </div>
          )}
          {error && (
            <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
              <button type="button" disabled={dashboardRefreshing}
                onClick={() => fetchDashboard(selectedStore, true)} className="ml-3 font-semibold underline">Retry dashboard</button>
            </div>
          )}
          {/* =========================================
              STAT CARDS
          ========================================= */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Sales */}
            <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Total Sales
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    ₹ {dashboard?.sales?.total ?? "—"}
                  </h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-xl">
                  💰
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-green-50 px-2 py-1 font-semibold text-green-600">
                  API
                </span>
                <span className="text-slate-400">
                  Live data
                </span>
              </div>
            </div>
            {/* Orders */}
            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Total Orders
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {dashboard?.orders?.total ?? "—"}
                  </h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">
                  🧾
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-400">
                Live data
              </div>
            </div>
            {/* Customers */}
            <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Customers
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {dashboard?.customers?.total ?? "—"}
                  </h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-xl">
                  👥
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-400">
                Live data
              </div>
            </div>
            {/* Delivery */}
            <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Delivery Partners
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {dashboard?.deliveryPartners?.total ?? "—"}
                  </h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-xl">
                  🚴
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-400">
                Live data
              </div>
            </div>
          </div>
          {/* =========================================
              SECOND ROW
          ========================================= */}
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Sales Overview */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Sales Overview
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Sales performance will be loaded from API.
                  </p>
                </div>
                <select
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 outline-none focus:border-green-500"
                  defaultValue="month"
                >
                  <option value="week">
                    This Week
                  </option>
                  <option value="month">
                    This Month
                  </option>
                  <option value="year">
                    This Year
                  </option>
                </select>
              </div>
              {/* Chart Placeholder */}
              <div className="mt-6 flex h-72 items-center justify-center rounded-xl border border-dashed border-green-200 bg-green-50/40">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                    📈
                  </div>
                  <p className="text-sm font-semibold text-slate-600">
                    Sales chart
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    API data will appear here
                  </p>
                </div>
              </div>
            </div>
            {/* Order Status */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Order Status
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Current order distribution
                </p>
              </div>
              <div className="mt-6 flex h-52 items-center justify-center rounded-xl border border-dashed border-green-200 bg-green-50/40">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                    🥗
                  </div>
                  <p className="text-sm font-semibold text-slate-600">
                    Order statistics
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    API data will appear here
                  </p>
                </div>
              </div>
              {/* Status List */}
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                    Pending
                  </span>
                  <span className="font-semibold text-slate-700">
                    {dashboard?.orders?.pending ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Processing
                  </span>
                  <span className="font-semibold text-slate-700">
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    Delivered
                  </span>
                  <span className="font-semibold text-slate-700">
                    {dashboard?.orders?.delivered ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    Cancelled
                  </span>
                  <span className="font-semibold text-slate-700">
                    {dashboard?.orders?.cancelled ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* =========================================
              THIRD ROW
          ========================================= */}
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Recent Orders */}
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Recent Orders
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Latest customer orders
                  </p>
                </div>
                <button className="text-sm font-semibold text-green-600 hover:text-green-700">
                  View All
                </button>
              </div>
              <div className="flex min-h-52 items-center justify-center p-6">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-2xl">
                    🧾
                  </div>
                  <p className="text-sm font-semibold text-slate-600">
                    No order data loaded
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Recent orders will come from the API.
                  </p>
                </div>
              </div>
            </div>
            {/* Low Stock */}
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Low Stock Products
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Products that need attention
                  </p>
                </div>
                <button className="text-sm font-semibold text-green-600 hover:text-green-700">
                  View Inventory
                </button>
              </div>
              <div className="flex min-h-52 items-center justify-center p-6">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
                    📦
                  </div>
                  <p className="text-sm font-semibold text-slate-600">
                    Inventory data
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Low-stock products will come from the API.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
export default AdminDashboard;