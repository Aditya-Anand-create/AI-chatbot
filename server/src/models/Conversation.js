// MongoDB schema. One document per conversation, messages embedded as an array.
// Why embedded? A chat is always read as a whole, so one read fetches everything
// (no joins). For very long chats you would split messages into their own collection.
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const conversationSchema = new mongoose.Schema(
  {
    title: { type: String, default: "New chat" },
    messages: [messageSchema],
  },
  { timestamps: true }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
