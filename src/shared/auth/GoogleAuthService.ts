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

const STORAGE_KEY_TOKEN = "mb:gis:token";
const STORAGE_KEY_EXPIRY = "mb:gis:expiry";
const STORAGE_KEY_CONSENTED = "mb:gis:consented";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets openid email profile";
const EXPIRY_BUFFER_MS = 30_000;
const PROACTIVE_REFRESH_BEFORE_MS = 5 * 60 * 1000;

export class GoogleAuthService {
  private clientId: string;
  private tokenClient: TokenClient | null = null;
  private resolveSignIn: (() => void) | null = null;
  private rejectSignIn: ((err: string) => void) | null = null;
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;

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

  async ensureValidToken(): Promise<string> {
    if (this.isAuthenticated()) return this.getAccessToken()!;
    await this.signIn();
    return this.getAccessToken()!;
  }

  async signIn(): Promise<void> {
    await this.waitForGis();

    return new Promise((resolve, reject) => {
      this.resolveSignIn = resolve;
      this.rejectSignIn = reject;

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
            this.scheduleProactiveRefresh();
            this.resolveSignIn?.();
          },
          error_callback: ({ type }) => {
            this.rejectSignIn?.(type);
          },
        });
      }

      this.tokenClient.requestAccessToken({ prompt: this._hasConsented ? "" : "consent" });
    });
  }

  signOut(): void {
    this.cancelProactiveRefresh();
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
    const msUntilRefresh = this._expiresAt - Date.now() - PROACTIVE_REFRESH_BEFORE_MS;
    if (msUntilRefresh > 0) {
      this._refreshTimer = setTimeout(() => {
        this.signIn().catch(() => {
          // Silent proactive refresh failed — token still valid for the remaining buffer window
        });
      }, msUntilRefresh);
    }
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
      const interval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error("Google Identity Services não carregou. Verifique a conexão."));
        }
      }, 100);
    });
  }
}
