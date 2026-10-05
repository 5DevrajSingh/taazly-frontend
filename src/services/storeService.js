import api from "./api";

export const getAdminStores = async () => {
  const response = await api.get("/admin/stores");

  return response.data;
};

export const createStore = async (payload) => {
  const response = await api.post("/stores", payload);
  return response.data;
};