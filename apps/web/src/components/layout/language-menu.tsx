"use client";

import { Globe } from "lucide-react";
import { useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@injishi/web-ui";
import { cn } from "@injishi/utils";

/**
 * The language switcher in the site header.
 *
 * It lived inline in `explore-header.tsx`, which was `/explore`'s own second
 * menu. That header is deleted and the marketplace runs on one bar, so the
 * control moved here rather than going with it — a component of its own this
 * time, because the one bar it now sits in is rendered by every route and an
 * inline copy in a shared file is how the two headers drifted apart in the
 * first place.
 *
 * **Nothing consumes the choice yet, and that is stated here rather than
 * hidden.** It opens, it holds a selection, and it renders the mark against
 * it. No route, no fetch and no formatter reads the value: there is no locale
 * layer in this app. It is kept because the capture ships it and because the
 * three languages are the real ones this market needs, not because it works.
 * When a locale layer lands, this is the ONE call site that has to change.
 */
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "rw", label: "Kinyarwanda" },
];

export function LanguageMenu({ className }: { className?: string }) {
  const [language, setLanguage] = useState("en");
  const current = LANGUAGES.find((entry) => entry.code === language) ?? LANGUAGES[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // The label carries the CURRENT language, not just the action. A
          // globe on its own tells a screen reader nothing about what is
          // selected, and this control's whole state is which one is.
          aria-label={`Change language, current: ${current.label}`}
          className={cn("group", className)}
        >
          <Globe
            width={20}
            height={20}
            className="opacity-70 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max border border-border">
        <span className="block px-3 py-2 text-2xs font-medium text-muted-foreground">
          LANG
        </span>
        <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
          {LANGUAGES.map((entry) => (
            <DropdownMenuRadioItem key={entry.code} value={entry.code}>
              {entry.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
