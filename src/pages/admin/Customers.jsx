import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getAdminStores } from "../../services/storeService";
import {
  getCustomers,
  updateCustomerStatus,
} from "../../services/customerService";

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

function isActive(customer) {
  return (
    customer.is_active === true ||
    Number(customer.is_active) === 1
  );
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to complete request."
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN");
}

function Customers() {
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

  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(isAdmin);
  const [storesError, setStoresError] = useState("");
  const [storesRefresh, setStoresRefresh] = useState(0);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(!sessionError);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState(1);

  const mutationLock = useRef(false);
  const targetStoreId = isManager ? assignedStoreId : selectedStore;

  // Managers never call the admin stores endpoint.
  useEffect(() => {
    if (!isAdmin || sessionError) return;

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
        if (active) setStoresError(errorMessage(err));
      } finally {
        if (active) setStoresLoading(false);
      }
    }

    loadStores();

    return () => {
      active = false;
    };
  }, [isAdmin, sessionError, storesRefresh]);

  useEffect(() => {
    if (sessionError || !targetStoreId) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadCustomers() {
      setLoading(true);
      setError("");
      setCustomers([]);

      try {
        const result = await getCustomers(targetStoreId, {
          signal: controller.signal,
        });

        if (!active) return;

        if (!result?.success) {
          throw new Error(
            result?.message || "Failed to fetch customers."
          );
        }

        // Preserve the response structure used in your existing page.
        if (!Array.isArray(result.data?.customers)) {
          throw new Error("Invalid customers response.");
        }

        // Validate scope when the backend includes it.
        if (result.scope) {
          if (result.scope.role !== session.user.role) {
            throw new Error(
              "Login role and API token do not match. Please login again."
            );
          }

          if (
            isManager &&
            String(result.scope.store_id) !== assignedStoreId
          ) {
            throw new Error(
              "Assigned store has changed or the session is invalid. Please login again."
            );
          }
        }

        // Customers can order from multiple stores. The backend must
        // select customers through orders for the requested store.
        setCustomers(result.data.customers);
        setPage(1);
      } catch (err) {
        if (active && !controller.signal.aborted) {
          setError(errorMessage(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCustomers();

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

  async function toggleCustomer(customer) {
    if (
      !isAdmin ||
      sessionError ||
      loading ||
      mutationLock.current ||
      !validId(customer.id) ||
      !customers.some(
        (item) => String(item.id) === String(customer.id)
      )
    ) {
      return;
    }

    const nextStatus = !isActive(customer);

    mutationLock.current = true;
    setBusyId(customer.id);
    setMessage("");
    setActionError("");

    try {
      const result = await updateCustomerStatus(
        customer.id,
        nextStatus
      );

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to update customer status."
        );
      }

      setCustomers((previous) =>
        previous.map((item) =>
          String(item.id) === String(customer.id)
            ? {
                ...item,
                is_active: result.data?.is_active ?? nextStatus,
              }
            : item
        )
      );

      setMessage(
        result.message ||
          (nextStatus
            ? "Customer unblocked successfully."
            : "Customer blocked successfully.")
      );
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      mutationLock.current = false;
      setBusyId(null);
    }
  }

  function refreshCustomers() {
    if (mutationLock.current) return;

    setPage(1);
    setRefreshKey((value) => value + 1);
  }

  function resetFilters() {
    if (mutationLock.current) return;

    if (isAdmin) setSelectedStore("all");
    setSelectedStatus("all");
    setPage(1);
    setMessage("");
    setActionError("");
  }

  const filteredCustomers = customers.filter((customer) => {
    if (selectedStatus === "active") return isActive(customer);
    if (selectedStatus === "blocked") return !isActive(customer);
    return true;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / pageSize)
  );

  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageCustomers = filteredCustomers.slice(
    start,
    start + pageSize
  );

  const customerStats = [
    {
      title: "Total Customers",
      value: customers.length,
      description: "Customers in the selected store scope",
      icon: "👥",
      color: "text-slate-900",
    },
    {
      title: "Active Customers",
      value: customers.filter(isActive).length,
      description: "Enabled customer accounts",
      icon: "✓",
      color: "text-green-600",
    },
    {
      title: "Blocked Customers",
      value: customers.filter((customer) => !isActive(customer)).length,
      description: "Blocked customer accounts",
      icon: "⏸",
      color: "text-red-500",
    },
  ];

  const summaryReady = !sessionError && !loading && !error;

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
                Customer Management
              </p>

              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Customers
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {isManager
                  ? `View customers who ordered from ${assignedStore?.name || "your assigned store"}.`
                  : "View customers and manage account access."}
              </p>
            </div>

            <button
              type="button"
              onClick={refreshCustomers}
              disabled={
                loading || busyId !== null || Boolean(sessionError)
              }
              className="rounded-xl border border-green-100 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
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
              {message && (
                <div
                  role="status"
                  className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-green-100 p-4 text-sm text-green-700"
                >
                  <span>{message}</span>
                  <button
                    type="button"
                    onClick={() => setMessage("")}
                    aria-label="Dismiss success message"
                    className="rounded-lg px-2 py-1 hover:bg-green-200"
                  >
                    ×
                  </button>
                </div>
              )}

              {actionError && (
                <div
                  role="alert"
                  className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-600"
                >
                  <span>{actionError}</span>
                  <button
                    type="button"
                    onClick={() => setActionError("")}
                    aria-label="Dismiss error message"
                    className="rounded-lg px-2 py-1 hover:bg-red-100"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {customerStats.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {card.title}
                        </p>
                        <h3
                          className={`mt-2 text-2xl font-bold ${card.color}`}
                        >
                          {summaryReady ? card.value : "—"}
                        </h3>
                        <p className="mt-2 text-xs text-slate-400">
                          {card.description}
                        </p>
                      </div>
                      <div
                        aria-hidden="true"
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl"
                      >
                        {card.icon}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Customer Filters
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Store filters show customers who ordered from that store.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {isAdmin ? (
                      <select
                        aria-label="Filter customers by store"
                        value={selectedStore}
                        disabled={
                          storesLoading ||
                          Boolean(storesError) ||
                          loading ||
                          busyId !== null
                        }
                        onChange={(event) => {
                          setSelectedStore(event.target.value);
                          setPage(1);
                          setMessage("");
                          setActionError("");
                        }}
                        className={selectClass}
                      >
                        <option value="all">
                          {storesLoading
                            ? "Loading stores..."
                            : "All Stores"}
                        </option>
                        {stores.map((store) => (
                          <option
                            key={store.id}
                            value={String(store.id)}
                          >
                            {store.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                        <p className="text-sm font-semibold text-green-700">
                          {assignedStore?.name ||
                            `Store #${assignedStoreId}`}
                        </p>
                        {assignedStore?.store_code && (
                          <p className="mt-1 text-xs text-green-600">
                            {assignedStore.store_code}
                          </p>
                        )}
                      </div>
                    )}

                    <select
                      aria-label="Filter customers by account status"
                      value={selectedStatus}
                      disabled={loading || busyId !== null}
                      onChange={(event) => {
                        setSelectedStatus(event.target.value);
                        setPage(1);
                      }}
                      className={selectClass}
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="blocked">Blocked</option>
                    </select>

                    <button
                      type="button"
                      onClick={resetFilters}
                      disabled={
                        loading ||
                        busyId !== null ||
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
                      disabled={storesLoading || busyId !== null}
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
                    Customers List
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {isAdmin
                      ? "Blocking an account applies across all stores."
                      : "Customer account access is managed by the admin."}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {loading
                      ? "Loading customers..."
                      : error
                        ? "Customers could not be loaded."
                        : `${filteredCustomers.length} customers found`}
                  </p>
                </div>

                {loading ? (
                  <div
                    role="status"
                    className="flex min-h-64 flex-col items-center justify-center gap-4 p-6"
                  >
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
                    <p className="text-sm text-slate-500">
                      Loading customers...
                    </p>
                  </div>
                ) : error ? (
                  <div role="alert" className="p-10 text-center">
                    <p className="text-sm text-red-600">{error}</p>
                    <button
                      type="button"
                      onClick={refreshCustomers}
                      className="mt-4 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Try Again
                    </button>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-16 text-center">
                    <p className="mb-3 text-3xl">👥</p>
                    <p className="text-sm font-semibold text-slate-600">
                      No customers found
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {selectedStatus !== "all"
                        ? "Try a different account status."
                        : "Customers will appear after ordering from this store."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="bg-green-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            {[
                              "Customer",
                              "Mobile",
                              "Email",
                              "Registered",
                              "Status",
                              ...(isAdmin ? ["Action"] : []),
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
                          {pageCustomers.map((customer) => {
                            const active = isActive(customer);

                            return (
                              <tr
                                key={customer.id}
                                className="hover:bg-green-50/50"
                              >
                                <td className="px-5 py-5">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-green-700">
                                      {customer.full_name
                                        ?.trim()
                                        .charAt(0)
                                        .toUpperCase() || "C"}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-slate-900">
                                        {customer.full_name || "—"}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-400">
                                        ID: {customer.id}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-5 text-slate-600">
                                  {customer.mobile || "—"}
                                </td>
                                <td className="px-5 py-5 text-slate-600">
                                  {customer.email || "—"}
                                </td>
                                <td className="px-5 py-5 text-slate-600">
                                  {formatDate(customer.created_at)}
                                </td>
                                <td className="px-5 py-5">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                      active
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-50 text-red-600"
                                    }`}
                                  >
                                    {active ? "Active" : "Blocked"}
                                  </span>
                                </td>

                                {isAdmin && (
                                  <td className="px-5 py-5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleCustomer(customer)
                                      }
                                      disabled={
                                        busyId !== null ||
                                        loading ||
                                        !validId(customer.id)
                                      }
                                      aria-label={`${active ? "Block" : "Unblock"} ${customer.full_name || "customer"}`}
                                      className={`rounded-lg border px-4 py-2 text-xs font-semibold disabled:opacity-50 ${
                                        active
                                          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                          : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                      }`}
                                    >
                                      {String(busyId) ===
                                      String(customer.id)
                                        ? "Saving..."
                                        : active
                                          ? "Block"
                                          : "Unblock"}
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                      <p className="text-sm text-slate-500">
                        Showing {start + 1}–
                        {Math.min(
                          start + pageSize,
                          filteredCustomers.length
                        )}{" "}
                        of {filteredCustomers.length} customers
                      </p>

                      <nav
                        aria-label="Customers pagination"
                        className="flex items-center gap-3"
                      >
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setPage(currentPage - 1)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-green-50 disabled:opacity-40"
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
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-green-50 disabled:opacity-40"
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

export default Customers;