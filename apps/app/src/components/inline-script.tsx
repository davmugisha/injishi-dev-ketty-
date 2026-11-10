"use client";

/**
 * An inline script that runs while the browser parses the server HTML, before the first paint.
 *
 * On the server it keeps its executable type, so a hard load runs it synchronously. When React
 * renders it on the client (hydration, or the development Strict Mode remount) it is inert: a
 * script with no type, or an executable type, is never run there and React warns "Encountered a
 * script tag while rendering React component". This is the helper from Next's "Preventing flash
 * before hydration" guide.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: callers pass a constant from this bundle, never visitor input.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
