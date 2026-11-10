import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { cn } from "@injishi/utils";
import { HostKindIcons } from "@/components/icons/search";
import {
  HOST_PROPERTY_KIND_GROUPS,
  HOST_PROPERTY_KINDS,
  hostKindHref,
} from "@/data/host";

type HostPropertyKind = (typeof HOST_PROPERTY_KINDS)[number];

/**
 * The property-type chooser — the entry point to the listing funnel.
 *
 * Floated over the hero photograph as a card. DESIGN.md forbids drop shadows,
 * so separation comes from the hero scrim, the card's tonal step against that
 * ground, and a hairline border.
 *
 * Inside, kinds are a two-column grid of tiles rather than a one-per-row list.
 * The list held eleven rows and scrolled inside the card, so Food & drink and
 * Residence sat below the fold where nobody saw them. Two columns fit
 * every kind on a 1440x900 screen with no inner scroll. Every tile keeps the
 * same width, so a group with an odd count leaves its last cell empty.
 *
 * Each tile goes straight to `/register` with its kind (`hostKindHref`).
 */

export async function HostChooser({ className }: { className?: string }) {
  const t = await getTranslations("host");
  return (
    <section
      aria-labelledby="host-chooser-title"
      className={cn(
        "flex flex-col overflow-hidden lg:max-h-[calc(100dvh-7rem)] rounded-card border border-border bg-card",
        className,
      )}
    >
      <header className="shrink-0 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
        <h2
          id="host-chooser-title"
          className="text-xl font-medium tracking-tight text-page-fg lg:text-2xl"
        >
          {t("chooserTitle")}
        </h2>
        <p className="mt-1 text-sm text-page-fg-70">
          {t("chooserLead")}
        </p>
      </header>

      <div className="min-h-0 flex-1 px-5 lg:overflow-y-auto lg:overscroll-contain pb-5 sm:px-6 sm:pb-6">
        <div className="flex flex-col gap-4">
          {HOST_PROPERTY_KIND_GROUPS.map((group) => (
            <div key={group.id}>
              <h3 className="mb-2 text-2xs font-semibold tracking-[0.08em] text-page-fg-70 uppercase">
                {t(`groups.${group.id}`)}
              </h3>
              <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[420px]:grid-cols-2">
                {group.kinds.map((kind) => (
                  <li key={kind.value}>
                    <KindTile kind={kind} label={t(`names.${kind.value}`)} blurb={t(`kinds.${kind.value}`)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function KindTile({ kind, label, blurb }: { kind: HostPropertyKind; label: string; blurb: string }) {
  // No fallback and no cast: `HostKindIcons` is total over `HostKind`
  // and `kind.value` is one, so a missing mark is a compile error
  // rather than a blank circle (ADR-011 call 7).
  const Icon = HostKindIcons[kind.value];

  return (
    <Link
      href={hostKindHref(kind.value)}
      className={cn(
        "group relative flex h-full items-center gap-3 rounded-[0.875rem] border border-border px-3 py-2.5 transition-colors duration-quick",
        "hover:border-accent-brand hover:bg-accent-brand/5",
        "focus-visible:border-accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-surface-secondary text-page-fg transition-colors duration-quick group-hover:bg-accent-brand group-hover:text-accent-brand-foreground">
        <Icon size={20} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-page-fg">{label}</span>
        <span className="line-clamp-2 text-xs leading-snug text-page-fg-70">{blurb}</span>
      </span>

      <ArrowRight
        aria-hidden
        className="size-4 shrink-0 -translate-x-1 text-accent-brand opacity-0 transition duration-quick group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
      />
    </Link>
  );
}
