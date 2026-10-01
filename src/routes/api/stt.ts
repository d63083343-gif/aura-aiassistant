import { createFileRoute } from "@tanstack/react-router";

/**
 * Speech-to-text. Runs directly against Groq Whisper (whisper-large-v3) with
 * the project's own GROQ_API_KEY — no AI gateway in the path.
 *
 * Response contract is unchanged: OpenAI-compatible JSON with a `text` field,
 * or `{ error }` with a non-2xx status.
 */
export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        const key = process.env["GROQ_API_KEY"]?.trim();
        if (!key) return json({ error: "STT_NOT_CONFIGURED" }, 503);

        let file: unknown;
        try {
          const form = await request.formData();
          file = form.get("file");
        } catch {
          return json({ error: "invalid_form_data" }, 400);
        }

        if (!(file instanceof File) || file.size < 512) {
          return json({ error: "empty_audio" }, 400);
        }

        const upstream = new FormData();
        upstream.append("model", "whisper-large-v3");
        upstream.append("response_format", "json");
        upstream.append("file", file, file.name || "recording.wav");

        try {
          const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: upstream,
          });

          const text = await res.text();
          if (!res.ok) {
            console.warn(`[aura] groq stt failed (${res.status})`);
            return json({ error: text || "stt_failed" }, res.status);
          }
          return new Response(text, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.warn("[aura] groq stt network error", e);
          return json({ error: "stt_unreachable" }, 502);
        }
      },
    },
  },
});
