import type { GoogleAuthService } from "@/shared/auth/GoogleAuthService";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export class DriveApiClient {
  constructor(private readonly auth: GoogleAuthService) {}

  async findSpreadsheet(name: string): Promise<DriveFile | null> {
    const params = new URLSearchParams({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${name}' and trashed=false`,
      fields: "files(id,name,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: "1",
    });
    const result = await this.request("GET", `${DRIVE_BASE}/files?${params}`);
    return (result.files?.[0] as DriveFile) ?? null;
  }

  async getOrCreateFolder(name: string): Promise<string> {
    const params = new URLSearchParams({
      q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`,
      fields: "files(id)",
      pageSize: "1",
    });
    const search = await this.request("GET", `${DRIVE_BASE}/files?${params}`);
    if (search.files?.length > 0) return search.files[0].id as string;

    const folder = await this.request("POST", `${DRIVE_BASE}/files`, {
      name,
      mimeType: "application/vnd.google-apps.folder",
    });
    return folder.id as string;
  }

  async moveToFolder(fileId: string, folderId: string): Promise<void> {
    const fileMeta = await this.request("GET", `${DRIVE_BASE}/files/${fileId}?fields=parents`);
    const currentParents: string[] = fileMeta.parents ?? [];
    if (currentParents.includes(folderId)) return;

    const params = new URLSearchParams({
      addParents: folderId,
      removeParents: currentParents.join(","),
      fields: "id",
    });
    await this.request("PATCH", `${DRIVE_BASE}/files/${fileId}?${params}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async request(method: string, url: string, body?: unknown): Promise<any> {
    const token = await this.auth.ensureValidToken();
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body != null ? { "Content-Type": "application/json" } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }
}
