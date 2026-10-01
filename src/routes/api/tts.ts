import { createFileRoute } from "@tanstack/react-router";
import { resolvePersona } from "@/lib/jarvisPersonas";

/**
 * Text-to-speech through a direct provider only.
 *
 * OpenAI is the one speech provider this project can talk to directly, so it is
 * used when OPENAI_API_KEY is configured. With no configured direct TTS
 * provider the route stays safe and returns TTS_NOT_CONFIGURED (503); the
 * client already falls back to the built-in browser voice on any non-2xx, so
 * read-aloud and Live Voice keep working.
 */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text, voice, speed, pitch, persona } = (await request.json()) as {
          text?: string;
          voice?: string;
          speed?: number;
          pitch?: number;
          persona?: string;
        };
        if (!text || !text.trim()) {
          return new Response("Missing text", { status: 400 });
        }

        const openaiKey = process.env["OPENAI_API_KEY"]?.trim();
        if (!openaiKey) {
          return new Response(JSON.stringify({ error: "TTS_NOT_CONFIGURED" }), {
            status: 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }

        const p10 = resolvePersona(persona);
        const clampedSpeed = Math.min(1.3, Math.max(0.7, Number(speed) || 0.95));
        const p = Math.min(3, Math.max(-3, Math.round(Number(pitch) || 0)));
        const pitchInstruction =
          p <= -3 ? "Use a very deep, bassy chest-resonant pitch."
          : p === -2 ? "Use a noticeably deep, low pitch."
          : p === -1 ? "Use a slightly lower, warmer pitch."
          : p === 0 ? "Use your natural pitch."
          : p === 1 ? "Use a slightly brighter, higher pitch."
          : p === 2 ? "Use a noticeably higher, lighter pitch."
          : "Use a very high, bright pitch.";

        try {
          const res = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini-tts",
              input: text,
              voice: voice ?? p10.voice,
              response_format: "mp3",
              instructions: `You are ${p10.label}, an advanced AI assistant. ${p10.ttsInstructions} ${pitchInstruction} When speaking Telugu, keep the same demeanor with clear natural pronunciation.`,
              speed: clampedSpeed,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.warn(`[aura] openai tts failed (${res.status})`);
            return new Response(errText, { status: res.status });
          }

          return new Response(res.body, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.warn("[aura] openai tts network error", e);
          return new Response(JSON.stringify({ error: "tts_unreachable" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
