import api from "./api";

const storePath = (storeId) =>
  `/inventory/store/${encodeURIComponent(storeId)}`;

const productPath = (storeId, productId) =>
  `${storePath(storeId)}/${encodeURIComponent(productId)}`;

export const getInventory = async (storeId, { signal } = {}) => {
  const response = await api.get(storePath(storeId), { signal });
  return response.data;
};

export const createInventory = async (storeId, payload) => {
  const response = await api.post(storePath(storeId), payload);
  return response.data;
};

export const updateInventory = async (storeId, productId, payload) => {
  const response = await api.put(
    productPath(storeId, productId),
    payload
  );
  return response.data;
};

export const updateStock = async (storeId, productId, quantity) => {
  const response = await api.patch(
    `${productPath(storeId, productId)}/stock`,
    { stock_quantity: quantity }
  );
  return response.data;
};

export const updateAvailability = async (
  storeId,
  productId,
  isAvailable
) => {
  const response = await api.patch(
    `${productPath(storeId, productId)}/availability`,
    { is_available: isAvailable }
  );
  return response.data;
};