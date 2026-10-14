"use client";

/**
 * Command bar (⌘K) — the fast path for a busy desk: jump to a reservation,
 * room, guest, or bill without reaching for the mouse (blueprint §3.1).
 *
 * The index is built from the workspace in view: nav destinations always, plus
 * the live reservations, rooms and open bills a receptionist actually chases.
 */

import { useRouter } from "next/navigation";
import { Button, Input } from "@injishi/ui";
import { useEffect, useMemo, useState } from "react";
import { useWorkspaceHref } from "../lib/workspace-href";
import { buildFolio } from "../lib/folio";
import { dateRange, dateRangeIso, fmt } from "../lib/format";
import { useWorkspaceId } from "../data/capability";
import { useBrokerDirectory } from "../data/broker-ops";
import { useStays } from "../data/ops";
import { useReservations } from "../data/reservations";
import { navFor } from "../lib/nav";
import { navContextOf } from "../lib/nav-context";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";
import { Icon } from "./icon";

interface CommandItem {
  group: string;
  label: string;
  sub?: string;
  icon: string;
  href: string;
}

export function CommandBar() {
  const pms = usePms();
  // Every jump the palette offers is addressed inside the workspace in view.
  const workspaceId = useWorkspaceId();
  // The search index reads every workspace's data directly, so this component
  // keeps the wide destructure the other two no longer need.
  const { state, host } = pms;
  const { cmdkOpen, setCmdkOpen } = usePmsUi();
  const router = useRouter();
  // Every jump stays inside the workspace in the address bar (ADR-018).
  const href = useWorkspaceHref();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  // Live reads for the palette's host groups, asked for only while it is open:
  // this component is mounted on every screen, and the desk's two lists are not
  // worth fetching behind a palette nobody opened. Both share the screens'
  // cache, so opening it on Reservations costs nothing.
  const live = workspaceId !== null;
  const askLive = cmdkOpen && live && state.ws === "host" ? workspaceId : null;
  const liveReservations = useReservations(askLive);
  const liveStays = useStays(askLive);
  // The broker's directory, from the same cache the Directory screen reads.
  const liveDirectory = useBrokerDirectory(
    cmdkOpen && live && state.ws === "broker" ? workspaceId : null,
  );

  // ⌘K / Ctrl-K toggles; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen(!cmdkOpen);
        setQ("");
        setIdx(0);
      } else if (e.key === "Escape") {
        setCmdkOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmdkOpen, setCmdkOpen]);

  const index = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];
    const sections = navFor(navContextOf(pms, workspaceId));
    sections.forEach((sec) =>
      sec.items.forEach((it) => items.push({ group: "Go to", label: it.label, icon: it.icon, href: it.href })),
    );

    if (state.ws === "host" && live) {
      /*
       * THE SAME ADDRESSES THE SCREENS USE (ADR-044, D-a, D-c).
       *
       * This group read the demo store and sent a fixture's RESERVATION id to
       * `/stays/<id>/folio`, which matches on a STAY id, so every pick was a
       * 404 on a live workspace. A reservation now opens its own record, and a
       * bill opens on the stay it hangs off, both from the reads the desk uses.
       */
      (liveReservations.data?.reservations ?? [])
        .filter((r) => r.state === "pending" || r.state === "confirmed" || r.state === "inhouse")
        .forEach((r) =>
          items.push({
            group: "Reservations",
            label: r.guestName ?? r.guestEmail ?? "Guest",
            sub: (r.room ? `Room ${r.room} · ` : "") + dateRangeIso(r.checkIn, r.checkOut),
            icon: "book-marked",
            href: href(`/reservations/${r.id}`),
          }),
        );
      (liveStays.data?.stays ?? [])
        .filter((s) => s.lifecycle === "open")
        .forEach((s) =>
          items.push({
            group: "Bills",
            label: `Bill — ${s.guestName ?? "Unnamed guest"}`,
            sub: s.roomLabel ? `Room ${s.roomLabel}` : undefined,
            icon: "receipt",
            href: href(`/stays/${s.id}/folio`),
          }),
        );
    } else if (state.ws === "host" && host) {
      // No workspace to ask: the demo store stands in, and its records are the
      // demo reservation pages. The fixture has no stays, so its bill is the
      // reservation's Payment lens rather than a stay that does not exist.
      host.res
        .filter((r) => r.status !== "declined" && r.status !== "out")
        .forEach((r) =>
          items.push({
            group: "Reservations",
            label: r.guest,
            sub: (r.room ? `Room ${r.room} · ` : "") + dateRange(r.start, r.nights),
            icon: "book-marked",
            href: href(`/reservations/${r.id}`),
          }),
        );
      host.rooms.forEach((rm) =>
        items.push({ group: "Rooms", label: `Room ${rm.id}`, sub: rm.type, icon: "bed-double", href: href("/calendar") }),
      );
      host.res
        .filter((r) => r.status === "inhouse")
        .forEach((r) =>
          items.push({
            group: "Bills",
            label: `Bill — ${r.guest}`,
            sub: `${fmt(buildFolio(r, host).bal)} due`,
            icon: "receipt",
            href: href(`/reservations/${r.id}/payment`),
          }),
        );
    } else if (state.ws === "landlord") {
      state.db.residence.leases
        .filter((l) => l.st !== "ended")
        .forEach((l) =>
          items.push({
            group: "Tenancies",
            label: l.tenant,
            sub: `${l.unit} · ${fmt(l.rent)} / mo`,
            icon: "file-text",
            href: l.st === "active" ? href("/rent-roll") : href("/leases"),
          }),
        );
    } else if (state.ws === "broker") {
      (liveDirectory.data?.listings ?? []).forEach((listing) =>
        listing.units.forEach((unit) =>
          items.push({
            group: "Directory",
            label: `${unit.name} · ${listing.propertyName}`,
            sub: `${unit.monthlyRentRwf === null ? "Rent not set" : `${fmt(unit.monthlyRentRwf)} / mo`} · ${listing.district ?? listing.landlordName}`,
            icon: "building-2",
            href: href("/directory"),
          }),
        ),
      );
    }

    return items;
  }, [
    state.ws,
    state.role,
    state.db.residence,
    host,
    liveDirectory.data,
    href,
    pms,
    workspaceId,
    live,
    liveReservations.data,
    liveStays.data,
  ]);

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    const matched = query
      ? index.filter((i) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(query))
      : index
          .filter((i) => i.group === "Go to")
          .slice(0, 6)
          .concat(index.filter((i) => i.group === "Reservations" || i.group === "Tenancies").slice(0, 3));
    return matched.slice(0, 12);
  }, [q, index]);

  if (!cmdkOpen) return null;

  const go = (item: CommandItem) => {
    setCmdkOpen(false);
    router.push(item.href);
  };

  const clamped = Math.max(0, Math.min(idx, hits.length - 1));

  // Group the flat hit list for rendering.
  const groups: { label: string; items: { item: CommandItem; n: number }[] }[] = [];
  hits.forEach((item, n) => {
    let g = groups.find((x) => x.label === item.group);
    if (!g) {
      g = { label: item.group, items: [] };
      groups.push(g);
    }
    g.items.push({ item, n });
  });

  return (
    <>
      <div onClick={() => setCmdkOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "var(--scrim)" }} />
      <div
        className="pms-pop"
        style={{
          position: "fixed",
          left: "50%",
          top: "13vh",
          transform: "translateX(-50%)",
          zIndex: 71,
          width: 580,
          maxWidth: "92vw",
          background: "var(--panel)",
          border: "1px solid var(--card-bd)",
          borderRadius: 14,
          boxShadow: "0 40px 90px -30px rgba(4,35,48,.6)",
          overflow: "hidden",
          color: "var(--foreground)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <Icon name="search" size={16} color="var(--faint)" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(i + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter" && hits[clamped]) {
                go(hits[clamped]);
              }
            }}
            placeholder="Jump to a reservation, room, guest, or bill…"
            style={{ flex: 1, border: "none", outline: "none", background: "none", color: "var(--foreground)", fontSize: 15 }}
          />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--faint)", border: "1px solid var(--line2)", borderRadius: 6, padding: "2px 6px" }}>
            esc
          </span>
        </div>

        <div style={{ maxHeight: 380, overflowY: "auto", padding: 8 }}>
          {hits.length === 0 && (
            <div style={{ padding: "22px 16px", fontSize: 13.5, color: "var(--muted)" }}>
              No matches. Try a guest name, a room number, or a reservation code.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.label}>
              <div style={{ padding: "8px 10px 3px", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--faint)" }}>
                {g.label}
              </div>
              {g.items.map(({ item, n }) => (
                <Button variant="ghost"
                  key={n}
                  onClick={() => go(item)}
                  onMouseEnter={() => setIdx(n)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 11,
                    border: "none",
                    borderRadius: 9,
                    padding: "9px 10px",
                    background: n === clamped ? "var(--hover)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Icon name={item.icon} size={15} color="var(--muted)" />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.label}
                  </span>
                  {item.sub && (
                    <span className="pms-num" style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {item.sub}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
