import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

/**
 * Centralized design tokens — "Clinical Infrastructure" (Phase 11B).
 *
 * Colour values live in src/app/globals.css as RGB channel triplets and are
 * referenced here so opacity modifiers keep working (bg-emergency/10).
 * Components must use these semantic names instead of raw hex or raw palette
 * shades, which is what previously produced three competing reds.
 *
 * Colour rules:
 *  - `primary` (ink #101828) is the standard action colour.
 *  - `emergency` (#DC2626) is reserved for emergency requests/actions only.
 *  - `danger` (#B42318) is destructive/error and stays distinct from emergency.
 *  - `brand` (#9F1239) is identity only — never a CTA fill.
 */
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        canvas: token("canvas"),
        surface: token("surface"),
        muted: token("muted"),
        border: token("border"),
        "border-strong": token("border-strong"),
        text: token("text"),
        "text-secondary": token("text-secondary"),
        "text-tertiary": token("text-tertiary"),
        primary: token("primary"),
        "primary-foreground": token("primary-foreground"),
        brand: token("brand"),
        emergency: token("emergency"),
        "emergency-hover": token("emergency-hover"),
        "emergency-surface": token("emergency-surface"),
        danger: token("danger"),
        "danger-surface": token("danger-surface"),
        success: token("success"),
        "success-surface": token("success-surface"),
        warning: token("warning"),
        "warning-surface": token("warning-surface"),
        info: token("info"),
        "info-surface": token("info-surface"),
      },
      // Bare `border` picks up the token colour without needing border-border.
      borderColor: {
        DEFAULT: token("border"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      // Semantic type scale. Weight is baked in so headings cannot drift.
      fontSize: {
        h1: ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }], // 24/32
        h2: ["1.125rem", { lineHeight: "1.625rem", fontWeight: "600" }], // 18/26
        h3: ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }], // 16/24
        body: ["0.9375rem", { lineHeight: "1.5rem", fontWeight: "400" }], // 15/24
        "body-strong": ["0.9375rem", { lineHeight: "1.5rem", fontWeight: "500" }],
        label: ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "500" }], // 13/18
        caption: ["0.75rem", { lineHeight: "1rem", fontWeight: "400" }], // 12/16
        numeric: ["1.25rem", { lineHeight: "1.5rem", fontWeight: "600" }], // 20/24
        "blood-group": ["1.25rem", { lineHeight: "1.5rem", fontWeight: "700" }],
        urgent: ["0.9375rem", { lineHeight: "1.375rem", fontWeight: "700" }], // 15/22
      },
      borderRadius: {
        sm: "6px", // chips, checkboxes
        md: "8px", // buttons, inputs
        lg: "12px", // cards, panels
        dialog: "16px",
        pill: "9999px", // status pills only
      },
      // Elevation is for genuinely floating layers only — never decoration.
      boxShadow: {
        sm: "0 1px 2px rgba(16,24,40,.06)", // sticky bars
        md: "0 4px 12px rgba(16,24,40,.10)", // popovers
        lg: "0 12px 32px rgba(16,24,40,.18)", // dialogs, sheets
      },
      maxWidth: {
        shell: "1200px", // desktop app shell
        "shell-wide": "1280px", // large desktop
        form: "720px", // readable form column
      },
      screens: {
        // mobile <640 · tablet 640–1024 · desktop 1024–1440 · large >1440
        wide: "1440px",
      },
      minHeight: {
        control: "44px", // mobile touch target floor
        "control-desktop": "40px",
        nav: "56px", // mobile bottom nav floor
      },
    },
  },
  plugins: [],
};

export default config;
