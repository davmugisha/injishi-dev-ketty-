"use client";

import { I18nProvider, RouterProvider } from "@heroui/react";
import { LOCALE } from "@injishi/ui/format";
import { useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";
import { THEME } from "@/lib/theme";

declare module "@heroui/react" {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
  }
}

/**
 * The design tokens' dark roles are scoped to `.dark` (packages/design-tokens): the `mouve-dark` id alone
 * would keep their light values. The class follows the theme; the pre-paint script sets it first.
 */
function DarkClass() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === THEME.dark);
  }, [resolvedTheme]);
  return null;
}

/** App-wide client providers: theme (mouve light/dark), React Aria routing via Next, locale. */
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <ThemeProvider
      attribute="data-theme"
      themes={[THEME.light, THEME.dark]}
      defaultTheme={THEME.light}
      enableSystem={false}
      disableTransitionOnChange
    >
      <DarkClass />
      <RouterProvider navigate={(href, options) => router.push(href, options)}>
        <I18nProvider locale={LOCALE}>{children}</I18nProvider>
      </RouterProvider>
    </ThemeProvider>
  );
}
