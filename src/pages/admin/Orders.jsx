import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getAdminStores } from "../../services/storeService";
import { getManagementOrders } from "../../services/orderService";

const processingStatuses = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
];

const statusOptions = [
  ["all", "All Orders"],
  ["processing", "Processing"],
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["preparing", "Preparing"],
  ["ready_for_pickup", "Ready for Pickup"],
  ["out_for_delivery", "Out for Delivery"],
  ["delivered", "Delivered"],
  ["returned", "Returned"],
  ["cancelled", "Cancelled"],
];

const selectClass =
  "rounded-xl border border-green-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:cursor-not-allowed disabled:opacity-50";

const pageSize = 10;

function readStoredData(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function validId(value) {
  return (
    /^[1-9]\d*$/.test(String(value ?? "")) &&
    Number.isSafeInteger(Number(value))
  );
}

function getError(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load orders."
  );
}

function formatMoney(value) {
  const amount = Number(value);

  return value != null && value !== "" && Number.isFinite(amount)
    ? amount.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
      })
    : "—";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN");
}

function statusLabel(status) {
  return (
    statusOptions.find(([value]) => value === status)?.[1] ||
    status ||
    "Unknown"
  );
}

function statusColor(status) {
  if (status === "delivered") {
    return "bg-green-100 text-green-700";
  }

  if (status === "out_for_delivery") {
    return "bg-blue-50 text-blue-600";
  }

  if (["cancelled", "returned"].includes(status)) {
    return "bg-red-50 text-red-600";
  }

  if (processingStatuses.includes(status)) {
    return "bg-orange-50 text-orange-600";
  }

  return "bg-slate-100 text-slate-500";
}

function paymentLabel(value) {
  return value ? String(value).replace(/_/g, " ") : "—";
}

