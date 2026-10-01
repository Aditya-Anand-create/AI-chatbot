# AI Chatbot (React + Node/Express + MongoDB)

A full-stack ChatGPT-style assistant: streaming replies, saved conversation history, and a provider-agnostic LLM layer that works with free APIs.

**Stack:** React (Vite) - Node.js + Express - MongoDB (Mongoose) - REST API + Server-Sent Events - any OpenAI-compatible LLM API.

## Features
- Token-by-token streaming (like ChatGPT)
- Multiple conversations, saved in MongoDB, sidebar to switch/delete
- Context memory: the last N messages are sent with every request
- Swap LLM provider by changing `.env` (Pollinations, Groq, Gemini, OpenRouter...)
- Labelled demo-mode fallback when the free provider is down, so the app never just breaks
- Automated tests (in-memory MongoDB + fake LLM, no key needed)

## Architecture

```
 React (Vite, :5173)        Express API (:5000)                 External
┌──────────────────┐  REST  ┌───────────────────────┐  HTTPS   ┌──────────────┐
│ Sidebar          │ -----> │ routes/chat.js        │ -------> │ LLM provider │
│ ChatWindow       │ <----- │  - validate input     │ <------- │ (OpenAI-     │
│ api.js (fetch)   │  SSE   │  - save user message  │ streamed │  compatible) │
└──────────────────┘ tokens │  - build context      │  tokens  └──────────────┘
                            │  - stream + save reply│
                            │ services/context.js   │   ┌─────────────┐
                            │ services/llm.js       │-->│  MongoDB    │
                            └───────────────────────┘   └─────────────┘
```

Request flow for one message:
1. Browser `POST /api/conversations/:id/messages {content}`.
2. Server saves the user message, builds context (system prompt + last N messages).
3. Server calls the LLM with `stream: true` and forwards each token to the browser as an SSE event.
4. When finished, the full reply is saved to MongoDB.

### Folder structure
```
server/src/
  index.js            start server + DB connection
  app.js              Express app (CORS, JSON, routes, error handler)
  config.js           all settings from environment variables
  models/Conversation.js   Mongoose schema
  routes/chat.js      REST endpoints + SSE streaming
  services/llm.js     LLM client (fetch, SSE parsing, retry, timeout, fallback)
  services/context.js sliding-window context builder
  dev-memory.js       zero-setup mode with in-memory MongoDB
server/test/          API + LLM tests
client/src/
  App.jsx             state (conversations, messages, streaming)
  api.js              REST calls + SSE stream reader
  components/         Sidebar.jsx, ChatWindow.jsx
```

### REST API
| Method | Path | Purpose |
|---|---|---|
| GET | /api/conversations | list chats |
| POST | /api/conversations | create chat |
| GET | /api/conversations/:id | chat + messages |
| DELETE | /api/conversations/:id | delete chat |
| POST | /api/conversations/:id/messages | send message, reply streams back (SSE) |

## Run it locally

Needs Node 18+ (tested on 22).

```bash
git clone https://github.com/adityaanand/ai-chatbot.git
cd ai-chatbot

# 1. Backend
cd server
npm install
cp .env.example .env          # Windows: copy .env.example .env
npm run dev:memory            # starts API on :5000 with a temporary in-memory MongoDB
```

```bash
# 2. Frontend (new terminal)
cd client
npm install
npm run dev                   # open http://localhost:5173
```

Want saved history that survives restarts? Install MongoDB (or a free Atlas cluster), set `MONGODB_URI` in `server/.env`, and use `npm run dev` instead of `npm run dev:memory`.

### Choosing the AI provider (`server/.env`)
Default is Pollinations: free, no signup, no key. Free anonymous tiers are rate-limited, so if it is busy the app replies with a clearly labelled `[demo mode]` message. For reliable real answers add a free key:

**Groq (recommended):** create a key at https://console.groq.com/keys, then in `server/.env`:
```
LLM_API_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=openai/gpt-oss-20b
LLM_API_KEY=paste_your_key
```
**OpenRouter (free models, email signup, no card):** key at https://openrouter.ai/settings/keys
```
LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
LLM_MODEL=poolside/laguna-s-2.1:free
LLM_API_KEY=paste_your_key
```
Free model names change over time; pick any model ending in `:free` from https://openrouter.ai/models?max_price=0. Avoid the `openrouter/free` auto-router, it may pick odd models.

**Gemini:** key at https://aistudio.google.com/apikey
```
LLM_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
LLM_MODEL=gemini-2.5-flash
LLM_API_KEY=paste_your_key
```
Restart the server after editing `.env`. Keys live only in `.env`, which is git-ignored.

## Tests
```bash
cd server && npm test
```
Covers: context window, full chat flow with persistence, validation, delete, SSE parsing (including events split across network chunks), and the demo-mode fallback.

## Ideas to extend
Auth (JWT), per-user chats, markdown rendering, stop-generation button, token-based context trimming, rate limiting.

## Live demo deployment (Render free tier)
`render.yaml` deploys one free web service that serves both the API and the built React app.
The demo runs with an **in-memory MongoDB** (`npm run start:demo`), so chat history resets when the free
service restarts or sleeps (it sleeps after ~15 min idle; the first load can take about a minute).
For persistent history, point `MONGODB_URI` at MongoDB Atlas (free M0 cluster) and use `npm start` instead.
