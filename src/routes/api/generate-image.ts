import { createFileRoute } from "@tanstack/react-router";

/**
 * Image generation through direct providers only — no AI gateway.
 *
 * Providers are tried in order and the first one that actually returns image
 * bytes wins. Pollinations is keyless and verified reachable from this runtime;
 * it is the fallback after any keyed provider. The response contract is
 * unchanged: `{ image }` holding a base64 data URL, so in-chat rendering and
 * saveGeneratedImage keep working.
 */

const bytesToDataUrl = (bytes: ArrayBuffer, mime: string): string => {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
};

/** Keyless Pollinations image endpoint (verified: returns image/jpeg bytes). */
async function viaPollinations(prompt: string): Promise<string | null> {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&nologo=true&safe=false`;
  const res = await fetch(url, { headers: { Accept: "image/*" } });
  if (!res.ok) {
    console.warn(`[aura] pollinations image failed (${res.status})`);
    return null;
  }
  const mime = res.headers.get("Content-Type") ?? "";
  if (!mime.startsWith("image/")) {
    console.warn(`[aura] pollinations returned non-image content type: ${mime}`);
    return null;
  }
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) return null;
  return bytesToDataUrl(buf, mime);
}

/** Direct OpenAI Images — only attempted when OPENAI_API_KEY is configured. */
async function viaOpenAI(prompt: string): Promise<string | null> {
  const key = process.env["OPENAI_API_KEY"]?.trim();
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!res.ok) {
    console.warn(`[aura] openai image failed (${res.status})`);
    return null;
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = data.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  return first?.url ?? null;
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        const { prompt } = (await request.json()) as { prompt?: string };
        if (!prompt || !prompt.trim()) {
          return json({ error: "Missing prompt" }, 400);
        }

        const detailed = `A high quality, highly detailed image of ${prompt.trim()}.`;
        const providers: Array<[string, (p: string) => Promise<string | null>]> = [
          ["openai", viaOpenAI],
          ["pollinations", viaPollinations],
        ];

        for (const [name, run] of providers) {
          try {
            const image = await run(detailed);
            if (image) return json({ image });
          } catch (e) {
            console.warn(`[aura] image provider ${name} errored`, e);
          }
        }

        return json({ error: "No image provider available right now." }, 503);
      },
    },
  },
});
