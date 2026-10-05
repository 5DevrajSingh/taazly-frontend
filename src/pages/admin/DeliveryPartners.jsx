import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getAdminStores } from "../../services/storeService";
import {
  getDeliveryPartners,
  getDeliveryPartner,
  verifyDeliveryPartner,
  rejectDeliveryPartner,
} from "../../services/deliveryPartnerService";

const pageSize = 10;

const enabled = (value) => value === true || Number(value) === 1;

const available = (partner) =>
  enabled(partner.is_active) &&
  enabled(partner.is_online) &&
  partner.verification_status === "verified" &&
  !enabled(partner.has_active_delivery);

const selectClass =
  "rounded-xl border border-green-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:cursor-not-allowed disabled:opacity-50";

const actionClass =
  "rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";

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
    "Unable to complete request."
  );
}

function readResult(result) {
  if (!result?.success) {
    throw new Error(result?.message || "API request failed.");
  }

  return result.data;
}

function verificationColor(status) {
  if (status === "verified") {
    return "bg-green-100 text-green-700";
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-600";
  }

  return "bg-orange-50 text-orange-600";
}

function availabilityLabel(partner) {
  if (enabled(partner.has_active_delivery)) return "Active Delivery";
  if (available(partner)) return "Available";
  return "Unavailable";
}

