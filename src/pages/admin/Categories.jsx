import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getAdminStores } from "../../services/storeService";
import {
  getCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
  activateCategory,
  uploadCategoryImage,
} from "../../services/categoryService";

const initialForm = {
  storeId: "",
  name: "",
  slug: "",
  description: "",
  sort_order: "0",
};

const getCategoryImageUrl = (imagePath) => {
  if (!imagePath) return "";

  return new URL(imagePath, "http://localhost:5000").href;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:bg-slate-50 disabled:text-slate-500";

function readStoredData(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function isCategoryActive(category) {
  return category.is_active === true || Number(category.is_active) === 1;
}

function Categories() {
  // Session must be initialized before any state that depends on it.
  const [session] = useState(() => {
    const adminUser = readStoredData("admin_user");
    const managerUser = readStoredData("manager_user");

    // If your login flow sets active_role, use it to select the session.
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
  const [categoryImageFile, setCategoryImageFile] = useState(null);
  const [categoryImagePreview, setCategoryImagePreview] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageSuccess, setImageSuccess] = useState("");
  const [pendingCreatedCategory, setPendingCreatedCategory] = useState(null);
  const categoryImageInputRef = useRef(null);
  const imageUploadLock = useRef(false);

  const [imageBusyId, setImageBusyId] = useState(null);
  const imageUploadingRef = useRef(false);
  const isAdmin = session.user?.role === "admin";
  const isManager = session.user?.role === "store_manager";

  const assignedStore = isManager ? session.store : null;
  const rawStoreId = assignedStore?.id;

  const assignedStoreId =
    /^[1-9]\d*$/.test(String(rawStoreId ?? "")) &&
      Number.isSafeInteger(Number(rawStoreId))
      ? String(rawStoreId)
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
  const [storesLoading, setStoresLoading] = useState(isAdmin);
  const [storesError, setStoresError] = useState("");
  const [storesRefresh, setStoresRefresh] = useState(0);

  const [selectedStore, setSelectedStore] = useState(() =>
    isAdmin ? "all" : assignedStoreId
  );

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(!sessionError);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusBusyId, setStatusBusyId] = useState(null);

  const submitting = useRef(false);
  const statusSubmitting = useRef(false);
  const modalTriggerRef = useRef(null);
  const addButtonRef = useRef(null);
  const dialogRef = useRef(null);

  const categoryStoreId = isManager ? assignedStoreId : selectedStore;

  const canAddCategory =
    !sessionError &&
    !storesLoading &&
    !storesError &&
    stores.length > 0 &&
    statusBusyId === null;

  function canManageCategory(category) {
    return (
      !sessionError &&
      (isAdmin ||
        (isManager && String(category.store_id) === assignedStoreId))
    );
  }

  // Modal open/close ya editing category change par selection reset.
  useEffect(() => {
    setCategoryImageFile(null);
    setImageError("");
    setImageSuccess("");

    if (categoryImageInputRef.current) {
      categoryImageInputRef.current.value = "";
    }
  }, [modalOpen, editingCategory?.id, editingCategory?.store_id]);

  // Selected image preview; old object URL release karo.
  useEffect(() => {
    if (!categoryImageFile) {
      setCategoryImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(categoryImageFile);
    setCategoryImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [categoryImageFile]);

  const handleSelectCategoryImage = (event) => {
    const file = event.target.files?.[0];

    setImageError("");
    setImageSuccess("");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("Please select an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image size must be 5 MB or less.");
      event.target.value = "";
      return;
    }

    setCategoryImageFile(file);
  };

  const handleUploadCategoryFormImage = async () => {
    if (
      !editingCategory ||
      !categoryImageFile ||
      saving ||
      imageUploadLock.current ||
      !canManageCategory(editingCategory)
    ) {
      return;
    }

    // Actual category ka store use karo, filter selection nahi.
    const categoryId = editingCategory.id;
    const storeId = editingCategory.store_id;

    imageUploadLock.current = true;
    setImageUploading(true);
    setImageError("");
    setImageSuccess("");

    try {
      const response = await uploadCategoryImage(
        storeId,
        categoryId,
        categoryImageFile
      );

      const imagePath = response.data?.category_image;

      if (response.success === false || !imagePath) {
        throw new Error(
          response.message || "Failed to upload category image."
        );
      }

      setEditingCategory((current) =>
        current &&
          String(current.id) === String(categoryId) &&
          String(current.store_id) === String(storeId)
          ? { ...current, category_image: imagePath }
          : current
      );

      setCategories((current) =>
        current.map((category) =>
          String(category.id) === String(categoryId) &&
            String(category.store_id) === String(storeId)
            ? { ...category, category_image: imagePath }
            : category
        )
      );

      setCategoryImageFile(null);

      if (categoryImageInputRef.current) {
        categoryImageInputRef.current.value = "";
      }

      setImageSuccess("Category image updated successfully.");
    } catch (error) {
      setImageError(
        error.response?.data?.message ||
        error.message ||
        "Failed to upload category image."
      );
    } finally {
      imageUploadLock.current = false;
      setImageUploading(false);
    }
  };

  // Only admins fetch the complete stores list.
  useEffect(() => {
    if (!isAdmin || sessionError) return;

    let active = true;

    async function fetchStores() {
      setStoresLoading(true);
      setStoresError("");

      try {
        const result = await getAdminStores();

        if (!active) return;

        if (!result?.success) {
          throw new Error(result?.message || "Failed to fetch stores.");
        }

        if (!Array.isArray(result.data?.stores)) {
          throw new Error("Invalid stores response.");
        }

        setStores(result.data.stores);
      } catch (err) {
        if (active) {
          setStoresError(getErrorMessage(err, "Unable to load stores."));
        }
      } finally {
        if (active) setStoresLoading(false);
      }
    }

    fetchStores();

    return () => {
      active = false;
    };
  }, [isAdmin, sessionError, storesRefresh]);

  useEffect(() => {
    if (sessionError || !categoryStoreId) {
      setCategories([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function fetchCategories() {
      setLoading(true);
      setError("");
      setActionError("");
      setCategories([]);

      try {
        const result = await getCategories(categoryStoreId, {
          signal: controller.signal,
        });

        if (!active) return;

        if (!result?.success) {
          throw new Error(result?.message || "Failed to fetch categories.");
        }

        if (!Array.isArray(result.data)) {
          throw new Error("Invalid categories response.");
        }

        // Fail closed if the manager receives data from another store.
        if (
          isManager &&
          result.data.some(
            (category) => String(category.store_id) !== assignedStoreId
          )
        ) {
          throw new Error(
            "Category response contains another store's data. Please check backend store permissions."
          );
        }

        setCategories(result.data);
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setError(getErrorMessage(err, "Unable to load categories."));
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchCategories();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    categoryStoreId,
    assignedStoreId,
    isManager,
    sessionError,
    refreshKey,
  ]);

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstControl = dialogRef.current?.querySelector(
      "input:not(:disabled), select:not(:disabled), textarea:not(:disabled)"
    );

    (firstControl || dialogRef.current)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  function restoreModalFocus() {
    const trigger = modalTriggerRef.current;

    if (trigger?.isConnected && !trigger.disabled) {
      trigger.focus();
    } else {
      addButtonRef.current?.focus();
    }
  }

  function closeModal() {
    if (submitting.current || imageUploadLock.current) return;

    setPendingCreatedCategory(null);
    setCategoryImageFile(null);
    setModalOpen(false);
    restoreModalFocus();
  }

  function openAddCategory(event) {
    if (
      !canAddCategory ||
      submitting.current ||
      statusSubmitting.current ||
      imageUploadLock.current
    ) {
      return;
    }

    modalTriggerRef.current = event?.currentTarget || addButtonRef.current;
    setEditingCategory(null);
    setPendingCreatedCategory(null);
    setCategoryImageFile(null);
    setImageError("");
    setImageSuccess("");

    setForm({
      ...initialForm,
      storeId: isManager
        ? assignedStoreId
        : selectedStore === "all"
          ? ""
          : selectedStore,
    });

    setFormError("");
    setSuccessMessage("");
    setActionError("");
    setModalOpen(true);
  }

  function openEditCategory(category, event) {
    if (
      !canManageCategory(category) ||
      submitting.current ||
      statusSubmitting.current
    ) {
      return;
    }

    modalTriggerRef.current = event?.currentTarget;
    setEditingCategory(category);

    setForm({
      storeId: isManager ? assignedStoreId : String(category.store_id),
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
      sort_order: String(category.sort_order ?? 0),
    });

    setFormError("");
    setSuccessMessage("");
    setActionError("");
    setModalOpen(true);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    // Store cannot be changed by managers or while editing a category.
    if (name === "storeId" && (isManager || editingCategory)) return;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSaveCategory(event) {
    event.preventDefault();

    if (
      submitting.current ||
      statusSubmitting.current ||
      imageUploadLock.current
    ) {
      return;
    }

    if (sessionError) {
      setFormError(sessionError);
      return;
    }

    const existingCategory =
      editingCategory || pendingCreatedCategory;

    if (
      existingCategory &&
      !canManageCategory(existingCategory)
    ) {
      setFormError(
        "You can only manage your assigned store's categories."
      );
      return;
    }

    const storeId = String(
      existingCategory
        ? existingCategory.store_id
        : isManager
          ? assignedStoreId || ""
          : form.storeId || ""
    );

    const name = form.name.trim();
    const slug = form.slug.trim();
    const sortOrderText = String(form.sort_order).trim();
    const sortOrder = Number(sortOrderText);

    // Retry mein category already created hai.
    if (!pendingCreatedCategory) {
      if (!storeId || !name || !slug) {
        setFormError(
          "Please select a store and enter name and slug."
        );
        return;
      }

      if (
        !editingCategory &&
        !stores.some((store) => String(store.id) === storeId)
      ) {
        setFormError("Please select a valid store.");
        return;
      }

      if (
        sortOrderText === "" ||
        !Number.isSafeInteger(sortOrder) ||
        sortOrder < 0
      ) {
        setFormError(
          "Sort order must be a non-negative whole number."
        );
        return;
      }
    }

    submitting.current = true;
    setSaving(true);
    setFormError("");

    let createdCategory = pendingCreatedCategory;
    let uploadingImage = false;

    try {
      const payload = {
        name,
        slug,
        description: form.description.trim(),
        sort_order: sortOrder,
      };

      let successMessage;

      if (editingCategory) {
        // Existing edit behavior.
        const result = await updateCategory(
          storeId,
          editingCategory.id,
          {
            ...payload,
            is_active: isCategoryActive(editingCategory),
          }
        );

        if (!result?.success) {
          throw new Error(
            result?.message || "Unable to update category."
          );
        }

        successMessage =
          result.message || "Category updated successfully.";
      } else {
        if (!createdCategory) {
          const result = await createCategory(storeId, payload);

          if (!result?.success || !result.data?.id) {
            throw new Error(
              result?.message || "Unable to create category."
            );
          }

          createdCategory = {
            ...result.data,
            store_id: result.data.store_id ?? storeId,
          };

          setPendingCreatedCategory(createdCategory);
        }

        // Category create complete; ab image upload.
        if (categoryImageFile) {
          uploadingImage = true;

          const imageResult = await uploadCategoryImage(
            createdCategory.store_id,
            createdCategory.id,
            categoryImageFile
          );

          if (
            !imageResult?.success ||
            !imageResult.data?.category_image
          ) {
            throw new Error(
              imageResult?.message || "Unable to upload image."
            );
          }

          uploadingImage = false;
        }

        successMessage = categoryImageFile
          ? "Category created with image successfully."
          : "Category created successfully.";
      }

      setPendingCreatedCategory(null);
      setCategoryImageFile(null);
      setModalOpen(false);
      restoreModalFocus();
      setSuccessMessage(successMessage);

      if (
        isAdmin &&
        selectedStore !== "all" &&
        selectedStore !== storeId
      ) {
        setSelectedStore(storeId);
      }

      setRefreshKey((value) => value + 1);
    } catch (err) {
      const message = getErrorMessage(
        err,
        "Unable to save category."
      );

      if (!editingCategory && createdCategory) {
        setFormError(
          uploadingImage
            ? `Category created, but image upload failed. ${message} Click Retry Image Upload.`
            : message
        );

        // Created category list mein bhi available rahe.
        setRefreshKey((value) => value + 1);
      } else {
        setFormError(message);
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  async function handleToggleCategory(category) {
    if (
      statusSubmitting.current ||
      submitting.current ||
      !canManageCategory(category)
    ) {
      return;
    }

    const isActive = isCategoryActive(category);
    const storeId = isManager ? assignedStoreId : category.store_id;

    statusSubmitting.current = true;
    setStatusBusyId(category.id);
    setSuccessMessage("");
    setActionError("");

    try {
      const result = isActive
        ? await deactivateCategory(storeId, category.id)
        : await activateCategory(storeId, category.id);

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to change category status."
        );
      }

      const updatedStatus = result.data?.is_active ?? (isActive ? 0 : 1);

      setCategories((previous) =>
        previous.map((item) =>
          String(item.id) === String(category.id) &&
            String(item.store_id) === String(category.store_id)
            ? { ...item, is_active: updatedStatus }
            : item
        )
      );

      setSuccessMessage(
        result.message ||
        (isActive
          ? "Category deactivated successfully."
          : "Category activated successfully.")
      );
    } catch (err) {
      setActionError(
        getErrorMessage(err, "Unable to change category status.")
      );
    } finally {
      statusSubmitting.current = false;
      setStatusBusyId(null);
    }
  }

  function handleModalKeys(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
      return;
    }

    if (event.key !== "Tab") return;

    const controls = Array.from(
      event.currentTarget.querySelectorAll(
        "button, input, select, textarea"
      )
    ).filter(
      (element) => !element.matches(":disabled") && element.tabIndex >= 0
    );

    const first = controls[0];
    const last = controls[controls.length - 1];
    const focused = document.activeElement;

    if (!first) {
      event.preventDefault();
      event.currentTarget.focus();
    } else if (!controls.includes(focused)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && focused === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && focused === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const handleCategoryImageUpload = async (category, event) => {
    const file = event.target.files?.[0];

    // Same file dobara select karne ki permission.
    event.target.value = "";

    if (!file || imageUploadingRef.current) return;
    if (!canManageCategory(category)) return;

    setActionError("");
    setSuccessMessage("");

    if (!file.type.startsWith("image/")) {
      setActionError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setActionError("Image size must be 5 MB or less.");
      return;
    }

    imageUploadingRef.current = true;
    setImageBusyId(`${category.store_id}-${category.id}`);

    try {
      const response = await uploadCategoryImage(
        category.store_id,
        category.id,
        file
      );

      if (
        response.success === false ||
        !response.data?.category_image
      ) {
        throw new Error(
          response.message || "Failed to upload category image."
        );
      }

      setCategories((current) =>
        current.map((item) =>
          String(item.id) === String(category.id) &&
            String(item.store_id) === String(category.store_id)
            ? {
              ...item,
              category_image: response.data.category_image,
            }
            : item
        )
      );

      setSuccessMessage("Category image updated successfully.");
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
        error.message ||
        "Failed to upload category image."
      );
    } finally {
      imageUploadingRef.current = false;
      setImageBusyId(null);
    }
  };

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
                Categories
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isManager
                  ? `Manage categories for ${assignedStore?.name || "your assigned store"}.`
                  : "Manage store-wise product categories."}
              </p>
            </div>

            <button
              ref={addButtonRef}
              type="button"
              onClick={openAddCategory}
              disabled={!canAddCategory}
              className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add Category
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
              {successMessage && (
                <div
                  role="status"
                  className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
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

              {actionError && (
                <div
                  role="alert"
                  className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
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

              <div className="mb-6 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Store Categories
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {isManager
                        ? "Categories from your assigned store."
                        : "View all categories or filter by store."}
                    </p>
                  </div>

                  {isAdmin ? (
                    <select
                      aria-label="Filter categories by store"
                      value={selectedStore}
                      onChange={(event) => {
                        setSelectedStore(event.target.value);
                        setSuccessMessage("");
                        setActionError("");
                      }}
                      disabled={storesLoading || statusBusyId !== null}
                      className="rounded-xl border border-green-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:opacity-50"
                    >
                      <option value="all">
                        {storesLoading ? "Loading stores..." : "All Stores"}
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
                        {assignedStore?.name || `Store #${assignedStoreId}`}
                      </p>
                      {assignedStore?.store_code && (
                        <p className="mt-1 text-xs text-green-600">
                          {assignedStore.store_code}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {isAdmin && storesError && (
                  <div
                    role="alert"
                    className="mt-4 flex flex-wrap items-center gap-3 text-sm text-red-500"
                  >
                    <span>{storesError}</span>
                    <button
                      type="button"
                      onClick={() => setStoresRefresh((value) => value + 1)}
                      disabled={storesLoading}
                      className="font-semibold underline disabled:opacity-50"
                    >
                      Retry Stores
                    </button>
                  </div>
                )}

                {isAdmin &&
                  !storesLoading &&
                  !storesError &&
                  stores.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      Create a store before adding categories.
                    </p>
                  )}
              </div>

              <div
                aria-busy={loading}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Category List
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {loading
                        ? "Loading categories..."
                        : error
                          ? "Categories could not be loaded."
                          : `${categories.length} categories found`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRefreshKey((value) => value + 1)}
                    disabled={loading || statusBusyId !== null}
                    className="rounded-xl border border-green-200 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div
                    role="status"
                    className="flex min-h-64 flex-col items-center justify-center gap-4 p-6"
                  >
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
                    <p className="text-sm text-slate-500">
                      Loading categories...
                    </p>
                  </div>
                ) : error ? (
                  <div role="alert" className="p-10 text-center">
                    <p className="text-sm font-medium text-red-500">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={() => setRefreshKey((value) => value + 1)}
                      className="mt-4 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Try Again
                    </button>
                  </div>
                ) : categories.length === 0 ? (
                  <div className="flex min-h-64 items-center justify-center p-6">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-3xl">
                        🗂️
                      </div>
                      <p className="text-sm font-semibold text-slate-600">
                        No categories found
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Add a category to this store to get started.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-green-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          {[
                            "Image",
                            "Category",
                            "Store",
                            "Description",
                            "Sort Order",
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
                        {categories.map((category) => {
                          const isActive = isCategoryActive(category);
                          const actionsDisabled =
                            statusBusyId !== null ||
                            loading ||
                            !canManageCategory(category);

                          return (
                            <tr
                              key={`${category.store_id}-${category.id}`}
                              className="transition hover:bg-green-50/50"
                            >
                              <td className="px-6 py-5">
                                {category.category_image ? (
                                  <img
                                    src={getCategoryImageUrl(category.category_image)}
                                    alt={category.name}
                                    loading="lazy"
                                    className="h-16 w-16 rounded-xl border border-green-100 bg-green-50 object-contain"
                                  />
                                ) : (
                                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-green-50 text-xs text-slate-400">
                                    No image
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-5">
                                <p className="font-semibold text-slate-900">
                                  {category.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {category.slug}
                                </p>
                              </td>

                              <td className="px-6 py-5 text-slate-600">
                                {category.store_name ||
                                  stores.find(
                                    (store) =>
                                      String(store.id) ===
                                      String(category.store_id)
                                  )?.name ||
                                  `Store #${category.store_id}`}
                              </td>

                              <td className="px-6 py-5 text-slate-500">
                                <p className="max-w-xs break-words">
                                  {category.description || "—"}
                                </p>
                              </td>

                              <td className="px-6 py-5 text-slate-600">
                                {category.sort_order ?? 0}
                              </td>

                              <td className="px-6 py-5">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isActive
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-50 text-red-500"
                                    }`}
                                >
                                  {isActive ? "Active" : "Inactive"}
                                </span>
                              </td>

                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) =>
                                      openEditCategory(category, event)
                                    }
                                    disabled={actionsDisabled}
                                    className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleCategory(category)
                                    }
                                    disabled={actionsDisabled}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isActive
                                      ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                      : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                      }`}
                                  >
                                    {statusBusyId === category.id
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


          {modalOpen && (

            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="category-modal-title"
                tabIndex={-1}
                onKeyDown={handleModalKeys}
                className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <h2
                    id="category-modal-title"
                    className="text-xl font-bold text-slate-900"
                  >
                    {editingCategory ? "Edit Category" : "Add Category"}
                  </h2>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    aria-label="Close category form"
                    className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>

                <form
                  onSubmit={handleSaveCategory}
                  aria-busy={saving}
                  className="overflow-y-auto p-6"
                >
                  {formError && (
                    <div
                      role="alert"
                      className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
                    >
                      {formError}
                    </div>
                  )}

                  <fieldset
                    disabled={saving || imageUploading}
                    className="space-y-4"
                  >
                    <div>
                      <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
                        <label
                          htmlFor="category-image"
                          className="mb-3 block text-sm font-semibold text-slate-700"
                        >
                          Category Image
                        </label>

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          {categoryImagePreview || editingCategory?.category_image ? (
                            <img
                              src={
                                categoryImagePreview ||
                                getCategoryImageUrl(editingCategory?.category_image)
                              }
                              alt={editingCategory?.name || form.name || "Category preview"}
                              className="h-24 w-24 rounded-xl border border-green-100 bg-white object-contain"
                            />
                          ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-green-100 bg-white text-xs text-slate-400">
                              No image
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <input
                              ref={categoryImageInputRef}
                              id="category-image"
                              type="file"
                              accept="image/*"
                              onChange={handleSelectCategoryImage}
                              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-green-100 file:px-3 file:py-2 file:font-semibold file:text-green-700"
                            />

                            <p className="mt-2 text-xs text-slate-500">
                              Maximum size: 5 MB.
                            </p>

                            {editingCategory && (
                              <button
                                type="button"
                                onClick={handleUploadCategoryFormImage}
                                disabled={
                                  !categoryImageFile ||
                                  imageUploading ||
                                  saving ||
                                  !canManageCategory(editingCategory)
                                }
                                className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {imageUploading ? "Uploading..." : "Upload Image"}
                              </button>
                            )}
                          </div>
                        </div>

                        {imageError && (
                          <p role="alert" className="mt-3 text-sm text-red-600">
                            {imageError}
                          </p>
                        )}

                        {imageSuccess && (
                          <p role="status" className="mt-3 text-sm text-green-700">
                            {imageSuccess}
                          </p>
                        )}

                        <p className="mt-3 text-xs text-slate-500">
                          Image saves separately. Cancel will not undo an uploaded image.
                        </p>
                      </div>
                      <label
                        htmlFor="category-store"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Store *
                      </label>

                      <select
                        id="category-store"
                        name="storeId"
                        value={form.storeId}
                        onChange={handleFormChange}
                        disabled={isManager || Boolean(editingCategory)}
                        required
                        className={inputClass}
                      >
                        <option value="">Select Store</option>

                        {editingCategory &&
                          !stores.some(
                            (store) =>
                              String(store.id) === form.storeId
                          ) && (
                            <option value={form.storeId}>
                              {editingCategory.store_name ||
                                `Store #${form.storeId}`}
                            </option>
                          )}

                        {stores.map((store) => (
                          <option key={store.id} value={String(store.id)}>
                            {store.name || `Store #${store.id}`}
                          </option>
                        ))}
                      </select>

                      {(isManager || editingCategory) && (
                        <p className="mt-2 text-xs text-slate-400">
                          {isManager
                            ? "This category belongs to your assigned store."
                            : "A category's store cannot be changed here."}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="category-name"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Category Name *
                      </label>
                      <input
                        id="category-name"
                        name="name"
                        value={form.name}
                        onChange={handleFormChange}
                        required
                        placeholder="Fresh Vegetables"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="category-slug"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Slug *
                      </label>
                      <input
                        id="category-slug"
                        name="slug"
                        value={form.slug}
                        onChange={handleFormChange}
                        required
                        placeholder="fresh-vegetables"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="category-description"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Description
                      </label>
                      <textarea
                        id="category-description"
                        name="description"
                        value={form.description}
                        onChange={handleFormChange}
                        rows={3}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="category-sort"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Sort Order *
                      </label>
                      <input
                        id="category-sort"
                        name="sort_order"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={form.sort_order}
                        onChange={handleFormChange}
                        className={inputClass}
                      />
                    </div>
                  </fieldset>

                  <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={saving || imageUploading}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving || imageUploading}
                      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {imageUploading
                        ? "Uploading Image..."
                        : saving
                          ? "Saving..."
                          : editingCategory
                            ? "Update Category"
                            : "Create Category"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Categories;