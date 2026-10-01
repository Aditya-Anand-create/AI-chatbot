// Integration tests using an in-memory MongoDB and a fake LLM (no network, no key needed).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { buildContext } from "../src/services/context.js";

let mongod, server, base;
let lastContext;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const fakeLLM = async (context, onToken) => {
    lastContext = context;
    for (const t of ["Hello", " from", " mock"]) onToken(t);
    return "Hello from mock";
  };
  server = createApp({ stream: fakeLLM }).listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

test("buildContext keeps system prompt + last N messages", () => {
  const msgs = Array.from({ length: 10 }, (_, i) => ({ role: "user", content: `m${i}` }));
  const ctx = buildContext({ systemPrompt: "sys", messages: msgs, maxMessages: 3 });
  assert.deepEqual(ctx.map((m) => m.content), ["sys", "m7", "m8", "m9"]);
});

test("full chat flow: create, stream reply, persist history", async () => {
  const convo = await (await fetch(`${base}/conversations`, { method: "POST" })).json();
  const res = await fetch(`${base}/conversations/${convo._id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Hi there" }),
  });
  const text = await res.text();
  assert.match(text, /"token":"Hello"/);
  assert.match(text, /"done":true/);

  const saved = await (await fetch(`${base}/conversations/${convo._id}`)).json();
  assert.equal(saved.messages.length, 2);
  assert.equal(saved.messages[1].content, "Hello from mock");
  assert.equal(saved.title, "Hi there");
  assert.equal(lastContext[0].role, "system");
});

test("rejects empty message and bad id", async () => {
  const convo = await (await fetch(`${base}/conversations`, { method: "POST" })).json();
  const r1 = await fetch(`${base}/conversations/${convo._id}/messages`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "  " }),
  });
  assert.equal(r1.status, 400);
  const r2 = await fetch(`${base}/conversations/nope`);
  assert.equal(r2.status, 400);
});

test("delete conversation", async () => {
  const convo = await (await fetch(`${base}/conversations`, { method: "POST" })).json();
  assert.equal((await fetch(`${base}/conversations/${convo._id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${base}/conversations/${convo._id}`)).status, 404);
});