function DeliveryPartners() {
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
  const [selectedAvailability, setSelectedAvailability] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");

  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(isAdmin);
  const [storesError, setStoresError] = useState("");
  const [storesRefresh, setStoresRefresh] = useState(0);

  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(!sessionError);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState(1);

  const [detailId, setDetailId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsRefresh, setDetailsRefresh] = useState(0);

  const mutationLock = useRef(false);
  const dialogRef = useRef(null);

  const targetStoreId = isManager ? assignedStoreId : selectedStore;

  function validateScope(result) {
    // Preserve compatibility with the existing response.
    // Backend authorization is still required even without scope metadata.
    if (!result.scope) return;

    if (result.scope.role !== session.user?.role) {
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

  // Managers never request the admin stores endpoint.
  useEffect(() => {
    if (!isAdmin || sessionError) return;

    let active = true;

    async function loadStores() {
      setStoresLoading(true);
      setStoresError("");

      try {
        const data = readResult(await getAdminStores());

        if (!Array.isArray(data?.stores)) {
          throw new Error("Invalid stores response.");
        }

        if (active) setStores(data.stores);
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
  }, [isAdmin, sessionError, storesRefresh]);

  useEffect(() => {
    if (sessionError || !targetStoreId) {
      setPartners([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadPartners() {
      setLoading(true);
      setError("");
      setPartners([]);

      try {
        const result = await getDeliveryPartners(targetStoreId, {
          signal: controller.signal,
        });

        if (!active) return;

        const data = readResult(result);

        if (!Array.isArray(data)) {
          throw new Error("Invalid delivery partners response.");
        }

        validateScope(result);

        // A partner may deliver for multiple stores. The backend
        // resolves store membership through delivery assignments.
        setPartners(data);
        setPage(1);
      } catch (err) {
        if (active && !controller.signal.aborted) {
          setError(getError(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPartners();

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

  useEffect(() => {
    if (detailId === null || sessionError) return;

    const controller = new AbortController();
    let active = true;

    async function loadDetails() {
      setDetails(null);
      setDetailsLoading(true);
      setDetailsError("");

      try {
        // Keep the existing service signature.
        // Backend must check manager access to this partner ID.
        const result = await getDeliveryPartner(detailId, {
          signal: controller.signal,
        });

        if (!active) return;

        const data = readResult(result);
        validateScope(result);

        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Invalid delivery partner details response.");
        }

        if (String(data.id) !== String(detailId)) {
          throw new Error("Delivery partner details do not match.");
        }

        setDetails(data);
      } catch (err) {
        if (active && !controller.signal.aborted) {
          setDetailsError(getError(err));
        }
      } finally {
        if (active) setDetailsLoading(false);
      }
    }

    loadDetails();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    detailId,
    detailsRefresh,
    sessionError,
    session.user?.role,
    isManager,
    assignedStoreId,
  ]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (detailId !== null && !dialog.open) dialog.showModal();
    if (detailId === null && dialog.open) dialog.close();

    if (detailId === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailId]);

  function openDetails(partner) {
    if (
      sessionError ||
      loading ||
      mutationLock.current ||
      !validId(partner.id) ||
      !partners.some(
        (item) => String(item.id) === String(partner.id)
      )
    ) {
      return;
    }

    setDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    setDetailId(partner.id);
  }

  function closeDetails() {
    setDetailId(null);
  }

  async function changeVerification(partner, action) {
    if (
      !isAdmin ||
      sessionError ||
      loading ||
      mutationLock.current ||
      !validId(partner.id) ||
      !["verify", "reject"].includes(action) ||
      !partners.some(
        (item) => String(item.id) === String(partner.id)
      )
    ) {
      return;
    }

    mutationLock.current = true;
    setBusyId(partner.id);
    setMessage("");
    setActionError("");

    try {
      const result =
        action === "verify"
          ? await verifyDeliveryPartner(partner.id)
          : await rejectDeliveryPartner(partner.id);

      readResult(result);

      setMessage(result.message || "Verification updated.");
      setRefreshKey((value) => value + 1);

      if (
        detailId !== null &&
        String(detailId) === String(partner.id)
      ) {
        setDetailsRefresh((value) => value + 1);
      }
    } catch (err) {
      setActionError(getError(err));
    } finally {
      mutationLock.current = false;
      setBusyId(null);
    }
  }

  function changeFilter(setter, value) {
    if (mutationLock.current) return;

    setter(value);
    setPage(1);
  }

  function refreshPartners() {
    if (mutationLock.current) return;

    setPage(1);
    setRefreshKey((value) => value + 1);
  }

  function resetFilters() {
    if (mutationLock.current) return;

    if (isAdmin) setSelectedStore("all");
    setSelectedStatus("all");
    setSelectedAvailability("all");
    setVerificationFilter("all");
    setPage(1);
    setMessage("");
    setActionError("");
  }

  const filteredPartners = partners.filter((partner) => {
    if (
      selectedStatus === "active" &&
      !enabled(partner.is_active)
    ) {
      return false;
    }

    if (
      selectedStatus === "inactive" &&
      enabled(partner.is_active)
    ) {
      return false;
    }

    if (
      verificationFilter !== "all" &&
      partner.verification_status !== verificationFilter
    ) {
      return false;
    }

    if (
      selectedAvailability === "available" &&
      !available(partner)
    ) {
      return false;
    }

    if (
      selectedAvailability === "busy" &&
      !enabled(partner.has_active_delivery)
    ) {
      return false;
    }

    if (
      selectedAvailability === "offline" &&
      enabled(partner.is_online)
    ) {
      return false;
    }

    return true;
  });

  const cards = [
    ["Total Partners", partners.length, "🚴"],
    [
      "Active",
      partners.filter((partner) => enabled(partner.is_active)).length,
      "✓",
    ],
    [
      "Inactive",
      partners.filter((partner) => !enabled(partner.is_active)).length,
      "⏸",
    ],
    ["Available", partners.filter(available).length, "🟢"],
    [
      "Partners on Delivery",
      partners.filter((partner) =>
        enabled(partner.has_active_delivery)
      ).length,
      "📦",
    ],
  ];

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPartners.length / pageSize)
  );
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagePartners = filteredPartners.slice(start, start + pageSize);

  const summaryReady = !sessionError && !loading && !error;

  const filtersChanged =
    (isAdmin && selectedStore !== "all") ||
    selectedStatus !== "all" ||
    selectedAvailability !== "all" ||
    verificationFilter !== "all";

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
                Delivery Management
              </p>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Delivery Partners
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isManager
                  ? `View delivery partners related to ${assignedStore?.name || "your assigned store"}.`
                  : "View delivery partners and manage verification."}
              </p>
            </div>

            <button
              type="button"
              disabled={
                loading || busyId !== null || Boolean(sessionError)
              }
              onClick={refreshPartners}
              className={`${selectClass} hover:bg-green-50`}
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

              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {cards.map(([title, value, icon]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-500">{title}</p>
                        <h3 className="mt-2 text-2xl font-bold text-slate-900">
                          {summaryReady ? value : "—"}
                        </h3>
                      </div>
                      <span aria-hidden="true" className="text-2xl">
                        {icon}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                <h2 className="font-bold text-slate-900">
                  Delivery Partner Filters
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Partners are listed using delivery assignment history.
                  Summary counts reflect the selected store.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {isAdmin ? (
                    <select
                      aria-label="Filter by store"
                      value={selectedStore}
                      disabled={
                        storesLoading ||
                        Boolean(storesError) ||
                        loading ||
                        busyId !== null
                      }
                      onChange={(event) => {
                        changeFilter(
                          setSelectedStore,
                          event.target.value
                        );
                        closeDetails();
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
                        <option key={store.id} value={String(store.id)}>
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
                    aria-label="Filter account status"
                    value={selectedStatus}
                    disabled={loading || busyId !== null}
                    onChange={(event) =>
                      changeFilter(setSelectedStatus, event.target.value)
                    }
                    className={selectClass}
                  >
                    <option value="all">All Account Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  <select
                    aria-label="Filter verification status"
                    value={verificationFilter}
                    disabled={loading || busyId !== null}
                    onChange={(event) =>
                      changeFilter(
                        setVerificationFilter,
                        event.target.value
                      )
                    }
                    className={selectClass}
                  >
                    <option value="all">All Verification</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <select
                    aria-label="Filter availability"
                    value={selectedAvailability}
                    disabled={loading || busyId !== null}
                    onChange={(event) =>
                      changeFilter(
                        setSelectedAvailability,
                        event.target.value
                      )
                    }
                    className={selectClass}
                  >
                    <option value="all">All Availability</option>
                    <option value="available">Available</option>
                    <option value="busy">Active Delivery</option>
                    <option value="offline">Offline</option>
                  </select>

                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={
                      loading || busyId !== null || !filtersChanged
                    }
                    className={`${selectClass} hover:bg-slate-50`}
                  >
                    Reset
                  </button>
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
                      className="underline disabled:opacity-50"
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
                    Delivery Partners List
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {loading
                      ? "Loading delivery partners..."
                      : error
                        ? "Delivery partners could not be loaded."
                        : `${filteredPartners.length} partners found`}
                  </p>
                  {isManager && (
                    <p className="mt-1 text-xs text-slate-400">
                      Partner verification is managed by the admin.
                    </p>
                  )}
                </div>

                {loading ? (
                  <div
                    role="status"
                    className="flex min-h-64 flex-col items-center justify-center gap-4 p-6"
                  >
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
                    <p className="text-sm text-slate-500">
                      Loading delivery partners...
                    </p>
                  </div>
                ) : error ? (
                  <div role="alert" className="p-10 text-center">
                    <p className="text-sm text-red-600">{error}</p>
                    <button
                      type="button"
                      onClick={refreshPartners}
                      className={`${selectClass} mt-4 hover:bg-green-50`}
                    >
                      Try Again
                    </button>
                  </div>
                ) : filteredPartners.length === 0 ? (
                  <div className="p-16 text-center">
                    <p className="mb-3 text-3xl">🚴</p>
                    <p className="text-sm font-semibold text-slate-600">
                      No delivery partners found
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Try different filters or check this store's delivery assignments.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1100px] text-left text-sm">
                        <thead className="bg-green-50 text-xs uppercase text-slate-500">
                          <tr>
                            {[
                              "Partner",
                              "Mobile",
                              "Vehicle",
                              "Account",
                              "Verification",
                              "Availability",
                              "Actions",
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
                          {pagePartners.map((partner) => {
                            const busy =
                              String(busyId) === String(partner.id);
                            const actionsDisabled =
                              busyId !== null || !validId(partner.id);

                            return (
                              <tr
                                key={partner.id}
                                className="hover:bg-green-50/50"
                              >
                                <td className="px-5 py-5">
                                  <p className="font-semibold text-slate-900">
                                    {partner.full_name || "—"}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {partner.email || "—"}
                                  </p>
                                </td>

                                <td className="px-5 py-5">
                                  {partner.mobile || "—"}
                                </td>

                                <td className="px-5 py-5">
                                  <p className="capitalize">
                                    {partner.vehicle_type || "—"}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {partner.vehicle_number || "—"}
                                  </p>
                                </td>

                                <td className="px-5 py-5">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                      enabled(partner.is_active)
                                        ? "bg-green-100 text-green-700"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {enabled(partner.is_active)
                                      ? "Active"
                                      : "Inactive"}
                                  </span>
                                </td>

                                <td className="px-5 py-5">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${verificationColor(partner.verification_status)}`}
                                  >
                                    {partner.verification_status || "—"}
                                  </span>
                                </td>

                                <td className="px-5 py-5">
                                  <p>{availabilityLabel(partner)}</p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {enabled(partner.is_online)
                                      ? "Online"
                                      : "Offline"}
                                  </p>
                                </td>

                                <td className="px-5 py-5">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openDetails(partner)}
                                      disabled={actionsDisabled}
                                      className={`${actionClass} border-slate-200 text-slate-600 hover:bg-slate-50`}
                                    >
                                      View
                                    </button>

                                    {isAdmin &&
                                      partner.verification_status !==
                                        "verified" && (
                                        <button
                                          type="button"
                                          disabled={actionsDisabled}
                                          onClick={() =>
                                            changeVerification(
                                              partner,
                                              "verify"
                                            )
                                          }
                                          className={`${actionClass} border-green-200 text-green-700 hover:bg-green-50`}
                                        >
                                          {busy ? "Saving..." : "Verify"}
                                        </button>
                                      )}

                                    {isAdmin &&
                                      partner.verification_status !==
                                        "rejected" && (
                                        <button
                                          type="button"
                                          disabled={actionsDisabled}
                                          onClick={() =>
                                            changeVerification(
                                              partner,
                                              "reject"
                                            )
                                          }
                                          className={`${actionClass} border-red-200 text-red-600 hover:bg-red-50`}
                                        >
                                          {busy ? "Saving..." : "Reject"}
                                        </button>
                                      )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                      <p className="text-sm text-slate-500">
                        Showing {start + 1}–
                        {Math.min(start + pageSize, filteredPartners.length)}{" "}
                        of {filteredPartners.length} partners
                      </p>
                      <nav
                        aria-label="Delivery partners pagination"
                        className="flex items-center gap-3"
                      >
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setPage(currentPage - 1)}
                          className={`${actionClass} border-slate-200 hover:bg-green-50`}
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
                          className={`${actionClass} border-slate-200 hover:bg-green-50`}
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

          <dialog
            ref={dialogRef}
            aria-labelledby="partner-details-title"
            onCancel={(event) => {
              event.preventDefault();
              closeDetails();
            }}
            className="m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl backdrop:bg-slate-900/50"
          >
            {detailId !== null && (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <h2
                    id="partner-details-title"
                    className="text-xl font-bold text-slate-900"
                  >
                    Delivery Partner Details
                  </h2>
                  <button
                    type="button"
                    onClick={closeDetails}
                    aria-label="Close details"
                    className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100"
                  >
                    ×
                  </button>
                </div>

                {detailsLoading ? (
                  <p role="status" className="text-sm text-slate-500">
                    Loading details...
                  </p>
                ) : detailsError ? (
                  <div role="alert" className="text-sm text-red-600">
                    {detailsError}
                    <button
                      type="button"
                      onClick={() =>
                        setDetailsRefresh((value) => value + 1)
                      }
                      className="ml-3 underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : details ? (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      ["Name", details.full_name],
                      ["Mobile", details.mobile],
                      ["Email", details.email],
                      ["User ID", details.id],
                      ["Profile ID", details.profile_id],
                      ["Vehicle", details.vehicle_type],
                      ["Vehicle Number", details.vehicle_number],
                      ["Driving License", details.driving_license_number],
                      ["Emergency Contact", details.emergency_contact_name],
                      ["Emergency Mobile", details.emergency_contact_mobile],
                      ["Verification", details.verification_status],
                      ["Account", enabled(details.is_active) ? "Active" : "Inactive"],
                      ["Online", enabled(details.is_online) ? "Yes" : "No"],
                      ["Latitude", details.current_latitude],
                      ["Longitude", details.current_longitude],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-slate-400">{label}</dt>
                        <dd className="mt-1 break-words text-sm font-semibold text-slate-700">
                          {value == null || value === "" ? "—" : value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </>
            )}
          </dialog>
        </main>
      </div>
    </div>
  );
}

export default DeliveryPartners;