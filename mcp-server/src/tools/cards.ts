import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ISheetProvider } from "@/shared/providers/ISheetProvider.js";
import type { CardRecord } from "@/modules/project/domain/types.js";
import { validateRequiredFields, moveCardAndReorder } from "@/modules/board/domain/cardRules.js";
import { ok, fail } from "../toolResult.js";

// ISheetProvider marks saveCardsBulk optional even though GoogleSheetProvider
// always implements it — fall back to sequential saveCard calls for any
// other future implementation that doesn't.
async function persistCards(provider: ISheetProvider, cards: CardRecord[]): Promise<CardRecord[]> {
  if (provider.saveCardsBulk) return provider.saveCardsBulk(cards);
  const saved: CardRecord[] = [];
  for (const card of cards) saved.push(await provider.saveCard(card));
  return saved;
}

async function findCard(
  provider: ISheetProvider,
  boardId: string,
  cardId: string,
): Promise<CardRecord | undefined> {
  const cards = await provider.loadCards(boardId);
  return cards.find((c) => c._id === cardId);
}

export function registerCardTools(server: McpServer, provider: ISheetProvider) {
  server.registerTool(
    "board_list_cards",
    {
      title: "List cards",
      description:
        "Lists the non-archived cards of a board. Field values are keyed by field ID — use board_list_fields to map IDs to labels.",
      inputSchema: { boardId: z.string() },
    },
    async ({ boardId }) => {
      try {
        return ok(await provider.loadCards(boardId));
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_create_card",
    {
      title: "Create card",
      description:
        "Creates a new card in a board. `values` is a map of field ID to value (use board_list_fields to see the available field IDs, types and which are required). Fails without writing if a required field is missing.",
      inputSchema: {
        boardId: z.string(),
        values: z.record(z.string(), z.unknown()),
      },
    },
    async ({ boardId, values }) => {
      try {
        const fields = await provider.loadFields(boardId);
        const errors = validateRequiredFields(fields, values as Partial<CardRecord>);
        if (Object.keys(errors).length > 0) {
          return fail(`Missing required field(s): ${JSON.stringify(errors)}`);
        }
        return ok(await provider.createCard(boardId, values as Partial<CardRecord>));
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_update_card",
    {
      title: "Update card field values",
      description:
        "Merges `values` into an existing card's field values (does not move it between columns/groups — use board_move_card for that).",
      inputSchema: {
        boardId: z.string(),
        cardId: z.string(),
        values: z.record(z.string(), z.unknown()),
      },
    },
    async ({ boardId, cardId, values }) => {
      try {
        const card = await findCard(provider, boardId, cardId);
        if (!card) return fail(`Card ${cardId} not found in board ${boardId}.`);
        return ok(await provider.saveCard({ ...card, ...values } as CardRecord));
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_move_card",
    {
      title: "Move card between columns/groups",
      description:
        "Moves a card to a different value of the board's grouping field (e.g. a different Kanban column) and renumbers `_sort` across the board, mirroring drag-and-drop in the UI. Optionally place it right before another card.",
      inputSchema: {
        boardId: z.string(),
        cardId: z.string(),
        groupField: z.string().describe("The board's groupBy field ID (see board_list_boards)."),
        targetGroupValue: z.string().describe("The column/group value to move the card into."),
        beforeCardId: z.string().optional(),
      },
    },
    async ({ boardId, cardId, groupField, targetGroupValue, beforeCardId }) => {
      try {
        const cards = await provider.loadCards(boardId);
        if (!cards.some((c) => c._id === cardId)) {
          return fail(`Card ${cardId} not found in board ${boardId}.`);
        }
        const reordered = moveCardAndReorder(
          cards,
          cardId,
          groupField,
          targetGroupValue,
          beforeCardId,
        );
        return ok(await persistCards(provider, reordered));
      } catch (err) {
        return fail(String(err));
      }
    },
  );

  server.registerTool(
    "board_archive_card",
    {
      title: "Archive card",
      description: "Archives a card (soft delete — sets _archived, does not remove the row).",
      inputSchema: { cardId: z.string() },
    },
    async ({ cardId }) => {
      try {
        await provider.deleteCard(cardId);
        return ok({ archived: cardId });
      } catch (err) {
        return fail(String(err));
      }
    },
  );
}
