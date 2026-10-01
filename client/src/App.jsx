import { useEffect, useState } from "react";
import * as api from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";

// App owns the state: list of chats, which one is open, its messages.
export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => api.listConversations().then(setConversations).catch((e) => setError(e.message));
  useEffect(() => { refresh(); }, []);

  async function open(id) {
    setActiveId(id);
    setError("");
    const convo = await api.getConversation(id);
    setMessages(convo.messages);
  }

  async function newChat() {
    const convo = await api.createConversation();
    await refresh();
    setActiveId(convo._id);
    setMessages([]);
    return convo._id;
  }

  async function remove(id) {
    await api.deleteConversation(id);
    if (id === activeId) { setActiveId(null); setMessages([]); }
    refresh();
  }

  async function send(text) {
    setError("");
    const id = activeId || (await newChat());
    // Optimistic UI: show the user's message and an empty assistant bubble immediately.
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);
    await api.sendMessage(id, text, {
      // Append each token to the last (assistant) message as it arrives.
      onToken: (t) => setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + t };
        return copy;
      }),
      onDone: () => refresh(),
      onError: (msg) => setError(msg),
    }).catch((e) => setError(e.message));
    setStreaming(false);
  }

  return (
    <div className="app">
      <Sidebar conversations={conversations} activeId={activeId} onOpen={open} onNew={newChat} onDelete={remove} />
      <ChatWindow messages={messages} streaming={streaming} error={error} onSend={send} />
    </div>
  );
}
