"use client";

import { Moon, Sun } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { THEME } from "@/lib/theme";

/** Light/dark switch (mouve-light ↔ mouve-dark), as on the legacy sign-in page. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === THEME.dark;
  return (
    <Button
      isIconOnly
      variant="ghost"
      className={className}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onPress={() => setTheme(dark ? THEME.light : THEME.dark)}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
