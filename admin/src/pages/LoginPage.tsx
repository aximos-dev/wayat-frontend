import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestOtp, verifyOtp } from "../lib/auth";
import { useAuth } from "../lib/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshPrincipal } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestOtp(phone, "ADMIN_LOGIN");
      setDevOtp(res.devOtp);
      setStep("otp");
    } catch {
      // The backend returns 404 NOT_FOUND for an unregistered phone — deliberately vague here
      // too, same reasoning as the backend's own OTP error messages (see OtpService).
      setError("No admin account found for that phone number.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, otp, "ADMIN_LOGIN");
      refreshPrincipal();
      navigate("/", { replace: true });
    } catch {
      setError("Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-surface p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          <span className="text-lg font-semibold text-text-primary">wayAt</span>
          <span className="text-sm text-text-muted">admin</span>
        </div>

        {step === "phone" && (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-text-muted">Phone number</span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-accent px-4 py-2 font-medium text-bg-base disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              Enter the 6-digit code sent to <span className="text-text-primary">{phone}</span>
            </p>
            {devOtp && (
              <p className="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
                Dev mode — your code is <span className="font-mono font-semibold">{devOtp}</span>
              </p>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-text-muted">Code</span>
              <input
                type="text"
                inputMode="numeric"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-accent px-4 py-2 font-medium text-bg-base disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Log in"}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="text-sm text-text-muted hover:text-text-primary"
            >
              Use a different phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
