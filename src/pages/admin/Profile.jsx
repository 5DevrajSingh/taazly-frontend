import { useEffect, useRef, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";

import {
  getProfileSession,
  getMyProfile,
  updateMyProfile,
  updateMyProfileImage,
  getProfileImageUrl,
  syncProfileSession,
} from "../../services/profileService";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:bg-slate-50 disabled:text-slate-500";

function makeForm(user) {
  return {
    full_name: user?.full_name || "",
    email: user?.email || "",
    mobile: user?.mobile || "",
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN");
}

function sessionMatches(session) {
  const current = getProfileSession();

  return (
    !current.error &&
    current.token === session.token &&
    current.role === session.role &&
    String(current.user?.id) === String(session.user?.id)
  );
}

function validateProfile(result, session) {
  const profile = result?.data;

  if (
    !profile?.user ||
    profile.user.role !== session.role ||
    String(profile.user.id) !== String(session.user?.id)
  ) {
    throw new Error("Invalid profile response.");
  }

  return profile;
}

function Profile() {
  const [session] = useState(getProfileSession);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(() => makeForm(session.user));

  const [loading, setLoading] = useState(!session.error);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageSaving, setImageSaving] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [failedImageUrl, setFailedImageUrl] = useState("");

  const submitting = useRef(false);
  const imageInputRef = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  // Load current user's details and existing profile image.
  useEffect(() => {
    if (session.error) return;

    const controller = new AbortController();
    let active = true;

    async function fetchProfile() {
      setLoading(true);
      setError("");

      try {
        if (!sessionMatches(session)) {
          throw new Error(
            "Your login session changed. Please reload the page."
          );
        }

        const result = await getMyProfile({
          token: session.token,
          signal: controller.signal,
        });

        if (!active || controller.signal.aborted) return;

        if (!sessionMatches(session)) {
          throw new Error(
            "Your login session changed. Please reload the page."
          );
        }

        const loadedProfile = validateProfile(result, session);

        setProfile(loadedProfile);
        setForm(makeForm(loadedProfile.user));
        setFailedImageUrl("");

        syncProfileSession(loadedProfile, session);
      } catch (err) {
        if (!active || controller.signal.aborted) return;

        setError(err.message || "Unable to load profile.");
      } finally {
        if (active && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      active = false;
      controller.abort();
    };
  }, [session, refreshKey]);

  // Create and release the selected image preview URL.
  useEffect(() => {
    if (!selectedImage) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(selectedImage);

    setImagePreview(previewUrl);
    setFailedImageUrl("");

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImage]);

  const user = profile?.user || session.user;
  const store = profile?.store;

  const busy = saving || imageSaving;

  const imageUrl = getProfileImageUrl(user?.profile_img);
  const displayedImageUrl = imagePreview || imageUrl;

  const showProfileImage =
    Boolean(displayedImageUrl) &&
    displayedImageUrl !== failedImageUrl;

  const profileInitial =
    Array.from(user?.full_name?.trim() || "")[0]?.toUpperCase() ||
    "U";

  const isActive =
    user?.is_active === true || Number(user?.is_active) === 1;

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFormError("");
    setMessage("");
  }

  function resetForm() {
    if (submitting.current) return;

    setForm(makeForm(profile?.user));
    setFormError("");
    setMessage("");
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    if (submitting.current || loading || !profile?.user) return;

    setFormError("");
    setMessage("");

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim(),
    };

    if (!payload.full_name || payload.full_name.length > 100) {
      setFormError("Enter a name between 1 and 100 characters.");
      return;
    }

    if (
      payload.email &&
      (payload.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
    ) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!/^\d{10}$/.test(payload.mobile)) {
      setFormError("Mobile number must contain 10 digits.");
      return;
    }

    if (!sessionMatches(session)) {
      setFormError(
        "Your login session changed. Please reload the page."
      );
      return;
    }

    submitting.current = true;
    setSaving(true);

    try {
      const result = await updateMyProfile(payload, {
        token: session.token,
      });

      if (!mounted.current) return;

      if (!sessionMatches(session)) {
        throw new Error(
          "Your login session changed. Please reload the page."
        );
      }

      const updatedProfile = validateProfile(result, session);

      setProfile(updatedProfile);
      setForm(makeForm(updatedProfile.user));

      syncProfileSession(updatedProfile, session);

      setMessage(
        result.message || "Profile updated successfully."
      );
    } catch (err) {
      if (mounted.current) {
        setFormError(err.message || "Unable to update profile.");
      }
    } finally {
      submitting.current = false;

      if (mounted.current) setSaving(false);
    }
  }

  function handleImageSelect(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || submitting.current) return;

    setImageError("");
    setImageMessage("");

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setImageError("Only JPG, PNG and WebP images are allowed.");
      return;
    }

    if (file.size === 0) {
      setImageError("Please select a valid image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError("Profile image must be within 5 MB.");
      return;
    }

    setSelectedImage(file);
  }

  function cancelImageSelection() {
    if (submitting.current) return;

    setSelectedImage(null);
    setImagePreview("");
    setFailedImageUrl("");
    setImageError("");
    setImageMessage("");

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  async function handleImageUpload() {
    if (submitting.current || loading || !profile?.user) return;

    setImageError("");
    setImageMessage("");

    if (!selectedImage) {
      setImageError("Please select a profile image.");
      return;
    }

    if (!sessionMatches(session)) {
      setImageError(
        "Your login session changed. Please reload the page."
      );
      return;
    }

    submitting.current = true;
    setImageSaving(true);

    try {
      const result = await updateMyProfileImage(selectedImage, {
        token: session.token,
      });

      if (!mounted.current) return;

      if (!sessionMatches(session)) {
        throw new Error(
          "Your login session changed. Please reload the page."
        );
      }

      const uploadedImage = result.data;

      if (
        String(uploadedImage?.user_id) !== String(profile.user.id) ||
        !uploadedImage?.profile_img
      ) {
        throw new Error("Invalid profile image response.");
      }

      const updatedProfile = {
        ...profile,
        user: {
          ...profile.user,
          profile_img: uploadedImage.profile_img,
        },
      };

      setProfile(updatedProfile);
      syncProfileSession(updatedProfile, session);

      setSelectedImage(null);
      setImagePreview("");
      setFailedImageUrl("");

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      setImageMessage(
        result.message || "Profile image updated successfully."
      );
    } catch (err) {
      if (mounted.current) {
        setImageError(
          err.message || "Unable to update profile image."
        );
      }
    } finally {
      submitting.current = false;

      if (mounted.current) setImageSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f0fdf4]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-8">
            <p className="mb-1 text-sm font-semibold text-green-600">
              Account
            </p>

            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              My Profile
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Update your personal details and profile photo.
            </p>
          </div>

          {session.error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-600"
            >
              {session.error}
            </div>
          ) : loading ? (
            <div
              role="status"
              className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl bg-white p-6"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />

              <p className="text-sm text-slate-500">
                Loading profile...
              </p>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-2xl bg-white p-8 text-center"
            >
              <p className="text-sm text-red-600">{error}</p>

              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                className="mt-4 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-3">
              {/* Profile photo and account information */}
              <div className="space-y-6">
                <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col items-center">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-green-100 bg-green-50">
                      {showProfileImage ? (
                        <img
                          src={displayedImageUrl}
                          alt={`${user?.full_name || "User"} profile`}
                          onError={() =>
                            setFailedImageUrl(displayedImageUrl)
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          aria-label={`${user?.full_name || "User"} profile`}
                          className="text-4xl font-bold text-green-700"
                        >
                          {profileInitial}
                        </span>
                      )}
                    </div>

                    <h2 className="mt-4 text-center text-lg font-bold text-slate-900">
                      {user?.full_name || "User"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {session.role === "admin"
                        ? "Admin"
                        : "Store Manager"}
                    </p>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageSelect}
                      disabled={busy}
                      aria-label="Select profile image"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={busy}
                      className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {selectedImage
                        ? "Choose Another Photo"
                        : "Change Photo"}
                    </button>

                    <p className="mt-2 text-center text-xs text-slate-400">
                      JPG, PNG or WebP · Maximum 5 MB
                    </p>

                    {selectedImage && (
                      <>
                        <p className="mt-3 max-w-full break-all text-center text-xs text-slate-500">
                          {selectedImage.name}
                        </p>

                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={cancelImageSelection}
                            disabled={busy}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={handleImageUpload}
                            disabled={busy}
                            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {imageSaving
                              ? "Uploading..."
                              : "Upload Photo"}
                          </button>
                        </div>
                      </>
                    )}

                    {imageError && (
                      <p
                        role="alert"
                        className="mt-3 text-center text-sm text-red-600"
                      >
                        {imageError}
                      </p>
                    )}

                    {imageMessage && (
                      <p
                        role="status"
                        className="mt-3 text-center text-sm text-green-700"
                      >
                        {imageMessage}
                      </p>
                    )}
                  </div>

                  <dl className="mt-6 space-y-4 border-t border-slate-100 pt-5 text-sm">
                    <div>
                      <dt className="text-xs text-slate-400">
                        Mobile
                      </dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {user?.mobile || "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-400">
                        Joined
                      </dt>
                      <dd className="mt-1 text-slate-700">
                        {formatDate(user?.created_at)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-400">
                        Last Login
                      </dt>
                      <dd className="mt-1 text-slate-700">
                        {formatDate(user?.last_login_at)}
                      </dd>
                    </div>
                  </dl>
                </section>

                {session.role === "store_manager" && (
                  <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
                    <h2 className="font-bold text-slate-900">
                      Assigned Store
                    </h2>

                    {store ? (
                      <div className="mt-4 space-y-2 text-sm">
                        <p className="font-semibold text-green-700">
                          {store.name}
                        </p>

                        <p className="text-slate-500">
                          Store ID: {store.id}
                        </p>

                        {store.address && (
                          <p className="text-slate-500">
                            {store.address}
                          </p>
                        )}

                        {store.city && (
                          <p className="text-slate-500">
                            {store.city}
                            {store.pincode
                              ? ` - ${store.pincode}`
                              : ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        No store is currently assigned.
                      </p>
                    )}
                  </section>
                )}
              </div>

              {/* Personal details form */}
              <section className="rounded-2xl border border-green-100 bg-white shadow-sm lg:col-span-2">
                <div className="border-b border-slate-100 px-6 py-5">
                  <h2 className="text-lg font-bold text-slate-900">
                    Personal Details
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Keep your account information up to date.
                  </p>
                </div>

                <form
                  onSubmit={handleSaveProfile}
                  aria-busy={saving}
                  className="p-6"
                >
                  {formError && (
                    <div
                      role="alert"
                      className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
                    >
                      {formError}
                    </div>
                  )}

                  {message && (
                    <div
                      role="status"
                      className="mb-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700"
                    >
                      {message}
                    </div>
                  )}

                  <fieldset
                    disabled={busy}
                    className="grid gap-5 sm:grid-cols-2"
                  >
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="profile-name"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Full Name *
                      </label>

                      <input
                        id="profile-name"
                        name="full_name"
                        autoComplete="name"
                        value={form.full_name}
                        onChange={handleFormChange}
                        maxLength={100}
                        required
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-email"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Email
                      </label>

                      <input
                        id="profile-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={handleFormChange}
                        maxLength={254}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-mobile"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Mobile *
                      </label>

                      <input
                        id="profile-mobile"
                        name="mobile"
                        type="tel"
                        autoComplete="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        value={form.mobile}
                        onChange={handleFormChange}
                        required
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-role"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Role
                      </label>

                      <input
                        id="profile-role"
                        value={
                          session.role === "admin"
                            ? "Admin"
                            : "Store Manager"
                        }
                        disabled
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-status"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Account Status
                      </label>

                      <input
                        id="profile-status"
                        value={isActive ? "Active" : "Inactive"}
                        disabled
                        className={inputClass}
                      />
                    </div>
                  </fieldset>

                  <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={busy}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reset
                    </button>

                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Profile;