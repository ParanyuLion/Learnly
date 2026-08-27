// One-off utility: applies every Prisma migration to a Turso (libSQL) database
// directly over the network, without needing the Turso CLI installed locally.
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

for (const dir of migrationDirs) {
  const sqlPath = join(migrationsDir, dir, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");
  console.log(`Applying ${dir}...`);
  await client.executeMultiple(sql);
  console.log(`  done.`);
}

console.log(`All ${migrationDirs.length} migration(s) applied to ${url}.`);
client.close();
