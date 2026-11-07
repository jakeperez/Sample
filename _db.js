// Direct PostgreSQL connection to Supabase (server side only).
// POSTGRES_URL is added automatically by the Vercel x Supabase integration.
let pool;
function getPool() {
  if (pool) return pool;
  const { Pool } = require("pg");
  const raw = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (!raw) throw new Error("POSTGRES_URL is not set");
  const u = new URL(raw);
  u.searchParams.delete("sslmode"); // handled by the ssl option below
  u.searchParams.delete("supa");    // Supabase-specific flag the pg driver does not understand
  pool = new Pool({
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: false }, // Supabase's pooler uses its own certificate chain
    max: 1,                             // one connection per serverless instance
    idleTimeoutMillis: 10000,
  });
  return pool;
}
module.exports = { getPool };
