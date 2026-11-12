# Laxmi Associates — Wholesale Electronics Shop

Website + admin panel for Mama's wholesale business. Retailers register, see
daily wholesale rates (only after approval), add to cart and order. Mama updates
prices/stock every day from his phone and confirms orders. Payment by UPI QR
(exact amount, split for lakhs), bank transfer, cash or credit.

## Run it on this laptop

```powershell
cd "C:\Users\Harsh Vidhani\laxmi-associates"
npm run dev
```

Open http://localhost:3000. The first start creates the database with demo data
automatically (stored in `.data/` — delete that folder to start fresh).

If `npm run dev` ever shows *"failed to create junction point … Access is denied"*
(a Windows/antivirus quirk with the Turbopack bundler), use `npm run dev:webpack`
instead — same app, different bundler.

**Demo logins (local testing only)**

| Who | Mobile | Password |
| --- | --- | --- |
| Mama (admin) | 9999999999 | mama1234 |
| Demo retailer | 8888888888 | shop1234 |

### Try it on a phone (same Wi-Fi)

```powershell
npm run dev:phone
```

Then on the phone open `http://<laptop-IP>:3000` (the terminal prints the
"Network" address, e.g. http://192.168.1.3:3000). Windows may ask to allow
Node.js through the firewall — allow it for private networks.

## Main screens

**Retailers:** Home · Products (search, category, brand, in-stock) · Product page
(variants, margin vs MRP, add to cart, ask on WhatsApp) · Cart (pickup / parcel) ·
Orders (status timeline, UPI QR with exact amount, bank details, submit UTR).

**Admin (`/admin`):**
- **Add new model** — type the name (e.g. `S24 Ultra 12/256`): brand, category and
  variant are detected, photos are searched and the best one is saved automatically.
- **Prices & stock** — every model on one screen; change numbers, press Save once.
- **Excel / Tally import** — upload a Tally Stock Summary or our own Excel; rows are
  matched to models (name + RAM/storage, model no., or ID), every change is previewed,
  unknown rows can be added as new models. Price list and orders download as Excel.
- **Orders** — confirm, edit qty/rate, add parcel charges, mark dispatched / ready /
  completed, verify payments, **scan IMEI / serial numbers** (camera or typed, check
  digit + duplicate check, printed on the bill, searchable), print, WhatsApp updates.
- **Retailers & khata** — approve shops, one-tap **login link** on WhatsApp, reset
  password, block; per-shop **khata** (ledger with running balance, lump-sum payment
  adjusted oldest-first, WhatsApp payment reminder, printable statement).
- **Alerts** — bell icon + phone notifications (web push) for new orders, payments,
  new shops, forgotten passwords; retailers get confirmed / dispatched / payment alerts.
- **Share rate list** — ready WhatsApp message of today's rates.
- **Settings** — shop info, UPI ID, bank, photo-search key, remove demo data.

Everything is in **English and हिंदी** (EN | हिंदी switch in the top bar, remembered per phone).
Retailers also get **My khata** (`/account/khata`), **Forgot password** (asks Mama for a
login link) and an **Install app** button.

## Automatic photo search

Uses Brave Search API (free $5 credit / month ≈ 1,000 searches).
Sign up at https://api-dashboard.search.brave.com/ → Search plan → copy key →
paste in **Admin → Settings → Automatic photo search**. Without a key, Mama can
still take a photo, pick from gallery or paste an image link.

## Going live

**Step-by-step guide: [GO-LIVE.md](GO-LIVE.md)** (Supabase + Netlify + GitHub + domain +
Play Store). `npm run db:copy-to-live` copies everything from the laptop to Supabase.

The app switches to the live setup purely through environment variables (`.env.example`):

| Variable | What |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres connection string (pooler) |
| `SUPABASE_URL` | Supabase project URL (photo storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (server only, keep secret) |
| `SUPABASE_BUCKET` | Storage bucket name, public (default `product-images`) |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://laxmiassociates.in` |
| `BRAVE_API_KEY` | optional, instead of saving it in Settings |

One-time database setup for the live site:

```powershell
$env:DATABASE_URL="postgresql://..."; $env:ADMIN_PHONE="98xxxxxxxx"; $env:ADMIN_PASSWORD="choose-a-strong-one"
npm run db:setup
```

## Developer notes

- Next.js 16 (App Router), React 19, Tailwind CSS 4, Drizzle ORM.
- Local DB: PGlite (Postgres in-process). Live DB: any Postgres (Supabase).
- Schema: `src/db/schema.ts` → after changes run `npm run db:generate`.
- Translations: English text is the key, Hindi lives in `src/lib/hi.ts`
  (`t("Text {n}", { n })` in server code via `getT()`, in client code via `useT()`).
- Security: hashed sessions + login tokens, login/registration rate limits,
  security headers, push endpoints restricted to real push services.
- Checks: `npm run typecheck`, `npm run lint`, `npm run build`.
