import { GoogleAuthError, type GoogleAuthService } from "@/shared/auth/GoogleAuthService";

/**
 * fetch() wrapper shared by every API client that needs a Google access
 * token (Sheets, Drive, and the backend proxies under /api/* that verify
 * the same token). Centralizes the "attach a fresh token, retry once on a
 * surprise 401" dance so each client only has to worry about its own
 * request/response shape.
 *
 * Throws GoogleAuthError (never a raw fetch/HTTP error) when no valid token
 * could be obtained without user interaction — callers can catch that
 * specific type to avoid piling a misleading generic failure toast on top
 * of the app-wide reconnect prompt.
 */
export async function googleApiFetch(
  auth: GoogleAuthService,
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await auth.ensureValidToken();
  const res = await fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  if (res.status !== 401) return res;

  // The token looked valid locally but the server disagrees (revoked
  // mid-session, clock skew, third-party sign-out). Force one silent
  // refresh and retry exactly once before giving up.
  const freshToken = await auth.ensureValidToken({ forceRefresh: true });
  const retryRes = await fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${freshToken}` },
  });

  if (retryRes.status === 401) {
    auth.notifyReauthRequired();
    throw new GoogleAuthError();
  }

  return retryRes;
}
