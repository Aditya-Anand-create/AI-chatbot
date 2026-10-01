import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ChatWindow({ messages, streaming, error, onSend }) {
  const [text, setText] = useState("");
  const bottom = useRef(null);
  // Auto-scroll to newest token.
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function submit(e) {
    e.preventDefault();
    if (!text.trim() || streaming) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <main className="chat">
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty"><h2>How can I help?</h2><p>Ask me anything - answers stream in live.</p></div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "assistant" ? (
              // Assistant replies are Markdown (lists, code blocks, bold...), so render them.
              m.content ? <ReactMarkdown>{m.content}</ReactMarkdown> : <span className="typing">…</span>
            ) : (
              m.content
            )}
          </div>
        ))}
        {error && <div className="error">{error}</div>}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={4000} />
        <button disabled={streaming || !text.trim()}>Send</button>
      </form>
    </main>
  );
}
