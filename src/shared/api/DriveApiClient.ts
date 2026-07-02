import type { GoogleAuthService } from "@/shared/auth/GoogleAuthService";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export class DriveApiClient {
  constructor(private readonly auth: GoogleAuthService) {}

  async listSpreadsheets(): Promise<DriveFile[]> {
    const token = await this.auth.ensureValidToken();
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: "files(id,name,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: "50",
    });
    const res = await fetch(`${DRIVE_BASE}/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg =
        (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const data = await res.json();
    return (data.files as DriveFile[]) ?? [];
  }
}
