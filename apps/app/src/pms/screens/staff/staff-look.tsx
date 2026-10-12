"use client";

/**
 * How the Staff lenses look where they show the same kind of thing (ADR-058).
 *
 * The lenses were built one by one, each right about its own data and each
 * drawing a person as a line of text and a figure as a number over a label. A
 * module about people read like a ledger. Four pieces, used by every lens:
 *
 *   Avatar, Person   a face where there is no photo: initials on a quiet tint,
 *                    the same tint every time for the same name, so an eye
 *                    finds somebody down a list before it reads
 *   Figure           a figure with the mark of what it counts, and a tone when
 *                    the figure is a state (something waiting, something wrong)
 *   Split            parts of one whole as a bar: who is in, who is out
 *
 * Nothing here reads data or decides a permission. A TONE IS A STATE, never
 * decoration: `ok`, `warn`, `bad` and `info` are the product's status colours,
 * always beside a word that says the same thing, and a plain figure is
 * `neutral`. An avatar's tint is not a state and is drawn from the brand's two
 * hues, never from the status colours.
 */

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** `Solange Uwera` is `SU`; one name gives one letter. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Five quiet grounds from the brand's green and blue, each mixed into the card so both themes carry them. */
const TINTS = [
  "color-mix(in oklab, var(--chart-2) 22%, var(--card))",
  "color-mix(in oklab, var(--info) 16%, var(--card))",
  "color-mix(in oklab, var(--chart-4) 34%, var(--card))",
  "color-mix(in oklab, var(--info) 30%, var(--card))",
  "color-mix(in oklab, var(--chart-1) 14%, var(--card))",
];

/** The same number for the same name, so a person keeps their tint from screen to screen. */
function tintOf(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum = (sum * 31 + name.charCodeAt(i)) % 9973;
  return TINTS[sum % TINTS.length] as string;
}

/** A person's face where there is no photo. Decorative: the name beside it is what is read out. */
export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, background: tintOf(name) }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-ink",
        size >= 64 ? "text-xl" : size >= 44 ? "text-sm" : "text-2xs",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Who a row is about: a face, the name, and one line under it. A link when the row leads to the file. */
export function Person({
  name,
  sub,
  href,
  size = 32,
  className,
}: {
  name: string;
  sub?: ReactNode;
  href?: string;
  size?: number;
  className?: string;
}) {
  const body = (
    <>
      <Avatar name={name} size={size} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold whitespace-nowrap text-foreground">{name}</span>
        {sub ? <span className="text-2xs text-muted-foreground">{sub}</span> : null}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={cn("flex min-w-0 items-center gap-2.5 no-underline hover:underline", className)}>
      {body}
    </Link>
  ) : (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>{body}</span>
  );
}

/**
 * A list cell that is a name over a line or two: the face stands to their left
 * and the lines keep their own column. Put it on the cell's wrapper in place of
 * a plain column, with `<Avatar className={FACE} />` as its first child.
 */
export const WITH_FACE = "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-0.5 [&>*:not(:first-child)]:col-start-2";
export const FACE = "row-span-3 self-start";

/** What a figure or a part of a whole is: a state, or nothing in particular. */
export type Tone = "neutral" | "accent" | "ok" | "warn" | "bad" | "info";

const MARK: Record<Tone, string> = {
  neutral: "bg-field text-ink2",
  accent: "bg-accent-soft text-accent-text",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  info: "bg-info-bg text-info",
};

/**
 * One figure, with the mark of what it counts. `tone` is for a figure that is
 * a state: a queue with something in it, a count that should be nought. A
 * figure that leads somewhere is a link, the whole tile.
 */
export function Figure({
  icon: IconCmp,
  n,
  label,
  hint,
  tone = "neutral",
  href,
}: {
  icon: LucideIcon;
  n: string;
  label: string;
  /** A second line: what the figure is made of, or what to do about it. */
  hint?: string;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", MARK[tone])}>
        <IconCmp aria-hidden className="size-5" strokeWidth={1.9} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cn("pms-num leading-tight font-bold tracking-[-0.3px] whitespace-nowrap text-ink", n.length > 9 ? "text-base" : "text-xl")}>{n}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint ? <span className="mt-0.5 text-2xs text-ink2">{hint}</span> : null}
      </span>
    </>
  );
  const box = "flex min-w-0 items-center gap-3 rounded-card border border-card-bd bg-card px-4 py-3.5";
  return href ? (
    <Link href={href} className={cn(box, "no-underline transition-colors duration-quick hover:bg-hover")}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

const FILL: Record<Tone, string> = {
  neutral: "bg-[var(--line2)]",
  accent: "bg-[var(--accent)]",
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  bad: "bg-[var(--bad)]",
  info: "bg-[var(--info)]",
};

/**
 * Parts of one whole, as one bar: who is at work, who has finished, who is not
 * in yet. Each part is named beneath with its count, so the bar is never read
 * by colour alone, and a part of nothing is left out of the bar and kept in
 * the key at nought.
 */
export function Split({ label, parts }: { label: string; parts: readonly { key: string; label: string; n: number; tone: Tone }[] }) {
  const total = parts.reduce((sum, p) => sum + p.n, 0);
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[var(--chart-track)]" aria-hidden>
        {total > 0 &&
          parts
            .filter((p) => p.n > 0)
            .map((p) => <span key={p.key} title={`${p.label}: ${p.n}`} style={{ flexGrow: p.n }} className={cn("min-w-1.5 basis-0 first:rounded-l-full last:rounded-r-full", FILL[p.tone])} />)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 text-2xs text-ink2">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", FILL[p.tone])} />
            <span>{p.label}</span>
            <span className="pms-num font-bold text-ink">{p.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
