// Tokens live in localStorage for now — simplest thing that works, but it means an XSS bug
// anywhere in this app could read them. A production hardening pass would move the refresh
// token to an httpOnly cookie set by the backend, which the backend doesn't do yet (it returns
// both tokens in the JSON body today). Documented here rather than silently accepted.

export type Role = "ADMIN" | "DRIVER";

export interface WayatPrincipal {
  userId: string;
  tenantId: string;
  role: Role;
  driverId: string | null;
  exp: number;
}

const ACCESS_TOKEN_KEY = "wayat_access_token";
const REFRESH_TOKEN_KEY = "wayat_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Our JWT isn't encrypted, just signed (see backend JwtService) — decoding the payload here
 *  client-side to read role/tenantId needs no secret and verifies nothing; the backend is what
 *  actually validates the signature on every request. This is purely for the UI to know who's
 *  logged in. */
export function decodeAccessToken(token: string): WayatPrincipal | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return {
      userId: json.sub,
      tenantId: json.tenantId,
      role: json.role,
      driverId: json.driverId ?? null,
      exp: json.exp,
    };
  } catch {
    return null;
  }
}

export function getCurrentPrincipal(): WayatPrincipal | null {
  const token = getAccessToken();
  if (!token) return null;
  const principal = decodeAccessToken(token);
  if (!principal) return null;
  if (principal.exp * 1000 < Date.now()) return null;
  return principal;
}
