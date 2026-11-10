"use client";

import { Bell, Check, CircleCheck, Clock, Hourglass, Persons, Printer, TriangleExclamation } from "@gravity-ui/icons";
import { type ReactNode, useState } from "react";
import type { PosTicket, TicketStatus } from "@/server/pos";
import "./kds.css";
import {
  DEFAULT_LIMITS,
  formatWait,
  type KdsLimits,
  type KdsStation,
  limitsError,
  mentionsAllergy,
  ORDER_TYPE_LABEL,
  shortOrderNumber,
  splitOption,
  urgencyOf,
  waitSeconds,
} from "./kds";
import { clock } from "./shared";

/** A fork and knife for the kitchen, a cocktail glass for the bar: two marks, one drawing style. */
export function StationMark({ station, size = 24 }: { station: KdsStation; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {station === "kitchen" ? (
        <>
          <path d="M6 3v6a2 2 0 0 0 2 2v10" />
          <path d="M4 3v5" />
          <path d="M8 3v5" />
          <path d="M18 21V3c-2.4 1.1-3.6 3.8-3.6 7.2 0 2.2 1.1 3.3 3.6 3.3" />
        </>
      ) : (
        <>
          <path d="M4 4h16l-8 9z" />
          <path d="M12 13v7" />
          <path d="M8 20h8" />
          <path d="M16.5 4.5 19 2" />
        </>
      )}
    </svg>
  );
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  queued: "NEW ORDER",
  preparing: "PREPARING",
  ready: "READY FOR COLLECTION",
  served: "COLLECTED",
  cancelled: "CANCELLED",
};

const URGENCY_TAG = { warning: "ALMOST LATE", late: "OVERDUE" } as const;

