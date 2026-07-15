declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: TokenClientConfig): TokenClient;
          revoke(token: string, callback?: () => void): void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

interface TokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
}

// Distinguishes "this request got superseded by a newer one" from a real
// auth failure — callers must not treat supersession as a lost session.
export const TOKEN_REQUEST_SUPERSEDED = "token-request-superseded";

const STORAGE_KEY_TOKEN = "mb:gis:token";
const STORAGE_KEY_EXPIRY = "mb:gis:expiry";
const STORAGE_KEY_CONSENTED = "mb:gis:consented";
const SCOPE = "https://www.googleapis.com/auth/drive.file openid email profile";
const EXPIRY_BUFFER_MS = 30_000;
const PROACTIVE_REFRESH_BEFORE_MS = 5 * 60 * 1000;
// Backoff schedule for retrying a failed silent proactive refresh before
// giving up and asking the user to re-authenticate interactively.
const PROACTIVE_RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

export class GoogleAuthService {
  private clientId: string;
  private tokenClient: TokenClient | null = null;
  private resolveSignIn: (() => void) | null = null;
  private rejectSignIn: ((err: string) => void) | null = null;
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private _proactiveRetryCount = 0;
  private _reauthRequiredHandler: ((required: boolean) => void) | null = null;

  // Primary storage: memory (never persisted, cleared on tab close)
  private _accessToken: string | null = null;
  private _expiresAt = 0;
  private _hasConsented = false;

  constructor(clientId: string) {
    this.clientId = clientId;
    this._hasConsented = localStorage.getItem(STORAGE_KEY_CONSENTED) === "true";
    this.loadFromSession();
    if (this.isAuthenticated()) {
      this.scheduleProactiveRefresh();
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

  async ensureValidToken(): Promise<string> {
    if (this.isAuthenticated()) return this.getAccessToken()!;
    await this.signIn();
    return this.getAccessToken()!;
  }

  async signIn(): Promise<void> {
    await this.waitForGis();
    return this._requestToken(this._hasConsented ? "" : "consent");
  }

  silentSignIn(): Promise<void> {
    if (this._silentRefreshPromise) return this._silentRefreshPromise;
    this._silentRefreshPromise = this.waitForGis()
      .then(() => this._requestToken("none"))
      .finally(() => {
        this._silentRefreshPromise = null;
      });
    return this._silentRefreshPromise;
  }

  private _silentRefreshPromise: Promise<void> | null = null;

  private _requestToken(prompt: string, timeoutMs = 15_000): Promise<void> {
    // The GIS tokenClient's callback is a single global closure, not per-call.
    // If a request is already in flight (e.g. a mount-time silent refresh)
    // when another one starts (e.g. a user tapping a board mid-share-target
    // flow), overwriting resolveSignIn/rejectSignIn below would silently
    // orphan the first caller's promise forever. Settle it explicitly first.
    this.rejectSignIn?.(TOKEN_REQUEST_SUPERSEDED);

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject("Tempo de autenticação esgotado.");
      }, timeoutMs);

      this.resolveSignIn = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      this.rejectSignIn = (err: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      };

      if (!this.tokenClient) {
        this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: SCOPE,
          callback: (response) => {
            if (response.error) {
              this.rejectSignIn?.(response.error_description ?? response.error);
              return;
            }
            const expiresAt = Date.now() + response.expires_in * 1000;
            this._accessToken = response.access_token;
            this._expiresAt = expiresAt;
            this._hasConsented = true;
            try {
              sessionStorage.setItem(STORAGE_KEY_TOKEN, response.access_token);
              sessionStorage.setItem(STORAGE_KEY_EXPIRY, String(expiresAt));
              localStorage.setItem(STORAGE_KEY_CONSENTED, "true");
            } catch {
              // sessionStorage unavailable (private mode) — token stays in memory
            }
            this._proactiveRetryCount = 0;
            this._reauthRequiredHandler?.(false);
            this.scheduleProactiveRefresh();
            this.resolveSignIn?.();
          },
          error_callback: ({ type }) => {
            this.rejectSignIn?.(type);
          },
        });
      }

      this.tokenClient.requestAccessToken({ prompt });
    });
  }

  signOut(): void {
    this.cancelProactiveRefresh();
    this._reauthRequiredHandler?.(false);
    if (this._accessToken) {
      window.google?.accounts.oauth2.revoke(this._accessToken);
    }
    this._accessToken = null;
    this._expiresAt = 0;
    this._hasConsented = false;
    try {
      sessionStorage.removeItem(STORAGE_KEY_TOKEN);
      sessionStorage.removeItem(STORAGE_KEY_EXPIRY);
      localStorage.removeItem(STORAGE_KEY_CONSENTED);
    } catch {
      // ignore
    }
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

  // Background renewal must stay silent (prompt: 'none') — signIn() with an
  // empty prompt can still surface a real, visible Google popup, which is
  // exactly the "flash" users see every ~55 min in a long session. On
  // failure, retry a few times with backoff before asking for interaction;
  // prompt: 'none' depends on the Google session cookie being reachable
  // (third-party cookies, storage partitioning on an installed PWA), which
  // is flaky enough to warrant more than one attempt.
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

  private cancelProactiveRefresh(): void {
    if (this._refreshTimer !== null) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  private waitForGis(timeout = 30_000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const start = Date.now();
      let retried = false;
      const interval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error("Google Identity Services não carregou. Verifique a conexão."));
        } else if (!retried && Date.now() - start > 5_000) {
          // After 5 s, inject a fresh script tag in case the original failed silently
          retried = true;
          const s = document.createElement("script");
          s.src = "https://accounts.google.com/gsi/client";
          s.async = true;
          document.head.appendChild(s);
        }
      }, 100);
    });
  }
}
