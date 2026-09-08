import { GoogleAuth, type JWT } from "google-auth-library";
import { GOOGLE_SERVICE_ACCOUNT_KEY_FILE } from "./env.js";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * Node-side stand-in for the app's browser-only GoogleAuthService (PKCE
 * against lealtek-api — unusable outside a browser tab). Implements only the
 * two members googleApiFetch() actually calls, authenticating instead as a
 * Service Account: no interactive login, no refresh-token cookie, just a
 * JSON key file authorized directly on the target spreadsheet.
 *
 * Not structurally assignable to GoogleAuthService (that class has private
 * fields, so TS requires nominal compatibility) — callers must cast
 * `as unknown as GoogleAuthService` at the single point where this is handed
 * to GoogleSheetProvider. See mcp-server/README.md.
 */
export class NodeGoogleAuthAdapter {
  private clientPromise: Promise<JWT> | null = null;

  private getClient(): Promise<JWT> {
    if (!this.clientPromise) {
      this.clientPromise = new GoogleAuth({
        keyFile: GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        scopes: SCOPES,
      })
        .getClient()
        .then((client) => client as JWT);
    }
    return this.clientPromise;
  }

  async ensureValidToken(opts?: { forceRefresh?: boolean }): Promise<string> {
    const client = await this.getClient();
    if (opts?.forceRefresh) {
      client.credentials.access_token = undefined;
    }
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Failed to obtain an access token for the service account.");
    return token;
  }

  notifyReauthRequired(): void {
    // No interactive flow exists for a service account — surface an
    // actionable message instead of failing silently.
    console.error(
      "[mcp-server] Google auth failed persistently. Check that the service account key is " +
        "valid and that the spreadsheet is shared with the service account's email as Editor.",
    );
  }
}
