export interface OpenAiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatComplete(
  apiKey: string,
  messages: OpenAiMessage[],
  model = "gpt-4o-mini",
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        `OpenAI error ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0].message.content;
}

export async function chatCompleteWithWebSearch(
  apiKey: string,
  instructions: string,
  input: string,
  model = "gpt-4o-mini",
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      instructions,
      input,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        `OpenAI error ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    output: Array<{
      type: string;
      content?: Array<{ type: string; text: string }>;
    }>;
  };

  const message = data.output.find((o) => o.type === "message");
  const text = message?.content?.find((c) => c.type === "output_text")?.text;
  if (!text) throw new Error("No response from web search");

  return text;
}
