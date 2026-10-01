// REST API:
//   GET    /api/conversations            list chats (sidebar)
//   POST   /api/conversations            create empty chat
//   GET    /api/conversations/:id        get one chat with messages
//   DELETE /api/conversations/:id        delete chat
//   POST   /api/conversations/:id/messages   send a message, reply streams back (SSE)
import { Router } from "express";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { buildContext } from "../services/context.js";
import { streamCompletion as defaultStream } from "../services/llm.js";
import { config } from "../config.js";

// `stream` is injectable so tests can use a fake LLM (dependency injection).
export function chatRouter({ stream = defaultStream } = {}) {
  const router = Router();

  const validId = (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    next();
  };

  router.get("/conversations", async (_req, res) => {
    const list = await Conversation.find({}, "title updatedAt").sort({ updatedAt: -1 }).limit(50);
    res.json(list);
  });

  router.post("/conversations", async (_req, res) => {
    const convo = await Conversation.create({});
    res.status(201).json(convo);
  });

  router.get("/conversations/:id", validId, async (req, res) => {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: "Not found" });
    res.json(convo);
  });

  router.delete("/conversations/:id", validId, async (req, res) => {
    await Conversation.findByIdAndDelete(req.params.id);
    res.status(204).end();
  });

  router.post("/conversations/:id/messages", validId, async (req, res) => {
    const content = String(req.body?.content || "").trim();
    if (!content) return res.status(400).json({ error: "content is required" });
    if (content.length > 4000) return res.status(400).json({ error: "content too long (max 4000 chars)" });

    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: "Not found" });

    // 1. Save the user's message first so it is never lost.
    convo.messages.push({ role: "user", content });
    if (convo.messages.length === 1) convo.title = content.slice(0, 40); // first message names the chat
    await convo.save();

    // 2. Open an SSE response: the browser receives tokens as they are generated.
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // tell reverse proxies (nginx etc.) not to buffer the stream
    });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    // Stop calling the LLM if the user closes the tab.
    const abort = new AbortController();
    res.on("close", () => abort.abort());

    try {
      const context = buildContext({
        systemPrompt: config.systemPrompt,
        messages: convo.messages,
        maxMessages: config.maxContextMessages,
      });
      const reply = await stream(context, (token) => send({ token }), { signal: abort.signal });

      // 3. Persist the full assistant reply once streaming is done.
      convo.messages.push({ role: "assistant", content: reply });
      await convo.save();
      send({ done: true, title: convo.title });
    } catch (err) {
      if (err.name === "TimeoutError") send({ error: "The AI provider timed out. Please try again." });
      else if (err.name !== "AbortError") send({ error: err.message });
    } finally {
      res.end();
    }
  });

  return router;
}
