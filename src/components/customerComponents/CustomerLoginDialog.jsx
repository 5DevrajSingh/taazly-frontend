import { useEffect, useRef, useState } from "react";

export default function CustomerLoginDialog({ onClose, onLogin }) {
  const [step, setStep] = useState("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    dialogRef.current.showModal();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (step === "mobile") {
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        setError("Please enter a valid 10-digit mobile number.");
        return;
      }

      setStep("otp");
      return;
    }

    if (step === "otp") {
      if (otp !== "456852") {
        setError("Incorrect OTP. Use 456852 for this demo.");
        return;
      }

      setStep("name");
      return;
    }

    const fullName = name.trim();

    if (fullName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;

    try {
      const user = {
        full_name: fullName,
        mobile,
      };

      localStorage.setItem("customer_demo_user", JSON.stringify(user));
      onLogin(user);
      onClose();
    } catch {
      submittingRef.current = false;
      setError("Could not complete login. Please try again.");
    }
  }

  function changeNumber() {
    setStep("mobile");
    setOtp("");
    setError("");
  }

  const heading = {
    mobile: "Welcome to TAAZLY",
    otp: "Verify your number",
    name: "What should we call you?",
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="customer-login-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border border-green-100 bg-white p-0 text-taazly-text shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          aria-label="Close login"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-taazly-light text-xl text-taazly-secondary transition hover:bg-green-100"
        >
          ×
        </button>

        <p className="text-2xl font-extrabold tracking-tight text-taazly-primary">
          TAAZLY
        </p>

        <h2
          id="customer-login-title"
          className="mt-5 text-xl font-bold"
        >
          {heading[step]}
        </h2>

        <p className="mt-2 text-sm leading-6 text-taazly-secondary">
          {step === "mobile" && "Please enter your number"}
          {step === "otp" && `Enter the OTP for +91 ${mobile}`}
          {step === "name" && "Enter your name to finish signing in."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          {step === "mobile" && (
            <>
              <label
                htmlFor="customer-mobile"
                className="mb-2 block text-xs font-semibold"
              >
                Mobile number
              </label>

              <div className="flex items-center rounded-xl border border-green-200 bg-taazly-light focus-within:border-taazly-primary focus-within:ring-2 focus-within:ring-green-100">
                <span className="border-r border-green-200 px-4 text-sm font-semibold">
                  +91
                </span>

                <input
                  ref={inputRef}
                  id="customer-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={mobile}
                  onChange={(event) =>
                    setMobile(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Enter mobile number"
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                />
              </div>
            </>
          )}

          {step === "otp" && (
            <>
              <label
                htmlFor="customer-otp"
                className="mb-2 block text-xs font-semibold"
              >
                6-digit OTP
              </label>

              <input
                ref={inputRef}
                id="customer-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, ""))
                }
                placeholder="000000"
                className="w-full rounded-xl border border-green-200 bg-taazly-light px-4 py-3 text-center text-xl font-bold tracking-[0.3em] outline-none focus:border-taazly-primary focus:ring-2 focus:ring-green-100"
              />

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-taazly-secondary">
                  Demo OTP: <strong>456852</strong>
                </p>

                <button
                  type="button"
                  onClick={changeNumber}
                  className="text-xs font-semibold text-taazly-primary"
                >
                  Change number
                </button>
              </div>
            </>
          )}

          {step === "name" && (
            <>
              <label
                htmlFor="customer-name"
                className="mb-2 block text-xs font-semibold"
              >
                Full name
              </label>

              <input
                ref={inputRef}
                id="customer-name"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-green-200 bg-taazly-light px-4 py-3 text-sm outline-none focus:border-taazly-primary focus:ring-2 focus:ring-green-100"
              />
            </>
          )}

          {error && (
            <p role="alert" className="mt-3 text-xs text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-taazly-primary py-3 text-sm font-bold text-white transition hover:bg-green-700"
          >
            {step === "mobile"
              ? "Continue"
              : step === "otp"
                ? "Verify OTP"
                : "Complete Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-taazly-secondary">
          Demo login • No SMS is sent
        </p>
      </div>
    </dialog>
  );
}