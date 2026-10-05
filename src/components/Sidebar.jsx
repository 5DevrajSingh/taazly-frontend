import { NavLink } from "react-router-dom";

const menuItems = [
  {
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: "📊",
  },
  {
    label: "Stores",
    path: "/admin/stores",
    icon: "🏪",
    adminOnly: true,
  },

  {
    label: "Store Managers",
    path: "/admin/store-managers",
    icon: "👨‍💼",
    adminOnly: true,
  },

  {
    label: "Categories",
    path: "/admin/categories",
    icon: "🗂️",
  },
  {
    label: "Products",
    path: "/admin/products",
    icon: "📦",
  },
  {
    label: "Inventory",
    path: "/admin/inventory",
    icon: "🛒",
  },
  {
    label: "Orders",
    path: "/admin/orders",
    icon: "🧾",
  },
  {
    label: "Customers",
    path: "/admin/customers",
    icon: "👥",
  },
  {
    label: "Delivery Partners",
    path: "/admin/delivery-partners",
    icon: "🚴",
  },
];

function Sidebar({ isOpen, onClose }) {
  let user = null;

  try {
    const userKey = localStorage.getItem("admin_token")
      ? "admin_user"
      : "manager_user";

    user = JSON.parse(
      localStorage.getItem(userKey) || "null"
    );
  } catch {
    user = null;
  }

  const isAdmin = user?.role === "admin";

  const visibleMenuItems = menuItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const handleLogout = () => {
    [
      "admin_token",
      "admin_user",
      "manager_token",
      "manager_user",
      "manager_store",
    ].forEach((key) => localStorage.removeItem(key));

    window.location.href = "/admin";
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col
          border-r border-green-100 bg-white
          transition-transform duration-300
          lg:static lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex h-20 items-center border-b border-green-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-2xl">
              🥬
            </div>

            <div>
              <h1 className="text-xl font-extrabold tracking-wide text-green-700">
                TAAZLY
              </h1>

              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {isAdmin ? "Admin Panel" : "Store Manager Panel"}
              </p>
            </div>
          </div>

          {/* Mobile Close */}
          <button
            onClick={onClose}
            className="ml-auto text-xl text-slate-400 lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Main Menu
          </p>

          <div className="space-y-1">
            {visibleMenuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `
                  group flex items-center gap-3 rounded-xl px-3 py-3
                  text-sm font-medium transition
                  ${isActive
                    ? "bg-green-600 text-white shadow-md shadow-green-100"
                    : "text-slate-600 hover:bg-green-50 hover:text-green-700"
                  }
                  `
                }
              >
                <span className="flex w-6 justify-center text-lg">
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="my-6 border-t border-slate-100" />

          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            System
          </p>

          <NavLink
            to="/admin/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `
              flex items-center gap-3 rounded-xl px-3 py-3
              text-sm font-medium transition
              ${isActive
                ? "bg-green-600 text-white"
                : "text-slate-600 hover:bg-green-50 hover:text-green-700"
              }
              `
            }
          >
            <span className="flex w-6 justify-center text-lg">
              ⚙️
            </span>

            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Bottom */}
        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-500 hover:bg-red-50"
          >
            🚪
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;