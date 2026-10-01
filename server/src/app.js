// Express app factory (separate from index.js so tests can import it without starting a server).
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.js";
import { config } from "./config.js";

export function createApp(options) {
  const app = express();
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: "50kb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", chatRouter(options));
  // Central error handler: never leak stack traces to the client.
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
