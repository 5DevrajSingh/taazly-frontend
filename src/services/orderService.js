import api from "./api";

export const getManagementOrders = async ({
  storeId,
  status = "all",
  signal,
} = {}) => {
  const params = {};

  if (storeId && storeId !== "all") {
    params.store_id = storeId;
  }

  if (status !== "all") {
    params.status = status;
  }

  const response = await api.get("/orders/store", {
    params,
    signal,
  });

  return response.data;
};