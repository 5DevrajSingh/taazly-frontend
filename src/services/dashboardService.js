import api from "./api";

export const getAdminDashboard = async (storeId = "all") => {
  let url = "/dashboard/admin";

  // Only send store_id when a real store is selected
  if (
    storeId !== null &&
    storeId !== undefined &&
    storeId !== "all" &&
    storeId !== ""
  ) {
    url += `?store_id=${storeId}`;
  }

  const response = await api.get(url);

  return response.data;
};