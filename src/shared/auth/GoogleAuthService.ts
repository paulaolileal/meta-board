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

const STORAGE_KEY_TOKEN = "mb:gis:token";
const STORAGE_KEY_EXPIRY = "mb:gis:expiry";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export class GoogleAuthService {
  private clientId: string;
  private tokenClient: TokenClient | null = null;
  private resolveSignIn: (() => void) | null = null;
  private rejectSignIn: ((err: string) => void) | null = null;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  isAuthenticated(): boolean {
    const token = sessionStorage.getItem(STORAGE_KEY_TOKEN);
    const expiry = Number(sessionStorage.getItem(STORAGE_KEY_EXPIRY) ?? "0");
    return !!token && Date.now() < expiry - 60_000;
  }

  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return sessionStorage.getItem(STORAGE_KEY_TOKEN);
  }

  async ensureValidToken(): Promise<string> {
    if (this.isAuthenticated()) {
      return this.getAccessToken()!;
    }
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
            const expiry = Date.now() + response.expires_in * 1000;
            sessionStorage.setItem(STORAGE_KEY_TOKEN, response.access_token);
            sessionStorage.setItem(STORAGE_KEY_EXPIRY, String(expiry));
            this.resolveSignIn?.();
          },
          error_callback: ({ type }) => {
            this.rejectSignIn?.(type);
          },
        });
      }

      this.tokenClient.requestAccessToken({ prompt: this.isAuthenticated() ? "" : "consent" });
    });
  }

  signOut(): void {
    const token = sessionStorage.getItem(STORAGE_KEY_TOKEN);
    if (token) {
      window.google?.accounts.oauth2.revoke(token);
    }
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_EXPIRY);
  }

  private waitForGis(timeout = 10_000): Promise<void> {
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
