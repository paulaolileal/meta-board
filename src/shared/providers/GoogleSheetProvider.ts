import type { ISheetProvider } from "./ISheetProvider";

/**
 * Stub for the future Google Sheets provider. Will use Google Identity Services
 * + the Sheets REST API. Activated when both VITE_GOOGLE_CLIENT_ID and
 * VITE_GOOGLE_SHEET_ID are set.
 */
export class GoogleSheetProvider implements ISheetProvider {
  readonly mode = "google" as const;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts: { clientId: string; sheetId: string }) {}
  loadProject(): never { throw new Error("GoogleSheetProvider ainda não implementado. Configure-o no próximo passo."); }
  loadFields(): never { throw new Error("GoogleSheetProvider ainda não implementado."); }
  loadCards(): never { throw new Error("GoogleSheetProvider ainda não implementado."); }
  saveCard(): never { throw new Error("GoogleSheetProvider ainda não implementado."); }
  createCard(): never { throw new Error("GoogleSheetProvider ainda não implementado."); }
  deleteCard(): never { throw new Error("GoogleSheetProvider ainda não implementado."); }
  sync(): never { throw new Error("GoogleSheetProvider ainda não implementado."); }
}
