import { useBoardStore } from "@/modules/board/store";
import { chatComplete } from "@/shared/api/OpenAiClient";
import type { CardRecord, FieldDef } from "@/modules/project/domain/types";

const OPTION_TYPES = new Set(["select", "chip", "multiselect"]);

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

export function useAiCardExtraction() {
  const board = useBoardStore((s) => s.board);
  const fields = useBoardStore((s) => s.fields);

  async function extractCard(text: string): Promise<Partial<CardRecord>> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    if (!apiKey) throw new Error("VITE_OPENAI_API_KEY não configurada no .env.local");
    if (!board) throw new Error("Board não carregado");

    const extractableFields = fields.filter(
      (f) => f.editable !== false && f.visible !== false && f.type !== "image",
    );

    const systemPrompt = buildSystemPrompt(
      board.name,
      board.description,
      extractableFields,
    );

    const raw = await chatComplete(apiKey, [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ]);

    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const result: Partial<CardRecord> = {};
    for (const field of extractableFields) {
      if (!(field.id in parsed)) continue;
      result[field.id] = parsed[field.id] as CardRecord[string];
    }

    return result;
  }

  return { extractCard };
}
