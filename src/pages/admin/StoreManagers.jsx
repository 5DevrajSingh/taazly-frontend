import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import {
  getStoreManagers,
  getManagerStores,
  createStoreManager,
  assignStoreManager,
} from "../../services/storeManagerService";

const emptyForm = {
  storeId: "",
  managerId: "",
  fullName: "",
  email: "",
  mobile: "",
  password: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:bg-slate-50";

const buttonClass =
  "rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50";

const enabled = (value) =>
  value === true || Number(value) === 1;

function readResult(result) {
  if (!result?.success) {
    throw new Error(result?.message || "API request failed.");
  }

  return result.data;
}

function getError(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    "Unable to complete request."
  );
}

function StoreManagers() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [managers, setManagers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [search, setSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const dialogRef = useRef(null);
  const submitting = useRef(false);
  const pageSize = 10;

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const results = await Promise.all([
          getStoreManagers({ signal: controller.signal }),
          getManagerStores({ signal: controller.signal }),
        ]);

        const managerList = readResult(results[0]);
        const storeList = readResult(results[1]);

        if (
          !Array.isArray(managerList) ||
          !Array.isArray(storeList)
        ) {
          throw new Error("Invalid manager or store response.");
        }

        if (!controller.signal.aborted) {
          setManagers(managerList);
          setStores(storeList);
          setPage(1);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(getError(err));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadData();

    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (modalOpen && !dialog.open) dialog.showModal();
    if (!modalOpen && dialog.open) dialog.close();

    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  const freeStores = stores.filter(
    (store) => store.manager_id == null
  );

  const occupiedStores = stores.filter(
    (store) => store.manager_id != null
  );

  const unassignedManagers = managers.filter(
    (manager) =>
      manager.store_id == null &&
      enabled(manager.is_active)
  );

  function openForm(nextMode, manager = null) {
    setMode(nextMode);
    setForm({
      ...emptyForm,
      managerId: manager ? String(manager.id) : "",
      storeId:
        nextMode === "change" && manager?.store_id != null
          ? String(manager.store_id)
          : "",
    });

    setFormError("");
    setMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    if (!submitting.current) setModalOpen(false);
  }

  function changeForm(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting.current) return;

    const selectedStore = stores.find(
      (store) => String(store.id) === form.storeId
    );

    if (!selectedStore) {
      setFormError("Please select a valid store.");
      return;
    }

    if (
      mode !== "change" &&
      selectedStore.manager_id != null
    ) {
      setFormError("This store already has a manager.");
      return;
    }

    if (
      mode === "change" &&
      selectedStore.manager_id == null
    ) {
      setFormError("Use Assign Manager for a manager-free store.");
      return;
    }

    if (mode === "create") {
      if (!form.fullName.trim()) {
        setFormError("Manager full name is required.");
        return;
      }

      if (!/^\d{10}$/.test(form.mobile.trim())) {
        setFormError("Enter a valid 10-digit mobile number.");
        return;
      }

      if (form.password.length < 6) {
        setFormError("Password must be at least 6 characters.");
        return;
      }
    } else {
      const selectedManager = unassignedManagers.find(
        (manager) => String(manager.id) === form.managerId
      );

      if (!selectedManager) {
        setFormError("Please select an active, unassigned manager.");
        return;
      }
    }

    submitting.current = true;
    setSaving(true);
    setFormError("");

    try {
      const result =
        mode === "create"
          ? await createStoreManager(form.storeId, {
              fullName: form.fullName.trim(),
              email: form.email.trim() || null,
              mobile: form.mobile.trim(),
              password: form.password,
            })
          : await assignStoreManager(
              form.storeId,
              form.managerId,
              mode === "change"
            );

      readResult(result);

      setModalOpen(false);
      setForm(emptyForm);
      setMessage(result.message || "Manager saved successfully.");
      setAssignmentFilter("all");
      setSearch("");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setFormError(getError(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const searchText = search.trim().toLowerCase();

  const filteredManagers = managers.filter((manager) => {
    const assigned = manager.store_id != null;

    if (assignmentFilter === "assigned" && !assigned) {
      return false;
    }

    if (assignmentFilter === "unassigned" && assigned) {
      return false;
    }

    const text = [
      manager.full_name,
      manager.mobile,
      manager.email,
      manager.store_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(searchText);
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredManagers.length / pageSize)
  );

  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageManagers = filteredManagers.slice(
    start,
    start + pageSize
  );

  const cards = [
    ["Total Managers", managers.length, "👨‍💼"],
    [
      "Assigned",
      managers.filter((manager) => manager.store_id != null).length,
      "✓",
    ],
    [
      "Unassigned",
      managers.filter((manager) => manager.store_id == null).length,
      "⏳",
    ],
    ["Stores Without Manager", freeStores.length, "🏪"],
  ];

  const title =
    mode === "create"
      ? "Create Store Manager"
      : mode === "change"
        ? "Change Store Manager"
        : "Assign Store Manager";

  const storeOptions =
    mode === "change" ? occupiedStores : freeStores;

  const selectedOccupiedStore = stores.find(
    (store) => String(store.id) === form.storeId
  );

  const currentManager = managers.find(
    (manager) =>
      selectedOccupiedStore?.manager_id != null &&
      String(manager.id) ===
        String(selectedOccupiedStore.manager_id)
  );

  const canUseData = !loading && !error && !saving;

  return (
    <div className="flex min-h-screen bg-[#f0fdf4]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <p className="mb-1 text-sm font-semibold text-green-600">
                Store Management
              </p>

              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Store Managers
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Create managers and manage store assignments.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={loading || saving}
                className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 disabled:opacity-50"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() => openForm("assign")}
                disabled={
                  !canUseData ||
                  !freeStores.length ||
                  !unassignedManagers.length
                }
                className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 disabled:opacity-50"
              >
                Assign Manager
              </button>

              <button
                type="button"
                onClick={() => openForm("change")}
                disabled={
                  !canUseData ||
                  !occupiedStores.length ||
                  !unassignedManagers.length
                }
                className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 disabled:opacity-50"
              >
                Change Manager
              </button>

              <button
                type="button"
                onClick={() => openForm("create")}
                disabled={!canUseData || !freeStores.length}
                className={buttonClass}
              >
                + Create Manager
              </button>
            </div>
          </div>

          {message && (
            <div
              role="status"
              className="mb-5 rounded-xl bg-green-100 p-4 text-sm text-green-700"
            >
              {message}
            </div>
          )}

          {/* Summary */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value, icon]) => (
              <div
                key={label}
                className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{label}</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      {loading || error ? "—" : value}
                    </h2>
                  </div>

                  <span className="text-2xl">{icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:flex-row">
            <input
              type="search"
              aria-label="Search managers"
              placeholder="Search name, mobile, email or store..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            />

            <select
              aria-label="Filter manager assignments"
              value={assignmentFilter}
              onChange={(event) => {
                setAssignmentFilter(event.target.value);
                setPage(1);
              }}
              className={`${inputClass} sm:max-w-[220px]`}
            >
              <option value="all">All Managers</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          {/* List */}
          <div
            aria-busy={loading}
            className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Manager List
              </h2>
            </div>

            {loading ? (
              <div
                role="status"
                className="p-16 text-center text-sm text-slate-500"
              >
                Loading managers...
              </div>
            ) : error ? (
              <div role="alert" className="p-10 text-center">
                <p className="text-sm text-red-600">{error}</p>

                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  className={`${buttonClass} mt-4`}
                >
                  Try Again
                </button>
              </div>
            ) : filteredManagers.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-500">
                No managers found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px] text-left text-sm">
                    <thead className="bg-green-50 text-xs uppercase text-slate-500">
                      <tr>
                        {[
                          "Manager",
                          "Mobile",
                          "Email",
                          "Assigned Store",
                          "Account",
                          "Action",
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
                      {pageManagers.map((manager) => (
                        <tr
                          key={manager.id}
                          className="hover:bg-green-50/50"
                        >
                          <td className="px-5 py-5">
                            <p className="font-semibold text-slate-900">
                              {manager.full_name}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              ID: {manager.id}
                            </p>
                          </td>

                          <td className="px-5 py-5 text-slate-600">
                            {manager.mobile}
                          </td>

                          <td className="px-5 py-5 text-slate-600">
                            {manager.email || "—"}
                          </td>

                          <td className="px-5 py-5">
                            {manager.store_id != null ? (
                              <>
                                <p className="font-medium text-slate-700">
                                  {manager.store_name}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {manager.store_code}
                                </p>
                              </>
                            ) : (
                              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                                Not Assigned
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                enabled(manager.is_active)
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {enabled(manager.is_active)
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>

                          <td className="px-5 py-5">
                            {manager.store_id != null ? (
                              <button
                                type="button"
                                onClick={() => openForm("change", manager)}
                                disabled={
                                  !canUseData ||
                                  !unassignedManagers.length
                                }
                                className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 disabled:opacity-50"
                              >
                                Change Manager
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openForm("assign", manager)}
                                disabled={
                                  !canUseData ||
                                  !enabled(manager.is_active) ||
                                  !freeStores.length
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                Assign Store
                              </button>
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
                    {Math.min(start + pageSize, filteredManagers.length)}
                    {" "}of {filteredManagers.length} managers
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <span className="text-xs text-slate-500">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage(currentPage + 1)}
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Form Modal */}
          <dialog
            ref={dialogRef}
            aria-labelledby="manager-form-title"
            onCancel={(event) => {
              event.preventDefault();
              closeModal();
            }}
            onClose={() => setModalOpen(false)}
            className="max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 shadow-xl backdrop:bg-slate-900/50"
          >
            {modalOpen && (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <h2
                    id="manager-form-title"
                    className="text-xl font-bold text-slate-900"
                  >
                    {title}
                  </h2>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    aria-label="Close manager form"
                    className="px-3 py-2 text-xl text-slate-500"
                  >
                    ×
                  </button>
                </div>

                <form
                  onSubmit={handleSubmit}
                  aria-busy={saving}
                  className="p-6"
                >
                  {formError && (
                    <p
                      role="alert"
                      className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600"
                    >
                      {formError}
                    </p>
                  )}

                  <fieldset disabled={saving} className="space-y-4">
                    <div>
                      <label
                        htmlFor="manager-store"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Store *
                      </label>

                      <select
                        id="manager-store"
                        name="storeId"
                        value={form.storeId}
                        onChange={changeForm}
                        required
                        className={inputClass}
                      >
                        <option value="">Select Store</option>

                        {storeOptions.map((store) => (
                          <option
                            key={store.id}
                            value={String(store.id)}
                          >
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {mode === "change" && form.storeId && (
                      <div className="rounded-xl bg-orange-50 p-3 text-sm text-orange-700">
                        Current manager:{" "}
                        {currentManager?.full_name ||
                          `Manager #${selectedOccupiedStore?.manager_id}`}
                        <p className="mt-1 text-xs">
                          Replacing the manager will leave the current
                          manager unassigned.
                        </p>
                      </div>
                    )}

                    {mode === "create" ? (
                      <>
                        {[
                          ["fullName", "Full Name", "text", true],
                          ["email", "Email", "email", false],
                          ["mobile", "Mobile", "tel", true],
                          ["password", "Password", "password", true],
                        ].map(([name, label, type, required]) => (
                          <div key={name}>
                            <label
                              htmlFor={`manager-${name}`}
                              className="mb-2 block text-sm font-semibold text-slate-700"
                            >
                              {label}{required ? " *" : ""}
                            </label>

                            <input
                              id={`manager-${name}`}
                              name={name}
                              type={type}
                              value={form[name]}
                              onChange={changeForm}
                              required={required}
                              minLength={
                                name === "password" ? 6 : undefined
                              }
                              maxLength={
                                name === "mobile" ? 10 : undefined
                              }
                              pattern={
                                name === "mobile" ? "[0-9]{10}" : undefined
                              }
                              autoComplete={
                                name === "password"
                                  ? "new-password"
                                  : "off"
                              }
                              className={inputClass}
                            />
                          </div>
                        ))}
                      </>
                    ) : (
                      <div>
                        <label
                          htmlFor="manager-selection"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          {mode === "change" ? "New Manager *" : "Manager *"}
                        </label>

                        <select
                          id="manager-selection"
                          name="managerId"
                          value={form.managerId}
                          onChange={changeForm}
                          required
                          className={inputClass}
                        >
                          <option value="">Select Manager</option>

                          {unassignedManagers.map((manager) => (
                            <option
                              key={manager.id}
                              value={String(manager.id)}
                            >
                              {manager.full_name} — {manager.mobile}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </fieldset>

                  <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={saving}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className={buttonClass}
                    >
                      {saving ? "Saving..." : title}
                    </button>
                  </div>
                </form>
              </>
            )}
          </dialog>
        </main>
      </div>
    </div>
  );
}

export default StoreManagers;