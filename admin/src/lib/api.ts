import axios, { AxiosError } from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The backend's refresh token is single-use (rotates on every call — see AuthService.refresh).
// If two requests 401 at the same moment, we must not fire two /auth/refresh calls — the
// second would get INVALID_REFRESH_TOKEN since the first already rotated it. This promise is
// shared so every concurrent 401 waits on the same in-flight refresh instead of racing it.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${import.meta.env.VITE_API_BASE_URL}/v1/auth/refresh`, { refreshToken })
      .then((res) => {
        setTokens(res.data.accessToken, res.data.refreshToken);
        return res.data.accessToken as string;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !(original as { _retried?: boolean })._retried) {
      (original as { _retried?: boolean })._retried = true;
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api.request(original);
      }
      clearTokens();
      window.location.href = "/login";
      // The page is navigating away — don't let the original caller's .catch run with this
      // now-irrelevant 401 (that's what was flashing a confusing "not authenticated" toast in
      // the instant before the redirect actually took effect). A promise that never settles is
      // correct here: nothing downstream should react to this request once we're leaving.
      return new Promise(() => {});
    }
    return Promise.reject(error);
  },
);
