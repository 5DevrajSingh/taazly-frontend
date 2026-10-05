import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getAdminStores } from "../../services/storeService";
import { getProducts } from "../../services/productService";
import {
  getInventory,
  createInventory,
  updateInventory,
  updateStock,
  updateAvailability,
} from "../../services/inventoryService";

const emptyForm = {
  storeId: "",
  product_id: "",
  selling_price: "",
  stock_quantity: "",
  low_stock_threshold: "10",
  is_available: true,
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:bg-slate-50 disabled:text-slate-500";

const buttonClass =
  "rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50";

const enabled = (value) => value === true || Number(value) === 1;

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

function readResult(result) {
  if (!result?.success) {
    throw new Error(result?.message || "API request failed.");
  }

  return result.data;
}

function getError(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to complete request."
  );
}

function money(value) {
  const number = Number(value);

  return value != null && value !== "" && Number.isFinite(number)
    ? number.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    })
    : "—";
}

function inventoryKey(item) {
  return `${item.store_id}-${item.product_id}`;
}

function stockLabel(item) {
  const stock = Number(item.stock_quantity);
  const threshold = Number(item.low_stock_threshold);

  if (
    item.stock_quantity == null ||
    item.stock_quantity === "" ||
    !Number.isFinite(stock) ||
    !Number.isFinite(threshold)
  ) {
    return "Unknown";
  }

  if (stock <= 0) return "Out of Stock";
  if (stock <= threshold) return "Low Stock";
  return "In Stock";
}

function ProductImage({ imagePath, alt, className }) {
  const [failedPath, setFailedPath] = useState(null);

  const imageUrl = imagePath
    ? new URL(imagePath, "http://localhost:5000").href
    : "";

  if (!imageUrl || failedPath === imagePath) {
    return (
      <div
        className={`${className} flex items-center justify-center text-xs text-slate-400`}
      >
        {imagePath ? "Preview unavailable" : "No image"}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailedPath(imagePath)}
    />
  );
}

