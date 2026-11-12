import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const BUCKET = process.env.SUPABASE_BUCKET || "product-images";

/** New Supabase "secret" keys (sb_secret_…) go in the apikey header; old service_role keys are JWTs (eyJ…). */
export function supabaseAuth(key: string): Record<string, string> {
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

/**
 * Cleans up any product photo (rotate, shrink to max 1200px, white
 * background, WebP) and stores it. Returns the public URL.
 * Live site: Supabase Storage. Laptop: ./.data/uploads served at /uploads/…
 */
export async function storeProductImage(input: Buffer): Promise<string> {
  const out = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 82 })
    .toBuffer();

  const name = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.webp`;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${name}`, {
      method: "POST",
      headers: {
        ...supabaseAuth(supabaseKey),
        "Content-Type": "image/webp",
        "Cache-Control": "max-age=31536000",
      },
      body: new Uint8Array(out),
    });
    if (!res.ok) throw new Error(`Photo upload failed (${res.status})`);
    return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${name}`;
  }

  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_UPLOAD_DIR, name), out);
  return `/uploads/${name}`;
}

export async function readLocalUpload(file: string): Promise<Buffer | null> {
  if (!/^[a-z0-9-]+\.webp$/.test(file)) return null;
  try {
    return await readFile(path.join(LOCAL_UPLOAD_DIR, file));
  } catch {
    return null;
  }
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$)/i;

/** Downloads an image from the internet (e.g. a search result) and stores it. */
export async function importImageFromUrl(url: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("That is not a valid link");
  }
  if (!/^https?:$/.test(u.protocol) || PRIVATE_HOST.test(u.hostname)) {
    throw new Error("That link cannot be used");
  }
  const res = await fetch(u, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LaxmiAssociatesCatalog/1.0)",
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Could not download photo (${res.status})`);
  const type = res.headers.get("content-type") || "";
  if (type && !type.startsWith("image/") && !type.includes("octet-stream")) {
    throw new Error("That link is not a photo");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new Error("Photo is too large");
  return storeProductImage(buf);
}
