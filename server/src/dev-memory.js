// Zero-setup dev mode: starts a throwaway in-memory MongoDB, then the API.
// Data is lost on restart. Use `npm start` with a real MongoDB for persistence.
import { MongoMemoryServer } from "mongodb-memory-server";
const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri("ai_chatbot");
console.log("In-memory MongoDB started (data resets on restart)");
await import("./index.js");
