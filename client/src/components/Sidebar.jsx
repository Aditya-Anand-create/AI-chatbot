export default function Sidebar({ conversations, activeId, onOpen, onNew, onDelete }) {
  return (
    <aside className="sidebar">
      <div className="brand">AI Chatbot</div>
      <button className="new" onClick={onNew}>+ New chat</button>
      <ul>
        {conversations.map((c) => (
          <li key={c._id} className={c._id === activeId ? "active" : ""}>
            <span onClick={() => onOpen(c._id)}>{c.title}</span>
            <button title="Delete" onClick={() => onDelete(c._id)}>×</button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
