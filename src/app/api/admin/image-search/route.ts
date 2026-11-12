import { NextResponse, type NextRequest } from "next/server";
import { getAdminOrNull } from "@/lib/auth";
import { searchProductImages } from "@/lib/image-search";
import { getSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  if (!(await getAdminOrNull())) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const s = await getSettings();
  const out = await searchProductImages(q, {
    brave: process.env.BRAVE_API_KEY || s.braveApiKey,
    serper: process.env.SERPER_API_KEY || s.serperApiKey,
  });
  return NextResponse.json(out);
}
