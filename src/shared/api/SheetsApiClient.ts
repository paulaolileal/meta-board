import type { GoogleAuthService } from "@/shared/auth/GoogleAuthService";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export class SheetsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "SheetsApiError";
  }
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  properties: { title: string };
  sheets: Array<{ properties: { sheetId: number; title: string } }>;
}

export class SheetsApiClient {
  constructor(private readonly auth: GoogleAuthService) {}

  async getValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const res = await this.request("GET", `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`);
    return (res.values as string[][] | undefined) ?? [];
  }

  async setValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    await this.request(
      "PUT",
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      { range, majorDimension: "ROWS", values },
    );
  }

  async appendValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    await this.request(
      "POST",
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { values },
    );
  }

  async clearValues(spreadsheetId: string, range: string): Promise<void> {
    await this.request("POST", `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`);
  }

  async batchUpdate(spreadsheetId: string, requests: unknown[]): Promise<void> {
    await this.request("POST", `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, { requests });
  }

  async getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata> {
    return this.request("GET", `${SHEETS_BASE}/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties`);
  }

  async createSpreadsheet(title: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    return this.request("POST", SHEETS_BASE, {
      properties: { title },
      sheets: [
        { properties: { title: "_boards" } },
        { properties: { title: "_fields" } },
        { properties: { title: "_cards" } },
      ],
    });
  }

  private async request(method: string, url: string, body?: unknown): Promise<any> {
    const token = await this.auth.ensureValidToken();
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = (data as any)?.error?.message ?? `HTTP ${res.status}`;
      throw new SheetsApiError(msg, res.status, data);
    }

    return data;
  }
}
