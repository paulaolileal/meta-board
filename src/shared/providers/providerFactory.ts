import type { ISheetProvider } from "./ISheetProvider";
import { MockSheetProvider } from "./MockSheetProvider";
import { GoogleSheetProvider } from "./GoogleSheetProvider";

let instance: ISheetProvider | null = null;

export function getSheetProvider(): ISheetProvider {
  if (instance) return instance;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID as string | undefined;
  if (clientId && sheetId) {
    instance = new GoogleSheetProvider({ clientId, sheetId });
  } else {
    instance = new MockSheetProvider();
  }
  return instance;
}

export function isMockMode() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID as string | undefined;
  return !clientId || !sheetId;
}
