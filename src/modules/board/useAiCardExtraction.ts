import { useBoardStore } from "@/modules/board/store";
import { chatComplete, chatCompleteWithWebSearch } from "@/shared/api/OpenAiClient";
import type { CardRecord, FieldDef } from "@/modules/project/domain/types";

const OPTION_TYPES = new Set(["select", "chip", "multiselect"]);

export type FieldSource = "extracted" | "searched";

export interface ExtractionResult {
  values: Partial<CardRecord>;
  sources: Record<string, FieldSource>;
}

function buildSystemPrompt(
  boardName: string,
  boardDescription: string | undefined,
  fields: FieldDef[],
): string {
  const fieldLines = fields
    .map((f) => {
      const opts =
        OPTION_TYPES.has(f.type) && f.options?.length
          ? `, options: ${f.options.join(", ")}`
          : "";
      return `- ${f.label} (id: ${f.id}, type: ${f.type}${opts})`;
    })
    .join("\n");

  return `You are a data extraction assistant. Extract information from the user's text to fill in a board card.

Board: ${boardName}${boardDescription ? `\nDescription: ${boardDescription}` : ""}

Available fields:
${fieldLines}

Respond with a JSON object where keys are field IDs and values match each type:
- text / longtext / url / email / icon / color: string
- number / longnumber: number
- bool: boolean
- date: "YYYY-MM-DD"
- datetime: "YYYY-MM-DDTHH:mm"
- select / chip: one of the listed options (string)
- multiselect: array of listed options (string[])
- checklist: [{id: "<uuid>", text: "<string>", done: false}]
- image: omit — cannot extract from text

Only include fields where you have reasonable confidence. Omit fields you cannot extract. Never guess.`;
}

function buildSearchInstructions(
  boardName: string,
  boardDescription: string | undefined,
  extractedFields: FieldDef[],
  extractedValues: Partial<CardRecord>,
  missingFields: FieldDef[],
): string {
  const extractedLines = extractedFields
    .filter((f) => f.id in extractedValues)
    .map((f) => `- ${f.label}: ${String(extractedValues[f.id])}`)
    .join("\n");

  const missingLines = missingFields
    .map((f) => {
      const opts =
        OPTION_TYPES.has(f.type) && f.options?.length
          ? `, options: ${f.options.join(", ")}`
          : "";
      return `- ${f.label} (id: ${f.id}, type: ${f.type}${opts})`;
    })
    .join("\n");

  return `You are a data enrichment assistant for a board called "${boardName}"${boardDescription ? ` (${boardDescription})` : ""}.

The following fields were already extracted from the user's text:
${extractedLines}

Search the web to find information for the missing fields listed below. Use the already-extracted fields as the search context.

Missing fields to find:
${missingLines}

Return ONLY a JSON code block with the found fields. Keys must be field IDs and values must match each type:
- text / longtext / url / email / icon / color: string
- number / longnumber: number
- bool: boolean
- date: "YYYY-MM-DD"
- datetime: "YYYY-MM-DDTHH:mm"
- select / chip: one of the listed options (string)
- multiselect: array of listed options (string[])
- checklist: [{id: "<uuid>", text: "<string>", done: false}]

Only include fields with reliable information found. Omit fields not found. Format your JSON inside a code block like:
\`\`\`json
{ "fieldId": "value" }
\`\`\``;
}

function extractJsonFromText(text: string): Record<string, unknown> {
  const codeBlock = text.match(/```json\s*([\s\S]*?)```/);
  if (codeBlock) return JSON.parse(codeBlock[1]) as Record<string, unknown>;

  const jsonObject = text.match(/\{[\s\S]*\}/);
  if (jsonObject) return JSON.parse(jsonObject[0]) as Record<string, unknown>;

  return {};
}

export function useAiCardExtraction() {
  const board = useBoardStore((s) => s.board);
  const fields = useBoardStore((s) => s.fields);

  async function extractCard(text: string): Promise<ExtractionResult> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    if (!apiKey) throw new Error("VITE_OPENAI_API_KEY não configurada no .env.local");
    if (!board) throw new Error("Board não carregado");

    const extractableFields = fields.filter(
      (f) => f.editable !== false && f.visible !== false && f.type !== "image",
    );

    const systemPrompt = buildSystemPrompt(board.name, board.description, extractableFields);

    const raw = await chatComplete(apiKey, [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ]);

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const values: Partial<CardRecord> = {};
    const sources: Record<string, FieldSource> = {};

    for (const field of extractableFields) {
      if (!(field.id in parsed)) continue;
      values[field.id] = parsed[field.id] as CardRecord[string];
      sources[field.id] = "extracted";
    }

    const missingFields = extractableFields.filter((f) => !(f.id in values));
    const hasSearchContext = Object.keys(values).length > 0;

    if (missingFields.length > 0 && hasSearchContext) {
      try {
        const instructions = buildSearchInstructions(
          board.name,
          board.description,
          extractableFields,
          values,
          missingFields,
        );

        const searchText = await chatCompleteWithWebSearch(
          apiKey,
          instructions,
          "Find the missing information using web search.",
        );

        const searchParsed = extractJsonFromText(searchText);

        for (const field of missingFields) {
          if (!(field.id in searchParsed)) continue;
          values[field.id] = searchParsed[field.id] as CardRecord[string];
          sources[field.id] = "searched";
        }
      } catch {
        // Web search failed silently — proceed with Phase 1 results only
      }
    }

    return { values, sources };
  }

  return { extractCard };
}
