/** E2E_DATABASE_URL, or DATABASE_URL with the database renamed to `<name>_test`. */
export function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set; copy .env.example to .env");
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/^\//, "")}_test`;
  return url.toString();
}
