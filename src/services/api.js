import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    // A service can explicitly select its session:
    // api.get("/some-path", { authScope: "customer" })
    const scope =
      config.authScope ||
      (/^\/(admin|manager)(\/|$)/.test(window.location.pathname)
        ? "panel"
        : "customer");

    let token = null;

    switch (scope) {
      case "admin":
        token = localStorage.getItem("admin_token");
        break;

      case "manager":
        token = localStorage.getItem("manager_token");
        break;

      case "panel":
        token =
          localStorage.getItem("admin_token") ||
          localStorage.getItem("manager_token");
        break;

      case "customer":
        token = localStorage.getItem("customer_token");
        break;

      case "none":
        break;

      default:
        return Promise.reject(
          new Error(`Unknown auth scope: ${scope}`)
        );
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;