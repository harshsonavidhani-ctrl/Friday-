import type { MetadataRoute } from "next";
import { adminManifest, shopManifest } from "@/lib/app-manifests";
import { appRole } from "@/lib/sites";

// The retailers' app — except on Mama's own address, where only Mama's app
// can be installed (so the two apps never get mixed up on a phone).
export default function manifest(): MetadataRoute.Manifest {
  return appRole() === "admin" ? adminManifest() : shopManifest();
}
