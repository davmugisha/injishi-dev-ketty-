"use client";

import {
  ArrowsExpand,
  Bars,
  Bell,
  CircleCheck,
  Gear,
  Hourglass,
  TriangleExclamation,
  Volume,
  VolumeXmark,
  Xmark,
} from "@gravity-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PosOutlet, PosTicket, TicketStatus } from "@/server/pos";
import { advanceTicketAction, reprintTicketAction } from "./actions";
import {
  byPriority,
  DEFAULT_LIMITS,
  filterCounts,
  inStation,
  isConnected,
  itemsToMake,
  type KdsLimits,
  type KdsStation,
  type KdsTheme,
  loadLimits,
  loadSound,
  loadTheme,
  matchesFilter,
  newQueuedIds,
  ORDER_FILTERS,
  ORDER_TYPE_LABEL,
  type OrderFilter,
  recentlyDone,
  STATION_NAME,
  saveLimits,
  saveSound,
  saveTheme,
  shortOrderNumber,
  stationCounts,
  urgencyOf,
  waitSeconds,
} from "./kds";
import { EmptyColumn, StationMark, TicketCard, TimingForm } from "./kds-parts";
import { posNavLinks } from "./pos-nav";

const COLUMNS: { status: "queued" | "preparing" | "ready"; label: string; icon: typeof Bell }[] = [
  { status: "queued", label: "NEW ORDERS", icon: Bell },
  { status: "preparing", label: "PREPARING", icon: Hourglass },
  { status: "ready", label: "READY FOR COLLECTION", icon: CircleCheck },
];

/** Ticks once a second so every clock on the board is live between the server refreshes. Null until the page has mounted. */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** A short two-note chime from the browser's own audio: no file to load, nothing to install. */
function useChime() {
  const ctx = useRef<AudioContext | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const context = useCallback((): AudioContext | null => {
    if (!ctx.current) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx.current = new Ctor();
      ctx.current.onstatechange = () => setUnlocked(ctx.current?.state === "running");
    }
    return ctx.current;
  }, []);

  // Browsers keep sound off until the person has touched the page once: any first touch or key press switches it on.
  useEffect(() => {
    const unlock = () => {
      const c = context();
      if (c && c.state !== "running") void c.resume().catch(() => undefined);
      if (c?.state === "running") setUnlocked(true);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [context]);

  const play = useCallback(() => {
    const c = context();
    if (!c) return;
    const t0 = c.currentTime;
    for (const [freq, delay] of [
      [880, 0],
      [1175, 0.2],
    ] as const) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.32);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.34);
    }
  }, [context]);

  return { play, unlocked };
}

type Panel = "settings" | "menu" | null;

/**
 * The kitchen and the bar display (POS spec §6): two separate screens of one design, each with its own colours, that
 * show their own stations' open tickets in three areas, most urgent first, each with a live clock that turns amber and
 * then red. A cook starts and readies a ticket; the waiter collects it from the pass. The workflow, permissions and
 * audit trail are the existing ones: this screen only draws them. A reprint is a simulated copy and never a second ticket.
 */
