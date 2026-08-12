export interface UserInfo {
  name: string;
  email: string;
  picture: string;
}

// Thrown by ensureValidToken()/googleApiFetch() when no valid token could be
// obtained without user interaction. Distinguishable via `instanceof` so
// callers (API clients, mutation hooks, the global query cache) can route it
// to the non-destructive "Renovar" prompt instead of a generic failure toast.
export class GoogleAuthError extends Error {
  constructor(message = "Sua sessão com o Google expirou. Toque em Renovar para continuar.") {
    super(message);
    this.name = "GoogleAuthError";
  }
}

const STORAGE_KEY_TOKEN = "mb:auth:token";
const STORAGE_KEY_EXPIRY = "mb:auth:expiry";
const EXPIRY_BUFFER_MS = 30_000;
const PROACTIVE_REFRESH_BEFORE_MS = 5 * 60 * 1000;
// Backoff schedule for retrying a failed silent proactive refresh before
// giving up and asking the user to re-authenticate interactively.
const PROACTIVE_RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

// Talks to lealtek-api's Authorization Code + PKCE flow instead of Google
// Identity Services directly. The token exchange and the refresh_token
// itself live server-side (httpOnly cookie on the shared root domain) — this
// class only ever holds the short-lived access_token, in memory + a
// sessionStorage mirror, exactly as before.
export class GoogleAuthService {
  private apiBaseUrl: string;
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private _proactiveRetryCount = 0;
  private _reauthRequiredHandler: ((required: boolean) => void) | null = null;
  private _silentRefreshPromise: Promise<void> | null = null;

