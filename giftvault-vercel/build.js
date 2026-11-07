// Runs on Vercel (npm run build). Writes public/config.js from environment variables.
// Works with the Vercel x Supabase integration (it sets these automatically) or with variables you add by hand.
const fs = require("fs");
const env = process.env;
const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();

function isSecretKey(k) {
  if (k.startsWith("sb_secret_")) return true;
  try {
    return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role === "service_role";
  } catch (e) { return false; }
}

if (isSecretKey(key)) {
  console.error("ERROR: the Supabase key is a secret / service_role key. Never put that in a website.");
  console.error("Use the anon (publishable) key from Supabase > Project Settings > API.");
  process.exit(1);
}
if (!url || !key) {
  console.warn("WARNING: Supabase URL or anon key is not set. The site will build, but login stays disabled.");
}
if (!env.POSTGRES_URL) {
  console.warn("NOTE: POSTGRES_URL is not set. The /api routes (checkout, admin summary) will not work until it is.");
}

fs.writeFileSync(
  "public/config.js",
  "window.GV_CONFIG = " + JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }) + ";\n"
);
console.log("public/config.js written (" + (url && key ? "Supabase configured" : "Supabase NOT configured") + ")");
