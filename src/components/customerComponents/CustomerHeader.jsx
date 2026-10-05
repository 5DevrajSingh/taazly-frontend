import { useState } from "react";
import { Link } from "react-router-dom";
import CustomerLoginDialog from "./CustomerLoginDialog";

function StoreDropdown({
    stores,
    selectedStore,
    onStoreChange,
    storesLoading,
    storesError,
}) {
    return (
        <label className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-bold text-taazly-secondary">
                Store
            </span>

            <select
                value={selectedStore}
                onChange={(event) => onStoreChange?.(event.target.value)}
                disabled={storesLoading || stores.length === 0}
                className="min-w-0 w-full rounded-xl border border-green-200 bg-taazly-light px-3 py-2 text-sm font-semibold text-taazly-text outline-none focus:border-taazly-primary focus:ring-2 focus:ring-green-100 disabled:opacity-60"
            >
                <option value="" disabled>
                    {storesLoading
                        ? "Loading stores..."
                        : storesError
                            ? "Unable to load stores"
                            : stores.length === 0
                                ? "No active stores"
                                : "Select Store"}
                </option>

                {stores.map((store) => (
                    <option key={store.id} value={String(store.id)}>
                        {store.name}
                    </option>
                ))}
            </select>
        </label>
    );
}



export default function CustomerHeader({
    stores = [],
    selectedStore = "",
    onStoreChange,
    storesLoading = false,
    storesError = "",
}) {
    const [loginOpen, setLoginOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    function handleLogout() {
        localStorage.removeItem("customer_demo_user");
        setCustomer(null);
        setProfileOpen(false);
    }

    const [customer, setCustomer] = useState(() => {
        try {
            return JSON.parse(
                localStorage.getItem("customer_demo_user") || "null"
            );
        } catch {
            return null;
        }
    });

    return (
        <>
            <header className="sticky top-0 z-50 border-b border-taazly-border bg-white">
                <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
                    {/* Logo */}
                    <div className="shrink-0">
                        <Link
                            to="/"
                            aria-label="TAAZLY Home"
                            className="flex shrink-0 items-center"
                        >
                            <img
                                src="/images/logo/taazly_logo2.png"
                                alt="TAAZLY"
                                className="h-10 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[190px]"
                            />
                        </Link>
                    </div>

                    {/* Location */}
                    {/* Desktop store dropdown */}
                    <div className="hidden w-56 shrink-0 md:block">
                        <StoreDropdown
                            stores={stores}
                            selectedStore={selectedStore}
                            onStoreChange={onStoreChange}
                            storesLoading={storesLoading}
                            storesError={storesError}
                        />
                    </div>

                    {/* Search */}
                    <div className="relative min-w-0 flex-1">
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taazly-secondary"
                        >
                            🔍
                        </span>

                        <input
                            type="search"
                            aria-label="Search products"
                            placeholder="Search products..."
                            className="w-full rounded-xl border border-taazly-border bg-taazly-light py-3 pl-10 pr-3 text-sm outline-none transition focus:border-taazly-primary focus:bg-white focus:ring-4 focus:ring-green-50"
                        />
                    </div>

                    {/* Login */}
                    {customer ? (
                        <div
                            className="relative shrink-0"
                            onMouseEnter={() => setProfileOpen(true)}
                            onMouseLeave={() => setProfileOpen(false)}
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                    setProfileOpen(false);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                    setProfileOpen(false);
                                    event.currentTarget.querySelector("button")?.focus();
                                }
                            }}
                        >
                            <button
                                type="button"
                                aria-expanded={profileOpen}
                                aria-controls="customer-account-dropdown"
                                onFocus={() => setProfileOpen(true)}
                                onClick={() => setProfileOpen(true)}
                                className="flex items-center gap-2 rounded-xl bg-taazly-light px-3 py-2 text-taazly-primary transition hover:bg-green-100"
                            >
                                <span className="max-w-20 truncate text-xs font-semibold sm:max-w-32 sm:text-sm">
                                    {customer.full_name}
                                </span>

                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className={`h-4 w-4 transition-transform ${profileOpen ? "rotate-180" : ""
                                        }`}
                                >
                                    <path
                                        d="m6 9 6 6 6-6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>

                            {profileOpen && (
                                <div
                                    id="customer-account-dropdown"
                                    className="absolute right-0 top-full z-50 w-56 pt-2"
                                >
                                    <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-lg shadow-green-100/60">
                                        <div className="border-b border-green-100 bg-taazly-light px-4 py-3">
                                            <p className="truncate text-sm font-bold text-taazly-text">
                                                {customer.full_name}
                                            </p>

                                            <p className="mt-1 text-xs text-taazly-secondary">
                                                +91 {customer.mobile}
                                            </p>
                                        </div>

                                        <nav aria-label="My account" className="p-2">
                                            {[
                                                { label: "My Profile", path: "/account/profile" },
                                                { label: "My Addresses", path: "/account/addresses" },
                                                { label: "My Orders", path: "/account/orders" },
                                                { label: "Wishlist", path: "/account/wishlist" },
                                            ].map((item) => (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    onClick={() => setProfileOpen(false)}
                                                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-taazly-text transition hover:bg-taazly-light hover:text-taazly-primary focus-visible:bg-taazly-light"
                                                >
                                                    {item.label}
                                                </Link>
                                            ))}

                                            <div className="my-1 border-t border-green-100" />

                                            <button
                                                type="button"
                                                onClick={handleLogout}
                                                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                                            >
                                                Logout
                                            </button>
                                        </nav>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setLoginOpen(true)}
                            className="shrink-0 rounded-xl px-2 py-2 text-xs font-semibold text-taazly-text transition hover:bg-taazly-light sm:px-4 sm:text-sm"
                        >
                            Login
                        </button>
                    )}

                    {/* Cart */}
                    <button
                        type="button"
                        aria-label="Cart, 0 items"
                        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-taazly-primary text-white shadow-md transition hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taazly-primary"
                    >
                        <svg
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-6 w-6"
                        >
                            <path d="M2 3h2l3 12h11l3-9H5" />
                            <circle cx="9" cy="20" r="1" />
                            <circle cx="18" cy="20" r="1" />
                        </svg>

                        <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-taazly-accent px-1 text-xs font-bold text-white ring-2 ring-white">
                            0
                        </span>
                    </button>
                </div>

                {/* Mobile store dropdown */}
                <div className="border-t border-green-100 px-4 py-2 md:hidden">
                    <StoreDropdown
                        stores={stores}
                        selectedStore={selectedStore}
                        onStoreChange={onStoreChange}
                        storesLoading={storesLoading}
                        storesError={storesError}
                    />
                </div>
            </header>
            {loginOpen && (
                <CustomerLoginDialog
                    onClose={() => setLoginOpen(false)}
                    onLogin={setCustomer}
                />
            )}
        </>

    );
}