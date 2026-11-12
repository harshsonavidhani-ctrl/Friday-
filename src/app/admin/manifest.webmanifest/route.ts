import { adminManifest } from "@/lib/app-manifests";

/** Install file for MAMA's app (admin) — separate from the retailers' app. */
export function GET() {
  return Response.json(adminManifest(), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
