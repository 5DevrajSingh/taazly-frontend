import api from "./api";

export const getStoreManagers = async ({ signal } = {}) => {
  const response = await api.get("/stores/managers", { signal });
  return response.data;
};

export const getManagerStores = async ({ signal } = {}) => {
  const response = await api.get("/stores", { signal });
  return response.data;
};

export const createStoreManager = async (storeId, payload) => {
  const response = await api.post(
    `/stores/${encodeURIComponent(storeId)}/manager`,
    payload
  );

  return response.data;
};

export const assignStoreManager = async (
  storeId,
  managerId,
  replaceExisting = false
) => {
  const response = await api.patch(
    `/stores/${encodeURIComponent(storeId)}/manager`,
    {
      manager_id: Number(managerId),
      replace_existing: replaceExisting,
    }
  );

  return response.data;
};