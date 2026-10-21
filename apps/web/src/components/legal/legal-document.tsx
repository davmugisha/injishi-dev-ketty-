import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import type { LegalBlock, LegalContent } from "@/data/legal/types";

/**
 * The one renderer for the legal pages: terms, privacy and cookies.
 *
 * The words live in `data/legal/`, typed, and nothing here knows which document
 * it is drawing. Every section is an anchor (`/legal/terms#cancellation` is
 * what the checkout's "Full policy" link opens), and a short numbered contents
 * list sits beside them, so a reviewer and a guest can both cite "section 6".
 *
 * WHILE A DOCUMENT IS A DRAFT it says so above everything else, with a count of
 * the `[TO CONFIRM: …]` markers still in it. Those markers render highlighted
 * rather than hidden on purpose: a draft that hid its open questions would read
 * as settled to the people it binds.
 */
export function LegalDocument({ content }: { content: LegalContent }) {
  const draft = content.status === "draft";
  const open = draft ? countMarkers(content) : 0;

  return (
    <div className="page-y">
      <div className="container flex flex-col">
        <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: content.title }]} />

        <header className="flex flex-col gap-4 py-10">
          <h1 className="text-3xl text-page-fg lg:text-display-md">{content.title}</h1>
          <p className="max-w-read text-page-fg-70">{content.summary}</p>
          <p className="text-sm text-page-fg-70">
            Last updated <time dateTime={content.lastUpdated}>{formatDay(content.lastUpdated)}</time>
          </p>
          {draft ? <DraftNotice open={open} /> : null}
        </header>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-32 lg:self-start">
            <p className="text-xs uppercase tracking-widest text-page-fg-70">On this page</p>
            <ol className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
              {content.sections.map((section, index) => (
                <li key={section.id} className="flex gap-2">
                  <span className="tabular-nums text-page-fg-70">{index + 1}.</span>
                  <a href={`#${section.id}`} className="text-page-fg hover:underline">
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex max-w-read flex-col gap-12">
            {content.sections.map((section, index) => (
              <section key={section.id} id={section.id} className="flex scroll-mt-32 flex-col gap-4">
                <SectionHeading lead={`${index + 1}. ${section.heading}`} />
                {section.blocks.map((block, blockIndex) => (
                  <Block key={blockIndex} block={block} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The banner a draft carries. The first sentence is the agreed wording; keep it verbatim. */
function DraftNotice({ open }: { open: number }) {
  return (
    <div
      role="note"
      className="flex max-w-read gap-3 rounded-card border border-warning/40 bg-warning/10 p-4 text-sm text-page-fg"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <p>
          This is a draft under legal review. It describes how Injishi works today, and may
          change before it is final.
        </p>
        {open > 0 ? (
          <p className="text-page-fg-70">
            {open} {open === 1 ? "point is" : "points are"} marked <ToConfirm>…</ToConfirm> and
            still {open === 1 ? "needs" : "need"} a fact from Injishi or its lawyers.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return <p className="text-page-fg-70">{renderInline(block)}</p>;
  }

  if ("list" in block) {
    return (
      <ul className="flex list-disc flex-col gap-2 pl-5 text-page-fg-70">
        {block.list.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  // The same table the photo credits page draws: it scrolls sideways on a
  // phone rather than squeezing four columns into a third of the width each.
  return (
    <div className="scrollbar overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-input">
            {block.table.columns.map((column) => (
              <th key={column} className="py-3 pr-6 font-medium text-page-fg-70">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-input/60 align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cellIndex === 0 ? "py-3 pr-6 text-page-fg" : "py-3 pr-6 text-page-fg-70"}
                >
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A fact the owner or the lawyer still has to supply.
 *
 * The literal words "TO CONFIRM" stay in the page text, not only in the
 * highlight, so a reviewer can find every one with the browser's own search.
 */
function ToConfirm({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-warning/20 px-1 text-page-fg">[TO CONFIRM: {children}]</mark>;
}

/**
 * The three inline forms `data/legal/types.ts` documents, in one pass:
 * `[TO CONFIRM: …]`, `[label](href)` and `` `literal` ``. Everything else is
 * plain text.
 */
const INLINE = /\[TO CONFIRM:\s*([^\]]+)\]|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`/g;

function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    const [, marker, label, href, literal] = match;

    if (marker !== undefined) {
      parts.push(<ToConfirm key={at}>{marker.trim()}</ToConfirm>);
    } else if (label !== undefined && href !== undefined) {
      parts.push(<InlineLink key={at} href={href} label={label} />);
    } else if (literal !== undefined) {
      parts.push(
        <code key={at} className="break-all font-mono text-page-fg">
          {literal}
        </code>,
      );
    }
    last = at + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

/** A site path goes through Next's router; an anchor or a mail address is a plain link. */
function InlineLink({ href, label }: { href: string; label: string }) {
  const className = "text-accent-text underline underline-offset-2 hover:opacity-80";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

/** Every open marker in a document, for the count in the draft notice. */
function countMarkers(content: LegalContent): number {
  const strings = content.sections.flatMap((section) =>
    section.blocks.flatMap((block) => {
      if (typeof block === "string") return [block];
      if ("list" in block) return [...block.list];
      return block.table.rows.flat();
    }),
  );
  return strings.reduce((total, value) => total + (value.match(/\[TO CONFIRM:/g)?.length ?? 0), 0);
}

const DAY = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `2026-10-21` to "21 October 2026". Read at UTC midnight so no zone moves the day. */
function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : DAY.format(date);
}
