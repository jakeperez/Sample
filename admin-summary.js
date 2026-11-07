// Admin-only sales summary read straight from PostgreSQL.
const { getPool } = require("./_db");
const { getUser } = require("./_auth");

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Please log in again" });
  try {
    const db = getPool();
    const role = await db.query("select role from public.profiles where id = $1", [user.id]);
    if (!role.rows[0] || role.rows[0].role !== "admin") return res.status(403).json({ error: "Admins only" });
    const [tot, top, by] = await Promise.all([
      db.query("select count(*)::int as orders, coalesce(sum(price),0) as revenue from public.orders where created_at > now() - interval '30 days'"),
      db.query("select item_name, count(*)::int as n, sum(price) as revenue from public.orders group by 1 order by n desc, revenue desc limit 5"),
      db.query("select payment_method, count(*)::int as n from public.orders group by 1 order by n desc"),
    ]);
    res.status(200).json({
      orders30: tot.rows[0].orders, revenue30: Number(tot.rows[0].revenue),
      top: top.rows.map((r) => ({ item: r.item_name, n: r.n, revenue: Number(r.revenue) })),
      methods: by.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load summary" });
  }
};
