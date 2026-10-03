/**
 * Server-only client for the AURA Intelligence Gateway (OpenAI-compatible
 * /v1/chat/completions). Reads AURA_API_KEY from the server env only.
 */
import type { ChatMessage } from "@/lib/omniroute/router.server";

const DEFAULT_URL = "https://aura-gateway-nexus.lovable.app/v1/chat/completions";
const TIMEOUT_MS = 60_000;

export class AuraGatewayError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function auraGatewayChat(messages: ChatMessage[]) {
  const apiKey = process.env["AURA_API_KEY"]?.trim();
  if (!apiKey) throw new AuraGatewayError("AI backend is not configured (missing AURA_API_KEY).", 503);
  const url = process.env["AURA_GATEWAY_URL"]?.trim() || DEFAULT_URL;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ messages, stream: false }),
      signal: ctrl.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    console.error("[aura-gateway] request failed:", timedOut ? "timeout" : (e as Error)?.message);
    throw new AuraGatewayError(timedOut ? "AI backend timed out." : "AI backend unreachable.", timedOut ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    console.error("[aura-gateway] upstream status", res.status);
    const status = res.status === 401 || res.status === 403 ? 502 : res.status === 429 ? 429 : 502;
    const msg =
      res.status === 429 ? "AI backend is busy, please retry shortly." :
      res.status === 401 || res.status === 403 ? "AI backend rejected the server credentials." :
      "AI backend error.";
    throw new AuraGatewayError(msg, status);
  }

  const data = (await res.json().catch(() => null)) as
    | { model?: string; provider?: string; choices?: Array<{ message?: { content?: unknown } }> }
    | null;
  const raw = data?.choices?.[0]?.message?.content;
  const content =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((p: { text?: string }) => p?.text ?? "").join("")
        : "";
  if (!content) throw new AuraGatewayError("AI backend returned an empty reply.", 502);
  return { content, provider: data?.provider ?? "aura-gateway", model: data?.model ?? "aura" };
}
