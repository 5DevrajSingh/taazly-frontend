import api from "./api";

//  Todo Get Active Store
export async function getActiveStores({ signal } = {}) {
  const { data } = await api.get("/stores/active", {
    authScope: "none",
    signal,
  });

  if (data.success !== true || !Array.isArray(data.data)) {
    throw new Error(data.message || "Unable to load stores.");
  }

  return data.data;
}

// Todo Get Category by store ID
export async function getHomeCategories(storeId, { signal } = {}) {
  const { data } = await api.get(
    `/categories/store/${encodeURIComponent(storeId)}`,
    {
      authScope: "none",
      signal,
    }
  );

  if (data.success !== true || !Array.isArray(data.data)) {
    throw new Error(data.message || "Unable to load categories.");
  }

  const backendOrigin = new URL(
    api.defaults.baseURL || "/",
    window.location.origin
  ).origin;

  return data.data
    .filter(
      (category) =>
        Number(category.is_active) === 1 &&
        String(category.store_id) === String(storeId)
    )
    .sort(
      (a, b) =>
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .map((category) => ({
      ...category,
      image_url: category.category_image
        ? new URL(category.category_image, backendOrigin).href
        : "",
    }));
}

// Todo Get Product by store id

export async function getHomeProducts(storeId, { signal } = {}) {
  const { data } = await api.get(
    `/products/store/${encodeURIComponent(storeId)}`,
    {
      authScope: "none",
      signal,
    }
  );

  if (data.success !== true || !Array.isArray(data.data)) {
    throw new Error(data.message || "Unable to load products.");
  }

  const backendOrigin = new URL(
    api.defaults.baseURL || "/",
    window.location.origin
  ).origin;

  return data.data
    .filter(
      (product) =>
        Number(product.is_active) === 1 &&
        String(product.store_id) === String(storeId)
    )
    .map((product) => ({
      ...product,
      price: product.base_price,
      image_url: product.product_image
        ? new URL(product.product_image, backendOrigin).href
        : "",
    }));
}