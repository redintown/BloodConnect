import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

// App Router metadata file — served at /manifest.webmanifest. Real icon
// assets (proper multi-size PNGs) are a Phase 10 task; icon.svg here is a
// functional placeholder so the manifest is valid immediately.
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
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