function Inventory() {
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

  const [stores, setStores] = useState(() =>
    isManager && assignedStoreId ? [assignedStore] : []
  );
  const [storesReady, setStoresReady] = useState(
    isManager && Boolean(assignedStoreId)
  );
  const [storesError, setStoresError] = useState("");
  const [storesRefresh, setStoresRefresh] = useState(0);

  const [selectedStore, setSelectedStore] = useState(() =>
    isAdmin ? "all" : assignedStoreId
  );
  const [stockFilter, setStockFilter] = useState("all");
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(!sessionError);
  const [listError, setListError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const [productOptions, setProductOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsStoreId, setOptionsStoreId] = useState("");
  const [optionsRefresh, setOptionsRefresh] = useState(0);

  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const mutationLock = useRef(false);
  const dialogRef = useRef(null);

  const targetStoreId = isManager ? assignedStoreId : selectedStore;
  const mutationBusy = saving || busyKey !== null;

  const optionsReady =
    Boolean(form.storeId) &&
    optionsStoreId === form.storeId &&
    !optionsLoading &&
    !optionsError;

  function canManageItem(item) {
    return (
      !sessionError &&
      Boolean(item) &&
      validId(item.store_id) &&
      validId(item.product_id) &&
      (isAdmin ||
        (isManager && String(item.store_id) === assignedStoreId))
    );
  }

  // Only admins load the complete stores list.
  useEffect(() => {
    if (!isAdmin || sessionError) return;

    let active = true;

    async function loadStores() {
      setStoresReady(false);
      setStoresError("");

      try {
        const data = readResult(await getAdminStores());

        if (!Array.isArray(data?.stores)) {
          throw new Error("Invalid stores response.");
        }

        if (active) {
          setStores(data.stores);
          setStoresReady(true);
        }
      } catch (error) {
        if (active) setStoresError(getError(error));
      }
    }

    loadStores();

    return () => {
      active = false;
    };
  }, [isAdmin, sessionError, storesRefresh]);

  useEffect(() => {
    if (sessionError || !storesReady) {
      setInventory([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadInventory() {
      setLoading(true);
      setListError("");
      setInventory([]);

      try {
        const targetStores =
          targetStoreId === "all"
            ? stores
            : stores.filter(
              (store) => String(store.id) === targetStoreId
            );

        if (targetStoreId !== "all" && targetStores.length === 0) {
          throw new Error("Selected store was not found.");
        }

        const lists = await Promise.all(
          targetStores.map(async (store) => {
            const data = readResult(
              await getInventory(store.id, {
                signal: controller.signal,
              })
            );

            if (!Array.isArray(data)) {
              throw new Error(
                `Invalid inventory response for ${store.name || store.id}.`
              );
            }

            if (
              data.some(
                (item) => String(item.store_id) !== String(store.id)
              )
            ) {
              throw new Error(
                "Inventory response contains another store's data. Please check backend store permissions."
              );
            }

            return data.map((item) => ({
              ...item,
              store_name:
                store.name || item.store_name || `Store #${store.id}`,
            }));
          })
        );

        if (active) setInventory(lists.flat());
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setListError(getError(error));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInventory();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    sessionError,
    storesReady,
    stores,
    targetStoreId,
    refreshKey,
  ]);

  // Creation offers active products that do not already have inventory.
  useEffect(() => {
    if (
      !modalOpen ||
      mode !== "create" ||
      !form.storeId ||
      sessionError
    ) {
      setProductOptions([]);
      setOptionsLoading(false);
      setOptionsError("");
      setOptionsStoreId("");
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadOptions() {
      setOptionsLoading(true);
      setOptionsError("");
      setProductOptions([]);
      setOptionsStoreId("");

      try {
        if (isManager && form.storeId !== assignedStoreId) {
          throw new Error("You can only manage your assigned store.");
        }

        const results = await Promise.all([
          getProducts(form.storeId, { signal: controller.signal }),
          getInventory(form.storeId, { signal: controller.signal }),
        ]);

        const products = readResult(results[0]);
        const existing = readResult(results[1]);

        if (!Array.isArray(products) || !Array.isArray(existing)) {
          throw new Error("Invalid product or inventory response.");
        }

        if (
          products.some(
            (product) => String(product.store_id) !== form.storeId
          ) ||
          existing.some(
            (item) => String(item.store_id) !== form.storeId
          )
        ) {
          throw new Error(
            "Product or inventory response contains another store's data."
          );
        }

        const existingIds = new Set(
          existing.map((item) => String(item.product_id))
        );

        const options = products.filter(
          (product) =>
            validId(product.id) &&
            enabled(product.is_active) &&
            !existingIds.has(String(product.id))
        );

        if (active) {
          setProductOptions(options);
          setOptionsStoreId(form.storeId);
        }
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setOptionsError(getError(error));
        }
      } finally {
        if (active) setOptionsLoading(false);
      }
    }

    loadOptions();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    modalOpen,
    mode,
    form.storeId,
    optionsRefresh,
    sessionError,
    isManager,
    assignedStoreId,
  ]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (modalOpen && !dialog.open) dialog.showModal();
    if (!modalOpen && dialog.open) dialog.close();

    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    dialog
      .querySelector("input:not(:disabled), select:not(:disabled)")
      ?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  function openForm(nextMode, item = null) {
    if (sessionError || mutationLock.current) return;
    if (!["create", "edit", "stock"].includes(nextMode)) return;

    if (
      nextMode === "create" &&
      (!storesReady || storesError || !stores.length)
    ) {
      return;
    }

    if (nextMode !== "create" && !canManageItem(item)) return;

    setMode(nextMode);
    setEditingItem(nextMode === "create" ? null : item);
    setFormError("");
    setMessage("");
    setActionError("");

    setProductOptions([]);
    setOptionsStoreId("");
    setOptionsError("");
    setOptionsLoading(nextMode === "create");

    setForm(
      nextMode !== "create"
        ? {
          storeId: isManager
            ? assignedStoreId
            : String(item.store_id),
          product_id: String(item.product_id),
          selling_price: String(item.selling_price ?? ""),
          stock_quantity: String(item.stock_quantity ?? ""),
          low_stock_threshold: String(item.low_stock_threshold ?? 10),
          is_available: enabled(item.is_available),
        }
        : {
          ...emptyForm,
          storeId: isManager
            ? assignedStoreId
            : selectedStore === "all"
              ? ""
              : selectedStore,
        }
    );

    setModalOpen(true);
  }

  function closeModal() {
    if (!mutationLock.current) setModalOpen(false);
  }

  function changeForm(event) {
    const { name, value, type, checked } = event.target;

    if (
      (name === "storeId" && (isManager || mode !== "create")) ||
      (name === "product_id" && mode !== "create")
    ) {
      return;
    }

    if (name === "storeId") {
      setProductOptions([]);
      setOptionsStoreId("");
      setOptionsError("");
      setOptionsLoading(Boolean(value));
    }

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "storeId" ? { product_id: "" } : {}),
    }));
  }

  async function saveInventory(event) {
    event.preventDefault();
    if (mutationLock.current) return;

    if (sessionError) {
      setFormError(sessionError);
      return;
    }

    if (mode !== "create" && !canManageItem(editingItem)) {
      setFormError("You can only manage your assigned store's inventory.");
      return;
    }

    const storeId = isManager
      ? assignedStoreId
      : mode === "create"
        ? form.storeId
        : String(editingItem.store_id);

    const productId =
      mode === "create"
        ? form.product_id
        : String(editingItem.product_id);

    if (!validId(storeId) || !validId(productId)) {
      setFormError("Please select a valid store and product.");
      return;
    }

    if (
      mode === "create" &&
      (!stores.some((store) => String(store.id) === storeId) ||
        !optionsReady ||
        !productOptions.some(
          (product) =>
            String(product.id) === productId &&
            String(product.store_id) === storeId
        ))
    ) {
      setFormError("Please select a valid product for this store.");
      return;
    }

    const stockText = form.stock_quantity.trim();
    const quantity = Number(stockText);

    if (
      stockText === "" ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0
    ) {
      setFormError("Stock must be a non-negative whole number.");
      return;
    }

    const priceText = form.selling_price.trim();
    const price = Number(priceText);
    const thresholdText = form.low_stock_threshold.trim();
    const threshold = Number(thresholdText);

    if (mode !== "stock") {
      if (
        priceText === "" ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        setFormError("Enter a valid non-negative selling price.");
        return;
      }

      if (
        thresholdText === "" ||
        !Number.isSafeInteger(threshold) ||
        threshold < 0
      ) {
        setFormError(
          "Low stock threshold must be a non-negative whole number."
        );
        return;
      }
    }

    mutationLock.current = true;
    setSaving(true);
    setFormError("");

    try {
      const payload = {
        selling_price: price,
        stock_quantity: quantity,
        low_stock_threshold: threshold,
        is_available: form.is_available,
      };

      let result;

      if (mode === "stock") {
        result = await updateStock(storeId, productId, quantity);
      } else if (mode === "edit") {
        result = await updateInventory(storeId, productId, payload);
      } else {
        result = await createInventory(storeId, {
          ...payload,
          product_id: Number(productId),
        });
      }

      readResult(result);
      setModalOpen(false);
      setMessage(result.message || "Inventory saved successfully.");
      setStockFilter("all");

      if (
        isAdmin &&
        selectedStore !== "all" &&
        selectedStore !== storeId
      ) {
        setSelectedStore(storeId);
      }

      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFormError(getError(error));
    } finally {
      mutationLock.current = false;
      setSaving(false);
    }
  }

  async function toggleAvailability(item) {
    if (mutationLock.current || !canManageItem(item)) return;

    const key = inventoryKey(item);
    const storeId = isManager ? assignedStoreId : item.store_id;
    const next = !enabled(item.is_available);

    mutationLock.current = true;
    setBusyKey(key);
    setMessage("");
    setActionError("");

    try {
      const result = await updateAvailability(
        storeId,
        item.product_id,
        next
      );

      const data = readResult(result);

      setInventory((previous) =>
        previous.map((record) =>
          inventoryKey(record) === key
            ? {
              ...record,
              is_available: data?.is_available ?? next,
            }
            : record
        )
      );

      setMessage(result.message || "Availability updated.");
    } catch (error) {
      setActionError(getError(error));
    } finally {
      mutationLock.current = false;
      setBusyKey(null);
    }
  }

  const filteredInventory = inventory.filter((item) => {
    if (stockFilter === "available") {
      return enabled(item.is_available) && Number(item.stock_quantity) > 0;
    }

    if (stockFilter === "low") return stockLabel(item) === "Low Stock";
    if (stockFilter === "out") return stockLabel(item) === "Out of Stock";

    return true;
  });

  const cards = [
    {
      label: "Total Products",
      value: inventory.length,
      color: "text-slate-900",
    },
    {
      label: "Available",
      value: inventory.filter(
        (item) =>
          enabled(item.is_available) && Number(item.stock_quantity) > 0
      ).length,
      color: "text-green-600",
    },
    {
      label: "Low Stock",
      value: inventory.filter(
        (item) => stockLabel(item) === "Low Stock"
      ).length,
      color: "text-orange-500",
    },
    {
      label: "Out of Stock",
      value: inventory.filter(
        (item) => stockLabel(item) === "Out of Stock"
      ).length,
      color: "text-red-500",
    },
  ];

  const summaryReady =
    !sessionError &&
    storesReady &&
    !storesError &&
    !loading &&
    !listError;

  const title =
    mode === "create"
      ? "Add Inventory"
      : mode === "stock"
        ? "Update Stock"
        : "Edit Inventory";

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
                Stock Management
              </p>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Inventory
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isManager
                  ? `Manage stock and availability for ${assignedStore?.name || "your assigned store"}.`
                  : "Manage product stock and availability across your stores."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => openForm("create")}
              disabled={
                Boolean(sessionError) ||
                !storesReady ||
                Boolean(storesError) ||
                !stores.length ||
                mutationBusy
              }
              className={buttonClass}
            >
              + Add Inventory
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

              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
                  >
                    <p className="text-sm font-medium text-slate-500">
                      {card.label}
                    </p>
                    <h3 className={`mt-2 text-2xl font-bold ${card.color}`}>
                      {summaryReady ? card.value : "—"}
                    </h3>
                  </div>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Inventory Filters
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {isManager
                        ? "Summary cards reflect your assigned store."
                        : "Summary cards reflect the selected store."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {isAdmin ? (
                      <select
                        aria-label="Filter by store"
                        value={selectedStore}
                        disabled={!storesReady || mutationBusy}
                        onChange={(event) => {
                          setSelectedStore(event.target.value);
                          setMessage("");
                          setActionError("");
                        }}
                        className={inputClass}
                      >
                        <option value="all">
                          {!storesReady && !storesError
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
                      <div className="min-w-48 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
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
                      aria-label="Filter by stock status"
                      value={stockFilter}
                      disabled={mutationBusy}
                      onChange={(event) =>
                        setStockFilter(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="all">All Stock</option>
                      <option value="available">Available</option>
                      <option value="low">Low Stock</option>
                      <option value="out">Out of Stock</option>
                    </select>
                  </div>
                </div>
              </div>

              <div
                aria-busy={!storesReady || loading}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Inventory List
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {summaryReady
                        ? `${filteredInventory.length} inventory records found`
                        : "Store-wise product inventory"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRefreshKey((value) => value + 1)}
                    disabled={!storesReady || loading || mutationBusy}
                    className="rounded-xl border border-green-200 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                {storesError || listError ? (
                  <div role="alert" className="p-10 text-center">
                    <p className="text-sm text-red-600">
                      {storesError || listError}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        storesError
                          ? setStoresRefresh((value) => value + 1)
                          : setRefreshKey((value) => value + 1)
                      }
                      className={`${buttonClass} mt-4`}
                    >
                      Try Again
                    </button>
                  </div>
                ) : !storesReady || loading ? (
                  <div
                    role="status"
                    className="flex min-h-64 flex-col items-center justify-center gap-4 p-6"
                  >
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
                    <p className="text-sm text-slate-500">
                      Loading inventory...
                    </p>
                  </div>
                ) : filteredInventory.length === 0 ? (
                  <div className="p-16 text-center">
                    <p className="mb-3 text-3xl">🛒</p>
                    <p className="text-sm font-semibold text-slate-600">
                      No inventory found
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {stores.length === 0
                        ? "Create a store before adding inventory."
                        : "Add inventory or change your stock filter."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-green-50 text-xs uppercase text-slate-500">
                        <tr>
                          {[
                            "Image",
                            "Product",
                            "Store",
                            "Selling Price",
                            "Stock",
                            "Threshold",
                            "Stock Status",
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
                        {filteredInventory.map((item) => {
                          const key = inventoryKey(item);
                          const label = stockLabel(item);
                          const isAvailable = enabled(item.is_available);
                          const actionsDisabled =
                            mutationBusy ||
                            loading ||
                            !canManageItem(item);

                          const stockColor =
                            label === "Out of Stock"
                              ? "bg-red-50 text-red-600"
                              : label === "Low Stock"
                                ? "bg-orange-50 text-orange-600"
                                : label === "In Stock"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500";

                          return (
                            <tr key={key} className="hover:bg-green-50/50">
                              <td className="px-5 py-5">
                                <ProductImage
                                  imagePath={item.product_image}
                                  alt={item.product_name || `Product #${item.product_id}`}
                                  className="h-16 w-16 rounded-xl border border-green-100 bg-green-50 object-contain"
                                />
                              </td>
                              <td className="px-5 py-5">
                                <p className="font-semibold text-slate-900">
                                  {item.product_name ||
                                    `Product #${item.product_id}`}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {item.sku || "—"} • {item.unit || "—"}
                                </p>
                              </td>
                              <td className="px-5 py-5 text-slate-600">
                                {item.store_name}
                              </td>
                              <td className="whitespace-nowrap px-5 py-5">
                                {money(item.selling_price)}
                              </td>
                              <td className="px-5 py-5 font-semibold">
                                {item.stock_quantity ?? "—"}
                              </td>
                              <td className="px-5 py-5">
                                {item.low_stock_threshold ?? "—"}
                              </td>
                              <td className="whitespace-nowrap px-5 py-5">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${stockColor}`}
                                >
                                  {label}
                                </span>
                              </td>
                              <td className="px-5 py-5">
                                <button
                                  type="button"
                                  onClick={() => toggleAvailability(item)}
                                  disabled={actionsDisabled}
                                  aria-pressed={isAvailable}
                                  aria-label={`Availability for ${item.product_name || `Product #${item.product_id}`}`}
                                  className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isAvailable
                                      ? "border-green-200 text-green-700 hover:bg-green-50"
                                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                                >
                                  {busyKey === key
                                    ? "Saving..."
                                    : isAvailable
                                      ? "Enabled"
                                      : "Disabled"}
                                </button>
                              </td>
                              <td className="px-5 py-5">
                                <div className="flex gap-2 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => openForm("edit", item)}
                                    disabled={actionsDisabled}
                                    className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openForm("stock", item)}
                                    disabled={actionsDisabled}
                                    className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    Update Stock
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          <dialog
            ref={dialogRef}
            aria-labelledby="inventory-form-title"
            onCancel={(event) => {
              event.preventDefault();
              closeModal();
            }}
            className="m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-2xl overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-xl backdrop:bg-slate-900/50"
          >
            {modalOpen && (
              <div className="max-h-[90vh] min-w-0 overflow-x-hidden overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <h2
                    id="inventory-form-title"
                    className="text-xl font-bold text-slate-900"
                  >
                    {title}
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    aria-label="Close inventory form"
                    className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>

                <form
                  onSubmit={saveInventory}
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
                    {mode === "create" ? (
                      <>
                        <div>
                          <label
                            htmlFor="inventory-store"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Store *
                          </label>
                          <select
                            id="inventory-store"
                            name="storeId"
                            value={form.storeId}
                            onChange={changeForm}
                            disabled={isManager}
                            required
                            className={inputClass}
                          >
                            <option value="">Select Store</option>
                            {stores.map((store) => (
                              <option
                                key={store.id}
                                value={String(store.id)}
                              >
                                {store.name || `Store #${store.id}`}
                              </option>
                            ))}
                          </select>
                          {isManager && (
                            <p className="mt-2 text-xs text-slate-400">
                              Your assigned store is fixed.
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="inventory-product"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Product *
                          </label>
                          <select
                            id="inventory-product"
                            name="product_id"
                            value={form.product_id}
                            onChange={changeForm}
                            disabled={!optionsReady}
                            required
                            className={inputClass}
                          >
                            <option value="">
                              {form.storeId &&
                                (optionsLoading ||
                                  (!optionsError &&
                                    optionsStoreId !== form.storeId))
                                ? "Loading products..."
                                : "Select Product"}
                            </option>
                            {productOptions.map((product) => (
                              <option
                                key={product.id}
                                value={String(product.id)}
                              >
                                {product.name} — {product.sku || "—"}
                              </option>
                            ))}
                          </select>
                        </div>

                        {optionsError && (
                          <div
                            role="alert"
                            className="text-sm text-red-600"
                          >
                            {optionsError}
                            <button
                              type="button"
                              onClick={() =>
                                setOptionsRefresh((value) => value + 1)
                              }
                              className="ml-3 underline"
                            >
                              Retry
                            </button>
                          </div>
                        )}

                        {optionsReady && productOptions.length === 0 && (
                          <p className="text-sm text-slate-500">
                            No active products without inventory found.
                            Existing inventory can be edited from the table.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl bg-green-50 p-4">
                        <p className="font-semibold text-slate-900">
                          {editingItem?.product_name ||
                            `Product #${editingItem?.product_id}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {editingItem?.store_name}
                        </p>
                      </div>
                    )}

                    {(mode === "stock"
                      ? [["stock_quantity", "New Total Stock", "1"]]
                      : [
                        ["selling_price", "Selling Price (₹)", "0.01"],
                        ["stock_quantity", "Total Stock Quantity", "1"],
                        ["low_stock_threshold", "Low Stock Threshold", "1"],
                      ]
                    ).map(([name, label, step]) => (
                      <div key={name}>
                        <label
                          htmlFor={`inventory-${name}`}
                          className="mb-2 block text-sm font-semibold"
                        >
                          {label} *
                        </label>
                        <input
                          id={`inventory-${name}`}
                          name={name}
                          type="number"
                          min="0"
                          step={step}
                          value={form[name]}
                          onChange={changeForm}
                          required
                          className={inputClass}
                        />
                      </div>
                    ))}

                    {mode === "stock" ? (
                      <p className="text-xs text-slate-500">
                        This replaces the current stock quantity.
                      </p>
                    ) : (
                      <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          name="is_available"
                          checked={form.is_available}
                          onChange={changeForm}
                          className="h-4 w-4 accent-green-600"
                        />
                        Enable product availability
                      </label>
                    )}
                  </fieldset>

                  <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={saving}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        saving ||
                        (mode === "create" &&
                          (!optionsReady ||
                            !form.product_id ||
                            productOptions.length === 0))
                      }
                      className={buttonClass}
                    >
                      {saving ? "Saving..." : title}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </dialog>
        </main>
      </div>
    </div>
  );
}

export default Inventory;