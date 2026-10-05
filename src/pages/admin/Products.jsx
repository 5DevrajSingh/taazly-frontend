import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getAdminStores } from "../../services/storeService";
import { getCategories } from "../../services/categoryService";
import {
  getProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
  activateProduct,
  getProduct,
  uploadProductImages,
} from "../../services/productService";
import ProductImageGallery from "../../components/adminComponents/ProductImageGallery";
const emptyForm = {
  storeId: "",
  category_id: "",
  name: "",
  slug: "",
  description: "",
  sku: "",
  unit: "",
  base_price: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:bg-slate-50 disabled:text-slate-500";

const buttonClass =
  "rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50";

const activeStatus = (value) => value === true || Number(value) === 1;

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

function checkResponse(result) {
  if (!result?.success) {
    throw new Error(result?.message || "API request failed.");
  }

  return result.data;
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to complete request."
  );
}

function productKey(product) {
  return `${product.store_id}-${product.id}`;
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


function Products() {
  // Initialize session before states that depend on it.
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
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(!sessionError);
  const [listError, setListError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [selectedImages, setSelectedImages] = useState([]);
  const [imageBusy, setImageBusy] = useState(false);

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [categoriesStoreId, setCategoriesStoreId] = useState("");
  const [categoryRefresh, setCategoryRefresh] = useState(0);

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const mutationLock = useRef(false);
  const dialogRef = useRef(null);

  const targetStoreId = isManager ? assignedStoreId : selectedStore;
  const mutationBusy = saving || imageBusy || busyKey !== null;

  function canManageProduct(product) {
    return (
      !sessionError &&
      validId(product.id) &&
      validId(product.store_id) &&
      (isAdmin ||
        (isManager && String(product.store_id) === assignedStoreId))
    );
  }


  

  // Managers use their assigned store and never call the admin stores API.
  useEffect(() => {
    if (!isAdmin || sessionError) return;

    let active = true;

    async function loadStores() {
      setStoresReady(false);
      setStoresError("");

      try {
        const data = checkResponse(await getAdminStores());

        if (!Array.isArray(data?.stores)) {
          throw new Error("Invalid stores response.");
        }

        if (active) {
          setStores(data.stores);
          setStoresReady(true);
        }
      } catch (error) {
        if (active) setStoresError(errorMessage(error));
      }
    }

    loadStores();

    return () => {
      active = false;
    };
  }, [isAdmin, sessionError, storesRefresh]);

  useEffect(() => {
    if (sessionError || !storesReady) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadProducts() {
      setLoading(true);
      setListError("");
      setProducts([]);

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
            const data = checkResponse(
              await getProducts(store.id, {
                signal: controller.signal,
              })
            );

            if (!Array.isArray(data)) {
              throw new Error(
                `Invalid products response for ${store.name || store.id}.`
              );
            }

            // Do not display records returned for a different store.
            if (
              data.some(
                (product) =>
                  String(product.store_id) !== String(store.id)
              )
            ) {
              throw new Error(
                "Products response contains another store's data. Please check backend store permissions."
              );
            }

            return data.map((product) => ({
              ...product,
              store_name:
                store.name ||
                product.store_name ||
                `Store #${store.id}`,
            }));
          })
        );

        if (active) setProducts(lists.flat());
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setListError(errorMessage(error));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProducts();

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

  useEffect(() => {
    if (!modalOpen || !form.storeId || sessionError) {
      setCategories([]);
      setCategoriesError("");
      setCategoriesLoading(false);
      setCategoriesStoreId("");
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoriesError("");
      setCategories([]);
      setCategoriesStoreId("");

      try {
        if (isManager && form.storeId !== assignedStoreId) {
          throw new Error("You can only manage your assigned store.");
        }

        const data = checkResponse(
          await getCategories(form.storeId, {
            signal: controller.signal,
          })
        );

        if (!Array.isArray(data)) {
          throw new Error("Invalid categories response.");
        }

        if (
          data.some(
            (category) =>
              String(category.store_id) !== form.storeId
          )
        ) {
          throw new Error(
            "Categories response contains another store's data."
          );
        }

        if (active) {
          setCategories(data);
          setCategoriesStoreId(form.storeId);
        }
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setCategoriesError(errorMessage(error));
        }
      } finally {
        if (active) setCategoriesLoading(false);
      }
    }

    loadCategories();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    modalOpen,
    form.storeId,
    categoryRefresh,
    isManager,
    assignedStoreId,
    sessionError,
  ]);

  // Native dialog provides focus trapping and makes the background inert.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (modalOpen && !dialog.open) dialog.showModal();
    if (!modalOpen && dialog.open) dialog.close();

    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    dialog
      .querySelector(
        "input:not(:disabled), select:not(:disabled), textarea:not(:disabled)"
      )
      ?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  function prepareModal() {
    setCategories([]);
    setCategoriesStoreId("");
    setCategoriesLoading(true);
    setCategoriesError("");
    setFormError("");
    setMessage("");
    setActionError("");
    setModalOpen(true);
  }

  function openAdd() {
    if (
      sessionError ||
      !storesReady ||
      storesError ||
      !stores.length ||
      mutationLock.current
    ) {
      return;
    }

    setEditingProduct(null);
    setForm({
      ...emptyForm,
      storeId: isManager
        ? assignedStoreId
        : selectedStore === "all"
          ? ""
          : selectedStore,
    });
    setSelectedImages([]);
    prepareModal();
  }

  function openEdit(product) {
    if (mutationLock.current || !canManageProduct(product)) return;

    setEditingProduct(product);
    setForm({
      storeId: isManager
        ? assignedStoreId
        : String(product.store_id),
      category_id:
        product.category_id == null ? "" : String(product.category_id),
      name: product.name || "",
      slug: product.slug || "",
      description: product.description || "",
      sku: product.sku || "",
      unit: product.unit || "",
      base_price: String(product.base_price ?? ""),
    });
    setSelectedImages([]);
    prepareModal();
  }

  function closeModal() {
    if (!mutationLock.current) setModalOpen(false);
  }

  function changeForm(event) {
    const { name, value } = event.target;

    if (name === "storeId" && (isManager || editingProduct)) return;

    if (name === "storeId") {
      setCategories([]);
      setCategoriesStoreId("");
      setCategoriesError("");
      setCategoriesLoading(Boolean(value));
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "storeId" ? { category_id: "" } : {}),
    }));
  }

  const availableCategories = categories.filter(
    (category) =>
      String(category.store_id) === form.storeId &&
      (activeStatus(category.is_active) ||
        (editingProduct &&
          String(category.id) === String(editingProduct.category_id)))
  );

  const categoriesReady =
    Boolean(form.storeId) &&
    categoriesStoreId === form.storeId &&
    !categoriesLoading &&
    !categoriesError;

  async function saveProduct(event) {
  event.preventDefault();
  if (mutationLock.current) return;

  if (sessionError) {
    setFormError(sessionError);
    return;
  }

  if (editingProduct && !canManageProduct(editingProduct)) {
    setFormError(
      "You can only manage your assigned store's products."
    );
    return;
  }

  const storeId = String(
    isManager
      ? assignedStoreId
      : editingProduct
        ? editingProduct.store_id
        : form.storeId
  );

  const priceText = form.base_price.trim();
  const price = Number(priceText);
  const categoryId = Number(form.category_id);

  if (
    !validId(storeId) ||
    !form.name.trim() ||
    !form.slug.trim() ||
    !form.sku.trim() ||
    !form.unit.trim()
  ) {
    setFormError("Please fill all required fields.");
    return;
  }

  if (!stores.some((store) => String(store.id) === storeId)) {
    setFormError("Please select a valid store.");
    return;
  }

  const category = availableCategories.find(
    (item) =>
      String(item.id) === form.category_id &&
      String(item.store_id) === storeId
  );

  if (
    !categoriesReady ||
    !category ||
    !Number.isSafeInteger(categoryId) ||
    categoryId <= 0
  ) {
    setFormError("Please select a valid category for this store.");
    return;
  }

  if (
    priceText === "" ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    setFormError("Please enter a valid non-negative base price.");
    return;
  }

  // Snapshot: selected order mein images upload hongi.
  const filesToUpload = [...selectedImages];

  mutationLock.current = true;
  setSaving(true);
  setFormError("");
  setMessage("");
  setActionError("");

  try {
    const payload = {
      category_id: categoryId,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      sku: form.sku.trim(),
      unit: form.unit.trim(),
      base_price: price,
    };

    const result = editingProduct
      ? await updateProduct(storeId, editingProduct.id, {
          ...payload,
          is_active: activeStatus(editingProduct.is_active),
        })
      : await createProduct(storeId, payload);

    const savedProduct = checkResponse(result);

    const successText = editingProduct
      ? "Product updated successfully."
      : "Product created successfully.";

    let imageUploadFailed = false;

    // Add Product: product create ke baad image upload.
    // Edit ka separate Upload Images button same rahega.
    if (!editingProduct && filesToUpload.length > 0) {
      try {
        if (
          !validId(savedProduct?.id) ||
          String(savedProduct?.store_id) !== storeId
        ) {
          throw new Error(
            "Product response did not contain valid product/store IDs."
          );
        }

        checkResponse(
          await uploadProductImages(
            savedProduct.store_id,
            savedProduct.id,
            filesToUpload
          )
        );
      } catch (imageError) {
        imageUploadFailed = true;

        setActionError(
          `Product saved, but image upload did not complete. ${
            errorMessage(imageError)
          } Open Edit to check the gallery and upload missing images.`
        );
      }
    }

    setSelectedImages([]);
    setModalOpen(false);

    setMessage(
      !editingProduct &&
      filesToUpload.length > 0 &&
      !imageUploadFailed
        ? "Product created with images successfully."
        : successText
    );

    if (
      isAdmin &&
      selectedStore !== "all" &&
      selectedStore !== storeId
    ) {
      setSelectedStore(storeId);
    }

    setSelectedStatus("all");
    setRefreshKey((value) => value + 1);
  } catch (error) {
    setFormError(errorMessage(error));
  } finally {
    mutationLock.current = false;
    setSaving(false);
  }
}

  async function toggleProduct(product) {
    if (mutationLock.current || !canManageProduct(product)) return;

    const key = productKey(product);
    const storeId = isManager ? assignedStoreId : product.store_id;
    const isActive = activeStatus(product.is_active);

    mutationLock.current = true;
    setBusyKey(key);
    setMessage("");
    setActionError("");

    try {
      const result = isActive
        ? await deactivateProduct(storeId, product.id)
        : await activateProduct(storeId, product.id);

      const data = checkResponse(result);

      setProducts((previous) =>
        previous.map((item) =>
          productKey(item) === key
            ? {
              ...item,
              is_active: data?.is_active ?? (isActive ? 0 : 1),
            }
            : item
        )
      );

      setMessage(result.message || "Product status updated.");
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      mutationLock.current = false;
      setBusyKey(null);
    }
  }

  const filteredProducts = products.filter((product) => {
    if (selectedStatus === "all") return true;

    return selectedStatus === "active"
      ? activeStatus(product.is_active)
      : !activeStatus(product.is_active);
  });

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
                Catalog
              </p>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Products
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isManager
                  ? `Manage products for ${assignedStore?.name || "your assigned store"}.`
                  : "Manage products across your TAAZLY stores."}
              </p>
            </div>

            <button
              type="button"
              onClick={openAdd}
              disabled={
                Boolean(sessionError) ||
                !storesReady ||
                Boolean(storesError) ||
                !stores.length ||
                mutationBusy
              }
              className={buttonClass}
            >
              + Add Product
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
                  className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-green-100 px-4 py-3 text-sm text-green-700"
                >
                  <span>{message}</span>
                  <button
                    type="button"
                    aria-label="Dismiss success message"
                    onClick={() => setMessage("")}
                    className="rounded-lg px-2 py-1 hover:bg-green-200"
                  >
                    ×
                  </button>
                </div>
              )}

              {actionError && (
                <div
                  role="alert"
                  className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  <span>{actionError}</span>
                  <button
                    type="button"
                    aria-label="Dismiss error message"
                    onClick={() => setActionError("")}
                    className="rounded-lg px-2 py-1 hover:bg-red-100"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="mb-6 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Product Filters
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {isManager
                        ? "Filter your assigned store's products by status."
                        : "Filter products by store and status."}
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
                      aria-label="Filter by status"
                      value={selectedStatus}
                      disabled={mutationBusy}
                      onChange={(event) =>
                        setSelectedStatus(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
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
                      Product List
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {storesReady && !loading && !listError
                        ? `${filteredProducts.length} products found`
                        : "Products from your stores"}
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

                {storesError ? (
                  <div role="alert" className="p-10 text-center">
                    <p className="text-sm text-red-600">{storesError}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setStoresRefresh((value) => value + 1)
                      }
                      className={`${buttonClass} mt-4`}
                    >
                      Retry Stores
                    </button>
                  </div>
                ) : !storesReady || loading ? (
                  <div
                    role="status"
                    className="flex min-h-64 flex-col items-center justify-center gap-4 p-6"
                  >
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
                    <p className="text-sm text-slate-500">
                      Loading products...
                    </p>
                  </div>
                ) : listError ? (
                  <div role="alert" className="p-10 text-center">
                    <p className="text-sm text-red-600">{listError}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setRefreshKey((value) => value + 1)
                      }
                      className={`${buttonClass} mt-4`}
                    >
                      Try Again
                    </button>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-16 text-center">
                    <p className="mb-3 text-3xl">📦</p>
                    <p className="text-sm font-semibold text-slate-600">
                      No products found
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {stores.length === 0
                        ? "Create a store before adding products."
                        : "Add a product or change your filters."}
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
                            "Category",
                            "Unit",
                            "Base Price",
                            "Status",
                            "Actions",
                          ].map((label) => (
                            <th
                              key={label}
                              scope="col"
                              className="px-6 py-4"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((product) => {
                          const isActive = activeStatus(product.is_active);
                          const price = Number(product.base_price);
                          const key = productKey(product);
                          const actionsDisabled =
                            mutationBusy || !canManageProduct(product);

                          return (
                            <tr
                              key={key}
                              className="hover:bg-green-50/50"
                            >

                              <td className="px-6 py-5">
                                <ProductImage
                                  imagePath={product.product_image}
                                  alt={product.name}
                                  className="h-16 w-16 rounded-xl border border-green-100 bg-green-50 object-contain"
                                />
                              </td>
                              <td className="px-6 py-5">
                                <p className="font-semibold text-slate-900">
                                  {product.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  SKU: {product.sku || "—"}
                                </p>
                              </td>
                              <td className="px-6 py-5 text-slate-600">
                                {product.store_name}
                              </td>
                              <td className="px-6 py-5 text-slate-600">
                                {product.category_name || "—"}
                              </td>
                              <td className="px-6 py-5 text-slate-600">
                                {product.unit || "—"}
                              </td>
                              <td className="whitespace-nowrap px-6 py-5 font-semibold">
                                {product.base_price != null &&
                                  product.base_price !== "" &&
                                  Number.isFinite(price)
                                  ? price.toLocaleString("en-IN", {
                                    style: "currency",
                                    currency: "INR",
                                  })
                                  : "—"}
                              </td>
                              <td className="px-6 py-5">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${isActive
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-50 text-red-500"
                                    }`}
                                >
                                  {isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEdit(product)}
                                    disabled={actionsDisabled}
                                    className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleProduct(product)}
                                    disabled={actionsDisabled}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isActive
                                      ? "border-red-200 text-red-600 hover:bg-red-50"
                                      : "border-green-200 text-green-700 hover:bg-green-50"
                                      }`}
                                  >
                                    {busyKey === key
                                      ? "Saving..."
                                      : isActive
                                        ? "Deactivate"
                                        : "Activate"}
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
            aria-labelledby="product-form-title"
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
                    id="product-form-title"
                    className="text-xl font-bold text-slate-900"
                  >
                    {editingProduct ? "Edit Product" : "Add Product"}
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    aria-label="Close product form"
                    className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>

                <form
                  onSubmit={saveProduct}
                  aria-busy={saving}
                  className="min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6"
                >
                  {formError && (
                    <p
                      role="alert"
                      className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600"
                    >
                      {formError}
                    </p>
                  )}

                  <ProductImageGallery
                    product={editingProduct}
                    files={selectedImages}
                    onFilesChange={setSelectedImages}
                    disabled={saving}
                    mutationLock={mutationLock}
                    onBusyChange={setImageBusy}
                    onGalleryChange={(images) => {
                      setProducts((current) =>
                        current.map((product) =>
                          productKey(product) === productKey(editingProduct)
                            ? {
                              ...product,
                              product_image: images[0]?.file_url || null,
                            }
                            : product
                        )
                      );
                    }}
                  />

                  <fieldset
                    disabled={saving}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                  >
                    <div>
                      <label
                        htmlFor="product-store"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Store *
                      </label>
                      <select
                        id="product-store"
                        name="storeId"
                        value={form.storeId}
                        onChange={changeForm}
                        disabled={isManager || Boolean(editingProduct)}
                        required
                        className={inputClass}
                      >
                        <option value="">Select Store</option>
                        {stores.map((store) => (
                          <option key={store.id} value={String(store.id)}>
                            {store.name || `Store #${store.id}`}
                          </option>
                        ))}
                      </select>
                      {(isManager || editingProduct) && (
                        <p className="mt-2 text-xs text-slate-400">
                          {isManager
                            ? "Your assigned store is fixed."
                            : "The product's store cannot be changed here."}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="product-category"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Category *
                      </label>
                      <select
                        id="product-category"
                        name="category_id"
                        value={form.category_id}
                        onChange={changeForm}
                        disabled={!categoriesReady}
                        required
                        className={inputClass}
                      >
                        <option value="">
                          {form.storeId &&
                            (categoriesLoading ||
                              (!categoriesError &&
                                categoriesStoreId !== form.storeId))
                            ? "Loading categories..."
                            : "Select Category"}
                        </option>
                        {availableCategories.map((category) => (
                          <option
                            key={category.id}
                            value={String(category.id)}
                          >
                            {category.name}
                            {!activeStatus(category.is_active)
                              ? " (Inactive)"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {categoriesError && (
                      <div
                        role="alert"
                        className="text-sm text-red-600 sm:col-span-2"
                      >
                        {categoriesError}
                        <button
                          type="button"
                          onClick={() =>
                            setCategoryRefresh((value) => value + 1)
                          }
                          className="ml-3 underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {categoriesReady &&
                      availableCategories.length === 0 && (
                        <p className="text-sm text-slate-500 sm:col-span-2">
                          Add an active category to this store first.
                        </p>
                      )}

                    {[
                      ["name", "Product Name", "Tata Salt"],
                      ["slug", "Slug", "tata-salt"],
                      ["sku", "SKU", "TATA-SALT-001"],
                      ["unit", "Unit", "1 kg"],
                      ["base_price", "Base Price (₹)", "0.00"],
                    ].map(([name, label, placeholder]) => (
                      <div key={name}>
                        <label
                          htmlFor={`product-${name}`}
                          className="mb-2 block text-sm font-semibold"
                        >
                          {label} *
                        </label>
                        <input
                          id={`product-${name}`}
                          name={name}
                          type={name === "base_price" ? "number" : "text"}
                          min={name === "base_price" ? "0" : undefined}
                          step={name === "base_price" ? "0.01" : undefined}
                          value={form[name]}
                          onChange={changeForm}
                          placeholder={placeholder}
                          required
                          className={inputClass}
                        />
                      </div>
                    ))}

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="product-description"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Description
                      </label>
                      <textarea
                        id="product-description"
                        name="description"
                        rows={3}
                        value={form.description}
                        onChange={changeForm}
                        className={inputClass}
                      />
                    </div>
                  </fieldset>

                  <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={saving || imageBusy}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        saving ||
                        !categoriesReady ||
                        availableCategories.length === 0
                      }
                      className={buttonClass}
                    >
                      {saving
                        ? "Saving..."
                        : editingProduct
                          ? "Update Product"
                          : "Create Product"}
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

export default Products;