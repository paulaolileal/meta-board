import { verifyGoogleAuth } from "../_lib/verifyGoogleAuth.js";

export const config = { maxDuration: 60 };

const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

interface TranscribeBody {
  videoUrl?: string;
}

// Named per-method export (not `export default function handler`) is what makes
// Vercel's Node.js runtime hand this a Web API Request instead of a classic
// http.IncomingMessage — the default-export form doesn't get the Fetch API req/res.
export async function POST(req: Request): Promise<Response> {
  const auth = await verifyGoogleAuth(req.headers.get("authorization"));
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { videoUrl } = (await req.json()) as TranscribeBody;
  if (!videoUrl) {
    return Response.json({ error: "Missing videoUrl" }, { status: 400 });
  }

  try {
    const videoResponse = await fetch(videoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!videoResponse.ok) {
      return Response.json(
        { error: `Could not fetch video from the provided URL (status ${videoResponse.status})` },
        { status: 422 },
      );
    }

    const contentLength = Number(videoResponse.headers.get("content-length") ?? 0);
    if (contentLength > MAX_VIDEO_BYTES) {
      return Response.json(
        { error: "Video exceeds the 25MB transcription limit" },
        { status: 413 },
      );
    }

    const videoBlob = await videoResponse.blob();
    if (videoBlob.size > MAX_VIDEO_BYTES) {
      return Response.json(
        { error: "Video exceeds the 25MB transcription limit" },
        { status: 413 },
      );
    }

    const form = new FormData();
    form.append("file", videoBlob, "video.mp4");
    form.append("model", "whisper-1");

    const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return Response.json(data, { status: upstream.status });
    }

    return Response.json({ text: (data as { text: string }).text });
  } catch (error) {
    console.error("Transcription failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Transcription failed: ${message}` }, { status: 500 });
  }
}
