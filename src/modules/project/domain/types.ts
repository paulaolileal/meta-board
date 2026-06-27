export type FieldType =
  | "text"
  | "longtext"
  | "number"
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
  | "color";

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  default?: unknown;
  visible?: boolean;
  editable?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  options?: string[]; // for select/multiselect/chip; for chip first option is color hint
  width?: number;
  order?: number;
}

export interface ProjectConfig {
  id: string;
  name: string;
  icon: string;
  description?: string;
  version: string;
  theme: "light" | "dark" | "auto";
  groupBy: string;
  orderBy: string;
  cardTitleField: string;
  cardDescriptionField?: string;
  cardClosedLayout: string[]; // field ids
  cardOpenLayout: string[] | "*";
  archivedColumn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | ChecklistItem[]
  | null
  | undefined;

export interface CardRecord {
  _id: string;
  _sort: number;
  _archived: boolean;
  _createdAt: string;
  _updatedAt: string;
  [key: string]: FieldValue | string | number | boolean;
}
