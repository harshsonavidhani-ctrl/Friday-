/**
 * Two apps → two web addresses, so a phone installs them as two SEPARATE apps.
 * (On one address the shops' app covers every page, including /admin, and the
 * phone then says Mama's app is "already installed".)
 *
 *   shops → https://laxmi-associates.netlify.app   (retailers' app)
 *   Mama  → https://laxmi-mama.netlify.app/admin    (admin app)
 *
 * Both are the same code and the same database (two Netlify sites from one
 * GitHub repo). next.config.ts works out which one is being built and sets
 * APP_ROLE / SHOP_SITE_URL / ADMIN_SITE_URL. On the laptop nothing is set and
 * everything stays on one address, as before.
 */
export const DEFAULT_SHOP_URL = "https://laxmi-associates.netlify.app";
export const DEFAULT_ADMIN_URL = "https://laxmi-mama.netlify.app";

/** "admin" on Mama's site, "shop" on the retailers' site, "" on the laptop. */
export const appRole = (): "admin" | "shop" | "" =>
  process.env.APP_ROLE === "admin" ? "admin" : process.env.APP_ROLE === "shop" ? "shop" : "";

/** Where shops log in (used for links shown on Mama's site). */
export const shopLoginHref = () => (process.env.SHOP_SITE_URL ? `${process.env.SHOP_SITE_URL}/login` : "/login");
