"use client";

/**
 * A screen the IA reserves but nobody has built yet. It names what the screen
 * is for (never a blank page), the ways the design looks at it, where that
 * work happens today, and a status chip, so the gap is honest rather than
 * hidden. It shows no number: a placeholder that showed one would be inventing
 * it.
 *
 * The Pro empty state (`@injishi/ui/empty-state`), which is what the boards
 * draw where the database cannot answer yet.
 */

import { EmptyState } from "@injishi/ui/empty-state";
import {
  Building2,
  ChartColumn,
  ConciergeBell,
  ContactRound,
  CreditCard,
  FileText,
  Gift,
  Handshake,
  LayoutGrid,
  MoonStar,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  UserPlus,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { PLACEHOLDER_COPY } from "../lib/nav";

/** The icons `PLACEHOLDER_COPY` names, imported one by one so the bundle carries only these. */
const ICONS: Record<string, LucideIcon> = {
  "building-2": Building2,
  "chart-column": ChartColumn,
  "concierge-bell": ConciergeBell,
  "contact-round": ContactRound,
  "credit-card": CreditCard,
  "file-text": FileText,
  gift: Gift,
  handshake: Handshake,
  "layout-grid": LayoutGrid,
  "moon-star": MoonStar,
  plug: Plug,
  "scroll-text": ScrollText,
  settings: Settings,
  "shield-check": ShieldCheck,
  tags: Tags,
  "user-plus": UserPlus,
  "user-round": UserRound,
  wallet: Wallet,
};

export function Placeholder({ screenKey }: { screenKey: string }) {
  const info = PLACEHOLDER_COPY[screenKey] ?? {
    icon: "layout-grid",
    title: screenKey,
    line: "",
  };
  const Glyph = ICONS[info.icon] ?? LayoutGrid;

  return (
    <div className="pms-enter flex min-h-[60vh] items-center justify-center">
      <EmptyState size="lg" className="max-w-narrow">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Glyph aria-hidden className="size-6" strokeWidth={1.6} />
          </EmptyState.Media>
          <EmptyState.Title>{info.title}</EmptyState.Title>
          {info.line ? <EmptyState.Description className="text-pretty">{info.line}</EmptyState.Description> : null}
        </EmptyState.Header>
        <EmptyState.Content className="items-center gap-3">
          {info.lenses && info.lenses.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">What it will hold</span>
              <ul className="flex flex-wrap justify-center gap-1.5" aria-label={`What ${info.title} will hold`}>
                {info.lenses.map((lens) => (
                  <li key={lens} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground">
                    {lens}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {info.hint ? <p className="text-center text-sm font-semibold text-accent-text text-pretty">{info.hint}</p> : null}
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
            {info.status ?? "Next design pass"}
          </span>
        </EmptyState.Content>
      </EmptyState>
    </div>
  );
}
