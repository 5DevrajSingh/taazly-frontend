import api from "./api";

export const getCustomers = async (
  storeId = "all",
  { signal } = {}
) => {
  const params = {};

  if (storeId !== "all") {
    params.store_id = storeId;
  }

  const response = await api.get("/admin/customers", {
    params,
    signal,
  });

  return response.data;
};

export const updateCustomerStatus = async (id, isActive) => {
  const response = await api.patch(
    `/admin/customers/${encodeURIComponent(id)}/status`,
    { is_active: isActive }
  );

  return response.data;
};