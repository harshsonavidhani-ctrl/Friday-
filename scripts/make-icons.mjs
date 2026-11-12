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

// Mama's admin app: gold icon so it never gets mixed up with the retailers' app
const adminMark = `<path d="M18 24h12v40h10v12H18z" fill="#121a4b"/><path fill="#121a4b" fill-rule="evenodd" d="M56 24h12l16 52H72l-3-10H55l-3 10H40zM62 40l4 16h-8z"/>`;
const adminRounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fcca4d"/><stop offset="1" stop-color="#f5930b"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/>${adminMark}<rect x="62" y="80" width="30" height="12" rx="6" fill="#121a4b"/><text x="77" y="89" font-family="Arial,Helvetica,sans-serif" font-size="8.5" font-weight="700" text-anchor="middle" fill="#fcca4d">MAMA</text></svg>`;
const adminMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fcca4d"/><stop offset="1" stop-color="#f5930b"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><g transform="translate(17.5 17.5) scale(0.65)">${adminMark}</g></svg>`;
for (const size of [192, 512]) {
  await sharp(Buffer.from(adminRounded)).resize(size, size).png().toFile(`public/icons/admin-${size}.png`);
}
await sharp(Buffer.from(adminMaskable)).resize(512, 512).png().toFile("public/icons/admin-maskable-512.png");
console.log("icons written");
