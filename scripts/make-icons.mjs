// Generates the PNG app icons from the logo. Run: node scripts/make-icons.mjs
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const mark = `<path d="M18 24h12v40h10v12H18z" fill="#fbb424"/><path fill="#fff" fill-rule="evenodd" d="M56 24h12l16 52H72l-3-10H55l-3 10H40zM62 40l4 16h-8z"/>`;
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#121a4b"/>${mark}</svg>`;
// maskable: full-bleed background, mark shrunk into the safe zone
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#121a4b"/><g transform="translate(17.5 17.5) scale(0.65)">${mark}</g></svg>`;
// status-bar badge for phone alerts: white shape on transparent (Android tints it)
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#fff"><path d="M18 24h12v40h10v12H18z"/><path fill-rule="evenodd" d="M56 24h12l16 52H72l-3-10H55l-3 10H40zM62 40l4 16h-8z"/></g></svg>`;

await mkdir("public/icons", { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(rounded)).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(Buffer.from(badge)).resize(96, 96).png().toFile("public/icons/badge-96.png");

// Mama's own app: his name in big letters under a crown (the owner's app),
// on gold — the shops' app is navy "LA", so the two never look alike.
// Letters are drawn as shapes (not a font) so the icon looks the same everywhere.
const M = (x, y, w, h, t) =>
  `M${x} ${y + h}V${y}h${t * 1.2}L${x + w / 2} ${y + h * 0.56}L${x + w - t * 1.2} ${y}H${x + w}V${y + h}h${-t}V${y + h * 0.4}L${x + w / 2} ${y + h * 0.95}L${x + t} ${y + h * 0.4}V${y + h}Z`;
const A = (x, y, w, h, t) => {
  const a = w * 0.27; // how far the slanted sides lean in (keeps a clear hole in the A)
  const at = (yy) => a * (1 - (yy - y) / h); // outer left edge x-offset at height yy
  const bar = [y + h * 0.62, y + h * 0.8];
  const top = y + h * 0.24;
  return (
    `M${x} ${y + h}L${x + a} ${y}H${x + w - a}L${x + w} ${y + h}h${-t}L${x + w - at(bar[1]) - t} ${bar[1]}H${x + at(bar[1]) + t}L${x + t} ${y + h}Z` +
    `M${x + at(top) + t} ${top}H${x + w - at(top) - t}L${x + w - at(bar[0]) - t} ${bar[0]}H${x + at(bar[0]) + t}Z`
  );
};
const word = (x, y, h) => {
  const t = h * 0.27, wm = h * 0.98, wa = h * 0.9, gap = h * 0.08;
  let d = "", cx = x;
  for (const ch of "MAMA") {
    d += ch === "M" ? M(cx, y, wm, h, t) : A(cx, y, wa, h, t * 0.75);
    cx += (ch === "M" ? wm : wa) + gap;
  }
  return { d, width: cx - gap - x };
};
const h = 20;
const { width } = word(0, 0, h);
const mama = word(50 - width / 2, 52, h).d;
const crown = `<path fill="#121a4b" d="M31 42V25l9.5 8L50 18l9.5 15 9.5-8v17z"/><rect x="31" y="43.5" width="38" height="4.5" rx="2" fill="#121a4b"/><circle cx="31" cy="24" r="3" fill="#121a4b"/><circle cx="50" cy="17" r="3.2" fill="#121a4b"/><circle cx="69" cy="24" r="3" fill="#121a4b"/><circle cx="50" cy="36" r="2.6" fill="#fcca4d"/>`;
const adminArt = `${crown}<path fill="#121a4b" fill-rule="evenodd" d="${mama}"/><rect x="34" y="78" width="32" height="3.2" rx="1.6" fill="#121a4b" opacity=".55"/>`;
const gold = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd768"/><stop offset=".55" stop-color="#fbb424"/><stop offset="1" stop-color="#f08a00"/></linearGradient><radialGradient id="s" cx=".3" cy=".2" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
const adminRounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${gold}<rect width="100" height="100" rx="22" fill="url(#g)"/><rect width="100" height="100" rx="22" fill="url(#s)"/>${adminArt}</svg>`;
// maskable (Android shapes): full-bleed gold, art shrunk into the safe circle
const adminMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${gold}<rect width="100" height="100" fill="url(#g)"/><rect width="100" height="100" fill="url(#s)"/><g transform="translate(14 13) scale(0.72)">${adminArt}</g></svg>`;
for (const size of [192, 512]) {
  await sharp(Buffer.from(adminRounded)).resize(size, size).png().toFile(`public/icons/admin-${size}.png`);
}
await sharp(Buffer.from(adminMaskable)).resize(512, 512).png().toFile("public/icons/admin-maskable-512.png");
console.log("icons written");
