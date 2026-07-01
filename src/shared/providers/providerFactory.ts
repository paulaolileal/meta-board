import type { ISheetProvider } from "./ISheetProvider";
import { GoogleSheetProvider } from "./GoogleSheetProvider";
import { GoogleAuthService } from "@/shared/auth/GoogleAuthService";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const envSpreadsheetId = import.meta.env.VITE_SPREADSHEET_ID as string | undefined;

if (!clientId) throw new Error("VITE_GOOGLE_CLIENT_ID is required");
if (!envSpreadsheetId) throw new Error("VITE_SPREADSHEET_ID is required");

export const googleAuthService = new GoogleAuthService(clientId);

const provider = new GoogleSheetProvider(envSpreadsheetId, googleAuthService);

export function getSheetProvider(): ISheetProvider {
  return provider;
}
