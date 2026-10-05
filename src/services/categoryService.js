import api from "./api";

export const getCategories = async (
  storeId = "all",
  { signal } = {}
) => {
  const url =
    storeId === "all"
      ? "/categories"
      : `/categories/store/${encodeURIComponent(storeId)}`;

  const response = await api.get(url, { signal });
  return response.data;
};

export const createCategory = async (storeId, payload) => {
  if (!storeId || storeId === "all") {
    throw new Error("Please select a store.");
  }

  const response = await api.post(
    `/categories/store/${encodeURIComponent(storeId)}`,
    payload
  );

  return response.data;
};

export const updateCategory = async (storeId, id, payload) => {
  const response = await api.put(
    `/categories/store/${encodeURIComponent(storeId)}/${encodeURIComponent(id)}`,
    payload
  );

  return response.data;
};

export const uploadCategoryImage = async (storeId, id, file) => {
  if (!storeId || storeId === "all") {
    throw new Error("Please select a store.");
  }

  if (!id) {
    throw new Error("Category ID is required.");
  }

  if (!file) {
    throw new Error("Please select an image.");
  }

  const formData = new FormData();
  formData.append("category_image", file);

  const response = await api.patch(
    `/categories/store/${encodeURIComponent(storeId)}/${encodeURIComponent(id)}/image`,
    formData,
    {
      // Default JSON Content-Type hatao;
      // browser multipart boundary set karega.
      headers: {
        "Content-Type": undefined,
      },
    }
  );

  return response.data;
};

export const deactivateCategory = async (storeId, id) => {
  const response = await api.delete(
    `/categories/store/${encodeURIComponent(storeId)}/${encodeURIComponent(id)}`
  );

  return response.data;
};

export const activateCategory = async (storeId, id) => {
  const response = await api.patch(
    `/categories/store/${encodeURIComponent(storeId)}/${encodeURIComponent(id)}/activate`
  );

  return response.data;
};