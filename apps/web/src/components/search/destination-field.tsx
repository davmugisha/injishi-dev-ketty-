"use client";

import { Building2, House, MapPin, Mountain, type LucideIcon } from "lucide-react";
import { Button } from "@injishi/ui";
import { useMemo, useRef, useState } from "react";
import { Input } from "@heroui/react";
import { cn, pluralize } from "@injishi/utils";
import type { Destination, DestinationKind } from "@/data/destinations";
import { KIND_LABELS, rankDestinations } from "@/lib/destination-search";

/**
 * The destination typeahead.
 *
 * Ranking runs against an in-memory index on every keystroke, so a suggestion
 * lands in the same frame as the character — no debounce and no request, which
 * is where the reference bar loses: it round-trips.
 *
 * The listbox is owned here rather than by a Popover so the input keeps focus
 * through arrow traversal; Radix's popover moves focus into the panel, which
 * breaks type-ahead-and-arrow as a single gesture.
 */
export function DestinationField({
  query,
  onQueryChange,
  onSelect,
  open,
  placeholder,
  inputRef,
  placement = "bottom",
  inputClassName,
  onFocus,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (destination: Destination) => void;
  open: boolean;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  placement?: "top" | "bottom";
  /** Appended to the input's classes; Explore's bar follows the theme. */
  inputClassName?: string;
  onFocus?: () => void;
}) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const ranked = useMemo(() => rankDestinations(query), [query]);
  const isEmptyQuery = query.trim().length === 0;

  const commit = (index: number) => {
    const hit = ranked[index];
    if (hit) onSelect(hit.destination);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (ranked.length === 0) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((current) => (current + 1) % ranked.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((current) => (current - 1 + ranked.length) % ranked.length);
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(ranked.length - 1);
        break;
      case "Enter":
        // Only claim Enter while a row is highlighted; otherwise the form
        // submits with whatever free text is in the field.
        if (open) {
          event.preventDefault();
          commit(active);
        }
        break;
      default:
        break;
    }
  };

  return (
    <>
      {/* THE ROLE TO DRIVE IS `--field`, NOT `--field-background`.

          This carried `[--field-background:transparent]` and painted a solid
          dark box inside the white pill anyway. The variable is real, but
          only in the OTHER layer: `_injishi-app.css` declares
          `--field: var(--field-background)`, so the signed-in app can be
          driven through it. The public layer takes its roles from
          `@injishi/design-tokens/heroui.css`, which sets `--field` directly,
          and nothing there reads `--field-background`. The override was a
          no-op on every public surface that used it.

          HeroUI's `.input` is `@apply ... bg-field ...` plus a `--field-focus`
          background on focus and `bg-field-hover` on hover, so all three are
          set here; overriding only the base leaves the box to reappear the
          moment the field is focused. Driving the component variable is the
          project rule for HeroUI (library-docs.md): a `bg-*` utility loses to
          its unlayered rule.

          `py-0` is the other half. `.input` carries `py-2`, which made this
          segment 73.3px against 57.3px for When and Who: one pill, three
          zones, two heights. Measured on the rendered bar.

          `--focus` goes transparent too, and the focus indicator moves OUT to
          the segment. HeroUI's `.input:focus` is `ring-2 ring-focus`, which
          drew a 2px orange box around the text inside a zone that was already
          washed to say the same thing: two indicators for one state, and the
          inner one looked like a stray control. The segment now carries both
          the wash (`focus-within`) and a keyboard-only ring, so the whole zone
          lights up rather than a box inside it. Nothing is lost to a keyboard
          user; the indicator just got bigger and landed on the real control. */}
      <Input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="destination-listbox"
        aria-autocomplete="list"
        aria-activedescendant={open && ranked[active] ? `destination-${active}` : undefined}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        className={cn(
          "w-full min-w-0 border-0 px-0 py-0 text-base leading-tight shadow-none outline-none [--field-foreground:var(--color-ink)] [--field-focus:transparent] [--field-hover:transparent] [--field:transparent] [--focus:transparent] placeholder:text-ink/65",
          inputClassName,
        )}
      />

      {open ? (
        <div
          className={cn(
            "absolute left-0 z-50 max-h-[min(70vh,520px)] w-[min(420px,calc(100vw-2rem))] scrollbar overflow-y-auto overscroll-contain rounded-card bg-white shadow-[0_18px_50px_-12px_rgba(4,35,48,0.35)] ring-1 ring-black/5",
            placement === "top"
              ? "bottom-[calc(100%+12px)]"
              : "top-[calc(100%+12px)]",
          )}
          // The panel lives inside the field's click region; a mousedown here
          // must not blur the input before the click resolves, and a click
          // must not bubble to the segment, whose handler would reopen this
          // field over whatever the selection just advanced to.
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="px-5 pb-2 pt-4 text-2xs font-semibold uppercase tracking-widest text-ink/40">
            {isEmptyQuery
              ? "Districts, parks, neighbourhoods or a stay by name"
              : pluralize(ranked.length, "match", "matches")}
          </p>

          {ranked.length === 0 ? (
            <NoMatches query={query} />
          ) : (
            <ul ref={listRef} id="destination-listbox" role="listbox" className="pb-2">
              {ranked.map((hit, index) => {
                const previous = ranked[index - 1]?.destination.kind;
                const showHeading =
                  !isEmptyQuery && hit.destination.kind !== previous;

                return (
                  <li key={hit.destination.id}>
                    {showHeading ? (
                      <p className="px-5 pb-1 pt-3 text-2xs font-medium text-ink/35">
                        {KIND_LABELS[hit.destination.kind]}
                      </p>
                    ) : null}
                    <Button
                      variant="ghost"
                      shape="square"
                      id={`destination-${index}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => commit(index)}
                      className={cn(
                        "h-auto w-full justify-start gap-3.5 px-5 py-2.5 text-left font-normal",
                        // `--surface-tint`, not `--ink-50`: the numbered ink
                        // ramp is absent from the public layer, so this row's
                        // highlight resolved to nothing and arrow traversal
                        // moved an invisible selection down an unmarked list.
                        index === active
                          ? "[--button-bg:var(--surface-tint)]"
                          : "[--button-bg:transparent]",
                      )}
                    >
                      <KindMark kind={hit.destination.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base leading-tight text-ink">
                          <Highlighted
                            text={hit.destination.label}
                            span={hit.highlight}
                          />
                        </span>
                        <span className="block truncate text-sm leading-tight text-ink/65">
                          {hit.destination.context}
                        </span>
                      </span>
                      {hit.destination.count ? (
                        <span className="shrink-0 text-xs tabular-nums text-ink/40">
                          {hit.destination.count}
                        </span>
                      ) : null}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}

/** The matched span in bold, the rest regular. */
function Highlighted({ text, span }: { text: string; span: [number, number] | null }) {
  if (!span) return <>{text}</>;
  const [start, end] = span;
  return (
    <>
      {text.slice(0, start)}
      <b className="font-semibold">{text.slice(start, end)}</b>
      {text.slice(end)}
    </>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <div className="px-5 pb-5 pt-1">
      <p className="text-base text-ink">
        Nothing matches “{query.trim()}”.
      </p>
      <p className="mt-1 text-sm text-ink/65">
        Search a district, a park, or a neighbourhood. Or press Enter to look for it
        across every stay.
      </p>
    </div>
  );
}

/**
 * A mark per row kind.
 *
 * The reference uses one magnifier for every row, which tells the eye nothing
 * about what it is about to pick. A district, a park, a neighbourhood and a
 * named property are four different answers to "where", so they read as four
 * different things.
 */
/** A district, a landmark, a wider area and a named stay are four different
 * answers to "where", so they get four different marks. */
const KIND_GLYPH: Record<DestinationKind, LucideIcon> = {
  district: MapPin,
  landmark: Mountain,
  area: Building2,
  stay: House,
};

function KindMark({ kind }: { kind: DestinationKind }) {
  const Glyph = KIND_GLYPH[kind];
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted">
      <Glyph width={18} height={18} strokeWidth={1.6} aria-hidden />
    </span>
  );
}
