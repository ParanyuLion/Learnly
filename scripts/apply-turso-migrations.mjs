// One-off utility: applies pending Prisma migrations to a Turso (libSQL)
// database directly over the network, without needing the Turso CLI
// installed locally. Safe to re-run — already-applied migrations (tracked
// in a `_manual_migrations` table this script creates) are skipped.
//
// Usage (PowerShell):
//   $env:TURSO_DATABASE_URL = "libsql://your-db.turso.io"
//   $env:TURSO_AUTH_TOKEN = "your-token"
//   node scripts/apply-turso-migrations.mjs
//
// Usage (bash):
//   TURSO_DATABASE_URL="libsql://your-db.turso.io" TURSO_AUTH_TOKEN="your-token" node scripts/apply-turso-migrations.mjs

import { createClient } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables first.");
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort(); // migration directory names are timestamp-prefixed, so lexical sort == chronological order

if (migrationDirs.length === 0) {
  console.error(`No migration directories found under ${migrationsDir}`);
  process.exit(1);
}

const client = createClient({ url, authToken });

await client.execute(
  "CREATE TABLE IF NOT EXISTS _manual_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
);

const appliedRows = await client.execute("SELECT name FROM _manual_migrations");
const applied = new Set(appliedRows.rows.map((row) => row.name));

let appliedCount = 0;
let skippedCount = 0;

for (const dir of migrationDirs) {
  if (applied.has(dir)) {
    console.log(`Skipping ${dir} (already applied).`);
    skippedCount++;
    continue;
  }

  const sqlPath = join(migrationsDir, dir, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");
  console.log(`Applying ${dir}...`);
  await client.executeMultiple(sql);
  await client.execute({
    sql: "INSERT INTO _manual_migrations (name, applied_at) VALUES (?, ?)",
    args: [dir, new Date().toISOString()],
  });
  console.log(`  done.`);
  appliedCount++;
}

console.log(`${appliedCount} migration(s) applied, ${skippedCount} already up to date, on ${url}.`);
client.close();
