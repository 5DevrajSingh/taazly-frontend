import { useRef, useState } from "react";
import { createStore } from "../../services/storeService";

const initialForm = {
  name: "",
  slug: "",
  storeCode: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  latitude: "",
  longitude: "",
  openingTime: "08:00",
  closingTime: "23:00",
  logo: "",
};

const fields = [
  { name: "name", label: "Store Name", required: true },
  { name: "slug", label: "Slug", required: true },
  { name: "storeCode", label: "Store Code", required: true },
  {
    name: "phone",
    label: "Phone",
    type: "tel",
    required: true,
    pattern: "[0-9]{10}",
    maxLength: 10,
    title: "Enter a 10-digit phone number",
  },
  { name: "email", label: "Email", type: "email", required: true },
  {
    name: "addressLine1",
    label: "Address Line 1",
    required: true,
    wide: true,
  },
  { name: "addressLine2", label: "Address Line 2", wide: true },
  { name: "city", label: "City", required: true },
  { name: "state", label: "State", required: true },
  {
    name: "pincode",
    label: "Pincode",
    required: true,
    pattern: "[0-9]{6}",
    maxLength: 6,
    title: "Enter a 6-digit pincode",
  },
  {
    name: "latitude",
    label: "Latitude",
    type: "number",
    required: true,
    min: -90,
    max: 90,
    step: "any",
  },
  {
    name: "longitude",
    label: "Longitude",
    type: "number",
    required: true,
    min: -180,
    max: 180,
    step: "any",
  },
  {
    name: "openingTime",
    label: "Opening Time",
    type: "time",
    required: true,
  },
  {
    name: "closingTime",
    label: "Closing Time",
    type: "time",
    required: true,
  },
  { name: "logo", label: "Logo URL (optional)", type: "url", wide: true },
];

function AddStoreModal({ onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting.current) return;

    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim()])
    );

    const requiredFields = fields.filter((field) => field.required);

    if (requiredFields.some((field) => !payload[field.name])) {
      setError("Please fill all required fields.");
      return;
    }

    payload.latitude = Number(payload.latitude);
    payload.longitude = Number(payload.longitude);

    if (
      !Number.isFinite(payload.latitude) ||
      payload.latitude < -90 ||
      payload.latitude > 90 ||
      !Number.isFinite(payload.longitude) ||
      payload.longitude < -180 ||
      payload.longitude > 180
    ) {
      setError("Please enter valid latitude and longitude.");
      return;
    }

    payload.openingTime =
      payload.openingTime.length === 5
        ? `${payload.openingTime}:00`
        : payload.openingTime;

    payload.closingTime =
      payload.closingTime.length === 5
        ? `${payload.closingTime}:00`
        : payload.closingTime;

    payload.logo = payload.logo || null;

    submitting.current = true;
    setSaving(true);
    setError("");

    let result;

    try {
      result = await createStore(payload);

      if (!result?.success) {
        throw new Error(result?.message || "Failed to create store.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to create store. Please try again."
      );

      submitting.current = false;
      setSaving(false);
      return;
    }

    submitting.current = false;
    setSaving(false);
    onCreated(result);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-store-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) {
            event.stopPropagation();
            onClose();
          }

          if (event.key === "Tab") {
            const controls = Array.from(
              event.currentTarget.querySelectorAll(
                "button:not(:disabled), input:not(:disabled)"
              )
            );

            const first = controls[0];
            const last = controls[controls.length - 1];

            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (
              !event.shiftKey &&
              document.activeElement === last
            ) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2
              id="add-store-title"
              className="text-xl font-bold text-slate-900"
            >
              Add Store
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter the details of your new TAAZLY store.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close add store form"
            className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto p-6"
          aria-busy={saving}
        >
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {error}
            </div>
          )}

          <fieldset disabled={saving}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className={field.wide ? "sm:col-span-2" : ""}
                >
                  <label
                    htmlFor={`store-${field.name}`}
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    {field.label}
                    {field.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>

                  <input
                    id={`store-${field.name}`}
                    name={field.name}
                    type={field.type || "text"}
                    value={form[field.name]}
                    onChange={handleChange}
                    required={field.required}
                    pattern={field.pattern}
                    maxLength={field.maxLength}
                    title={field.title}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    autoFocus={field.name === "name"}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 disabled:bg-slate-50"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Store"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AddStoreModal;