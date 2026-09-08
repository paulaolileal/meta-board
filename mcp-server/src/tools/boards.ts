import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ISheetProvider } from "@/shared/providers/ISheetProvider.js";
import { ok, fail } from "../toolResult.js";

export function registerBoardTools(server: McpServer, provider: ISheetProvider) {
  server.registerTool(
    "board_list_boards",
    {
      title: "List boards",
      description: "Lists every board configured in the meta-board spreadsheet.",
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await provider.loadBoards());
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_list_fields",
    {
      title: "List board fields",
      description:
        "Lists the field schema (columns) of a board — needed to know which field IDs to use in board_create_card/board_update_card, which are required, and which options a select/multiselect field allows.",
      inputSchema: { boardId: z.string() },
    },
    async ({ boardId }) => {
      try {
        return ok(await provider.loadFields(boardId));
      } catch (err) {
        return fail(String(err));
      }
    },
  );
}
