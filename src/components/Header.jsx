import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  getProfileSession,
  getProfileImageUrl,
} from "../services/profileService";

function Header({ onMenuClick }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const [user, setUser] = useState(
    () => getProfileSession().user
  );

  const profileRef = useRef(null);

  // Update Header when profile details or image change.
  useEffect(() => {
    function refreshUser() {
      setUser(getProfileSession().user);
      setFailedImageUrl("");
    }

    window.addEventListener("profile-updated", refreshUser);
    window.addEventListener("storage", refreshUser);

    return () => {
      window.removeEventListener("profile-updated", refreshUser);
      window.removeEventListener("storage", refreshUser);
    };
  }, []);

  // Close dropdown on outside click or Escape.
  useEffect(() => {
    if (!profileOpen) return;

    function handleOutsideClick(event) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick
      );
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  const profileImageUrl = getProfileImageUrl(user?.profile_img);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "store_manager";

  const displayName =
    user?.full_name ||
    (isAdmin
      ? "TAAZLY Admin"
      : isManager
        ? "Store Manager"
        : "User");

  const roleLabel = isAdmin
    ? "Administrator"
    : isManager
      ? "Store Manager"
      : "User";

  const nameInitial =
    Array.from(displayName.trim())[0]?.toUpperCase() || "U";

  function handleLogout() {
    [
      "admin_token",
      "admin_user",
      "manager_token",
      "manager_user",
      "manager_store",
      "active_role",
    ].forEach((key) => localStorage.removeItem(key));

    window.location.replace("/admin");
  }

  return (
    <header className="sticky top-0 z-30 h-20 border-b border-green-100 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-xl text-green-700 lg:hidden"
          >
            ☰
          </button>

          <div className="hidden sm:block">
            <div className="relative w-64 lg:w-80">
              <span
                aria-hidden="true"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                🔍
              </span>

              <input
                type="text"
                aria-label="Search"
                placeholder="Search anything..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-50"
              />
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Search"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-slate-500 hover:bg-green-50 hover:text-green-700 sm:hidden"
          >
            🔍
          </button>

          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-xl text-slate-500 transition hover:bg-green-50 hover:text-green-700"
          >
            🔔

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          <div className="hidden h-8 w-px bg-slate-200 sm:block" />

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((previous) => !previous)}
              aria-label="Open account menu"
              aria-expanded={profileOpen}
              aria-controls="header-profile-dropdown"
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-green-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-100 font-bold text-green-700">
                {profileImageUrl &&
                failedImageUrl !== profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={`${displayName} profile`}
                    onError={() =>
                      setFailedImageUrl(profileImageUrl)
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{nameInitial}</span>
                )}
              </div>

              <div className="hidden text-left md:block">
                <p className="max-w-[140px] truncate text-sm font-semibold text-slate-800">
                  {displayName}
                </p>

                <p className="text-xs text-slate-400">
                  {roleLabel}
                </p>
              </div>

              <span
                aria-hidden="true"
                className="hidden text-xs text-slate-400 md:block"
              >
                ▼
              </span>
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <div
                id="header-profile-dropdown"
                className="absolute right-0 top-14 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl"
              >
                <div className="border-b border-slate-100 px-4 py-4">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {displayName}
                  </p>

                  <p className="mt-1 truncate text-xs text-slate-400">
                    {user?.email || user?.mobile || roleLabel}
                  </p>
                </div>

                <div className="p-2">
                  <Link
                    to="/admin/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-green-50 hover:text-green-700"
                  >
                    <span aria-hidden="true">👤</span>
                    <span>My Profile</span>
                  </Link>

                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-green-50 hover:text-green-700"
                  >
                    <span aria-hidden="true">⚙️</span>
                    <span>Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-500 hover:bg-red-50"
                  >
                    <span aria-hidden="true">🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;