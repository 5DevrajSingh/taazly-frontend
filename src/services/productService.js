import api from "./api";

const storePath = (storeId) =>
  `/products/store/${encodeURIComponent(storeId)}`;

const productPath = (storeId, id) =>
  `${storePath(storeId)}/${encodeURIComponent(id)}`;

// List products.
export const getProducts = async (storeId, { signal } = {}) => {
  const response = await api.get(storePath(storeId), { signal });
  return response.data;
};

// Product details and image gallery.
export const getProduct = async (storeId, id, { signal } = {}) => {
  const response = await api.get(productPath(storeId, id), {
    signal,
  });
  return response.data;
};

// Create product.
export const createProduct = async (storeId, payload) => {
  const response = await api.post(storePath(storeId), payload);
  return response.data;
};

// Update product details.
export const updateProduct = async (storeId, id, payload) => {
  const response = await api.put(
    productPath(storeId, id),
    payload
  );
  return response.data;
};

// Deactivate product.
export const deactivateProduct = async (storeId, id) => {
  const response = await api.delete(productPath(storeId, id));
  return response.data;
};

// Activate product.
export const activateProduct = async (storeId, id) => {
  const response = await api.patch(
    `${productPath(storeId, id)}/activate`
  );
  return response.data;
};

// Upload multiple images.
export const uploadProductImages = async (storeId, id, files) => {
  const selectedFiles = Array.from(files || []);

  if (!selectedFiles.length) {
    throw new Error("Please select at least one image.");
  }

  if (selectedFiles.length > 10) {
    throw new Error("You can upload up to 10 images at a time.");
  }

  const formData = new FormData();

  selectedFiles.forEach((file) => {
    formData.append("product_images", file);
  });

  const response = await api.post(
    `${productPath(storeId, id)}/images`,
    formData,
    {
      headers: {
        "Content-Type": undefined,
      },
    }
  );

  return response.data;
};

// Reorder using product_images.id.
export const reorderProductImages = async (
  storeId,
  id,
  imageIds
) => {
  const response = await api.patch(
    `${productPath(storeId, id)}/images/order`,
    {
      image_ids: imageIds.map((imageId) => Number(imageId)),
    }
  );

  return response.data;
};

// Delete an individual image.
export const deleteProductImage = async (
  storeId,
  id,
  imageId
) => {
  const response = await api.delete(
    `${productPath(storeId, id)}/images/${encodeURIComponent(imageId)}`
  );

  return response.data;
};