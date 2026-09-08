import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ISheetProvider } from "@/shared/providers/ISheetProvider.js";
import { ok, fail } from "../toolResult.js";

export function registerPendingTools(server: McpServer, provider: ISheetProvider) {
  server.registerTool(
    "board_list_pending",
    {
      title: "List pending items",
      description:
        "Lists the pending-item queue of a board (items waiting to be turned into cards).",
      inputSchema: { boardId: z.string() },
    },
    async ({ boardId }) => {
      try {
        return ok(await provider.loadPendingItems(boardId));
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_create_pending",
    {
      title: "Create pending item",
      description: "Adds a free-text item to a board's pending queue.",
      inputSchema: { boardId: z.string(), description: z.string() },
    },
    async ({ boardId, description }) => {
      try {
        return ok(await provider.createPendingItem(boardId, description));
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_toggle_pending",
    {
      title: "Toggle pending item done",
      description: "Marks a pending item as done or not done.",
      inputSchema: { id: z.string(), done: z.boolean() },
    },
    async ({ id, done }) => {
      try {
        await provider.togglePendingItemDone(id, done);
        return ok({ id, done });
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_delete_pending",
    {
      title: "Delete pending item",
      description: "Permanently removes a single pending item.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await provider.deletePendingItem(id);
        return ok({ deleted: id });
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_clear_completed_pending",
    {
      title: "Clear completed pending items",
      description: "Removes every pending item already marked done in a board.",
      inputSchema: { boardId: z.string() },
    },
    async ({ boardId }) => {
      try {
        await provider.clearCompletedPendingItems(boardId);
        return ok({ cleared: boardId });
      } catch (err) {
        return fail(String(err));
      }
    },
  );
}
