/**
 * Digital Asset Links for the Play Store app (served at /.well-known/assetlinks.json).
 * Set ANDROID_PACKAGE (e.g. in.laxmiassociates.app) and ANDROID_SHA256 (from
 * Play Console → App integrity → App signing key certificate) on the live site.
 * Several fingerprints can be given, separated by commas.
 */
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE;
  const prints = (process.env.ANDROID_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const body =
    pkg && prints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints },
          },
        ]
      : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