/** One order, readable in a second: the number, the table, the clock, then exactly what to make and what to press. */
export function TicketCard({
  t,
  nowMs,
  limits,
  fresh,
  upNext,
  cook,
  pass,
  busy,
  onAdvance,
  onReprint,
}: {
  t: PosTicket;
  nowMs: number;
  limits: KdsLimits;
  fresh: boolean;
  upNext: boolean;
  cook: boolean;
  pass: boolean;
  busy: boolean;
  onAdvance: (t: PosTicket, to: TicketStatus, message: string) => void;
  onReprint: (t: PosTicket) => void;
}) {
  const seconds = waitSeconds(t, nowMs);
  const urgency = urgencyOf(t.status, seconds, limits);
  const number = shortOrderNumber(t.orderNumber);
  const where = t.tableLabel ?? ORDER_TYPE_LABEL[t.orderType];
  const timed = nowMs !== 0;
  const tag = urgency === "normal" ? null : URGENCY_TAG[urgency];

  return (
    <article
      className="kds-card"
      aria-label={`Order ${number}, ${where}, ${t.status}${tag ? `, ${tag.toLowerCase()}` : ""}`}
      data-ticket={t.id}
      data-status={t.status}
      data-urgency={urgency}
      data-order={number}
      data-fresh={fresh}
    >
      <div className="kds-head">
        <span className="kds-status">
          <i />
          {STATUS_LABEL[t.status]}
        </span>
        <div className="kds-order" data-field="order-number">
          #{number}
        </div>
        <div className="kds-timer">
          <b data-field="timer" data-seconds={timed ? seconds : undefined}>
            <Clock width={22} height={22} />
            {timed ? formatWait(seconds) : "–:––"}
          </b>
          <small>{t.status === "ready" ? "waiting at the pass" : "since sent"}</small>
        </div>
        <div className="kds-where">
          <span className="kds-table" data-kind={t.tableLabel ? "in" : "out"}>
            {t.tableLabel ? <small>TABLE</small> : null}
            <b data-field="where">{where}</b>
          </span>
          {t.tableLabel ? (
            <span className="kds-tag" data-field="order-type">
              {ORDER_TYPE_LABEL[t.orderType]}
            </span>
          ) : null}
          <span className="kds-tag">{t.stationName}</span>
          {upNext ? (
            <span className="kds-tag" data-tone="next">
              UP NEXT
            </span>
          ) : null}
          {tag ? (
            <span className="kds-tag" data-tone={urgency}>
              {tag}
            </span>
          ) : null}
        </div>
      </div>

      <div className="kds-info">
        {t.guestNote ? (
          <span className="guest" data-field="guest">
            Guest: {t.guestNote}
          </span>
        ) : null}
        {t.guestCount ? (
          <span className="party" data-field="party">
            <Persons width={14} height={14} />
            {t.guestCount}
          </span>
        ) : null}
        <span>{t.waiterName ?? "—"}</span>
        <span>sent {clock(t.createdAt)}</span>
        <span>
          {t.ticketNumber} · {t.orderNumber}
        </span>
      </div>

      <ul className="kds-items">
        {t.items.map((i) => (
          <li key={i.id} className="kds-item" data-item={i.name} data-voided={i.status === "cancelled"}>
            <span className="kds-qty" data-field="qty">
              {i.quantity}×
            </span>
            <div className="kds-what">
              <span className="kds-name">{i.name}</span>
              {i.options.length ? (
                <span className="kds-mods" data-field="modifiers">
                  {i.options.map((o) => {
                    const { label, value } = splitOption(o);
                    return (
                      <span key={o} className="kds-mod">
                        {label ? <small>{label}</small> : null}
                        {value}
                      </span>
                    );
                  })}
                </span>
              ) : null}
              {i.note ? (
                <div className="kds-note" data-field="note" data-allergy={mentionsAllergy(i.note)}>
                  <TriangleExclamation width={18} height={18} />
                  <div>
                    <small className="kds-note-label">
                      {mentionsAllergy(i.note) ? "ALLERGY" : "SPECIAL INSTRUCTION"}
                    </small>
                    <span className="kds-note-text">{i.note}</span>
                  </div>
                </div>
              ) : null}
              {i.status === "cancelled" ? <span className="kds-void">VOIDED · DO NOT MAKE</span> : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="kds-actions">
        {t.status === "queued" && cook ? (
          <div className="row">
            <button
              type="button"
              className="kds-btn"
              data-v="primary"
              disabled={busy}
              onClick={() => onAdvance(t, "preparing", `#${number} started`)}
            >
              START
            </button>
            <button
              type="button"
              className="kds-btn"
              disabled={busy}
              onClick={() => onAdvance(t, "ready", `#${number} ready for collection`)}
            >
              READY
            </button>
          </div>
        ) : null}
        {t.status === "preparing" && cook ? (
          <button
            type="button"
            className="kds-btn"
            data-v="primary"
            disabled={busy}
            onClick={() => onAdvance(t, "ready", `#${number} ready for collection`)}
          >
            <Check width={20} height={20} />
            MARK READY
          </button>
        ) : null}
        {t.status === "ready" && pass ? (
          <button
            type="button"
            className="kds-btn"
            data-v="ok"
            disabled={busy}
            onClick={() => onAdvance(t, "served", `#${number} collected by the waiter`)}
          >
            <CircleCheck width={20} height={20} />
            COLLECTED BY WAITER
          </button>
        ) : null}
        {!cook && !pass ? <span className="kds-view-only">View only</span> : null}
        <button type="button" className="kds-link" disabled={busy} onClick={() => onReprint(t)}>
          <Printer width={16} height={16} />
          Reprint
        </button>
      </div>
    </article>
  );
}

const EMPTY: Record<"queued" | "preparing" | "ready", { icon: ReactNode; title: string; hint: string }> = {
  queued: {
    icon: <Bell width={26} height={26} />,
    title: "No new orders",
    hint: "New orders arrive here with a chime.",
  },
  preparing: {
    icon: <Hourglass width={26} height={26} />,
    title: "Nothing in preparation",
    hint: "Press START on a new order to begin.",
  },
  ready: {
    icon: <CircleCheck width={26} height={26} />,
    title: "Nothing waiting",
    hint: "Finished orders wait here until the waiter collects them.",
  },
};

export function EmptyColumn({ status }: { status: "queued" | "preparing" | "ready" }) {
  const e = EMPTY[status];
  return (
    <div className="kds-empty">
      <div className="ring">{e.icon}</div>
      <b className="kds-empty-title">{e.title}</b>
      <span className="kds-empty-hint">{e.hint}</span>
    </div>
  );
}

/** The two limits of this screen. Kept on this device, per outlet. */
export function TimingForm({ limits, onSave }: { limits: KdsLimits; onSave: (next: KdsLimits) => void }) {
  const [warn, setWarn] = useState(String(limits.warnMinutes));
  const [late, setLate] = useState(String(limits.lateMinutes));
  const error = limitsError(Number(warn), Number(late));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!error) onSave({ warnMinutes: Number(warn), lateMinutes: Number(late) });
      }}
    >
      <div className="fields">
        <label>
          Turns orange after (minutes)
          <input inputMode="numeric" value={warn} onChange={(e) => setWarn(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label>
          Overdue (red) after (minutes)
          <input inputMode="numeric" value={late} onChange={(e) => setLate(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      {error ? (
        <p className="hint" role="alert">
          {error}
        </p>
      ) : (
        <p className="hint">Saved on this screen only.</p>
      )}
      <div className="btns">
        <button type="submit" className="kds-btn" data-v="primary" disabled={error !== null}>
          Save timing
        </button>
        <button
          type="button"
          className="kds-btn"
          onClick={() => {
            setWarn(String(DEFAULT_LIMITS.warnMinutes));
            setLate(String(DEFAULT_LIMITS.lateMinutes));
          }}
        >
          Use the standard {DEFAULT_LIMITS.warnMinutes} / {DEFAULT_LIMITS.lateMinutes}
        </button>
      </div>
    </form>
  );
}

/** What the board looks like while it loads: the same three areas, with cards that are still being drawn. */
export function KdsSkeleton({ station = "kitchen" }: { station?: KdsStation }) {
  return (
    <div className="kds" data-station={station} data-fullscreen="false" aria-busy="true">
      <div className="kds-top">
        <div className="kds-brand">
          <span className="kds-mark">
            <StationMark station={station} size={26} />
          </span>
          <span className="kds-word">
            <b>
              INJISHI <span>{station === "kitchen" ? "KITCHEN" : "BAR"}</span>
            </b>
            <small>Loading…</small>
          </span>
        </div>
      </div>
      <div className="kds-sub">
        <div className="kds-stats">
          {["a", "b", "c", "d"].map((k) => (
            <div key={k} className="kds-skel" style={{ height: 66 }}>
              <i style={{ width: "100%", height: "100%" }} />
            </div>
          ))}
        </div>
      </div>
      <div className="kds-board">
        {["a", "b", "c"].map((col) => (
          <div key={col} className="kds-col">
            <div className="kds-col-head">
              <i style={{ width: 120, height: 14, borderRadius: 8, display: "block", background: "var(--line)" }} />
            </div>
            <div className="kds-col-body">
              {[0, 1].slice(0, col === "c" ? 1 : 2).map((n) => (
                <div key={n} className="kds-skel" style={{ height: 230 }}>
                  <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <i style={{ width: "42%", height: 38 }} />
                    <i style={{ width: "28%", height: 22 }} />
                    <i style={{ width: "80%", height: 26, marginTop: 12 }} />
                    <i style={{ width: "100%", height: 52, marginTop: 10 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
