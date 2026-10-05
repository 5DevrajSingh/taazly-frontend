import api from "./api";

export const adminLogin = async (mobile, password) => {
  const response = await api.post(
    "/auth/admin/login",
    { mobile, password },
    { authScope: "none" }
  );

  return response.data;
};

export const managerLogin = async (mobile, password) => {
  const response = await api.post(
    "/auth/manager/login",
    { mobile, password },
    { authScope: "none" }
  );

  return response.data;
};