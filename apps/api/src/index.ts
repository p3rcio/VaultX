// server entry point — sets up Express, runs DB migrations, then starts listening
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

async function main() {
  // tables need to exist before anything else runs
  await runMigrations();

  // create the MinIO bucket if it doesn't already exist
  await ensureBucket();

  const app = express();

  // helmet sets a bunch of secure response headers with sensible defaults
  app.use(helmet());
  // without CORS the browser blocks requests from localhost:3000
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  // file bytes go via presigned S3 URLs, so 1MB is plenty for JSON bodies
  app.use(express.json({ limit: "1mb" }));

  // quick health check to confirm the server is up
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authRoutes);
  app.use("/files", fileRoutes);
  app.use("/shares", shareRoutes);
  app.use("/files", tagRoutes);       // tag routes are nested under /files/:id/tags
  app.use("/audit", auditRoutes);

  // any unhandled route error falls through here and returns a generic 500
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

// close the DB pool on SIGTERM so docker-compose down doesn't hang
process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
