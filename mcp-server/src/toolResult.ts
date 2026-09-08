import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Wraps a JSON-serializable payload as a successful tool result. */
export function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** Wraps an error message as a failed tool result (surfaced to the caller, not thrown). */
export function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
