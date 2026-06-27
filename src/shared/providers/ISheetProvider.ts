import type { CardRecord, FieldDef, ProjectConfig } from "@/modules/project/domain/types";

export interface ISheetProvider {
  readonly mode: "mock" | "google";
  loadProject(): Promise<ProjectConfig>;
  loadFields(): Promise<FieldDef[]>;
  loadCards(): Promise<CardRecord[]>;
  saveCard(card: CardRecord): Promise<CardRecord>;
  createCard(partial: Partial<CardRecord>): Promise<CardRecord>;
  deleteCard(id: string): Promise<void>;
  sync(): Promise<void>;
}
