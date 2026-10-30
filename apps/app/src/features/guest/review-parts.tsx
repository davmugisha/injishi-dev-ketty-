"use client";

import { ChevronLeft } from "@gravity-ui/icons";
import { Switch } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { LinkButton, PhoneTop } from "@injishi/ui";
import { type ReactNode, useCallback, useEffect, useState } from "react";

/*
 * The guest phone pieces the review screen draws (Marketplace's, `/guest/review`). They were `./parts`, which
 * moves with PMS's guest screens in ADR-074 stage 4; a product never imports an app and the app never reaches
 * into a product's internals, so the review screen keeps this copy until it moves with the marketplace
 * (stage 7). The language it remembers is the same device setting the PMS guest screens read.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Language ────────────────────────────────────────────────────────────────

type Lang = "en" | "rw" | "fr";

const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "rw", label: "RW", name: "Kinyarwanda" },
  { id: "fr", label: "FR", name: "Français" },
];

const LANG_KEY = "injishi.guest.lang";

const isLang = (v: unknown): v is Lang => v === "en" || v === "rw" || v === "fr";

/**
 * The guest app's language. Starts in English (as the artifact does) and remembers the guest's choice on this
 * device, so every guest screen follows it.
 */
export function useGuestLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (isLang(saved)) setLang(saved);
    } catch {
      // Storage can be unavailable (private mode); English stays.
    }
  }, []);
  const choose = useCallback((next: Lang) => {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // Not remembered on this device; the choice still applies on this screen.
    }
  }, []);
  return [lang, choose];
}

/** EN · RW · FR switch in a guest screen header (artifact: segment--sm "Language"). */
function LanguageSwitch({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <Segment
      size="sm"
      aria-label="Language"
      selectedKey={lang}
      onSelectionChange={(k) => {
        if (isLang(k)) onChange(k);
      }}
      className="shrink-0"
    >
      {LANGS.map((l) => (
        <Segment.Item key={l.id} id={l.id} aria-label={l.name}>
          <Segment.Separator />
          {l.label}
        </Segment.Item>
      ))}
    </Segment>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

/**
 * Guest screen header row (artifact: .ij-phone-top): a leading avatar or back button, a two-line title and the
 * language switch.
 */
export function GuestTop({
  lead,
  title,
  sub,
  lang,
  onLang,
}: {
  lead: ReactNode;
  title: ReactNode;
  sub: ReactNode;
  lang: Lang;
  onLang: (lang: Lang) => void;
}) {
  return (
    <PhoneTop>
      {lead}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] leading-[18px] font-semibold">{title}</span>
        <span className="truncate text-[12px] leading-4 text-muted tabular">{sub}</span>
      </div>
      <LanguageSwitch lang={lang} onChange={onLang} />
    </PhoneTop>
  );
}

/** Ghost icon button back to another guest screen. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <LinkButton href={href} variant="ghost" isIconOnly aria-label={label} title={label} className="shrink-0">
      <ChevronLeft className="size-4" />
    </LinkButton>
  );
}

/** Card heading (artifact: 15px semibold h2). */
export function CardHeading({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cx("text-[15px] leading-[22px] font-semibold", className)}>
      {children}
    </h2>
  );
}

/** Full-width switch with the label on the left and the control on the right (artifact phone switches). */
export function WideSwitch({
  isSelected,
  onChange,
  isDisabled,
  children,
}: {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  isDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      className="w-full max-w-none flex-row-reverse justify-between"
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content className="min-w-0 flex-1 text-left">
        <span className="text-[14px] leading-5 font-medium">{children}</span>
      </Switch.Content>
    </Switch>
  );
}