function Orders() {
  // Initialize session before states that depend on the role.
  const [session] = useState(() => {
    const adminUser = readStoredData("admin_user");
    const managerUser = readStoredData("manager_user");
    const activeRole = localStorage.getItem("active_role");

    const hasAdmin =
      Boolean(localStorage.getItem("admin_token")) &&
      adminUser?.role === "admin";

    const hasManager =
      Boolean(localStorage.getItem("manager_token")) &&
      managerUser?.role === "store_manager";

    let user = null;

    if (activeRole === "admin" && hasAdmin) {
      user = adminUser;
    } else if (activeRole === "store_manager" && hasManager) {
      user = managerUser;
    } else if (hasAdmin && !hasManager) {
      user = adminUser;
    } else if (hasManager && !hasAdmin) {
      user = managerUser;
    }

    return {
      user,
      store: readStoredData("manager_store"),
      ambiguous: !user && hasAdmin && hasManager,
    };
  });

  const isAdmin = session.user?.role === "admin";
  const isManager = session.user?.role === "store_manager";
  const assignedStore = isManager ? session.store : null;

  const assignedStoreId = validId(assignedStore?.id)
    ? String(assignedStore.id)
    : "";

  const sessionError = session.ambiguous
    ? "Both admin and manager sessions were found. Please logout and login again."
    : isManager
      ? assignedStoreId
        ? ""
        : "Assigned store not found. Please login again."
      : isAdmin
        ? ""
        : "Invalid login session. Please login again.";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState(() =>
    isAdmin ? "all" : assignedStoreId
  );
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [scope, setScope] = useState(null);
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState("");
  const [storesRefresh, setStoresRefresh] = useState(0);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(!sessionError);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);

  const targetStoreId = isManager ? assignedStoreId : selectedStore;

  useEffect(() => {
    if (sessionError || !targetStoreId) {
      setOrders([]);
      setScope(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadOrders() {
      setLoading(true);
      setError("");
      setOrders([]);
      setScope(null);

      try {
        const result = await getManagementOrders({
          storeId: targetStoreId,
          signal: controller.signal,
        });

        if (!active) return;

        if (!result?.success) {
          throw new Error(result?.message || "Failed to fetch orders.");
        }

        if (
          !Array.isArray(result.data) ||
          !["admin", "store_manager"].includes(result.scope?.role)
        ) {
          throw new Error(
            "Invalid orders response. Expected data array and scope.role."
          );
        }

        // Backend scope must match the current login.
        if (result.scope.role !== session.user.role) {
          throw new Error(
            "Login role and API token do not match. Please login again."
          );
        }

        if (
          isManager &&
          (!validId(result.scope.store_id) ||
            String(result.scope.store_id) !== assignedStoreId)
        ) {
          throw new Error(
            "Assigned store has changed or the session is invalid. Please login again."
          );
        }

        // Fail closed if a store-filtered request returns another store.
        if (
          targetStoreId !== "all" &&
          result.data.some(
            (order) => String(order.store_id) !== targetStoreId
          )
        ) {
          throw new Error(
            "Orders response contains another store's data. Please check backend store permissions."
          );
        }

        setScope(result.scope);
        setOrders(result.data);
        setPage(1);
      } catch (err) {
        if (active && !controller.signal.aborted) {
          setError(getError(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    targetStoreId,
    refreshKey,
    sessionError,
    session.user?.role,
    isManager,
    assignedStoreId,
  ]);

  // Load admin stores only after the backend confirms admin scope.
  useEffect(() => {
    if (!isAdmin || scope?.role !== "admin" || sessionError) return;

    let active = true;

    async function loadStores() {
      setStoresLoading(true);
      setStoresError("");

      try {
        const result = await getAdminStores();

        if (!result?.success) {
          throw new Error(result?.message || "Failed to fetch stores.");
        }

        if (!Array.isArray(result.data?.stores)) {
          throw new Error("Invalid stores response.");
        }

        if (active) setStores(result.data.stores);
      } catch (err) {
        if (active) setStoresError(getError(err));
      } finally {
        if (active) setStoresLoading(false);
      }
    }

    loadStores();

    return () => {
      active = false;
    };
  }, [isAdmin, scope?.role, sessionError, storesRefresh]);

  const filteredOrders = orders.filter((order) => {
    if (selectedStatus === "all") return true;

    if (selectedStatus === "processing") {
      return processingStatuses.includes(order.status);
    }

    return order.status === selectedStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / pageSize)
  );
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageOrders = filteredOrders.slice(start, start + pageSize);

  const statusCards = [
    ["Total Orders", orders.length, "📦", "text-slate-900"],
    [
      "Processing",
      orders.filter((order) =>
        processingStatuses.includes(order.status)
      ).length,
      "⏳",
      "text-orange-500",
    ],
    [
      "Out for Delivery",
      orders.filter((order) => order.status === "out_for_delivery").length,
      "🚚",
      "text-blue-600",
    ],
    [
      "Delivered",
      orders.filter((order) => order.status === "delivered").length,
      "✓",
      "text-green-600",
    ],
    [
      "Returned",
      orders.filter((order) => order.status === "returned").length,
      "↩",
      "text-red-500",
    ],
    [
      "Cancelled",
      orders.filter((order) => order.status === "cancelled").length,
      "✕",
      "text-red-500",
    ],
  ];

  const summaryReady =
    !sessionError && !loading && !error && Boolean(scope);

  const managerStoreName =
    scope?.store_name ||
    assignedStore?.name ||
    orders[0]?.store_name ||
    `Store #${assignedStoreId}`;

  function refreshOrders() {
    setPage(1);
    setRefreshKey((value) => value + 1);
  }

  function resetFilters() {
    if (isAdmin) setSelectedStore("all");
    setSelectedStatus("all");
    setPage(1);
  }

  return (
    <div className="flex min-h-screen bg-[#f0fdf4]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="mb-1 text-sm font-semibold text-green-600">
                Order Management
              </p>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Orders
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isManager
                  ? "Monitor orders from your assigned store."
                  : "Monitor orders across your TAAZLY stores."}
              </p>
            </div>

            <button
              type="button"
              onClick={refreshOrders}
              disabled={loading || Boolean(sessionError)}
              className="rounded-xl border border-green-100 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Loading..." : "↻ Refresh"}
            </button>
          </div>

          {sessionError ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-600"
            >
              {sessionError}
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {statusCards.map(([title, value, icon, color]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {title}
                        </p>
                        <h2 className={`mt-2 text-2xl font-bold ${color}`}>
                          {summaryReady ? value : "—"}
                        </h2>
                      </div>
                      <div
                        aria-hidden="true"
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl"
                      >
                        {icon}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Order Filters
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {isManager
                        ? "Summary cards reflect your assigned store."
                        : "Summary cards reflect the selected store."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {isAdmin && (
                      <select
                        aria-label="Filter orders by store"
                        value={selectedStore}
                        disabled={
                          loading ||
                          scope?.role !== "admin" ||
                          storesLoading ||
                          Boolean(storesError)
                        }
                        onChange={(event) => {
                          setSelectedStore(event.target.value);
                          setPage(1);
                        }}
                        className={selectClass}
                      >
                        <option value="all">
                          {storesLoading ? "Loading stores..." : "All Stores"}
                        </option>

                        {selectedStore !== "all" &&
                          !stores.some(
                            (store) => String(store.id) === selectedStore
                          ) && (
                            <option value={selectedStore}>
                              Store #{selectedStore}
                            </option>
                          )}

                        {stores.map((store) => (
                          <option key={store.id} value={String(store.id)}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {isManager && (
                      <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                        <p className="text-sm font-semibold text-green-700">
                          {managerStoreName}
                        </p>
                        {assignedStore?.store_code && (
                          <p className="mt-1 text-xs text-green-600">
                            {assignedStore.store_code}
                          </p>
                        )}
                      </div>
                    )}

                    <select
                      aria-label="Filter orders by status"
                      value={selectedStatus}
                      disabled={loading}
                      onChange={(event) => {
                        setSelectedStatus(event.target.value);
                        setPage(1);
                      }}
                      className={selectClass}
                    >
                      {statusOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={resetFilters}
                      disabled={
                        loading ||
                        (selectedStatus === "all" &&
                          (!isAdmin || selectedStore === "all"))
                      }
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {isAdmin && storesError && (
                  <div
                    role="alert"
                    className="mt-4 flex flex-wrap items-center gap-3 text-sm text-red-600"
                  >
                    <span>{storesError}</span>
                    <button
                      type="button"
                      disabled={storesLoading || scope?.role !== "admin"}
                      onClick={() =>
                        setStoresRefresh((value) => value + 1)
                      }
                      className="font-semibold underline disabled:opacity-50"
                    >
                      Retry Stores
                    </button>
                  </div>
                )}
              </div>

              <div
                aria-busy={loading}
                className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm"
              >
                <div className="border-b border-green-50 px-6 py-5">
                  <h2 className="text-lg font-bold text-slate-900">
                    Orders List
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {loading
                      ? "Loading orders..."
                      : error
                        ? "Orders could not be loaded."
                        : `${filteredOrders.length} orders found`}
                  </p>
                </div>

                {loading ? (
                  <div
                    role="status"
                    className="flex min-h-64 flex-col items-center justify-center gap-4 p-6"
                  >
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
                    <p className="text-sm text-slate-500">
                      Loading orders...
                    </p>
                  </div>
                ) : error ? (
                  <div role="alert" className="p-10 text-center">
                    <p className="text-sm text-red-600">{error}</p>
                    <button
                      type="button"
                      onClick={refreshOrders}
                      className="mt-4 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Try Again
                    </button>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="p-16 text-center">
                    <p className="mb-3 text-3xl">📦</p>
                    <p className="text-sm font-semibold text-slate-600">
                      No orders found
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {selectedStatus !== "all"
                        ? "Try a different order status."
                        : isManager
                          ? "Your assigned store has no orders yet."
                          : "No orders are available for the selected stores."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1000px] text-left text-sm">
                        <thead className="bg-green-50 text-xs uppercase text-slate-500">
                          <tr>
                            {[
                              "Order ID",
                              "Customer",
                              "Store",
                              "Items",
                              "Amount",
                              "Payment",
                              "Status",
                              "Date",
                            ].map((label) => (
                              <th
                                key={label}
                                scope="col"
                                className="px-5 py-4"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {pageOrders.map((order) => (
                            <tr
                              key={`${order.store_id}-${order.id}`}
                              className="hover:bg-green-50/50"
                            >
                              <td className="px-5 py-5 font-semibold text-slate-900">
                                {order.order_number || `#${order.id}`}
                              </td>

                              <td className="px-5 py-5">
                                <p className="font-medium text-slate-700">
                                  {order.customer_name ||
                                    order.delivery_full_name ||
                                    "—"}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {order.customer_mobile ||
                                    order.delivery_mobile ||
                                    "—"}
                                </p>
                              </td>

                              <td className="px-5 py-5 text-slate-600">
                                {order.store_name ||
                                  (isManager ? managerStoreName : null) ||
                                  stores.find(
                                    (store) =>
                                      String(store.id) ===
                                      String(order.store_id)
                                  )?.name ||
                                  `Store #${order.store_id}`}
                              </td>

                              <td className="px-5 py-5 text-slate-600">
                                {order.item_count ?? "—"}
                              </td>

                              <td className="whitespace-nowrap px-5 py-5 font-semibold">
                                {formatMoney(order.total_amount)}
                              </td>

                              <td className="px-5 py-5">
                                <p className="uppercase text-slate-700">
                                  {paymentLabel(order.payment_method)}
                                </p>
                                <p
                                  className={`mt-1 text-xs capitalize ${
                                    order.payment_status === "paid"
                                      ? "text-green-600"
                                      : order.payment_status === "failed"
                                        ? "text-red-500"
                                        : "text-slate-400"
                                  }`}
                                >
                                  {paymentLabel(order.payment_status)}
                                </p>
                              </td>

                              <td className="whitespace-nowrap px-5 py-5">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(order.status)}`}
                                >
                                  {statusLabel(order.status)}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-5 py-5 text-xs text-slate-500">
                                {formatDate(
                                  order.placed_at || order.created_at
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                      <p className="text-sm text-slate-500">
                        Showing {start + 1}–
                        {Math.min(
                          start + pageSize,
                          filteredOrders.length
                        )}{" "}
                        of {filteredOrders.length} orders
                      </p>

                      <nav
                        aria-label="Orders pagination"
                        className="flex items-center gap-3"
                      >
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setPage(currentPage - 1)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <span
                          aria-live="polite"
                          className="text-xs text-slate-500"
                        >
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setPage(currentPage + 1)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Orders;