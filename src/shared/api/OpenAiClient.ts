import { googleAuthService } from "@/shared/providers/providerFactory";
import { googleApiFetch } from "@/shared/api/googleApiFetch";

export interface OpenAiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatComplete(
  messages: OpenAiMessage[],
  model = "gpt-4o-mini",
): Promise<string> {
  const response = await googleApiFetch(googleAuthService, "/api/openai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `OpenAI error ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0].message.content;
}

export async function chatCompleteWithWebSearch(
  instructions: string,
  input: string,
  model = "gpt-4o-mini",
): Promise<string> {
  const response = await googleApiFetch(googleAuthService, "/api/openai/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, tools: [{ type: "web_search_preview" }], instructions, input }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `OpenAI error ${response.status}`,
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

export async function transcribeVideo(videoUrl: string): Promise<string> {
  const response = await googleApiFetch(googleAuthService, "/api/openai/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoUrl }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Transcription error ${response.status}`);
  }

  const data = (await response.json()) as { text: string };
  return data.text;
}
