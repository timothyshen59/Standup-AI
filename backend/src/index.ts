import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { standupRouter } from "./routes/standup.js";
import { userRouter } from "./routes/user.js";
import { errorHandler } from "./middleware/error.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// ─── Health check ─────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────
app.use("/api/standup", standupRouter);
app.use("/api/user", userRouter);

// ─── Error handler ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[standup-ai] Server running on port ${PORT}`);
});

export default app;
