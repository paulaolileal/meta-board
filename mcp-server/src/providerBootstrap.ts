import { GoogleSheetProvider } from "@/shared/providers/GoogleSheetProvider.js";
import type { ISheetProvider } from "@/shared/providers/ISheetProvider.js";
import type { GoogleAuthService } from "@/shared/auth/GoogleAuthService.js";
import { NodeGoogleAuthAdapter } from "./googleAuth.js";
import { SPREADSHEET_ID } from "./env.js";

const nodeAuth = new NodeGoogleAuthAdapter();

// GoogleAuthService has private fields, so TS requires nominal — not
// structural — compatibility here; the adapter only needs to satisfy the two
// members googleApiFetch() actually calls (see googleAuth.ts). This cast is
// the single place that fiction lives.
export const provider: ISheetProvider = new GoogleSheetProvider(
  SPREADSHEET_ID,
  nodeAuth as unknown as GoogleAuthService,
);
