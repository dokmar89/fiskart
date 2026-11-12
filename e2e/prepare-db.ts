import "dotenv/config";
import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Creates the test database if needed, applies migrations, empties it and seeds the built-in
 * templates. Runs as part of the Playwright web server command, because Playwright starts the
 * server before any globalSetup.
 */
async function prepareDatabase() {
  // The Playwright config passes the test database as DATABASE_URL.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(databaseUrl);
  const name = url.pathname.replace(/^\//, "");

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }

  execSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "inherit",
  });

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query('TRUNCATE "Project", "Asset", "Template", "BrandKit" CASCADE');
  } finally {
    await client.end();
  }

  // The built-in templates, as a real installation has them.
  execSync("pnpm exec tsx prisma/seed.ts", {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "inherit",
  });
}

prepareDatabase().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
