export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "longnumber"
  | "bool"
  | "date"
  | "datetime"
  | "url"
  | "image"
  | "icon"
  | "chip"
  | "select"
  | "multiselect"
  | "checklist"
  | "email"
  | "color"
  | "location"
  | "duration";

export interface FieldDef {
  id: string;
  boardId: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  visible?: boolean;
  editable?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  options?: string[];
  width?: number;
  displayOrder?: number;
}

export interface BoardConfig {
  id: string;
  name: string;
  icon: string;
  description?: string;
  groupBy: string;
  orderBy: string;
  cardTitleField: string;
  cardDescriptionField?: string;
  cardClosedLayout: string[];
  cardOpenLayout: string[] | "*";
  archivedColumn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpreadsheetConnection {
  id: string;
  sheetId: string;
  name: string;
  connectedAt: string;
  lastAccessedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface DurationValue {
  value: number;
  unit: "seg" | "min" | "hr" | "dia";
}

export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | ChecklistItem[]
  | DurationValue
  | null
  | undefined;

export interface CardRecord {
  _id: string;
  boardId: string;
  _sort: number;
  _archived: boolean;
  _createdAt: string;
  _updatedAt: string;
  [key: string]: FieldValue | string | number | boolean;
}
