/**
 * Skip link — the first focusable element on every page.
 *
 * Targets `#main-content`, which is set by AppShell, PageShell, the (auth)
 * layout and the landing page's own main element, so keyboard and
 * screen-reader users can bypass the account bar and navigation.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-label focus:text-primary-foreground"
    >
      Skip to main content
    </a>
  );
}
