import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

// Load mcp-server/.env explicitly — never the app's own .env (this process
// has nothing to do with Vite) and independent of the caller's cwd, since
// MCP clients spawn this process with varying working directories.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "..", ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[mcp-server] Missing required env var "${name}". Copy mcp-server/.env.example to ` +
        `mcp-server/.env and fill it in — see mcp-server/README.md.`,
    );
    process.exit(1);
  }
  return value;
}

export const SPREADSHEET_ID = required("SPREADSHEET_ID");
export const GOOGLE_SERVICE_ACCOUNT_KEY_FILE = required("GOOGLE_SERVICE_ACCOUNT_KEY_FILE");
