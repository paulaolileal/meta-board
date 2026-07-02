import type { ISheetProvider } from "./ISheetProvider";
import { GoogleSheetProvider } from "./GoogleSheetProvider";
import { GoogleAuthService } from "@/shared/auth/GoogleAuthService";
import { SheetsApiClient } from "@/shared/api/SheetsApiClient";
import { DriveApiClient } from "@/shared/api/DriveApiClient";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
if (!clientId) throw new Error("VITE_GOOGLE_CLIENT_ID is required");

export const googleAuthService = new GoogleAuthService(clientId);
export const sheetsApiClient = new SheetsApiClient(googleAuthService);
export const driveApiClient = new DriveApiClient(googleAuthService);

let activeProvider: GoogleSheetProvider | null = null;
let activeSpreadsheetId: string | null = null;

export function initProvider(spreadsheetId: string): void {
  if (activeSpreadsheetId === spreadsheetId && activeProvider !== null) return;
  activeProvider = new GoogleSheetProvider(spreadsheetId, googleAuthService);
  activeSpreadsheetId = spreadsheetId;
}

export function getSheetProvider(): ISheetProvider {
  if (!activeProvider) throw new Error("No spreadsheet selected. Call initProvider first.");
  return activeProvider;
}
