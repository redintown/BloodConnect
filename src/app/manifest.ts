import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

// App Router metadata file — served at /manifest.webmanifest.
//
// The install icon is the official BloodConnect brand mark (square 1:1 SVG,
// scales to any size). Raster fallbacks for platforms that ignore SVG — and a
// `maskable` variant, which would crop this circular emblem — require derived
// artwork and are deliberately not generated here.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#DC2626",
    icons: [
      {
        src: "/logo/bloodconnect-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
