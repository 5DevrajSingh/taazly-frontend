import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, managerLogin } from "../../services/authService";

function AdminLogin() {
  const [loginType, setLoginType] = useState("admin");
  const navigate = useNavigate();



  const [formData, setFormData] = useState({
    mobile: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    const mobile = formData.mobile.trim();

    if (!/^\d{10}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);

    try {
      const loginApi =
        loginType === "admin" ? adminLogin : managerLogin;

      const data = await loginApi(mobile, formData.password);

      if (!data.success) {
        setError(data.message || "Login failed.");
        return;
      }

      const token = data.data?.token;
      const user = data.data?.user;
      const store = data.data?.store;

      if (!token || !user) {
        setError("Login response is missing token or user details.");
        return;
      }

      // Match these manager role names with your backend response.
      const isAuthorized =
        loginType === "admin"
          ? user.role === "admin"
          : ["manager", "store_manager"].includes(user.role);

      if (!isAuthorized) {
        setError(
          `This account cannot access the ${loginType === "admin" ? "Admin" : "Store Manager"
          } panel.`
        );
        return;
      }
      if (loginType === "manager" && !store?.id) {
        setError(
          "No store is assigned to this manager. Please contact admin."
        );
        return;
      }

      // Clear the previous panel session after successful login.
      [
        "admin_token",
        "admin_user",
        "manager_token",
        "manager_user",
        "manager_store",
      ].forEach((key) => localStorage.removeItem(key));

      localStorage.setItem(`${loginType}_token`, token);

      localStorage.setItem(
        `${loginType}_user`,
        JSON.stringify(user)
      );

      if (loginType === "manager") {
        localStorage.setItem(
          "manager_store",
          JSON.stringify(store)
        );
      }

      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0fdf4] flex items-center justify-center p-4">

      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl">

        <div className="grid min-h-[650px] md:grid-cols-2">

          {/* =========================================
              LEFT - VEGETABLE IMAGE
          ========================================= */}

          <div className="relative hidden overflow-hidden md:block">

            <img
              src="https://images.pexels.com/photos/5202219/pexels-photo-5202219.jpeg?cs=srgb&dl=pexels-karola-g-5202219.jpg&fm=jpg"
              alt="Fresh vegetables"
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Green Overlay */}

            <div className="absolute inset-0 bg-gradient-to-br from-green-950/75 via-green-900/45 to-green-800/20" />

            {/* Content */}

            <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">

              {/* Logo */}

              <div>
                <div className="flex items-center gap-3">

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-lg">
                    🥬
                  </div>

                  <div>
                    <h1 className="text-2xl font-extrabold tracking-wide">
                      TAAZLY
                    </h1>

                    <p className="text-xs font-medium text-green-100">
                      Fresh • Fast • Delivered
                    </p>
                  </div>

                </div>
              </div>

              {/* Bottom Content */}

              <div className="max-w-md">

                <div className="mb-4 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-md">
                  🥦 Fresh groceries at your fingertips
                </div>

                <h2 className="text-4xl font-bold leading-tight lg:text-5xl">
                  Freshness
                  <br />
                  delivered daily.
                </h2>

                <p className="mt-5 max-w-sm text-base leading-7 text-green-50">
                  Manage your stores, products, orders and
                  customers from one powerful admin panel.
                </p>

              </div>

            </div>
          </div>


          {/* =========================================
              RIGHT - LOGIN FORM
          ========================================= */}

          <div className="flex items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-16">

            <div className="w-full max-w-md">

              {/* Mobile Logo */}

              <div className="mb-8 flex items-center gap-3 md:hidden">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-xl">
                  🥬
                </div>

                <div>
                  <h1 className="text-xl font-extrabold text-green-800">
                    TAAZLY
                  </h1>

                  <p className="text-xs text-green-600">
                    Fresh • Fast • Delivered
                  </p>
                </div>

              </div>


              {/* Heading */}

              <div className="mb-8">

                {loginType === "admin" ? "Admin Portal" : "Store Manager Portal"}

                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Welcome back 👋
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Login to manage your TAAZLY grocery
                  operations.
                </p>

              </div>

              {/* Login Type */}
              <div>
                <label
                  htmlFor="loginType"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Login As
                </label>

                <select
                  id="loginType"
                  value={loginType}
                  disabled={loading}
                  onChange={(e) => {
                    setLoginType(e.target.value);
                    setError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100 disabled:opacity-60"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Store Manager</option>
                </select>
              </div>

              {/* Login Form */}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >

                {/* Mobile */}

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Mobile Number
                  </label>

                  <div className="relative">

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                      📱
                    </span>

                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleChange}
                      placeholder="Enter mobile number"
                      maxLength="10"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                    />

                  </div>

                </div>


                {/* Password */}

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>

                  <div className="relative">

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                      🔒
                    </span>

                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter password"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                    />

                  </div>

                </div>


                {/* Error */}

                {error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {error}
                  </div>
                )}


                {/* Login Button */}

                <button
                  type="submit"
                  disabled={loading}
                  className="group w-full rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-200 transition hover:bg-green-700 hover:shadow-green-300 disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Logging in...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Login to Dashboard
                      <span className="transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  )}

                </button>

              </form>


              {/* Footer */}

              <div className="mt-8 border-t border-slate-100 pt-6 text-center">

                <p className="text-xs text-slate-400">
                  © 2026 TAAZLY. All rights reserved.
                </p>

                <p className="mt-1 text-xs text-green-600">
                  Fresh groceries • Better living
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default AdminLogin;