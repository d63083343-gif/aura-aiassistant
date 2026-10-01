import { createFileRoute } from "@tanstack/react-router";
import type { ChatMessage, ContentBlock } from "@/lib/omniroute/router.server";
import { resolvePersona } from "@/lib/jarvisPersonas";

const BASE_PROMPT = `You are an advanced AI assistant inspired by Tony Stark's assistant from Iron Man. You are witty, elegant and precise.

CRITICAL LANGUAGE RULE:
- Detect the language of the user's message.
- If the user speaks or writes in Telugu (even in Roman script / Tenglish), reply in NATURAL TELUGU using Telugu script (తెలుగు).
- If the user speaks English, reply in English.
- If the user mixes them, reply in the dominant language.

When the user attaches an image, analyze it carefully and answer questions about it. Describe what you see, identify objects, read any text, and respond to the user's request about the image.

RESPONSE FORMAT (typed chat): reply like ChatGPT using clean Markdown — short questions get short answers; complex or technical ones get structure with headings, paragraphs, bullet/numbered lists, tables when comparing, and fenced code blocks with a language tag for any code. Put prompts the user should copy in a fenced block. Never pad or repeat.`;

const VOICE_PROMPT = `VOICE MODE: reply will be spoken aloud. Keep it to 1-3 short sentences of plain spoken prose — no markdown, no emojis, no lists, no code.`;

const MODE_PROMPTS: Record<string, string> = {
  general: "MODE: GENERAL. Be a helpful, polite, and efficient AI voice assistant with a balanced tone across everyday topics.",
  developer:
    "MODE: DEVELOPER. Focus on software engineering, debugging, and technical problem solving. Provide direct, correct code snippets when useful.",
  creative:
    "MODE: CREATIVE. Be highly imaginative, conversational, and offer unique perspectives, metaphors, and ideas for brainstorming.",
};

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    return (m.content as ContentBlock[])
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join(" ");
  }
  return "";
}

export const Route = createFileRoute("/api/jarvis-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: ChatMessage[];
          mode?: string;
          persona?: string;
          memories?: string[];
          grounding?: boolean;
          voice?: boolean;
          knowledge?: Array<{ source?: string; content?: string }>;
        };
        const history = Array.isArray(body.messages) ? body.messages : [];
        const persona = resolvePersona(body.persona);
        const mode = MODE_PROMPTS[body.mode ?? "general"] ?? MODE_PROMPTS.general;

        const sections = [BASE_PROMPT, persona.personality, mode];
        if (body.voice) sections.push(VOICE_PROMPT);

        const memories = (body.memories ?? []).filter((m) => typeof m === "string" && m.trim());
        if (memories.length) {
          sections.push(
            `LONG-TERM MEMORY about this user (remember and use naturally, never recite the whole list):\n- ${memories
              .slice(0, 40)
              .join("\n- ")}`,
          );
        }

        // Retrieved knowledge (RAG). Provided by the client after an
        // authenticated, user-scoped vector search. Never fabricate beyond it.
        const knowledge = (body.knowledge ?? [])
          .filter((k) => typeof k?.content === "string" && k.content!.trim())
          .slice(0, 6);
        if (knowledge.length) {
          sections.push(
            `RETRIEVED KNOWLEDGE from the user's own documents. Use it when it answers the question, and mention the source name naturally if helpful. If it does not contain the answer, say you don't have it in their documents and answer from general knowledge instead — never invent document contents.\n\n${knowledge
              .map(
                (k, i) =>
                  `[${i + 1}] ${k.source ?? "document"}:\n${k.content!.slice(0, 1500)}`,
              )
              .join("\n\n")}`,
          );
        }


        // If any message carries an image, route to a vision-capable model tier.
        const hasImage = history.some(
          (m) =>
            Array.isArray(m.content) &&
            (m.content as ContentBlock[]).some((c) => c.type === "image_url"),
        );

        // ── Web-search grounding ──────────────────────────────────────────
        const query = lastUserText(history).trim();
        if (!hasImage && query && body.grounding !== false) {
          const { needsGrounding, webSearch, formatGrounding } = await import(
            "@/lib/websearch.server"
          );
          if (body.grounding === true || needsGrounding(query)) {
            const results = await webSearch(query);
            const block = formatGrounding(query, results);
            if (block) sections.push(block);
          }
        }

        const { routeChatCompletion, OmniRouteError } = await import(
          "@/lib/omniroute/router.server"
        );

        try {
          const result = await routeChatCompletion({
            messages: [{ role: "system", content: sections.join("\n\n") }, ...history],
            tier: hasImage ? "vision" : "text",
            routeKey: hasImage ? "chat:vision" : "chat",
          });
          return new Response(
            JSON.stringify({
              reply: result.content,
              provider: result.provider,
              model: result.model,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          const status = err instanceof OmniRouteError ? err.status : 500;
          const message = err instanceof Error ? err.message : "AI routing failed";
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
