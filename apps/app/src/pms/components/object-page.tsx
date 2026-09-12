"use client";

/**
 * The one object page shell (ADR-018, move 3).
 *
 * A record with an address needs a header that names it, a rail of lenses, and
 * two refusals. Building that five times is how five record pages end up looking
 * like five products, so it is built once here and every object copies it.
 *
 * A LENS IS A ROUTE SEGMENT, NEVER A QUERY PARAM (D-c). `/…/stays/[id]/folio`,
 * not `?tab=folio`. The whole reason records got addresses is so one member of
 * staff can send another a link; a lens that is not addressable stops that link
 * at the record and never reaches the thing they meant. This is one rule on
 * purpose: two rules become a judgement call on every new lens.
 *
 * THE RECORD NAMES ITSELF, IN THE TOPBAR (ADR-044, D-e). A shell has one `h1`
 * and the topbar owns it, so this page hands the record's name up through
 * `setRecord` rather than printing a second heading beside the route's generic
 * one ("Stay"). The browser tab follows from the same value.
 *
 * THE WAY BACK IS THE LEAF THAT GRANTS THE RECORD (ADR-044, D-d), read from the
 * nav, never written per page. The breadcrumb's middle crumb is that leaf and it
 * is the back link: a stay returns to Reservations, which a receptionist can
 * always open, rather than to Room status, which refused them.
 *
 * Registered in ui-registry.md as the object page shell.
 */

import { Breadcrumbs, type Crumb } from "@injishi/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";

import { useWorkspaceId } from "../data/capability";
import { leafFor, navFor, screenSegment } from "../lib/nav";
import { navContextOf } from "../lib/nav-context";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";
import { Icon } from "./icon";
import { Badge } from "./ui";

export interface Lens {
  key: string;
  label: string;
  /** The full address of this lens, built by the record's own route helper. */
  href: string;
}

export function ObjectPage({
  /** What the record IS, in the words two people would use for it. */
  title,
  /** The line that tells this record from its neighbours: dates, unit, room. */
  subtitle,
  /** State worth reading before anything else, or nothing. */
  status,
  lenses,
  /** Which lens is open. Matched on `key`, never on the URL. */
  active,
  children,
}: {
  title: string;
  subtitle: string;
  status?: { label: string; intent: "ok" | "warn" | "bad" | "info" | "neutral" };
  lenses: Lens[];
  active: string;
  children: ReactNode;
}) {
  const pms = usePms();
  const workspaceId = useWorkspaceId();
  const pathname = usePathname();
  const { setRecord } = usePmsUi();

  // The default lens (the first) lives at the record's own address and is not
  // worth naming in a title; any other lens is.
  const openLens = lenses.findIndex((lens) => lens.key === active) > 0
    ? lenses.find((lens) => lens.key === active)?.label
    : undefined;

  useEffect(() => {
    setRecord({ name: title, lens: openLens });
    return () => setRecord(null);
  }, [title, openLens, setRecord]);

  const parent = useMemo(
    () => leafFor(navFor(navContextOf(pms, workspaceId)), screenSegment(pathname)),
    [pms, workspaceId, pathname],
  );
  const trail: Crumb[] = parent
    ? [
        { label: parent.section.label },
        { label: parent.item.label, href: parent.item.href },
        { label: title },
      ]
    : [{ label: title }];

  return (
    <div className="pms-enter">
      <Breadcrumbs trail={trail} linkAs={Link} />

      <header style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
        <p className="pms-num" style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--muted)" }}>
          {subtitle}
        </p>
        {status ? <Badge intent={status.intent}>{status.label}</Badge> : null}
      </header>

      {/* The rail shows only the lenses this record HAS. Nobody should be able
          to click their way to a 404; a direct URL to a lens the record does not
          carry is one, per D-n, and that is the only way to reach it. A record
          with one view (a Finance bill) has no rail at all. */}
      {lenses.length > 0 && (
        <nav
          aria-label="Record sections"
          style={{
            marginTop: 16,
            display: "flex",
            gap: 4,
            overflowX: "auto",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {lenses.map((lens) => {
            const on = lens.key === active;
            return (
              <Link
                key={lens.key}
                href={lens.href}
                aria-current={on ? "page" : undefined}
                style={{
                  padding: "8px 12px 9px",
                  fontSize: 13,
                  fontWeight: on ? 700 : 500,
                  color: on ? "var(--foreground)" : "var(--muted)",
                  borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {lens.label}
              </Link>
            );
          })}
        </nav>
      )}

      <div style={{ marginTop: 18 }}>{children}</div>
    </div>
  );
}

/**
 * A record this caller cannot act on, but may know exists.
 *
 * DELIBERATELY NOT A 404. The two refusals answer different questions and must
 * not be collapsed: a record in another workspace is a 404, because confirming
 * it exists tells a stranger something. A record in YOUR workspace that your
 * role cannot touch is a refusal that names the reason, because you already know
 * it exists and a 404 would send you to fix the wrong thing.
 */
export function ObjectRefused({ reason }: { reason: string }) {
  return (
    <div
      className="pms-enter"
      style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        style={{
          maxWidth: 440,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--bad-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--bad)",
          }}
        >
          <Icon name="shield-check" size={26} strokeWidth={1.6} />
        </span>
        <h2 className="pms-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
          Not yours to change
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>{reason}</p>
      </div>
    </div>
  );
}
