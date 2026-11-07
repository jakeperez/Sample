# GiftVault: Vercel + Supabase (PostgreSQL)

A static site (HTML, CSS, JS) plus small Vercel API routes that talk straight to your Supabase PostgreSQL database.

```
public/              the website (index.html, style.css, script.js, images/)
api/                 Vercel serverless functions (server side, use PostgreSQL directly)
  _db.js             PostgreSQL connection (uses POSTGRES_URL)
  _auth.js           checks the logged-in user with Supabase Auth
  health.js          GET  /api/health         test the database connection
  checkout.js        POST /api/checkout       server-side prices, vouchers, balance, orders
  admin-summary.js   GET  /api/admin-summary  admin-only sales summary
build.js             writes public/config.js from environment variables
vercel.json          build settings
supabase/schema.sql  tables, security rules, functions, product price list
```

## 1. Set up the database (once)
Supabase > **SQL Editor** > New query > paste all of `supabase/schema.sql` > **Run**.
This also creates the `products` price list (119 rows) that `/api/checkout` reads.

## 2. Put the project on GitHub, then import it into Vercel
```
git init && git add . && git commit -m "GiftVault"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/giftvault.git
git push -u origin main
```
vercel.com > **Add New > Project** > import the repo. Framework Preset: **Other**. Do not deploy yet if you want the variables ready first (step 3), or deploy and redeploy afterwards.

## 3. Connect Supabase with the Vercel integration
In your Vercel project open **Storage / Integrations**, choose **Supabase**, and connect your existing project (`xrfehvxqchskxcjytkvv`). The integration adds these variables for you:

`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` and a few more.

This project only uses `POSTGRES_URL` (server side) and the URL + anon key (the anon key is public by design). It never reads `SUPABASE_SERVICE_ROLE_KEY`. `build.js` refuses to build if a secret key is put where the anon key belongs.

Not using the integration? Add these by hand in Vercel > Settings > Environment Variables:
- `SUPABASE_URL` = `https://xrfehvxqchskxcjytkvv.supabase.co`
- `SUPABASE_ANON_KEY` = the anon / publishable key
- `POSTGRES_URL` = Supabase > **Connect** > **Transaction pooler** string (port 6543)

Variables are read at build time, so **Redeploy** after any change.

## 4. Check the database connection
Open `https://YOUR-APP.vercel.app/api/health`. You should see something like:
`{"ok":true,"time":"...","db":"postgres","products":119}`
- `"ok":false`: check `POSTGRES_URL` and redeploy.
- `"products":null`: the SQL in step 1 has not been run.

## 5. Tell Supabase your Vercel address
Supabase > **Authentication > URL Configuration**: set **Site URL** to `https://YOUR-APP.vercel.app` and add `https://YOUR-APP.vercel.app/**` under **Redirect URLs** (add `http://localhost:3000/**` for local testing).
Google login: Authentication > Providers > Google. While testing, you can turn off **Confirm email** under Providers > Email.

## 6. Make your admin account
Register on the live site, then in the SQL Editor run (with your email):
`update public.profiles set role = 'admin' where email = 'YOUR-EMAIL@gmail.com';`
Log out and in again. An **Admin** button appears, with a live sales summary from PostgreSQL.

## 7. Lock it down (after checkout works)
At the bottom of `schema.sql`, section 9 has two commented `revoke` lines. Run them once `/api/health` is OK and a test purchase works. After that, browsers can no longer call the price-trusting functions directly; only `/api/checkout` can create orders.

## How checkout works now
1. The browser sends item names, method, email and voucher code (never prices).
2. `/api/checkout` verifies the login with Supabase Auth, then in one database transaction: reads prices from `products`, applies the discount and voucher, checks the balance, saves the orders and updates balance and points.
3. If `/api/checkout` does not exist (for example hosting without Vercel), the site falls back to the older `place_order` database function.

## Run on your computer
```
npm i -g vercel
vercel link
vercel env pull .env.local
npm run dev        # runs "vercel dev" so the /api routes work too
```

## Before real money
- Delete `deposit_demo` and credit balances from your payment provider's webhook.
- For GCash, PayPal and Bank Card, confirm the payment with the provider before saving the order (marked in `api/checkout.js`).
- Gift card codes here are random demo codes. Real codes come from a supplier.
- `api/_db.js` turns off certificate checking for the Supabase pooler (common with the `pg` driver). Pin Supabase's CA certificate if you need stricter security.
