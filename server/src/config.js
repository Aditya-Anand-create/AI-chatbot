// Central place for configuration. Everything comes from environment variables
// (.env in development) so no secret is ever hardcoded in source.
import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_chatbot",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  llm: {
    apiKey: process.env.LLM_API_KEY || "",
    // Full URL of the chat-completions endpoint (differs slightly per provider).
    fallbackToMock: process.env.LLM_FALLBACK_TO_MOCK !== "false",
    apiUrl: process.env.LLM_API_URL || "https://text.pollinations.ai/openai",
    model: process.env.LLM_MODEL || "openai",
  },
  maxContextMessages: Number(process.env.MAX_CONTEXT_MESSAGES) || 20,
  systemPrompt: process.env.SYSTEM_PROMPT || "You are a helpful, concise AI assistant.",
};
