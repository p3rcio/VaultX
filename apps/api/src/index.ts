import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { pool, runMigrations } from "./db";
import { ensureBucket } from "./s3";

import authRoutes from "./routes/auth";
import fileRoutes from "./routes/files";
import shareRoutes from "./routes/shares";
import tagRoutes from "./routes/tags";
import auditRoutes from "./routes/audit";
import userRoutes from "./routes/users";

async function main() {
  await runMigrations();
  await ensureBucket();

  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authRoutes);
  app.use("/files", fileRoutes);
  app.use("/shares", shareRoutes);
  app.use("/files", tagRoutes);
  app.use("/audit", auditRoutes);
  app.use("/users", userRoutes);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[unhandled]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  app.listen(config.port, () => {
    console.log(`[api] VaultX API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
