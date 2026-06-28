import { useBoardStore } from "@/modules/board/store";
import { chatComplete, chatCompleteWithWebSearch } from "@/shared/api/OpenAiClient";
import type { CardRecord, FieldDef } from "@/modules/project/domain/types";

const OPTION_TYPES = new Set(["select", "chip", "multiselect"]);

export type FieldSource = "extracted" | "searched";

export interface ExtractionResult {
  values: Partial<CardRecord>;
  sources: Record<string, FieldSource>;
  reasons: Record<string, string>;
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
          ? `, options: [${f.options.join(", ")}]`
          : "";
      return `- ${f.label} (id: ${f.id}, type: ${f.type}${opts})`;
    })
    .join("\n");

  return `You are a precise data extraction assistant. Your only job is to extract explicitly stated information from the user's text into structured board cards.

Board: ${boardName}${boardDescription ? `\nDescription: ${boardDescription}` : ""}

Available fields:
${fieldLines}

VALUE FORMAT per field type:
- text / longtext / url / email / icon / color → string
- number / longnumber → number
- bool → boolean
- date → "YYYY-MM-DD"
- datetime → "YYYY-MM-DDTHH:mm"
- select / chip → exactly one of the listed options (string)
- multiselect → array of listed options (string[])
- checklist → [{id: "<uuid>", text: "<string>", done: false}]
- image → direct URL to an image found in the text. Omit if no image URL is present.

STRICT RULES — violating these produces useless data:

1. NEVER include a field if its value is not explicitly stated in the text.
   An omitted field is always better than a wrong, guessed, or placeholder value.

2. NEVER use filler/placeholder strings. Forbidden examples (in any language):
   "Not Available", "N/A", "Unknown", "Unavailable", "Not specified",
   "Não disponível", "Não especificado", "Não informado", "Sem informação", "-", "—", "?".
   If the information is absent → omit the field key entirely.

3. select / chip: only pick an option if that exact option (or a very clear synonym)
   is explicitly named in the text. When uncertain → omit.

4. multiselect: include ONLY options that are explicitly mentioned in the text.
   Never add options that are "plausible", "typical", or "might apply" — they are wrong if not stated.
   Example: a coffee shop text mentioning only "espresso" and "cappuccino" must NOT include
   "sushi", "burgers", or any other item not mentioned.

5. Do NOT dump multiple facts into a single text/longtext field. Each piece of information
   must go into its own most specific field.

6. If the text describes multiple distinct items, return one card per item.
   If only one item, return an array with one card.

RESPONSE FORMAT — return a single JSON object with two parallel arrays:
{
  "cards": [
    { "<fieldId>": <value>, ... }
  ],
  "reasons": [
    { "<fieldId>": "exact quote or short sentence from the text that proves this value" }
  ]
}

Both arrays must have the same length. Each reasons[i] corresponds to cards[i].
The reason strings must directly cite or paraphrase the source text.`;
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
          ? `, options: [${f.options.join(", ")}]`
          : "";
      return `- ${f.label} (id: ${f.id}, type: ${f.type}${opts})`;
    })
    .join("\n");

  return `You are a data enrichment assistant for a board called "${boardName}"${boardDescription ? ` (${boardDescription})` : ""}.

Already extracted from the user's text:
${extractedLines}

Search the web to find the missing fields below. Use the extracted fields as search context.

Missing fields:
${missingLines}

STRICT RULES:
- Only include fields you found with high confidence from a reliable source.
- NEVER use placeholder strings ("Not Available", "N/A", "Não especificado", etc.) — omit the field instead.
- For multiselect: include only options explicitly confirmed by the source.
- When in doubt → omit.

Return a JSON code block with this exact structure:
\`\`\`json
{
  "values": { "<fieldId>": <value> },
  "reasons": { "<fieldId>": "Source: [brief description or URL where this was found]" }
}
\`\`\``;
}

function extractJsonFromText(text: string): Record<string, unknown> {
  const codeBlock = text.match(/```json\s*([\s\S]*?)```/);
  if (codeBlock) return JSON.parse(codeBlock[1]) as Record<string, unknown>;

  const jsonObject = text.match(/\{[\s\S]*\}/);
  if (jsonObject) return JSON.parse(jsonObject[0]) as Record<string, unknown>;

  return {};
}

function extractSearchResult(text: string): {
  values: Record<string, unknown>;
  reasons: Record<string, unknown>;
} {
  const raw = extractJsonFromText(text);
  if (raw.values && typeof raw.values === "object" && !Array.isArray(raw.values)) {
    return {
      values: raw.values as Record<string, unknown>,
      reasons: ((raw.reasons ?? {}) as Record<string, unknown>),
    };
  }
  return { values: raw, reasons: {} };
}

export function useAiCardExtraction() {
  const board = useBoardStore((s) => s.board);
  const fields = useBoardStore((s) => s.fields);

  async function extractCards(text: string): Promise<ExtractionResult[]> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    if (!apiKey) throw new Error("VITE_OPENAI_API_KEY não configurada no .env.local");
    if (!board) throw new Error("Board não carregado");

    const extractableFields = fields.filter(
      (f) => f.editable !== false && f.visible !== false,
    );

    const systemPrompt = buildSystemPrompt(board.name, board.description, extractableFields);

    const raw = await chatComplete(apiKey, [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ]);

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rawCards = Array.isArray(parsed.cards) ? (parsed.cards as unknown[]) : [parsed];
    const rawReasons = Array.isArray(parsed.reasons) ? (parsed.reasons as unknown[]) : [];

    const phase1Results: ExtractionResult[] = rawCards.map((rawCard, cardIdx) => {
      const cardData = rawCard as Record<string, unknown>;
      const cardReasonData = (rawReasons[cardIdx] ?? {}) as Record<string, unknown>;
      const values: Partial<CardRecord> = {};
      const sources: Record<string, FieldSource> = {};
      const reasons: Record<string, string> = {};

      for (const field of extractableFields) {
        if (!(field.id in cardData)) continue;
        values[field.id] = cardData[field.id] as CardRecord[string];
        sources[field.id] = "extracted";
        if (cardReasonData[field.id]) {
          reasons[field.id] = String(cardReasonData[field.id]);
        }
      }

      return { values, sources, reasons };
    });

    const enriched = await Promise.allSettled(
      phase1Results.map(async (result) => {
        const missingFields = extractableFields.filter((f) => !(f.id in result.values));
        const hasSearchContext = Object.keys(result.values).length > 0;

        if (missingFields.length === 0 || !hasSearchContext) return result;

        try {
          const instructions = buildSearchInstructions(
            board.name,
            board.description,
            extractableFields,
            result.values,
            missingFields,
          );

          const searchText = await chatCompleteWithWebSearch(
            apiKey,
            instructions,
            "Find the missing information using web search.",
          );

          const { values: searchValues, reasons: searchReasons } = extractSearchResult(searchText);
          const enrichedValues = { ...result.values };
          const enrichedSources = { ...result.sources };
          const enrichedReasons = { ...result.reasons };

          for (const field of missingFields) {
            if (!(field.id in searchValues)) continue;
            enrichedValues[field.id] = searchValues[field.id] as CardRecord[string];
            enrichedSources[field.id] = "searched";
            if (searchReasons[field.id]) {
              enrichedReasons[field.id] = String(searchReasons[field.id]);
            }
          }

          return { values: enrichedValues, sources: enrichedSources, reasons: enrichedReasons };
        } catch {
          return result;
        }
      }),
    );

    return enriched.map((r, i) =>
      r.status === "fulfilled" ? r.value : phase1Results[i],
    );
  }

  return { extractCards };
}
