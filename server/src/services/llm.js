// Only `delta.content` is used: some models also stream a separate `reasoning` field
// (their hidden thinking), which we deliberately ignore.
// Thin client for any OpenAI-compatible /chat/completions endpoint (Groq, Gemini,
// OpenRouter, ...). We use plain fetch instead of a vendor SDK so there is no
// lock-in: switching provider = changing two env vars.
import { config } from "../config.js";

/**
 * Streams a completion. Calls onToken(text) for every chunk and resolves with
 * the full text. The API replies in Server-Sent Events: lines like
 *   data: {"choices":[{"delta":{"content":"Hel"}}]}
 *   data: [DONE]
 */
// Offline "demo mode": streams a canned reply word by word. Used when LLM_API_URL=mock,
// and as an automatic fallback (clearly labelled) if the free provider is down/rate-limited.
async function mockStream(messages, onToken, reason) {
  const last = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const text =
    `[demo mode${reason ? `: ${reason}` : ""}] I received: "${last.slice(0, 80)}". ` +
    `Conversation so far has ${messages.length} messages in context. ` +
    "Set a working LLM_API_URL / LLM_API_KEY in server/.env to get real AI answers.";
  let full = "";
  for (const word of text.split(/(?<= )/)) {
    await new Promise((r) => setTimeout(r, 25));
    full += word;
    onToken(word);
  }
  return full;
}

export async function streamCompletion(messages, onToken, opts = {}) {
  if (config.llm.apiUrl === "mock") return mockStream(messages, onToken);
  try {
    return await realStream(messages, onToken, opts);
  } catch (err) {
    // Only fall back for provider-side failures, never for a user abort.
    if (err.name === "AbortError" || !config.llm.fallbackToMock) throw err;
    const why = err.name === "TimeoutError" ? "provider timed out" : `provider error ${err.status ?? ""}`.trim();
    return mockStream(messages, onToken, why);
  }
}

async function realStream(messages, onToken, { signal } = {}) {
  // The key is optional: the default provider (Pollinations) is free and keyless.
  // Providers like Groq/Gemini need one, so we send it only when configured.
  const headers = { "Content-Type": "application/json" };
  if (config.llm.apiKey) headers.Authorization = `Bearer ${config.llm.apiKey}`;

  // Free tiers rate-limit hard (Pollinations allows 1 queued request per IP), so on
  // HTTP 429 we wait and retry a couple of times before giving up.
  // Each attempt also has a 25s timeout so a stuck provider never hangs the chat forever.
  const timeout = AbortSignal.timeout(25_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(config.llm.apiUrl, {
      method: "POST",
      signal: combined,
      headers,
      body: JSON.stringify({ model: config.llm.model, messages, stream: true }),
    });
    if (res.status !== 429 || attempt === 3) break;
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`LLM provider error ${res.status}: ${detail.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // last piece may be an incomplete line; keep it for next chunk
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return full;
      try {
        const token = JSON.parse(data).choices?.[0]?.delta?.content;
        if (token) {
          full += token;
          onToken(token);
        }
      } catch {
        // ignore keep-alive / malformed lines
      }
    }
  }
  return full;
}
