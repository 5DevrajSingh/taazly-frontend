const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

function readStoredData(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function getProfileSession() {
  const adminUser = readStoredData("admin_user");
  const managerUser = readStoredData("manager_user");

  const adminToken = localStorage.getItem("admin_token");
  const managerToken = localStorage.getItem("manager_token");
  const activeRole = localStorage.getItem("active_role");

  const hasAdmin =
    Boolean(adminToken) && adminUser?.role === "admin";

  const hasManager =
    Boolean(managerToken) &&
    managerUser?.role === "store_manager";

  if (
    (activeRole === "admin" && hasAdmin) ||
    (hasAdmin && !hasManager)
  ) {
    return {
      role: "admin",
      token: adminToken,
      user: adminUser,
      error: "",
    };
  }

  if (
    (activeRole === "store_manager" && hasManager) ||
    (hasManager && !hasAdmin)
  ) {
    return {
      role: "store_manager",
      token: managerToken,
      user: managerUser,
      error: "",
    };
  }

  return {
    role: "",
    token: "",
    user: null,
    error:
      hasAdmin && hasManager
        ? "Both login sessions were found. Please logout and login again."
        : "Invalid login session. Please login again.",
  };
}

function resolveToken(token) {
  if (token) return token;

  const session = getProfileSession();

  if (session.error || !session.token) {
    throw new Error(session.error || "Please login again.");
  }

  return session.token;
}

async function readResponse(response) {
  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid profile API response.");
  }

  if (!response.ok || !result?.success) {
    throw new Error(
      result?.message || "Unable to complete profile request."
    );
  }

  return result;
}

async function requestProfile({
  token,
  signal,
  payload,
} = {}) {
  const hasPayload = payload !== undefined;

  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: hasPayload ? "PATCH" : "GET",
    headers: {
      Authorization: `Bearer ${resolveToken(token)}`,
      ...(hasPayload
        ? { "Content-Type": "application/json" }
        : {}),
    },
    signal,
    ...(hasPayload
      ? { body: JSON.stringify(payload) }
      : {}),
  });

  return readResponse(response);
}

// Fetch current admin/manager profile.
export function getMyProfile(options = {}) {
  return requestProfile(options);
}

// Update name, email and mobile.
export function updateMyProfile(payload, options = {}) {
  return requestProfile({
    ...options,
    payload,
  });
}

// Upload current user's profile image.
export async function updateMyProfileImage(
  file,
  options = {}
) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select an image.");
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPG, PNG and WebP images are allowed.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Profile image must be within 5 MB.");
  }

  const formData = new FormData();

  // Must match uploadProfileImage.single("profile_image").
  formData.append("profile_image", file);

  const response = await fetch(
    `${API_BASE_URL}/auth/me/profile-image`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${resolveToken(options.token)}`,
      },
      body: formData,
      signal: options.signal,
    }
  );

  // Browser sets the multipart Content-Type and boundary.
  return readResponse(response);
}

// Convert stored image path into a public URL.
export function getProfileImageUrl(value) {
  if (!value || typeof value !== "string") return "";

  try {
    const apiUrl = new URL(
      API_BASE_URL,
      window.location.origin
    );

    const imageUrl = new URL(
      value.replace(/\\/g, "/"),
      `${apiUrl.origin}/`
    );

    return ["http:", "https:"].includes(imageUrl.protocol)
      ? imageUrl.href
      : "";
  } catch {
    return "";
  }
}

// Update the current user's locally stored public details.
export function syncProfileSession(profile, session) {
  const current = getProfileSession();
  const user = profile?.user;

  if (
    !user ||
    current.error ||
    current.token !== session.token ||
    current.role !== session.role ||
    user.role !== session.role ||
    String(user.id) !== String(current.user?.id)
  ) {
    return;
  }

  const key =
    session.role === "admin"
      ? "admin_user"
      : "manager_user";

  localStorage.setItem(
    key,
    JSON.stringify({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      profile_img: user.profile_img || null,
      is_active:
        user.is_active === true ||
        Number(user.is_active) === 1,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    })
  );

  // Only update store storage when the response includes store.
  if (
    session.role === "store_manager" &&
    Object.prototype.hasOwnProperty.call(profile, "store")
  ) {
    if (profile.store) {
      localStorage.setItem(
        "manager_store",
        JSON.stringify(profile.store)
      );
    } else {
      localStorage.removeItem("manager_store");
    }
  }

  window.dispatchEvent(
    new CustomEvent("profile-updated", {
      detail: profile,
    })
  );
}