"use client";

/**
 * The housekeeper's phone (F-P04) — a focused PWA surface, not a responsive
 * breakpoint of the desk. A room attendant sees three things: the cleaning
 * queue, room status, and a way to report a fault with a photo (blueprint §3.3).
 *
 * Checkout-to-clean is the loop this will close: the desk checks a guest out, a
 * task appears here, and marking a room Ready flips it back on the desk's Room
 * grid.
 *
 * **IT IS A PREVIEW, AND IT NOW SAYS SO.** Every control on this surface writes
 * to the demo store in this browser tab and to nothing else: there is no
 * `useSetHousekeeping` here, no ticket command, no upload. It used to present
 * itself as a live handset — a "Synced" pill, a status bar reading 10:24, and
 * toasts promising "the front desk sees it live" and "sent to Maintenance". A
 * room attendant who believes that stops telling anybody about the broken
 * shower. So the chrome that claimed a connection is gone and every message
 * says what actually happened, which is nothing outside this screen.
 *
 * The fix is not more copy: it is the mutations the desktop Cleaning board
 * already has. Until this surface calls them, honesty is the only thing on
 * offer.
 */

import { Button, Input } from "@injishi/ui";
import { useState } from "react";
import { useHost, usePms } from "../store";
import type { HkStatus } from "../data/types";
import { useSignOut } from "../data/sign-out";
import { Badge, SelectField } from "./ui";
import { Icon } from "./icon";

const HK: Record<HkStatus, { label: string; intent: "ok" | "warn" | "info" | "neutral"; dot: string }> = {
  ready: { label: "Ready", intent: "ok", dot: "var(--ok)" },
  needs: { label: "Needs cleaning", intent: "warn", dot: "var(--warn)" },
  cleaning: { label: "Being cleaned", intent: "info", dot: "var(--info)" },
  inspected: { label: "Inspected", intent: "neutral", dot: "var(--faint)" },
};

type Tab = "tasks" | "rooms" | "report";
type Sheet = { kind: "room"; room: string } | { kind: "report"; room?: string } | null;

const FAULTS = ["Plumbing", "Electrical", "Furniture", "Other"];

