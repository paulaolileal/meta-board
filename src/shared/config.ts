const apiUrl = import.meta.env.VITE_LEALTEK_API_URL as string | undefined;
if (!apiUrl) throw new Error("VITE_LEALTEK_API_URL is required");

// No trailing slash, so callers can safely do `${LEALTEK_API_URL}/api/...`.
export const LEALTEK_API_URL = apiUrl.replace(/\/$/, "");
