import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getAdminStores } from "../../services/storeService";
import AddStoreModal from "../../components/adminComponents/AddStoreModal";

function formatTime(value) {
  if (!value) return "—";

  const [hours, minutes] = value.split(":");
  const hour = Number(hours);

  if (!Number.isInteger(hour) || minutes === undefined) {
    return "—";
  }

  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

function Stores() {
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const addStoreButtonRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function fetchStores() {
      setLoading(true);
      setError("");

      try {
        const result = await getAdminStores();

        if (!isActive) return;

        if (!result?.success) {
          throw new Error(
            result?.message || "Failed to fetch stores"
          );
        }

        if (!Array.isArray(result?.data?.stores)) {
          throw new Error("Invalid stores response from server");
        }

        setStoreData(result.data);
      } catch (err) {
        if (!isActive) return;

        setError(
          err.response?.data?.message ||
          err.message ||
          "Unable to load stores. Please try again."
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchStores();

    return () => {
      isActive = false;
    };
  }, [refreshKey]);

  const stores = storeData?.stores ?? [];

  const totalStores = storeData?.total ?? stores.length;

  const activeStores =
    storeData?.active ??
    stores.filter((store) => store.status === "active").length;

  const inactiveStores = stores.filter(
    (store) => store.status === "inactive"
  ).length;

  const totalManagers = new Set(
    stores
      .filter((store) => store.manager_id != null)
      .map((store) => String(store.manager_id))
  ).size;

  const summaryCards = [
    {
      label: "Total Stores",
      value: totalStores,
      color: "text-slate-900",
    },
    {
      label: "Active Stores",
      value: activeStores,
      color: "text-green-600",
    },
    {
      label: "Inactive Stores",
      value: inactiveStores,
      color: "text-red-500",
    },
    {
      label: "Assigned Managers",
      value: totalManagers,
      color: "text-slate-900",
    },
  ];

  function refreshStores() {
    setRefreshKey((value) => value + 1);
  }

  function closeAddStore() {
    setAddStoreOpen(false);
    addStoreButtonRef.current?.focus();
  }

  function handleStoreCreated(result) {
    closeAddStore();
    setSuccessMessage(
      result.message || "Store created successfully"
    );
    refreshStores();
  }
  return (

    <div className="flex min-h-screen bg-[#f0fdf4]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {successMessage && (
          <div
            role="status"
            className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
          >
            <span>{successMessage}</span>

            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              aria-label="Dismiss success message"
              className="rounded-lg px-2 py-1 hover:bg-green-100"
            >
              ×
            </button>
          </div>
        )}


        {addStoreOpen && (
          <AddStoreModal
            onClose={closeAddStore}
            onCreated={handleStoreCreated}
          />
        )}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="mb-1 text-sm font-semibold text-green-600">
                Management
              </p>

              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Stores
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage all TAAZLY stores from one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={refreshStores}
                disabled={loading}
                className="rounded-xl border border-green-200 bg-white px-5 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>

              <button
                ref={addStoreButtonRef}
                type="button"
                onClick={() => {
                  setSuccessMessage("");
                  setAddStoreOpen(true);
                }}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
              >
                + Add Store
              </button>
            </div>
          </div>

          {/* Store Summary */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-500">
                  {card.label}
                </p>

                <h2 className={`mt-2 text-2xl font-bold ${card.color}`}>
                  {loading || error ? "—" : card.value}
                </h2>
              </div>
            ))}
          </div>

          {/* Store List */}
          <div
            aria-busy={loading}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Store List
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                All your TAAZLY stores and manager assignments.
              </p>
            </div>

            {loading ? (
              <div
                role="status"
                className="flex min-h-64 flex-col items-center justify-center gap-4 p-6"
              >
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />

                <p className="text-sm font-medium text-slate-500">
                  Loading stores...
                </p>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="flex min-h-64 items-center justify-center p-6"
              >
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">
                    ⚠️
                  </div>

                  <p className="text-sm font-semibold text-red-500">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={refreshStores}
                    className="mt-4 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : stores.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center p-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-3xl">
                    🏪
                  </div>

                  <p className="text-sm font-semibold text-slate-600">
                    No stores found
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Created stores will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-green-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-6 py-4">
                        Store
                      </th>
                      <th scope="col" className="px-6 py-4">
                        Location
                      </th>
                      <th scope="col" className="px-6 py-4">
                        Timings
                      </th>
                      <th scope="col" className="px-6 py-4">
                        Manager
                      </th>
                      <th scope="col" className="px-6 py-4">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {stores.map((store) => (
                      <tr
                        key={store.id}
                        className="transition hover:bg-green-50/50"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-2xl">
                              🏪
                            </div>

                            <div>
                              <p className="font-semibold text-slate-900">
                                {store.name}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {store.store_code || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <p className="font-medium text-slate-700">
                            {store.city || "—"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {[store.state, store.pincode]
                              .filter(Boolean)
                              .join(" • ") || "—"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-6 py-5 text-slate-600">
                          {formatTime(store.opening_time)}
                          {" – "}
                          {formatTime(store.closing_time)}
                        </td>

                        <td className="px-6 py-5">
                          {store.manager_id != null ? (
                            <div>
                              <p className="font-medium text-slate-700">
                                Manager #{store.manager_id}
                              </p>

                              <p className="mt-1 text-xs text-green-600">
                                Assigned
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">
                              Not assigned
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${store.status === "active"
                              ? "bg-green-100 text-green-700"
                              : store.status === "inactive"
                                ? "bg-red-50 text-red-500"
                                : "bg-slate-100 text-slate-600"
                              }`}
                          >
                            {store.status || "Unknown"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Stores;