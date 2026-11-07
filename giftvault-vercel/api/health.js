// Open /api/health on your Vercel site to confirm the database connection works.
const { getPool } = require("./_db");
module.exports = async (req, res) => {
  try {
    const r = await getPool().query("select now() as time, current_database() as db");
    let products = null;
    try { products = Number((await getPool().query("select count(*) as n from public.products")).rows[0].n); } catch (e) {}
    res.status(200).json({ ok: true, ...r.rows[0], products });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Database connection failed", code: e.code || null });
  }
};
