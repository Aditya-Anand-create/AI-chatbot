// Entry point: connect to MongoDB, then start the HTTP server.
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { config } from "./config.js";

await mongoose.connect(config.mongoUri);
console.log("MongoDB connected");
createApp().listen(config.port, () => console.log(`API on http://localhost:${config.port}`));
