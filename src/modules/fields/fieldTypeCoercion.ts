import type {
  CardRecord,
  ChecklistItem,
  DurationValue,
  FieldType,
  FieldValue,
} from "@/modules/project/domain/types";

const TEXT_TYPES: FieldType[] = ["text", "longtext"];
const NUMBER_TYPES: FieldType[] = ["number", "longnumber"];
const DATE_TYPES: FieldType[] = ["date", "datetime"];
const OPTION_TYPES: FieldType[] = ["select", "chip", "multiselect"];

const COMPATIBLE_GROUPS: FieldType[][] = [TEXT_TYPES, NUMBER_TYPES, DATE_TYPES, OPTION_TYPES];

// Conversions within the same group are lossless-ish; anything else may drop data.
export function areTypesCompatible(a: FieldType, b: FieldType): boolean {
  return a === b || COMPATIBLE_GROUPS.some((group) => group.includes(a) && group.includes(b));
}

function flattenToStrings(value: FieldValue): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ? item : ((item as ChecklistItem)?.text ?? String(item)),
      )
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === "object") {
    const d = value as DurationValue;
    return [`${d.value} ${d.unit}`];
  }
  const s = String(value).trim();
  return s ? [s] : [];
}

function toStringValue(value: FieldValue): string {
  return flattenToStrings(value).join(", ");
}

function toNumberValue(value: FieldValue): number | undefined {
  const [first] = flattenToStrings(value);
  if (first === undefined) return undefined;
  const n = Number(first);
  return Number.isNaN(n) ? undefined : n;
}

function toBoolValue(value: FieldValue): boolean {
  const s = (flattenToStrings(value)[0] ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "sim";
}

// Best-effort transform of a card's field value when its type changes.
// Same-group conversions (e.g. select <-> multiselect) preserve data faithfully;
// cross-group conversions fall back to a reasonable coercion, clearing the value
// when there's no sensible mapping (e.g. anything -> checklist/duration).
export function coerceFieldValue(
  value: FieldValue,
  fromType: FieldType,
  toType: FieldType,
): FieldValue {
  if (fromType === toType) return value;
  if (value == null || value === "") return value;

  if (OPTION_TYPES.includes(fromType) && OPTION_TYPES.includes(toType)) {
    return toType === "multiselect" ? flattenToStrings(value) : (flattenToStrings(value)[0] ?? "");
  }
  if (
    (TEXT_TYPES.includes(fromType) && TEXT_TYPES.includes(toType)) ||
    (DATE_TYPES.includes(fromType) && DATE_TYPES.includes(toType))
  ) {
    return toStringValue(value);
  }
  if (NUMBER_TYPES.includes(fromType) && NUMBER_TYPES.includes(toType)) {
    return toNumberValue(value);
  }

  switch (toType) {
    case "text":
    case "longtext":
    case "url":
    case "location":
    case "color":
    case "email":
    case "icon":
    case "date":
    case "datetime":
      return toStringValue(value);
    case "number":
    case "longnumber":
      return toNumberValue(value);
    case "bool":
      return toBoolValue(value);
    case "select":
    case "chip":
      return flattenToStrings(value)[0] ?? "";
    case "multiselect":
      return flattenToStrings(value);
    case "checklist":
    case "duration":
    default:
      return undefined;
  }
}

// Collects distinct values already used by cards for a field, in first-seen order —
// used to auto-generate options when converting a field into an options-based type.
export function collectDistinctOptionValues(cards: CardRecord[], fieldId: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const card of cards) {
    for (const s of flattenToStrings(card[fieldId] as FieldValue)) {
      if (!seen.has(s)) {
        seen.add(s);
        ordered.push(s);
      }
    }
  }
  return ordered;
}
