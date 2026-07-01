import type { GoogleAuthService } from "@/shared/auth/GoogleAuthService";
import { SheetsApiClient } from "@/shared/api/SheetsApiClient";
import type { ISheetProvider } from "./ISheetProvider";
import type {
  BoardConfig,
  CardRecord,
  FieldDef,
  FieldType,
  FieldValue,
  ChecklistItem,
  DurationValue,
} from "@/modules/project/domain/types";

// snake_case ↔ camelCase helpers (preserve leading underscores)
function toCamel(snake: string): string {
  const prefix = snake.match(/^_+/)?.[0] ?? "";
  const rest = snake.slice(prefix.length);
  return prefix + rest.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// Column letter from 1-based index (A=1, Z=26, AA=27...)
function colLetter(n: number): string {
  let result = "";
  let remaining = n;
  while (remaining > 0) {
    result = String.fromCharCode(65 + ((remaining - 1) % 26)) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return result;
}

const BOARDS_HEADERS = [
  "id",
  "name",
  "icon",
  "description",
  "group_by",
  "order_by",
  "card_title_field",
  "card_description_field",
  "card_closed_layout",
  "card_open_layout",
  "archived_column",
  "created_at",
  "updated_at",
  "color",
];

const FIELDS_HEADERS = [
  "id",
  "board_id",
  "label",
  "type",
  "required",
  "default_value",
  "visible",
  "editable",
  "searchable",
  "sortable",
  "options",
  "width",
  "display_order",
];

const CARDS_FIXED_HEADERS = [
  "_id",
  "board_id",
  "_sort",
  "_archived",
  "_created_at",
  "_updated_at",
  "values",
];

export const DEFAULT_BOARD_FIELDS: Array<Omit<FieldDef, "boardId">> = [
  {
    id: "title",
    label: "Título",
    type: "text",
    required: true,
    visible: true,
    editable: true,
    searchable: true,
    displayOrder: 1,
  },
  {
    id: "description",
    label: "Descrição",
    type: "longtext",
    visible: true,
    editable: true,
    displayOrder: 2,
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    visible: true,
    editable: true,
    sortable: true,
    options: ["Backlog", "Em progresso", "Revisão", "Concluído"],
    displayOrder: 3,
  },
  {
    id: "priority",
    label: "Prioridade",
    type: "chip",
    visible: true,
    editable: true,
    options: ["Baixa", "Média", "Alta", "Urgente"],
    displayOrder: 4,
  },
  {
    id: "due_date",
    label: "Vencimento",
    type: "date",
    visible: true,
    editable: true,
    sortable: true,
    displayOrder: 5,
  },
  {
    id: "cover_image",
    label: "Capa",
    type: "image",
    visible: true,
    editable: true,
    displayOrder: 6,
  },
  {
    id: "tags",
    label: "Tags",
    type: "multiselect",
    visible: true,
    editable: true,
    options: ["design", "frontend", "backend", "infra", "docs", "bug"],
    displayOrder: 7,
  },
  {
    id: "checklist",
    label: "Checklist",
    type: "checklist",
    visible: true,
    editable: true,
    displayOrder: 8,
  },
  { id: "link", label: "Link", type: "url", visible: true, editable: true, displayOrder: 9 },
];

function now(): string {
  return new Date().toISOString();
}

export class GoogleSheetProvider implements ISheetProvider {
  readonly mode = "google" as const;
  private readonly api: SheetsApiClient;

  constructor(
    private readonly sheetId: string,
    auth: GoogleAuthService,
  ) {
    this.api = new SheetsApiClient(auth);
  }

  async loadBoards(): Promise<BoardConfig[]> {
    const values = await this.api.getValues(this.sheetId, "_boards");
    if (values.length < 2) return [];
    const [headers, ...rows] = values;
    return rows.filter((row) => row[0]).map((row) => this.rowToBoardConfig(headers, row));
  }

  async loadBoard(boardId: string): Promise<BoardConfig> {
    const boards = await this.loadBoards();
    const board = boards.find((b) => b.id === boardId);
    if (!board) throw new Error(`Board ${boardId} não encontrado na planilha`);
    return board;
  }

  async loadFields(boardId: string): Promise<FieldDef[]> {
    const values = await this.api.getValues(this.sheetId, "_fields");
    if (values.length < 2) return [];
    const [headers, ...rows] = values;
    return rows
      .filter((row) => row[0] && row[1] === boardId)
      .map((row) => this.rowToFieldDef(headers, row));
  }

  async loadCards(boardId: string): Promise<CardRecord[]> {
    const [cardValues, fieldValues] = await Promise.all([
      this.api.getValues(this.sheetId, "_cards"),
      this.api.getValues(this.sheetId, "_fields"),
    ]);

    if (cardValues.length < 2) return [];
    const [cardHeaders, ...cardRows] = cardValues;
    const fieldMap = this.buildFieldTypeMap(fieldValues, boardId);

    return cardRows
      .filter((row) => row[0] && row[1] === boardId && row[3] !== "true" && row[3] !== "TRUE")
      .map((row) => this.rowToCardRecord(cardHeaders, row, fieldMap));
  }

  async saveCard(card: CardRecord): Promise<CardRecord> {
    const values = await this.api.getValues(this.sheetId, "_cards");
    if (values.length < 2) throw new Error("Aba _cards não encontrada");

    const [headers, ...rows] = values;
    const rowIndex = rows.findIndex((row) => row[0] === card._id);
    if (rowIndex < 0) throw new Error(`Card ${card._id} não encontrado`);

    const updated = { ...card, _updatedAt: now() };
    const newRow = this.cardToRow(headers, updated);
    const sheetRow = rowIndex + 2;
    await this.api.setValues(
      this.sheetId,
      `_cards!A${sheetRow}:${colLetter(headers.length)}${sheetRow}`,
      [newRow],
    );
    return updated;
  }

  async createCard(boardId: string, partial: Partial<CardRecord>): Promise<CardRecord> {
    const values = await this.api.getValues(this.sheetId, "_cards");
    const headers = values[0] ?? CARDS_FIXED_HEADERS;

    const card: CardRecord = {
      _id: crypto.randomUUID(),
      boardId,
      _sort: Math.max(0, values.length - 1),
      _archived: false,
      _createdAt: now(),
      _updatedAt: now(),
      ...partial,
    };

    await this.api.appendValues(this.sheetId, "_cards", [this.cardToRow(headers, card)]);
    return card;
  }

  async deleteCard(id: string): Promise<void> {
    const values = await this.api.getValues(this.sheetId, "_cards");
    if (values.length < 2) return;

    const [headers, ...rows] = values;
    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex < 0) return;

    const archivedIndex = headers.indexOf("_archived");
    if (archivedIndex < 0) return;

    const sheetRow = rowIndex + 2;
    await this.api.setValues(this.sheetId, `_cards!${colLetter(archivedIndex + 1)}${sheetRow}`, [
      ["true"],
    ]);
  }

  async deleteBoard(boardId: string): Promise<void> {
    const values = await this.api.getValues(this.sheetId, "_boards");
    if (values.length < 2) return;
    const [headers, ...rows] = values;
    const rowIndex = rows.findIndex((row) => row[0] === boardId);
    if (rowIndex < 0) return;
    const sheetRow = rowIndex + 2;
    const emptyRow = Array(headers.length).fill("");
    await this.api.setValues(
      this.sheetId,
      `_boards!A${sheetRow}:${colLetter(headers.length)}${sheetRow}`,
      [emptyRow],
    );
  }

  async saveBoard(board: BoardConfig): Promise<BoardConfig> {
    const values = await this.api.getValues(this.sheetId, "_boards");
    if (values.length < 2) throw new Error("Aba _boards não encontrada");
    const [initialHeaders, ...rows] = values;
    let headers = initialHeaders;

    if (!headers.includes("color")) {
      await this.api.setValues(this.sheetId, `_boards!${colLetter(headers.length + 1)}1`, [
        ["color"],
      ]);
      headers = [...headers, "color"];
    }

    const rowIndex = rows.findIndex((row) => row[0] === board.id);
    if (rowIndex < 0) throw new Error(`Board ${board.id} não encontrado`);
    const updated = { ...board, updatedAt: now() };
    const newRow = this.boardConfigToRow(updated);
    const sheetRow = rowIndex + 2;
    await this.api.setValues(
      this.sheetId,
      `_boards!A${sheetRow}:${colLetter(newRow.length)}${sheetRow}`,
      [newRow],
    );
    return updated;
  }

  async saveField(field: FieldDef): Promise<FieldDef> {
    const values = await this.api.getValues(this.sheetId, "_fields");
    if (values.length < 2) throw new Error("Aba _fields não encontrada");
    const [headers, ...rows] = values;
    const rowIndex = rows.findIndex((row) => row[0] === field.id && row[1] === field.boardId);
    if (rowIndex < 0) throw new Error(`Campo ${field.id} não encontrado`);
    const newRow = this.fieldDefToRow(field);
    const sheetRow = rowIndex + 2;
    await this.api.setValues(
      this.sheetId,
      `_fields!A${sheetRow}:${colLetter(headers.length)}${sheetRow}`,
      [newRow],
    );
    return field;
  }

  async createField(field: FieldDef): Promise<FieldDef> {
    await this.api.appendValues(this.sheetId, "_fields", [this.fieldDefToRow(field)]);
    return field;
  }

  async sync(): Promise<void> {
    // Writes are synchronous per-operation; no batch buffer needed yet
  }

  async initializeSpreadsheet(): Promise<void> {
    const meta = await this.api.getSpreadsheetMetadata(this.sheetId);
    const existingTitles = meta.sheets.map((s) => s.properties.title);

    const tabsToCreate = (["_boards", "_fields", "_cards"] as const).filter(
      (title) => !existingTitles.includes(title),
    );

    if (tabsToCreate.length) {
      await this.api.batchUpdate(
        this.sheetId,
        tabsToCreate.map((title) => ({ addSheet: { properties: { title } } })),
      );
    }

    // Only write headers to tabs that have no data yet — never overwrite existing data
    const [boardsRow, fieldsRow, cardsRow] = await Promise.all([
      this.api.getValues(this.sheetId, "_boards!A1:A1"),
      this.api.getValues(this.sheetId, "_fields!A1:A1"),
      this.api.getValues(this.sheetId, "_cards!A1:A1"),
    ]);

    await Promise.all([
      !boardsRow[0]?.length
        ? this.api.setValues(this.sheetId, `_boards!A1:${colLetter(BOARDS_HEADERS.length)}1`, [
            BOARDS_HEADERS,
          ])
        : Promise.resolve(),
      !fieldsRow[0]?.length
        ? this.api.setValues(this.sheetId, `_fields!A1:${colLetter(FIELDS_HEADERS.length)}1`, [
            FIELDS_HEADERS,
          ])
        : Promise.resolve(),
      !cardsRow[0]?.length
        ? this.api.setValues(this.sheetId, `_cards!A1:${colLetter(CARDS_FIXED_HEADERS.length)}1`, [
            CARDS_FIXED_HEADERS,
          ])
        : Promise.resolve(),
    ]);

    // Migrate _boards: append "color" column header if missing
    if (boardsRow[0]?.length && !boardsRow[0].includes("color")) {
      const currentHeaders = await this.api.getValues(this.sheetId, "_boards!A1:Z1");
      const headerRow = currentHeaders[0] ?? [];
      if (headerRow.length > 0 && !headerRow.includes("color")) {
        await this.api.setValues(this.sheetId, `_boards!${colLetter(headerRow.length + 1)}1`, [
          ["color"],
        ]);
      }
    }
  }

  async createBoard(
    config: Omit<BoardConfig, "id" | "createdAt" | "updatedAt">,
    fields: FieldDef[],
  ): Promise<BoardConfig> {
    const newBoard: BoardConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: now(),
      updatedAt: now(),
    };

    await this.api.appendValues(this.sheetId, "_boards", [this.boardConfigToRow(newBoard)]);

    if (fields.length) {
      const rows = fields.map((f) => this.fieldDefToRow({ ...f, boardId: newBoard.id }));
      await this.api.appendValues(this.sheetId, "_fields", rows);
    }

    return newBoard;
  }

  private buildFieldTypeMap(fieldValues: string[][], boardId: string): Map<string, FieldType> {
    const map = new Map<string, FieldType>();
    if (fieldValues.length < 2) return map;
    const [headers, ...rows] = fieldValues;
    const idIdx = headers.indexOf("id");
    const boardIdx = headers.indexOf("board_id");
    const typeIdx = headers.indexOf("type");
    rows
      .filter((r) => r[boardIdx] === boardId && r[idIdx])
      .forEach((r) => map.set(r[idIdx], r[typeIdx] as FieldType));
    return map;
  }

  private rowToBoardConfig(headers: string[], row: string[]): BoardConfig {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[toCamel(h)] = row[i] ?? "";
    });
    return {
      id: obj.id,
      name: obj.name,
      icon: obj.icon || "KanbanSquare",
      color: obj.color || undefined,
      description: obj.description || undefined,
      groupBy: obj.groupBy || "status",
      orderBy: obj.orderBy || "_sort",
      cardTitleField: obj.cardTitleField || "title",
      cardDescriptionField: obj.cardDescriptionField || undefined,
      cardClosedLayout: obj.cardClosedLayout
        ? obj.cardClosedLayout.split(",").map((s) => s.trim())
        : ["title"],
      cardOpenLayout:
        obj.cardOpenLayout === "*" || !obj.cardOpenLayout
          ? "*"
          : obj.cardOpenLayout.split(",").map((s) => s.trim()),
      archivedColumn: obj.archivedColumn || undefined,
      createdAt: obj.createdAt || now(),
      updatedAt: obj.updatedAt || now(),
    };
  }

  private boardConfigToRow(board: BoardConfig): string[] {
    return BOARDS_HEADERS.map((h) => {
      const key = toCamel(h) as keyof BoardConfig;
      const val = board[key];
      if (Array.isArray(val)) return val.join(",");
      return String(val ?? "");
    });
  }

  private rowToFieldDef(headers: string[], row: string[]): FieldDef {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[toCamel(h)] = row[i] ?? "";
    });
    return {
      id: obj.id,
      boardId: obj.boardId,
      label: obj.label,
      type: obj.type as FieldType,
      required: obj.required === "true",
      defaultValue: obj.defaultValue || undefined,
      visible: obj.visible !== "false",
      editable: obj.editable !== "false",
      searchable: obj.searchable !== "false",
      sortable: obj.sortable === "true",
      options: obj.options ? obj.options.split(",").map((s) => s.trim()) : undefined,
      width: obj.width ? Number(obj.width) : undefined,
      displayOrder: obj.displayOrder ? Number(obj.displayOrder) : undefined,
    };
  }

  private fieldDefToRow(field: FieldDef): string[] {
    return FIELDS_HEADERS.map((h) => {
      const key = toCamel(h) as keyof FieldDef;
      const val = field[key];
      if (Array.isArray(val)) return (val as string[]).join(",");
      if (val == null) return "";
      return String(val);
    });
  }

  private rowToCardRecord(
    headers: string[],
    row: string[],
    fieldTypes: Map<string, FieldType>,
  ): CardRecord {
    const record: CardRecord = {
      _id: "",
      boardId: "",
      _sort: 0,
      _archived: false,
      _createdAt: "",
      _updatedAt: "",
    };

    headers.forEach((h, i) => {
      const raw = (row[i] ?? "").trim();
      if (h === "_id") {
        record._id = raw;
        return;
      }
      if (h === "board_id") {
        record.boardId = raw;
        return;
      }
      if (h === "_sort") {
        record._sort = Number(raw) || 0;
        return;
      }
      if (h === "_archived") {
        record._archived = raw === "true" || raw === "TRUE";
        return;
      }
      if (h === "_created_at") {
        record._createdAt = raw;
        return;
      }
      if (h === "_updated_at") {
        record._updatedAt = raw;
        return;
      }
      if (h === "values") {
        const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
        for (const [fieldId, val] of Object.entries(parsed)) {
          const type = fieldTypes.get(fieldId);
          record[fieldId] = type ? this.deserializeTypedValue(val, type) : (val as FieldValue);
        }
      }
    });

    return record;
  }

  private cardToRow(headers: string[], card: CardRecord): string[] {
    return headers.map((h) => {
      if (h === "_id") return card._id;
      if (h === "board_id") return card.boardId as string;
      if (h === "_sort") return String(card._sort);
      if (h === "_archived") return String(card._archived);
      if (h === "_created_at") return card._createdAt;
      if (h === "_updated_at") return card._updatedAt;
      if (h === "values") {
        const values: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(card)) {
          if (key.startsWith("_") || key === "boardId") continue;
          if (val != null) values[key] = val;
        }
        return JSON.stringify(values);
      }
      return "";
    });
  }

  // Accepts unknown because values come from JSON.parse — no string-to-type coercion needed for most types
  private deserializeTypedValue(val: unknown, type: FieldType): FieldValue {
    if (val == null) return undefined;
    switch (type) {
      case "bool":
        return typeof val === "boolean" ? val : String(val).toLowerCase() === "true";
      case "number":
      case "longnumber":
        return typeof val === "number" ? val : Number(val);
      case "multiselect":
        return Array.isArray(val) ? (val as string[]) : [];
      case "checklist":
        return Array.isArray(val) ? (val as ChecklistItem[]) : [];
      case "duration":
        return typeof val === "object" && !Array.isArray(val) ? (val as DurationValue) : undefined;
      default:
        return String(val ?? "");
    }
  }
}
