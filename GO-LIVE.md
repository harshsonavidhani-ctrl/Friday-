# Going live — step by step

Goal: retailers open **https://laxmiassociates.in** (or a free `*.netlify.app`
address) from anywhere, 24×7, and install it like an app.

| Piece | Service | Cost to start |
| --- | --- | --- |
| Database + product photos | Supabase (Free plan) | ₹0 — 500 MB data, 1 GB photos. A free project pauses after ~1 week with **no** use; daily use keeps it on. Pro is $25/month when you grow. |
| Website hosting | Netlify (Free plan — commercial use allowed) | ₹0 to start |
| Code storage + auto-updates | GitHub (private repository) | ₹0 |
| Address | Any domain seller (GoDaddy, Hostinger, BigRock…) | about ₹700–1,200 / year |
| Play Store app (optional) | Google Play Console | $25 once |

Why not Vercel? Its free plan is for non-commercial use only; Pro is $20/month.

You create the accounts yourself (Claude never signs up or types passwords for you).
Everything else — code, settings, data copy — is already prepared.

---

## 0. On the laptop first

1. Admin → **Settings** → fill shop phone, WhatsApp, address, **UPI ID**, bank details.
2. Admin → Settings → **Remove demo data** (removes the sample shop 8888888888,
   the 8 sample products and the demo admin 9999999999).
3. Add your real models (or upload your Tally / Excel list: Admin → Excel / Tally import).

## 1. Supabase (database + photos)

1. Sign up at <https://supabase.com> → **New project**
   - Region: **South Asia (Mumbai)** · set a strong database password and note it down.
2. **Storage** → **New bucket** → name `product-images` → tick **Public bucket** → Save.
3. **Project Settings → Database → Connection string → Transaction pooler** → copy the URI
   (port 6543) and put your database password into it → this is `DATABASE_URL`.
4. **Project Settings → API** → copy **Project URL** (`SUPABASE_URL`) and the
   **service_role** key (`SUPABASE_SERVICE_ROLE_KEY` — secret, never share).

## 2. Copy the laptop data to Supabase

Stop the local website first (close the `npm run dev` window), then in PowerShell:

```powershell
cd "C:\Users\Harsh Vidhani\laxmi-associates"
$env:DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres"
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="..."
npm run db:copy-to-live
```

It copies shops, products, photos, orders, payments, khata and settings, and prints
a ✓ for each. Logins stay the same mobile number + password. (It refuses to run if
the live database already has data; `npm run db:copy-to-live -- --wipe` replaces it.)

Starting fresh instead? `npm run db:setup` with `ADMIN_PHONE` and `ADMIN_PASSWORD` set.

## 3. GitHub (so the website updates itself)

1. Install Git: <https://git-scm.com/download/win> (defaults are fine).
2. Sign up at <https://github.com> → **New repository** → name `laxmi-associates` →
   **Private** → Create.
3. Tell Claude "push to GitHub" — the first push asks you to log in to GitHub in the browser.

## 4. Netlify (the website)

1. Sign up at <https://netlify.com> with your GitHub account.
2. **Add new project → Import an existing project → GitHub → laxmi-associates**.
   Build settings are detected automatically (Next.js).
3. Before the first deploy open **Environment variables** and add (see `.env.example`):
   `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=product-images`,
   `NEXT_PUBLIC_SITE_URL` (your address), optional `BRAVE_API_KEY`.
4. **Deploy**. In 2–3 minutes you get `https://something.netlify.app` — open it and login.

From now on every change Claude pushes to GitHub goes live by itself in a few minutes.

## 5. Your own address (optional but professional)

1. Buy `laxmiassociates.in` (or similar) from any domain seller.
2. Netlify → **Domain management → Add a domain** → follow the steps (change the
   "nameservers" at the seller). HTTPS (the lock) is switched on automatically.
3. Change `NEXT_PUBLIC_SITE_URL` to the new address → **Redeploy**.

## 6. After it is live

- Mama: open the site on his phone → login → **Install** (Add to Home Screen) →
  Dashboard → **Turn on alerts on this phone**.
- Send every shop a **Login link** (Admin → Retailers → shop → Login link → WhatsApp).
- Place one small test order yourself and pay ₹1 by UPI to see the full flow.
- IMEI camera scanning works now (it needs https).

## 7. Play Store app (after step 5)

1. Open <https://www.pwabuilder.com> → enter your website address → **Package for stores → Android**.
   Package ID e.g. `in.laxmiassociates.app` → download the zip (it has an `.aab` file and a signing key — keep the key safe).
2. <https://play.google.com/console> → create a developer account ($25 once, ID verification) →
   **Create app** → upload the `.aab` → fill store listing (use `public/icons/icon-512.png`).
3. In Play Console → **App integrity → App signing** copy the **SHA-256** fingerprint.
4. In Netlify add `ANDROID_PACKAGE=in.laxmiassociates.app` and `ANDROID_SHA256=<fingerprint>` → Redeploy.
   (This removes the browser address bar inside the app.)

Updates to the website show up in the app automatically — no new Play Store upload needed.
