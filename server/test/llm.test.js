// Tests the real streaming parser against a fake OpenAI-style SSE server.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

test("streamCompletion parses SSE tokens from an OpenAI-compatible API", async () => {
  const fake = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer test-key");
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const ev = (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`;
    res.write(ev("Hi"));
    // split one event across two TCP writes to test buffering
    const half = ev(" there");
    res.write(half.slice(0, 10));
    setTimeout(() => { res.write(half.slice(10)); res.end("data: [DONE]\n\n"); }, 20);
  });
  await new Promise((r) => fake.listen(0, r));
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_API_URL = `http://localhost:${fake.address().port}/v1/chat/completions`;
  const { streamCompletion } = await import("../src/services/llm.js");
  const tokens = [];
  const full = await streamCompletion([{ role: "user", content: "x" }], (t) => tokens.push(t));
  fake.close();
  assert.deepEqual(tokens, ["Hi", " there"]);
  assert.equal(full, "Hi there");
});

test("falls back to labelled demo mode when provider fails", async () => {
  const fake = http.createServer((_req, res) => { res.writeHead(402); res.end("{}"); });
  await new Promise((r) => fake.listen(0, r));
  const { config } = await import("../src/config.js");
  config.llm.apiUrl = `http://localhost:${fake.address().port}/x`;
  const { streamCompletion } = await import("../src/services/llm.js");
  let out = "";
  await streamCompletion([{ role: "user", content: "hello" }], (t) => (out += t));
  fake.close();
  assert.match(out, /^\[demo mode: provider error 402\]/);
});
