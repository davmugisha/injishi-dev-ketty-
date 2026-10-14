"use client";

import { ChevronLeft } from "@gravity-ui/icons";
import { Avatar, Switch } from "@heroui/react";
import { Segment, Timeline } from "@heroui-pro/react";
import type { GuestStepStatus } from "@injishi/data/fixtures/guest";
import { Icon, LinkButton, PhoneTop } from "@injishi/ui";
import NextLink from "next/link";
import { type ComponentPropsWithRef, type ReactNode, useCallback, useEffect, useState } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Language ────────────────────────────────────────────────────────────────

export type Lang = "en" | "rw" | "fr";

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
export function LanguageSwitch({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
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

/** Small soft avatar with initials (the guest, or the hotel). */
export function InitialsAvatar({ initials }: { initials: string }) {
  return (
    <Avatar size="sm" variant="soft" color="accent" className="shrink-0">
      <Avatar.Fallback>{initials}</Avatar.Fallback>
    </Avatar>
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

/** Screen heading under the header (artifact: 24px h1 with a muted line). */
export function ScreenHeading({ title, sub, children }: { title: ReactNode; sub: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-[2px]">
      <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.015em]">{title}</h1>
      <p className="text-[14px] leading-5 text-muted">{sub}</p>
      {children}
    </div>
  );
}

/** Step heading inside a flow (artifact: 22px h1 with a muted line). */
export function StepHeading({ id, title, sub }: { id: string; title: ReactNode; sub: ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <h1 id={id} className="text-[22px] leading-7 font-semibold">
        {title}
      </h1>
      <p className="text-[14px] leading-5 text-muted">{sub}</p>
    </div>
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

// ── Small pieces ────────────────────────────────────────────────────────────

/** Rounded icon tile (artifact: .item-card__icon used outside an item card). */
export function IconTile({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-default text-foreground",
        className,
      )}
    >
      <Icon name={name} className="size-4" />
    </span>
  );
}

/** Muted icon + text row (guide entries, privacy points, help notes). */
export function IconRow({
  icon,
  title,
  text,
  className,
}: {
  icon: string;
  title?: ReactNode;
  text: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start gap-[10px]", className)}>
      <Icon name={icon} className="mt-[2px] size-4 shrink-0 text-muted" />
      <div className="flex min-w-0 flex-col gap-[1px]">
        {title ? <span className="text-[13px] leading-[18px] font-semibold">{title}</span> : null}
        <span className="text-[12px] leading-[17px] text-muted">{text}</span>
      </div>
    </div>
  );
}

/** Muted 12px note with a leading icon (artifact: ij-muted ij-row with gi-sm). */
export function Hint({ icon, children, className }: { icon: string; children: ReactNode; className?: string }) {
  return (
    <p className={cx("flex items-start gap-[6px] text-[12px] leading-4 text-muted", className)}>
      <Icon name={icon} className="mt-[1px] size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Accent text link with a trailing chevron (artifact: ij-link-reset row in accent-soft-foreground). */
export function ChevronLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <NextLink
      href={href}
      className="flex items-center gap-[6px] self-start text-[12px] leading-4 font-medium text-accent-soft-foreground no-underline hover:underline"
    >
      {children}
      <Icon name="ChevronRight" className="size-3.5" />
    </NextLink>
  );
}

// ── Card render helpers ─────────────────────────────────────────────────────

/** Renders a Card as a <section> landmark (the artifact's cards are sections with their own heading). */
export function renderSection(props: ComponentPropsWithRef<"section">) {
  return <section {...props} />;
}

/** Renders a Card as an <article> (one request, one payment, one past trip). */
export function renderArticle(props: ComponentPropsWithRef<"article">) {
  return <article {...props} />;
}

/** Renders an ItemCard as a native button — the documented ItemCard "Pressable" pattern. */
export function renderButton(props: ComponentPropsWithRef<"button">) {
  return <button type="button" {...props} />; // heroui-ok: ItemCard pressable pattern (docs/heroui/item-card.md)
}

/** Renders an ItemCard as a link to another screen. */
export function renderAnchor(href: string) {
  return function Anchor(props: ComponentPropsWithRef<"a">) {
    return <NextLink {...props} href={href} />;
  };
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

/** Compact timeline with an icon in each marker (artifact: timeline--sm timeline--compact). */
export function GuestTimeline({
  label,
  items,
}: {
  label?: string;
  items: { id: string; status: GuestStepStatus; icon: string; title: string; detail: string }[];
}) {
  return (
    <Timeline size="sm" density="compact" aria-label={label}>
      {items.map((item) => (
        <Timeline.Item key={item.id} status={item.status}>
          <Timeline.Rail>
            <Timeline.Marker>
              <Icon name={item.icon} className="size-3" />
            </Timeline.Marker>
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content className="flex flex-col pb-[2px]">
            <span className="font-medium">{item.title}</span>
            <span className="text-[12px] leading-4 text-muted tabular">{item.detail}</span>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