export function HousekeeperPhone() {
  const { dispatch, toast, me } = usePms();
  const { signOut, signingOut } = useSignOut();
  const P = useHost();
  const [tab, setTab] = useState<Tab>("tasks");
  const [filter, setFilter] = useState<HkStatus | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [rep, setRep] = useState({ room: "", fault: "", note: "" });

  const hasMaintenance = P.departments.includes("Maintenance");

  const tasksAll = P.tasks.map((t) => {
    const rm = P.rooms.find((x) => x.id === t.room);
    return { ...t, hk: rm?.hk, type: rm?.type };
  });
  const active = tasksAll.filter((t) => t.hk === "needs" || t.hk === "cleaning");
  const done = tasksAll.filter((t) => t.hk === "ready" || t.hk === "inspected");

  const chips = (["ready", "needs", "cleaning", "inspected"] as HkStatus[]).map((hk) => ({
    hk,
    n: P.rooms.filter((r) => r.hk === hk).length,
  }));

  const sheetRoom = sheet?.kind === "room" ? P.rooms.find((r) => r.id === sheet.room) : null;

  const markReady = (room: string) => {
    dispatch({ type: "setHk", room, hk: "ready" });
    toast(`Room ${room} is Ready on this preview. The front desk won't see it yet.`, "neutral");
  };

  const sendReport = () => {
    if (!rep.room || !rep.fault) {
      toast("Pick the room and what is wrong first.", "warn");
      return;
    }
    const dest = hasMaintenance ? "Maintenance" : "the manager";
    // It sent nothing, and it says so. A fault an attendant believes is
    // reported is a fault nobody fixes.
    toast(
      `This preview can't send reports yet — nothing reached ${dest}. Tell them about Room ${rep.room} directly.`,
      "warn",
    );
    setRep({ room: "", fault: "", note: "" });
    setSheet(null);
    setTab("tasks");
  };

  return (
    /* The frame is `.pms-phone` in pms-tokens.css so it can drop away below
       640px — on a real phone the simulated bezel is 49px of overflow. */
    <div className="pms-phone-stage">
      <div className="pms-phone">
        {/* The simulated status bar is gone with its clock. It read 10:24 at
            every hour of every day, which is the kind of small lie that makes a
            person distrust the times that ARE real. */}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px 12px" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 16.5, fontWeight: 700 }}>{P.name}</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{me.name.split(" ")[0]} · Housekeeping</span>
          </span>
          {/* Was a green "Synced" pill, which was never true: nothing on this
              surface has ever reached the server. It says what it is. */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, background: "var(--hover)", color: "var(--muted)", padding: "5px 11px", fontSize: 11.5, fontWeight: 600 }}>
            Preview
          </span>
          {/*
            The housekeeper's ONLY way out (F-S01).

            `AppShell` short-circuits a housekeeper to this surface and never
            renders the sidebar, so the sign out that lives there is unreachable
            for exactly the people most likely to be on a shared handset. A
            control that exists on every surface but one is missing from the
            surface that needs it most.
          */}
          <Button
            variant="ghost"
            onClick={signOut}
            /* `pending` rather than `disabled`: a dead-looking button with a
               wait cursor is how somebody walks away from a shared handset
               believing they signed out. */
            pending={signingOut}
            aria-label={signingOut ? "Signing out" : "Sign out"}
            title={signingOut ? "Signing out…" : "Sign out"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "none",
              borderRadius: 999,
              padding: 7,
              color: "var(--muted)",
              cursor: signingOut ? "wait" : "pointer",
            }}
          >
            <Icon name="log-out" size={17} />
          </Button>
        </div>

        {/* Status filter rail (rooms tab) */}
        {tab === "rooms" && (
          <div className="pms-noscroll" style={{ display: "flex", gap: 8, padding: "0 20px 12px", overflowX: "auto" }}>
            {chips.map((c) => {
              const on = filter === c.hk;
              return (
                <Button variant="ghost"
                  key={c.hk}
                  onClick={() => setFilter(on ? null : c.hk)}
                  style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    border: `1px solid ${on ? "var(--accent-text)" : "var(--card-bd)"}`,
                    background: on ? "var(--accent-soft)" : "var(--card)",
                    color: on ? "var(--accent-text)" : "var(--ink2)",
                    borderRadius: 999,
                    padding: "8px 13px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: 36,
                  }}
                >
                  <span className="pms-num" style={{ fontSize: 14, fontWeight: 700 }}>
                    {c.n}
                  </span>
                  {HK[c.hk].label}
                </Button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 16px 96px", display: "flex", flexDirection: "column", gap: 10 }}>
          {tab === "tasks" && (
            <>
              {active.length === 0 && (
                <div style={{ border: "1px dashed var(--line2)", borderRadius: "var(--radius-surface)", padding: "28px 20px", textAlign: "center", marginTop: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>All caught up</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>
                    No rooms waiting. New checkouts appear here the moment the desk taps Check out.
                  </div>
                </div>
              )}
              {active.map((t) => (
                <div key={t.room} style={{ background: "var(--card)", border: "1px solid var(--card-bd)", borderRadius: "var(--radius-surface)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 17, fontWeight: 700 }}>Room {t.room}</span>
                      <span style={{ display: "block", marginTop: 1, fontSize: 12, color: "var(--muted)" }}>
                        {t.kind} · {t.ts}
                      </span>
                    </span>
                    <Badge intent={HK[t.hk!].intent}>{HK[t.hk!].label}</Badge>
                  </div>
                  <Button variant="ghost"
                    onClick={() => (t.hk === "needs" ? dispatch({ type: "setHk", room: t.room, hk: "cleaning" }) : markReady(t.room))}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      minHeight: 46,
                      border: "none",
                      borderRadius: "var(--radius-surface)",
                      background: t.hk === "needs" ? "var(--accent)" : "var(--foreground)",
                      color: t.hk === "needs" ? "var(--accent-ink)" : "var(--background)",
                      fontSize: 14.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t.hk === "needs" ? "Start cleaning" : "Mark ready"}
                  </Button>
                </div>
              ))}
              {done.length > 0 && (
                <>
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted2)" }}>
                    Done today
                  </div>
                  {done.map((t) => (
                    <div key={t.room} style={{ background: "var(--card)", border: "1px solid var(--card-bd)", borderRadius: "var(--radius-surface)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, opacity: 0.75 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>Room {t.room}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>{t.kind}</span>
                      </span>
                      <Badge intent={HK[t.hk!].intent}>{HK[t.hk!].label}</Badge>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {tab === "rooms" &&
            P.rooms
              .filter((r) => !filter || r.hk === filter)
              .map((r) => (
                <Button variant="ghost"
                  key={r.id}
                  onClick={() => setSheet({ kind: "room", room: r.id })}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--card-bd)", borderRadius: "var(--radius-surface)", padding: "13px 16px", minHeight: 52, cursor: "pointer", textAlign: "left", width: "100%" }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: HK[r.hk].dot }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Room {r.id}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>{r.type}</span>
                  </span>
                  <Badge intent={HK[r.hk].intent}>{HK[r.hk].label}</Badge>
                </Button>
              ))}
        </div>

        {/* Bottom nav */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", background: "var(--panel)", borderTop: "1px solid var(--line2)", padding: "8px 10px 14px", gap: 6 }}>
          {[
            { key: "tasks" as const, icon: "sparkles", label: "Cleaning tasks" },
            { key: "rooms" as const, icon: "bed-double", label: "Room status" },
            { key: "report" as const, icon: "flag", label: "Report issue" },
          ].map((b) => (
            <Button variant="ghost"
              key={b.key}
              onClick={() => {
                if (b.key === "report") {
                  setSheet({ kind: "report" });
                  setRep({ room: "", fault: "", note: "" });
                } else {
                  setTab(b.key);
                  setSheet(null);
                }
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                border: "none",
                background: "none",
                borderRadius: 12,
                padding: "7px 0",
                minHeight: 48,
                cursor: "pointer",
                color: tab === b.key && b.key !== "report" ? "var(--accent-text)" : "var(--sb-fg)",
              }}
            >
              <Icon name={b.icon} size={20} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>{b.label}</span>
            </Button>
          ))}
        </div>

        {/* Bottom sheet */}
        {sheet && (
          <>
            <div onClick={() => setSheet(null)} style={{ position: "absolute", inset: 0, background: "var(--scrim)" }} />
            <div className="pms-sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--panel)", borderTop: "1px solid var(--line2)", borderRadius: "24px 24px 0 0", padding: "10px 20px 24px" }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: "var(--line2)", margin: "0 auto 14px" }} />

              {sheet.kind === "room" && sheetRoom && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontSize: 18, fontWeight: 700 }}>Room {sheetRoom.id}</span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)" }}>{sheetRoom.type}</span>
                    </span>
                    <Badge intent={HK[sheetRoom.hk].intent}>{HK[sheetRoom.hk].label}</Badge>
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {(["needs", "cleaning", "ready", "inspected"] as HkStatus[]).map((k) => {
                      const on = sheetRoom.hk === k;
                      return (
                        <Button variant="ghost"
                          key={k}
                          onClick={() => {
                            dispatch({ type: "setHk", room: sheetRoom.id, hk: k });
                            if (k === "ready") markReady(sheetRoom.id);
                            setSheet(null);
                          }}
                          style={{
                            minHeight: 46,
                            border: `1.5px solid ${on ? "var(--accent-text)" : "var(--line2)"}`,
                            background: on ? "var(--accent-soft)" : "var(--field)",
                            color: on ? "var(--accent-text)" : "var(--foreground)",
                            borderRadius: "var(--radius-surface)",
                            fontSize: 13.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {HK[k].label}
                        </Button>
                      );
                    })}
                  </div>
                  <Button variant="ghost"
                    onClick={() => {
                      setSheet({ kind: "report", room: sheetRoom.id });
                      setRep({ room: sheetRoom.id, fault: "", note: "" });
                    }}
                    style={{ marginTop: 10, width: "100%", minHeight: 46, border: "1px solid var(--card-bd)", background: "var(--card)", color: "var(--foreground)", borderRadius: "var(--radius-surface)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    Report an issue in this room
                  </Button>
                </>
              )}

              {sheet.kind === "report" && (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Report an issue</div>
                  <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--muted)" }}>
                    {`This is a preview of the form. Nothing is sent to ${hasMaintenance ? "the Maintenance board" : "the manager"} yet — tell them directly.`}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted2)" }}>Room</div>
                  <div style={{ marginTop: 6 }}>
                    <SelectField
                      value={rep.room}
                      onChange={(room) => setRep({ ...rep, room })}
                      label="Room"
                      placeholder="Choose a room"
                      options={P.rooms.map((r) => ({
                        value: r.id,
                        label: `Room ${r.id} · ${r.type}`,
                      }))}
                    />
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted2)" }}>What is wrong</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {FAULTS.map((f) => {
                      const on = rep.fault === f;
                      return (
                        <Button variant="ghost"
                          key={f}
                          onClick={() => setRep({ ...rep, fault: f })}
                          style={{ minHeight: 40, border: `1.5px solid ${on ? "var(--accent-text)" : "var(--line2)"}`, background: on ? "var(--accent-soft)" : "var(--field)", color: on ? "var(--accent-text)" : "var(--foreground)", borderRadius: 999, padding: "0 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          {f}
                        </Button>
                      );
                    })}
                  </div>
                  <Input
                    value={rep.note}
                    onChange={(e) => setRep({ ...rep, note: e.target.value })}
                    placeholder="One line about the fault (optional)"
                    style={{ marginTop: 12, width: "100%", minHeight: 44, border: "1px solid var(--line2)", background: "var(--field)", color: "var(--foreground)", borderRadius: "var(--radius-surface)", padding: "0 12px", fontSize: 14 }}
                  />
                  <div style={{ marginTop: 12, border: "1.5px dashed var(--line2)", borderRadius: "var(--radius-surface)", minHeight: 88, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, color: "var(--faint)" }}>
                    <Icon name="camera" size={22} strokeWidth={1.6} />
                    {/* Not a control: there is no upload behind it. It says
                        what the finished form will do rather than inviting a
                        tap that does nothing. */}
                    <span style={{ fontSize: 12 }}>A photo will lead the ticket. Not in this preview.</span>
                  </div>
                  <Button variant="ghost"
                    onClick={sendReport}
                    style={{ marginTop: 14, width: "100%", minHeight: 48, border: "none", background: "var(--accent)", color: "var(--accent-ink)", borderRadius: "var(--radius-surface)", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "var(--shadow-cta)" }}
                  >
                    {hasMaintenance ? "Send to Maintenance" : "Send to the manager"}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
