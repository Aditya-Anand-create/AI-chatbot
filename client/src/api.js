// All HTTP calls live here so components stay simple.
const json = async (res) => {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.status === 204 ? null : res.json();
};

export const listConversations = () => fetch("/api/conversations").then(json);
export const createConversation = () => fetch("/api/conversations", { method: "POST" }).then(json);
export const getConversation = (id) => fetch(`/api/conversations/${id}`).then(json);
export const deleteConversation = (id) => fetch(`/api/conversations/${id}`, { method: "DELETE" }).then(json);

/**
 * Sends a message and reads the streamed reply (Server-Sent Events over fetch).
 * EventSource only supports GET, so we read the response body stream manually.
 */
export async function sendMessage(id, content, { onToken, onDone, onError }) {
  const res = await fetch(`/api/conversations/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) return onError((await res.json().catch(() => ({}))).error || "Request failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop(); // keep incomplete event
    for (const ev of events) {
      if (!ev.startsWith("data:")) continue;
      const msg = JSON.parse(ev.slice(5));
      if (msg.token) onToken(msg.token);
      else if (msg.error) onError(msg.error);
      else if (msg.done) onDone(msg);
    }
  }
}
