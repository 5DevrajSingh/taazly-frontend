import api from "./api";

export const getDeliveryPartners = async (
  storeId = "all",
  { signal } = {}
) => {
  const response = await api.get("/delivery-partners", {
    params: storeId === "all" ? {} : { store_id: storeId },
    signal,
  });

  return response.data;
};

export const getDeliveryPartner = async (id, { signal } = {}) => {
  const response = await api.get(
    `/delivery-partners/${encodeURIComponent(id)}`,
    { signal }
  );

  return response.data;
};

export const verifyDeliveryPartner = async (id) => {
  const response = await api.patch(
    `/delivery-partners/${encodeURIComponent(id)}/verify`
  );

  return response.data;
};

export const rejectDeliveryPartner = async (id) => {
  const response = await api.patch(
    `/delivery-partners/${encodeURIComponent(id)}/reject`
  );

  return response.data;
};