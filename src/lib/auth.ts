import { api } from "./api";
import { clearTokens, getRefreshToken, setTokens } from "./tokenStore";

// Mirrors auth/AuthDtos.kt on the backend exactly.
export type AuthPurpose = "ADMIN_LOGIN" | "DRIVER_LOGIN";

interface RequestOtpResponse {
  phone: string;
  expiresInSeconds: number;
  devOtp: string | null; // only set when the backend's app.auth.otp-dev-mode is true
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export async function requestOtp(phone: string, purpose: AuthPurpose): Promise<RequestOtpResponse> {
  const res = await api.post<RequestOtpResponse>("/v1/auth/otp/request", { phone, purpose });
  return res.data;
}

export async function verifyOtp(phone: string, otp: string, purpose: AuthPurpose): Promise<void> {
  const res = await api.post<TokenResponse>("/v1/auth/otp/verify", { phone, otp, purpose });
  setTokens(res.data.accessToken, res.data.refreshToken);
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await api.post("/v1/auth/logout", { refreshToken }).catch(() => {
      // Logging out with an already-invalid token is a no-op on the backend too — proceed
      // regardless so the user is never stuck unable to log out.
    });
  }
  clearTokens();
}
