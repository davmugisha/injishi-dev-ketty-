// biome-ignore-all lint/security/noDangerouslySetInnerHtml: static pre-paint script, no user input (Next "Preventing Flash" guide)
"use client";

import { THEME_MIGRATION } from "@/lib/theme";

/** Run during HTML parsing, then keep client-created copies inert. */
export function ThemeMigrationScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_MIGRATION }}
    />
  );
}
