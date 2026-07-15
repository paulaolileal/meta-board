import type {
  BoardConfig,
  CardRecord,
  FieldDef,
  PendingItem,
} from "@/modules/project/domain/types";

export interface ISheetProvider {
  readonly mode: "google";
  loadBoards(): Promise<BoardConfig[]>;
  loadBoard(boardId: string): Promise<BoardConfig>;
  loadFields(boardId: string): Promise<FieldDef[]>;
  loadCards(boardId: string): Promise<CardRecord[]>;
  saveCard(card: CardRecord): Promise<CardRecord>;
  createCard(boardId: string, partial: Partial<CardRecord>): Promise<CardRecord>;
  deleteCard(id: string): Promise<void>;
  saveBoard(board: BoardConfig): Promise<BoardConfig>;
  saveField(field: FieldDef): Promise<FieldDef>;
  createField(field: FieldDef): Promise<FieldDef>;
  deleteField(fieldId: string, boardId: string): Promise<void>;
  sync(): Promise<void>;
  initializeSpreadsheet?(): Promise<void>;
  deleteBoard?(boardId: string): Promise<void>;
  saveCardsBulk?(cards: CardRecord[]): Promise<CardRecord[]>;
  createBoard?(
    config: Omit<BoardConfig, "id" | "createdAt" | "updatedAt">,
    fields: FieldDef[],
  ): Promise<BoardConfig>;
  loadPendingItems(boardId: string): Promise<PendingItem[]>;
  createPendingItem(boardId: string, description: string): Promise<PendingItem>;
  togglePendingItemDone(id: string, done: boolean): Promise<void>;
  deletePendingItem(id: string): Promise<void>;
  clearCompletedPendingItems(boardId: string): Promise<void>;
}
