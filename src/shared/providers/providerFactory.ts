import type { ISheetProvider } from "./ISheetProvider";
import { MockSheetProvider } from "./MockSheetProvider";
import { GoogleSheetProvider } from "./GoogleSheetProvider";
import { GoogleAuthService } from "@/shared/auth/GoogleAuthService";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const googleAuthService = new GoogleAuthService(clientId ?? "");

const providers = new Map<string, ISheetProvider>();
let mockInstance: MockSheetProvider | null = null;

export function getSheetProvider(sheetId: string): ISheetProvider {
  if (!clientId) {
    if (!mockInstance) mockInstance = new MockSheetProvider();
    return mockInstance;
  }
  if (!providers.has(sheetId)) {
    providers.set(sheetId, new GoogleSheetProvider(sheetId, googleAuthService));
  }
  return providers.get(sheetId)!;
}

export function isMockMode(): boolean {
  return !clientId;
}
