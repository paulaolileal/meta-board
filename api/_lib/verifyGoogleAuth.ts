export type GoogleAuthCheck = { ok: true } | { ok: false; status: 401 | 403; message: string };

interface GoogleTokenInfo {
  aud?: string;
  expires_in?: string;
  error_description?: string;
}

export async function verifyGoogleAuth(req: Request): Promise<GoogleAuthCheck> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return { ok: false, status: 401, message: "Missing Authorization header" };
  }

  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
  );

  if (!tokenInfoResponse.ok) {
    return { ok: false, status: 401, message: "Invalid or expired Google token" };
  }

  const tokenInfo = (await tokenInfoResponse.json()) as GoogleTokenInfo;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId || tokenInfo.aud !== clientId) {
    return { ok: false, status: 403, message: "Token was not issued for this application" };
  }

  return { ok: true };
}