  // Primary storage: memory (never persisted, cleared on tab close)
  private _accessToken: string | null = null;
  private _expiresAt = 0;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.consumeRedirectResult();
    this.loadFromSession();
    if (this.isAuthenticated()) {
      this.scheduleProactiveRefresh();
    }
    // setTimeout is throttled/suspended for backgrounded tabs and sleeping
    // laptops, so the scheduled refresh above can simply never fire while
    // away. Re-check the moment the tab is usable again instead of waiting
    // for the next API call to discover the token is dead.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => this.revalidateOnResume());
      window.addEventListener("focus", () => this.revalidateOnResume());
    }
  }

  isAuthenticated(): boolean {
    if (this._accessToken && Date.now() < this._expiresAt - EXPIRY_BUFFER_MS) return true;
    return this.loadFromSession();
  }

  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this._accessToken;
  }

  async fetchUserInfo(): Promise<UserInfo | null> {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return { name: data.name ?? "", email: data.email ?? "", picture: data.picture ?? "" };
    } catch {
      return null;
    }
  }

  // Lets callers show a non-blocking "session expiring" prompt instead of a
  // hard sign-out when background silent refresh can't recover a token.
  onReauthRequiredChange(handler: (required: boolean) => void): void {
    this._reauthRequiredHandler = handler;
  }

  // Used by every API client before a request. Deliberately never falls
  // back to an interactive signIn(): that would navigate the whole tab away
  // from inside a background fetch/mutation with no user gesture behind it.
  // Instead it makes one best-effort silent attempt and, if that fails,
  // throws GoogleAuthError so the caller can surface the non-destructive
  // reconnect prompt instead. Pass forceRefresh to bypass the local expiry
  // cache when the server itself just rejected a token we believed was
  // still valid.
  async ensureValidToken(opts?: { forceRefresh?: boolean }): Promise<string> {
    if (!opts?.forceRefresh && this.isAuthenticated()) return this.getAccessToken()!;
    try {
      await this.silentSignIn();
    } catch {
      this._reauthRequiredHandler?.(true);
      throw new GoogleAuthError();
    }
    if (!this.isAuthenticated()) {
      this._reauthRequiredHandler?.(true);
      throw new GoogleAuthError();
    }
    return this.getAccessToken()!;
  }

  // Lets a request wrapper report a hard auth failure discovered mid-flight
  // (e.g. a 401 from the API despite a locally "valid" token) through the
  // same non-destructive prompt used by the proactive refresh scheduler.
  notifyReauthRequired(): void {
    this._reauthRequiredHandler?.(true);
  }

  // Interactive sign-in navigates the whole tab to lealtek-api's login
  // endpoint (full-page redirect, not a popup) — more robust in installed
  // PWAs and mobile browsers than window.open(), and it's what lets
  // lealtek-api detect and block in-app browsers before ever reaching
  // Google. Control returns to this app only when the browser lands back
  // here with #access_token=... in the URL, picked up by
  // consumeRedirectResult() on the next boot.
  signIn(): void {
    const returnTo = window.location.href;
    window.location.href = `${this.apiBaseUrl}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
  }

  // Background renewal: calls lealtek-api's /api/auth/refresh, which reads
  // the httpOnly refresh_token cookie server-side. Never opens any UI —
  // failure just rejects, same contract as before.
  silentSignIn(): Promise<void> {
    if (this._silentRefreshPromise) return this._silentRefreshPromise;
    this._silentRefreshPromise = this.refreshFromServer().finally(() => {
      this._silentRefreshPromise = null;
    });
    return this._silentRefreshPromise;
  }

  async signOut(): Promise<void> {
    this.cancelProactiveRefresh();
    this._reauthRequiredHandler?.(false);
    this._accessToken = null;
    this._expiresAt = 0;
    try {
      sessionStorage.removeItem(STORAGE_KEY_TOKEN);
      sessionStorage.removeItem(STORAGE_KEY_EXPIRY);
    } catch {
      // ignore
    }
    // Best-effort: local state is already cleared regardless of whether the
    // network call succeeds.
    await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }

  // Reads #access_token=...&expires_in=... left in the URL by
  // lealtek-api's /api/auth/callback redirect, applies it, and strips the
  // fragment so the token doesn't linger in the address bar/history.
  private consumeRedirectResult(): void {
    if (typeof window === "undefined" || !window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");
    if (!accessToken || !expiresIn) return;
    this.setToken(accessToken, Number(expiresIn));
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, "", url.toString());
  }

  private setToken(token: string, expiresIn: number): void {
    const expiresAt = Date.now() + expiresIn * 1000;
    this._accessToken = token;
    this._expiresAt = expiresAt;
    try {
      sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
      sessionStorage.setItem(STORAGE_KEY_EXPIRY, String(expiresAt));
    } catch {
      // sessionStorage unavailable (private mode) — token stays in memory
    }
    this._proactiveRetryCount = 0;
    this._reauthRequiredHandler?.(false);
    this.scheduleProactiveRefresh();
  }

  private async refreshFromServer(): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`refresh_failed_${res.status}`);

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token || !data.expires_in) throw new Error("refresh_failed_invalid_response");

    this.setToken(data.access_token, data.expires_in);
  }

  private loadFromSession(): boolean {
    try {
      const token = sessionStorage.getItem(STORAGE_KEY_TOKEN);
      const expiresAt = Number(sessionStorage.getItem(STORAGE_KEY_EXPIRY) ?? "0");
      if (token && Date.now() < expiresAt - EXPIRY_BUFFER_MS) {
        this._accessToken = token;
        this._expiresAt = expiresAt;
        return true;
      }
    } catch {
      // sessionStorage unavailable
    }
    return false;
  }

  private scheduleProactiveRefresh(): void {
    this.cancelProactiveRefresh();
    this._proactiveRetryCount = 0;
    const msUntilRefresh = this._expiresAt - Date.now() - PROACTIVE_REFRESH_BEFORE_MS;
    if (msUntilRefresh > 0) {
      this._refreshTimer = setTimeout(() => this.attemptProactiveRefresh(), msUntilRefresh);
    }
  }

  // Background renewal must stay silent — signIn() now navigates the whole
  // tab away, which would be a jarring "flash" if triggered automatically
  // every ~55 min. On failure, retry a few times with backoff before asking
  // for interaction; the refresh_token cookie is generally reliable, but
  // still worth more than one attempt against transient network errors.
  private attemptProactiveRefresh(): void {
    this.silentSignIn().catch(() => {
      const delay = PROACTIVE_RETRY_DELAYS_MS[this._proactiveRetryCount];
      if (delay !== undefined && Date.now() + delay < this._expiresAt) {
        this._proactiveRetryCount += 1;
        this._refreshTimer = setTimeout(() => this.attemptProactiveRefresh(), delay);
        return;
      }
      this._proactiveRetryCount = 0;
      this._reauthRequiredHandler?.(true);
    });
  }

  // Runs on visibilitychange/focus. If the token is still locally valid, this
  // just re-arms the timer against the real remaining time (a suspended tab
  // can leave the old setTimeout wildly late). If it already expired outright
  // while we were away, recover immediately instead of waiting for the next
  // API call to hit a dead token. Only bothers retrying if this tab had a
  // token at some point — no point silently refreshing for a visitor who
  // never signed in here.
  private revalidateOnResume(): void {
    if (document.visibilityState === "hidden") return;
    if (this._expiresAt === 0) return;
    if (this.isAuthenticated()) {
      this.scheduleProactiveRefresh();
    } else {
      this.attemptProactiveRefresh();
    }
  }

  private cancelProactiveRefresh(): void {
    if (this._refreshTimer !== null) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }
}
