import { verifyGoogleAuth } from "../_lib/verifyGoogleAuth";

export const config = { maxDuration: 60 };

const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

interface TranscribeBody {
  videoUrl?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await verifyGoogleAuth(req);
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

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    return Response.json({ error: "Could not fetch video from the provided URL" }, { status: 422 });
  }

  const contentLength = Number(videoResponse.headers.get("content-length") ?? 0);
  if (contentLength > MAX_VIDEO_BYTES) {
    return Response.json({ error: "Video exceeds the 25MB transcription limit" }, { status: 413 });
  }

  const videoBlob = await videoResponse.blob();
  if (videoBlob.size > MAX_VIDEO_BYTES) {
    return Response.json({ error: "Video exceeds the 25MB transcription limit" }, { status: 413 });
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
}
