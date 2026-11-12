import { NextResponse, type NextRequest } from "next/server";
import { getAdminOrNull } from "@/lib/auth";
import { importImageFromUrl, storeProductImage } from "@/lib/storage";

/**
 * Save a product photo. Either:
 *  - multipart form with "file" (photo from phone / camera), or
 *  - JSON { url, fallback? } (photo picked from internet search / pasted link)
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminOrNull())) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("No photo received");
      if (file.size > 15 * 1024 * 1024) throw new Error("Photo is too large");
      const url = await storeProductImage(Buffer.from(await file.arrayBuffer()));
      return NextResponse.json({ url });
    }

    const { url, fallback } = (await req.json()) as { url?: string; fallback?: string };
    if (!url) throw new Error("No link received");
    try {
      return NextResponse.json({ url: await importImageFromUrl(url) });
    } catch (e) {
      // some websites block downloads — the search thumbnail usually works
      if (fallback && fallback !== url) {
        return NextResponse.json({ url: await importImageFromUrl(fallback) });
      }
      throw e;
    }
  } catch (e) {
    const msg = (e as Error).message || "Could not save photo";
    const friendly = /unsupported image|Input buffer/i.test(msg) ? "That file is not a photo" : msg;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}
