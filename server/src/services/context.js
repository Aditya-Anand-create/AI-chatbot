// Builds the list of messages sent to the LLM.
// LLM APIs are stateless: the model only "remembers" what we send each time.
// So we send: system prompt + the most recent N messages (a sliding window).
// This keeps token usage and latency bounded as conversations grow.
export function buildContext({ systemPrompt, messages, maxMessages }) {
  const recent = messages.slice(-maxMessages).map((m) => ({ role: m.role, content: m.content }));
  return [{ role: "system", content: systemPrompt }, ...recent];
}
