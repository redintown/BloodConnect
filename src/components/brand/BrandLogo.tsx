import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { siteConfig } from "@/config/site";

/**
 * The official BloodConnect brand mark.
 *
 * Single source for brand rendering — every surface (navigation, auth pages,
 * public landing) must use this component rather than re-declaring logo
 * markup, so the asset path, sizing and accessible naming stay consistent.
 *
 * The artwork is a square (1:1) circular emblem and is used exactly as
 * supplied: no recolouring, filters, cropping or CSS effects. Intrinsic
 * dimensions are passed to next/image and display size is driven by height
 * with `w-auto`, so the aspect ratio can never distort and there is no
 * layout shift.
 *
 * Variants:
 *  - `full` — emblem plus the "BloodConnect" wordmark set in the product
 *    typography. Use where there is horizontal room (desktop rail, auth
 *    pages, public navigation).
 *  - `mark` — emblem only. Use in compact space (mobile header, tablet bar).
 *
 * Accessibility: exactly one accessible name is exposed. In `full` the
 * visible wordmark names it and the image is decorative; in `mark` the image
 * carries the name. Wrapping links therefore must NOT add their own
 * aria-label, or the name would be announced twice.
 */
const LOGO_SRC = "/logo/bloodconnect-logo.svg";

/** Intrinsic size of the supplied artwork (viewBox 0 0 1254 1254). */
const INTRINSIC_SIZE = 1254;

export type BrandLogoVariant = "full" | "mark";
export type BrandLogoSize = "sm" | "md" | "lg";

const MARK_HEIGHT: Record<BrandLogoSize, string> = {
  sm: "h-7", // 28px — mobile header, tablet bar
  md: "h-9", // 36px — desktop rail
  lg: "h-14", // 56px — auth pages, landing
};

const WORDMARK_SIZE: Record<BrandLogoSize, string> = {
  sm: "text-h3",
  md: "text-h2",
  lg: "text-h1",
};

const GAP: Record<BrandLogoSize, string> = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
};

export function BrandLogo({
  variant = "full",
  size = "md",
  /** Set on above-the-fold placements so the mark is not lazy-loaded. */
  priority = false,
  className,
}: {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  priority?: boolean;
  className?: string;
}) {
  const mark = (
    <Image
      src={LOGO_SRC}
      // Decorative in `full` (the wordmark text names the brand); named in `mark`.
      alt={variant === "mark" ? siteConfig.name : ""}
      width={INTRINSIC_SIZE}
      height={INTRINSIC_SIZE}
      // SVG is served as-is: no optimizer, no rasterising, no recolouring.
      unoptimized
      priority={priority}
      className={cn("w-auto shrink-0", MARK_HEIGHT[size])}
    />
  );

  if (variant === "mark") {
    return <span className={cn("inline-flex items-center", className)}>{mark}</span>;
  }

  return (
    <span className={cn("inline-flex items-center", GAP[size], className)}>
      {mark}
      <span className={cn("whitespace-nowrap text-brand", WORDMARK_SIZE[size])}>
        {siteConfig.name}
      </span>
    </span>
  );
}
