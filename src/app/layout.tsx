import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { AuthNav } from "@/components/ui/AuthNav";
import { SkipToContent } from "@/components/ui/SkipToContent";

/**
 * One variable font for the whole app, exposed as --font-sans and consumed
 * by the Tailwind `sans` family (with a system fallback stack).
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
};

export const viewport: Viewport = {
  themeColor: "#DC2626",
  width: "device-width",
  initialScale: 1,
  // No maximumScale / userScalable: pinch-zoom must stay available
  // (WCAG 1.4.4). Phase 11B removed the previous maximumScale: 1.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      {/*
        No global max-width: the app shell owns responsive width per region.
        The previous `max-w-lg` rendered a 512px phone column on desktop.
      */}
      <body className="bg-background font-sans text-body text-text antialiased">
        <SkipToContent />
        <AuthNav />
        {children}
      </body>
    </html>
  );
}