export function PosStationsView({
  outlet,
  initialStation,
  tickets,
  can,
}: {
  outlet: PosOutlet;
  initialStation: KdsStation;
  tickets: PosTicket[];
  can: string[];
}) {
  const router = useRouter();
  const cook = can.includes("kitchen.work");
  const pass = can.includes("pos.sell") || cook;

  const [list, setList] = useState(tickets);
  const [lastRead, setLastRead] = useState<number | null>(null);
  useEffect(() => {
    setList(tickets);
    setLastRead(Date.now());
  }, [tickets]);

  const now = useNow();
  const nowMs = now ?? 0;
  const [station, setStation] = useState<KdsStation>(initialStation);
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [limits, setLimits] = useState<KdsLimits>(DEFAULT_LIMITS);
  const [soundOn, setSoundOn] = useState(true);
  const [theme, setTheme] = useState<KdsTheme>("light");
  const [panel, setPanel] = useState<Panel>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [online, setOnline] = useState(true);
  const [narrowColumn, setNarrowColumn] = useState<TicketStatus>("queued");
  const [flash, setFlash] = useState<ReadonlySet<string>>(new Set());
  const [toasts, setToasts] = useState<{ id: number; text: string; error: boolean }[]>([]);
  const { play, unlocked } = useChime();

  const say = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur.slice(-2), { id, text, error }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 3200);
  }, []);

  // What this screen remembers: its limits and whether it makes a sound (per outlet, per device).
  useEffect(() => {
    setLimits(loadLimits(window.localStorage, outlet.id));
    setSoundOn(loadSound(window.localStorage, outlet.id));
  }, [outlet.id]);
  useEffect(() => setTheme(loadTheme(window.localStorage)), []);

  // Stay in step with the waiter and the till: the board re-reads the server every 5 seconds while it is on screen.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const t = setInterval(refresh, 5_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // A chime and a highlight for every new queued ticket of THIS display. The first look announces nothing.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const fresh = newQueuedIds(seen.current, list).filter((id) => {
      const t = list.find((x) => x.id === id);
      return t ? inStation(t, station) : false;
    });
    seen.current = new Set(list.map((t) => t.id));
    if (fresh.length === 0) return;
    if (soundOn) play();
    setFlash((cur) => new Set([...cur, ...fresh]));
    const t = setTimeout(() => setFlash((cur) => new Set([...cur].filter((id) => !fresh.includes(id)))), 6000);
    return () => clearTimeout(t);
  }, [list, station, soundOn, play]);

  // Full screen: the browser's own full screen where it exists (the layout already fills the window).
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const toggleFullscreen = () => {
    setPanel(null);
    if (fullscreen) {
      setFullscreen(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } else {
      setFullscreen(true);
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  };

  const chooseStation = (next: KdsStation) => {
    setStation(next);
    setPanel(null);
    // The address follows, so a refresh or a shared link opens the same display (no navigation, no reload).
    const url = new URL(window.location.href);
    url.searchParams.set("kind", next);
    window.history.replaceState(null, "", url);
  };

  const inflight = useRef(new Set<string>());
  const [busy, setBusy] = useState<string[]>([]);
  const guard = async (id: string, work: () => Promise<void>) => {
    if (inflight.current.has(id)) return; // one press at a time per ticket: no duplicate moves
    inflight.current.add(id);
    setBusy([...inflight.current]);
    try {
      await work();
    } finally {
      inflight.current.delete(id);
      setBusy([...inflight.current]);
    }
  };
  const advance = (t: PosTicket, to: TicketStatus, message: string) =>
    guard(t.id, async () => {
      const r = await advanceTicketAction(t.id, to);
      if (!r.ok) {
        say(r.error, true);
        router.refresh();
        return;
      }
      setList((cur) => cur.map((x) => (x.id === r.value.id ? r.value : x)));
      say(message);
      router.refresh();
    });
  const reprint = (t: PosTicket) =>
    guard(t.id, async () => {
      const r = await reprintTicketAction(t.id);
      if (!r.ok) {
        say(r.error, true);
        return;
      }
      say(`Simulated reprint · copy ${r.value.printCount}`);
    });

  const open = useMemo(
    () => list.filter((t) => t.status === "queued" || t.status === "preparing" || t.status === "ready"),
    [list],
  );
  const perStation = stationCounts(open);
  const mine = useMemo(() => open.filter((t) => inStation(t, station)), [open, station]);
  const counts = filterCounts(mine);
  const shown = useMemo(() => mine.filter((t) => matchesFilter(t, filter)), [mine, filter]);
  const byStatus = (s: "queued" | "preparing" | "ready") => shown.filter((t) => t.status === s);
  const overdue = shown.filter((t) => urgencyOf(t.status, waitSeconds(t, nowMs), limits) === "late").length;
  const activeOrders = new Set(mine.map((t) => t.orderId)).size;
  const toMake = itemsToMake(mine);
  const noun = station === "kitchen" ? "food" : "drink";
  const done = recentlyDone(list, station);
  const connected = isConnected(online, lastRead, nowMs);
  const links = posNavLinks("PosStations", outlet.id, can);

  const stats: { k: string; label: string; n: number; icon: typeof Bell; hot?: boolean }[] = [
    { k: "new", label: "NEW ORDERS", n: byStatus("queued").length, icon: Bell },
    { k: "preparing", label: "PREPARING", n: byStatus("preparing").length, icon: Hourglass },
    { k: "ready", label: "READY", n: byStatus("ready").length, icon: CircleCheck },
    { k: "overdue", label: "OVERDUE", n: overdue, icon: TriangleExclamation, hot: overdue > 0 },
  ];

  return (
    <div className="kds" data-station={station} data-fullscreen={fullscreen} data-theme={theme}>
      <header className="kds-top">
        <div className="kds-brand">
          <span className="kds-mark">
            <StationMark station={station} size={26} />
          </span>
          <span className="kds-word">
            <b>
              INJISHI <span>{station === "kitchen" ? "KITCHEN" : "BAR"}</span>
            </b>
            <small>
              {outlet.name}
              {outlet.branchName ? ` · ${outlet.branchName}` : ""}
            </small>
          </span>
        </div>

        <fieldset className="kds-seg" aria-label="Display">
          {(["kitchen", "bar"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={station === s} onClick={() => chooseStation(s)}>
              <StationMark station={s} size={18} />
              {STATION_NAME[s]}
              <span className="kds-seg-n">{perStation[s]}</span>
            </button>
          ))}
        </fieldset>

        <div className="kds-meta">
          <span className="kds-pill" data-state={connected ? "live" : "reconnecting"} data-field="live">
            <i className="kds-dot" />
            <strong>{connected ? "Live" : "Reconnecting"}</strong>
          </span>
          <span className="kds-pill" data-field="active">
            <strong>{activeOrders}</strong> active {noun} {activeOrders === 1 ? "order" : "orders"}
            {toMake ? (
              <>
                {" "}
                · <strong>{toMake}</strong> {toMake === 1 ? "item" : "items"} to make
              </>
            ) : null}
          </span>
          <span className="kds-clock">
            <time dateTime={now ? new Date(now).toISOString() : undefined} data-field="clock">
              {now
                ? new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Africa/Kigali",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }).format(now)
                : ""}
            </time>
            <small>
              {now
                ? new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Africa/Kigali",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }).format(now)
                : ""}
            </small>
          </span>
          <button
            type="button"
            className="kds-icon"
            aria-label={soundOn ? "Sound on" : "Sound off"}
            aria-pressed={soundOn}
            title={soundOn ? "New-order sound is on" : "New-order sound is off"}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              saveSound(window.localStorage, outlet.id, next);
              if (next) play();
            }}
          >
            {soundOn ? <Volume width={20} height={20} /> : <VolumeXmark width={20} height={20} />}
          </button>
          <button
            type="button"
            className="kds-icon"
            aria-label="Settings"
            aria-expanded={panel === "settings"}
            onClick={() => setPanel(panel === "settings" ? null : "settings")}
          >
            <Gear width={20} height={20} />
          </button>
          <button
            type="button"
            className="kds-icon"
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            aria-pressed={fullscreen}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Xmark width={20} height={20} /> : <ArrowsExpand width={20} height={20} />}
          </button>
          {!fullscreen && links.length ? (
            <button
              type="button"
              className="kds-icon"
              aria-label="POS menu"
              aria-expanded={panel === "menu"}
              onClick={() => setPanel(panel === "menu" ? null : "menu")}
            >
              <Bars width={20} height={20} />
            </button>
          ) : null}
        </div>
      </header>

      {soundOn && !unlocked ? (
        <p className="kds-hint">Touch the screen once to switch the new-order sound on.</p>
      ) : null}

      <div className="kds-sub">
        <div className="kds-stats">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.k} className="kds-stat" data-k={s.k} data-hot={s.hot ? "true" : undefined}>
                <span className="ic">
                  <Icon width={22} height={22} />
                </span>
                <div>
                  <div className="num" data-stat={s.k}>
                    {s.n}
                  </div>
                  <div className="lab">{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
        <fieldset className="kds-filter" aria-label="Show">
          {ORDER_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className="kds-filter-n">{counts[f.id]}</span>
            </button>
          ))}
        </fieldset>
      </div>

      <div className="kds-tabs">
        {COLUMNS.map((col) => (
          <button
            key={col.status}
            type="button"
            aria-pressed={narrowColumn === col.status}
            onClick={() => setNarrowColumn(col.status)}
          >
            {col.label} {byStatus(col.status).length}
          </button>
        ))}
      </div>

      <main className="kds-board">
        {COLUMNS.map((col) => {
          const column = byStatus(col.status).sort(byPriority(limits, nowMs));
          const Icon = col.icon;
          return (
            <section
              key={col.status}
              className="kds-col"
              aria-label={col.label}
              data-column={col.status}
              data-hidden={narrowColumn !== col.status}
            >
              <div className="kds-col-head">
                <span className="ic">
                  <Icon width={18} height={18} />
                </span>
                <h2>{col.label}</h2>
                <span className="kds-col-n" data-count={col.status}>
                  {column.length}
                </span>
              </div>
              <div className="kds-col-body">
                {column.length === 0 ? <EmptyColumn status={col.status} /> : null}
                {column.map((t, index) => (
                  <TicketCard
                    key={t.id}
                    t={t}
                    nowMs={nowMs}
                    limits={limits}
                    fresh={flash.has(t.id)}
                    upNext={col.status === "queued" && index === 0}
                    cook={cook}
                    pass={pass}
                    busy={busy.includes(t.id)}
                    onAdvance={advance}
                    onReprint={reprint}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {done.length ? (
        <footer className="kds-recent">
          <span>Recently done</span>
          {done.map((t) => (
            <span key={t.id} className="chip" data-off={t.status === "cancelled"}>
              #{shortOrderNumber(t.orderNumber)} · {t.tableLabel ?? ORDER_TYPE_LABEL[t.orderType]} ·{" "}
              {t.status === "served" ? "collected" : t.status}
            </span>
          ))}
        </footer>
      ) : null}

      {panel ? <button type="button" aria-label="Close" className="kds-scrim" onClick={() => setPanel(null)} /> : null}

      {panel === "settings" ? (
        <section className="kds-pop" aria-label="Settings">
          <div className="group">
            <h3>SOUND</h3>
            <button
              type="button"
              className="kds-switch"
              aria-pressed={soundOn}
              onClick={() => {
                const next = !soundOn;
                setSoundOn(next);
                saveSound(window.localStorage, outlet.id, next);
                if (next) play();
              }}
            >
              New-order chime
              <span className="track" />
            </button>
          </div>
          <div className="group">
            <h3>SCREEN</h3>
            <button
              type="button"
              className="kds-switch"
              aria-pressed={theme === "dark"}
              onClick={() => {
                const next: KdsTheme = theme === "dark" ? "light" : "dark";
                setTheme(next);
                saveTheme(window.localStorage, next);
              }}
            >
              Dark screen, for a dim kitchen
              <span className="track" />
            </button>
          </div>
          <div className="group">
            <h3>TIMING</h3>
            <TimingForm
              limits={limits}
              onSave={(next) => {
                setLimits(next);
                saveLimits(window.localStorage, outlet.id, next);
                say("Timing saved on this screen.");
                setPanel(null);
              }}
            />
          </div>
          <div className="group">
            <h3>COLOUR KEY</h3>
            <ul className="kds-key" aria-label="Colour key">
              <li>
                <i style={{ background: "var(--new)" }} /> New orders
              </li>
              <li>
                <i style={{ background: "var(--prep)" }} /> Preparing
              </li>
              <li>
                <i style={{ background: "var(--ok)" }} /> Ready for collection
              </li>
              <li>
                <i style={{ background: "var(--ok)" }} /> On time
              </li>
              <li>
                <i style={{ background: "var(--warn)" }} /> From {limits.warnMinutes} min
              </li>
              <li>
                <i style={{ background: "var(--late)" }} /> Overdue from {limits.lateMinutes} min
              </li>
            </ul>
          </div>
        </section>
      ) : null}

      {panel === "menu" ? (
        <nav className="kds-pop" aria-label="Point of sale">
          <h3>POINT OF SALE</h3>
          <div className="kds-menu">
            {links.map((l) => (
              <Link key={l.board} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      <div className="kds-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="kds-toast" data-error={t.error}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
