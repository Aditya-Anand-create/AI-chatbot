# Interview notes - AI Chatbot project

## 30-second pitch
"I built a full-stack ChatGPT-style chatbot. React frontend, Node/Express REST backend, MongoDB for conversation history. The backend calls any OpenAI-compatible LLM API, and streams the answer token by token to the browser using Server-Sent Events. I wrote tests with an in-memory MongoDB and a fake LLM, so it runs without any API key."

## Likely questions

**Why this stack?**
It is the stack I know (React, Node, MongoDB). One language (JavaScript) end to end. MongoDB fits because a chat is a document: a list of messages read together. Express keeps the REST layer small and easy to explain.

**Why MongoDB and not MySQL?**
Messages are always read as one conversation, so embedding them in one document means one read and no joins. Schema is flexible if I add fields later (model name, token counts). MySQL would also work, with a messages table and a foreign key. For millions of messages per chat I would move messages to their own collection.

**How does the AI "remember" the conversation?**
It does not. LLM APIs are stateless. On every request I send the system prompt plus the last N messages from MongoDB (`services/context.js`). That is a sliding window: it bounds tokens, cost and latency. Improvement: trim by token count, or summarize older messages.

**How does streaming work?**
I call the LLM with `stream: true`. It replies as Server-Sent Events: lines like `data: {...delta...}`. My server parses each line, takes `delta.content`, and forwards it to the browser as its own SSE event. In React, I read the response body with `fetch` + `ReadableStream` and append each token to the last message. I used fetch instead of `EventSource` because EventSource only supports GET and I need POST.

**Why SSE and not WebSockets?**
Streaming is one-way (server to client) per request. SSE is plain HTTP, works with normal REST, auto-works through proxies, and is simpler. WebSockets make sense for two-way real-time features like typing indicators or multi-user rooms.

**A network chunk can cut an SSE line in half. How do you handle it?**
I keep a buffer, split by newline, process complete lines, and keep the last partial line for the next chunk. There is a test that splits an event across two writes.

**How do you handle API keys and secrets?**
Only in environment variables via `.env`, which is in `.gitignore`. `.env.example` shows the variable names. The key never reaches the browser because the browser only talks to my backend.

**What if the LLM provider is slow, down or rate-limited?**
Requests have a 25 second timeout, a retry with backoff on HTTP 429, and a clearly labelled demo-mode fallback so the UI does not just break. Errors are sent to the browser as an SSE error event.

**How do you switch LLM providers?**
Everything is OpenAI-compatible `/chat/completions`. Changing `LLM_API_URL`, `LLM_MODEL` and `LLM_API_KEY` switches between Pollinations, Groq, Gemini or OpenRouter. No vendor SDK, so no lock-in.

**How did you test it?**
Node's built-in test runner. `mongodb-memory-server` gives a real MongoDB in memory. The LLM is injected into the router (dependency injection), so tests use a fake. A separate test runs the real SSE parser against a fake HTTP server.

**What happens if the user closes the tab mid-answer?**
`res.on("close")` fires an AbortController that cancels the upstream LLM request, so I do not pay for or wait on tokens nobody reads.

**Security considerations?**
Input validation (non-empty, max 4000 chars), ObjectId validation, JSON body size limit, CORS limited to the client origin, no stack traces in error responses. Missing: authentication and rate limiting per user.

**How would you scale it?**
- Stateless API servers behind a load balancer (state is in MongoDB), so scale horizontally.
- Index `updatedAt`; move messages to a separate collection with an index on `(conversationId, createdAt)` for long chats.
- Add per-user rate limiting (Redis) and a queue for LLM calls so one provider limit does not hit everyone.
- Cache repeated prompts; trim or summarize context to cut token cost.
- Load balancer must allow long-lived SSE connections (disable response buffering).

**What would you improve next?**
JWT login and per-user chats, markdown/code rendering, stop-generation button, token-aware context, conversation summaries, retrieval (RAG) over documents.

**What was the hardest bug?**
The free provider stalled on some requests and the chat hung with no error. I added timeouts, retry on 429 and a fallback, and I found it by testing the LLM client on its own before testing the whole server.

## Demo script (2 minutes)
1. Start backend and frontend. Show the folder structure.
2. Send "My name is X", then "What is my name?" - shows context memory.
3. Point out tokens appearing live (streaming).
4. Open a new chat, switch back - shows MongoDB history.
5. Show `services/llm.js` and `context.js` (the two core files) and run `npm test`.
