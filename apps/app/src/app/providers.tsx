"use client";

import { I18nProvider, RouterProvider } from "@heroui/react";
import { LOCALE } from "@injishi/ui/format";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { THEME } from "@/lib/theme";

declare module "@heroui/react" {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
  }
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
      <RouterProvider navigate={(href, options) => router.push(href, options)}>
        <I18nProvider locale={LOCALE}>{children}</I18nProvider>
      </RouterProvider>
    </ThemeProvider>
  );
}
