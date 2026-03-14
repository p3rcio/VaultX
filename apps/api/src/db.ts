// postgres connection pool and migration runner
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { config } from "./config";

export const pool = new Pool({ connectionString: config.databaseUrl });

// postgres takes a moment to start inside docker so retry with increasing delays before giving up
async function waitForDb(maxRetries = 10, delayMs = 1000): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      console.log(`[db] waiting for postgres (attempt ${i}/${maxRetries})...`);
      if (i === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
}

// reads and runs the init SQL file — safe to call on every startup because it uses IF NOT EXISTS
export async function runMigrations(): Promise<void> {
  await waitForDb();
  const sql = fs.readFileSync(
    path.join(__dirname, "migrations", "001_init.sql"),
    "utf-8"
  );
  await pool.query(sql);
  console.log("[db] migrations applied");
}
