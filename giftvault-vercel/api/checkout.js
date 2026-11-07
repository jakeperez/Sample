// Server-side checkout: prices, vouchers and balances are decided here, not in the browser.
const { getPool } = require("./_db");
const { getUser } = require("./_auth");

const METHODS = ["Vault Coins", "GCash", "PayPal", "Bank Card"];
const VOUCHERS = { WELCOME5: [5, 0], VAULT10: [10, 300], GOLD15: [15, 1000] }; // [percent off, points needed]
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/;
const fail = (status, message) => Object.assign(new Error(message), { status });

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Please log in again" });

  const items = (req.body || {}).items;
  const vc = String((req.body || {}).voucher || "").trim().toUpperCase();
  if (!Array.isArray(items) || items.length < 1 || items.length > 50)
    return res.status(400).json({ error: "An order must have 1 to 50 items" });
  for (const i of items) {
    if (typeof i.n !== "string" || i.n.length > 120 || !METHODS.includes(i.m) ||
        typeof i.e !== "string" || i.e.length > 254 || !EMAIL.test(i.e) ||
        typeof i.c !== "string" || !CODE.test(i.c))
      return res.status(400).json({ error: "Invalid order data" });
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const pr = await client.query("select balance, points from public.profiles where id = $1 for update", [user.id]);
    if (!pr.rows[0]) throw fail(400, "Profile not found. Run the SQL setup first.");
    const balance = Number(pr.rows[0].balance), have = pr.rows[0].points;

    let off = 0;
    if (vc) {
      const v = VOUCHERS[vc];
      if (!v) throw fail(400, "Invalid voucher code");
      if (have < v[1]) throw fail(400, "Needs " + v[1] + " Vault Points - you have " + have);
      off = v[0];
    }

    const names = [...new Set(items.map((i) => i.n))];
    const pq = await client.query("select name, price, points, discount from public.products where name = any($1)", [names]);
    const map = new Map(pq.rows.map((r) => [r.name, r]));

    let total = 0, pts = 0;
    const prices = [];
    for (const i of items) {
      const p = map.get(i.n);
      if (!p) throw fail(400, "Unknown item: " + i.n);
      const unit = Math.round(Number(p.price) * (1 - p.discount / 100));
      const line = Math.round(unit * (1 - off / 100));
      prices.push(line);
      pts += p.points;
      if (i.m === "Vault Coins") total += line;
    }
    if (total > balance) throw fail(400, "Not enough Vault Coins");

    // NOTE: for GCash / PayPal / Bank Card a real store must confirm the payment with the
    // provider (webhook) BEFORE this insert. In this demo those methods are trusted.
    for (let k = 0; k < items.length; k++) {
      const i = items[k];
      await client.query(
        "insert into public.orders (user_id, item_name, price, payment_method, email, code, points) values ($1,$2,$3,$4,$5,$6,$7)",
        [user.id, i.n, prices[k], i.m, i.e, i.c, map.get(i.n).points]);
    }
    const up = await client.query(
      "update public.profiles set balance = balance - $2, points = points + $3 where id = $1 returning balance, points",
      [user.id, total, pts]);
    await client.query("commit");
    return res.status(200).json({ balance: Number(up.rows[0].balance), points: up.rows[0].points, prices });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: "Checkout failed" });
  } finally {
    client.release();
  }
};
