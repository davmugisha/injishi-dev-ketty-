"use client";

/**
 * The PMS topbar: page title + Kigali subtitle, the command-bar trigger,
 * notifications, and the theme toggle.
 *
 * The title is a Spectral serif; the subtitle carries the date, property, and
 * timezone in tabular numerics.
 */

import Link from "next/link";
import { Button } from "@injishi/ui";
import { useEffect } from "react";
import { workspaces } from "../data/demo";
import { ds, TIMEZONE } from "../lib/format";
import { useWorkspaceHref } from "../lib/workspace-href";
import { currentGrant, workspaceName } from "../store/helpers";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";
import { useBranchInView } from "./branch-scope";
import { AssistantLauncher } from "./assistant/assistant-panel";
import { Icon } from "./icon";

export function Topbar({ title }: { title: string }) {
  const { state, dispatch, host } = usePms();
  const { setCmdkOpen, navOpen, setNavOpen, record } = usePmsUi();
  // Inside the workspace in view, never by kind (ADR-018, AC-1).
  const wsHref = useWorkspaceHref();

  // A record names itself (ADR-044, D-e 3). The route only knows it is "a
  // stay"; the record's name comes up from `ObjectPage` once its data is in.
  const heading = record?.name ?? title;
  const workspace = workspaceName(state);

  /*
   * The browser tab: `{page} · {workspace} | Injishi` (ADR-044, D-e 1).
   *
   * It read "Injishi PMS" on every screen, so four open tabs were four copies
   * of one word and a folio shared in a handover arrived with no name. Set here
   * rather than by route `metadata` because the workspace name and the record's
   * name are both client reads; the root layout's title stands until they land.
   */
  useEffect(() => {
    const page = record ? (record.lens ? `${record.lens} · ${record.name}` : record.name) : title;
    document.title = workspace ? `${page} · ${workspace} | Injishi` : `${page} | Injishi`;
  }, [record, title, workspace]);

  const ws = workspaces.find((w) => w.key === state.ws) ?? workspaces[0];
  const year = new Date().getFullYear();

  /*
   * THE PROPERTY NAME COMES FROM THE SERVER (ADR-035, D-f wave 2 follow-up).
   *
   * Both branches used to read the demo store — `state.db.residence.name` for a
   * landlord and `hostProperty(state)` for a hotelier — so this line named a
   * fixture building while every screen under it showed the real one. A header
   * that says which business you are about to charge is the one place a wrong
   * name is worst.
   *
   * It comes from the GRANT, not from `/inventory/properties`. That controller
   * is gated on `listing.manage`, so reading it here meant a receptionist took
   * a 403 on every page load for a name — identity is not a listing operation.
   * `WorkspaceAccess.propertyName` carries it beside the role and the
   * permissions, so everyone who can open the workspace can read what it is
   * called.
   */
  //
  // With several branches it names the one in view (ADR-054 AC-S1): the chosen
  // branch, or All branches. The head office's name over every branch's rows
  // would say the wrong place.
  const { branchId, branches } = useBranchInView();
  const inView = branches.find((b) => b.id === branchId)?.name;
  const served =
    inView ?? (branches.length > 1 ? "All branches" : (currentGrant(state)?.propertyName ?? null));

  // What "where you are" means changes by workspace: a property for an
  // operator, the person themselves otherwise. The fixture stands in only while
  // the read is in flight, so the app still runs standalone.
  const place =
    state.ws === "landlord"
      ? (served ?? (state.grants && state.grants.length > 0 ? "No property yet" : state.db.residence.name))
      : state.ws === "host"
        ? (served ?? (state.grants && state.grants.length > 0 ? "No property yet" : (host?.name ?? ws.name)))
        : ws.role;
  // The workspace, first, on every screen (ADR-018, AC-14). The address no
  // longer says which business you are in — `/w/<id>/today` is an id, not a
  // name — so this line is the only place that says, and an operator holding
  // two hotels needs it to know which one they are about to charge.
  const subtitle = `${workspace} · ${ds(0)} ${year} · ${place} · ${TIMEZONE}`;
  const dark = state.theme === "dark";
  // The Production/Demo pill that sat here is gone (ADR-043, AC-22). It flipped
  // a client side fixture set and started on "demo" in every build; which
  // platform this is now comes from the API alone.

  return (
    /* Layout is `.pms-topbar` in pms-tokens.css so the breakpoints can reach
       it: below 640px the actions drop to their own line, and an inline
       `display: flex` here would pin them to the first one. */
    <header className="pms-topbar">
      {/* The drawer handle. `.pms-burger` hides it above 1024px, where the
          sidebar is always up and there is nothing to open. */}
      {/* The three icon buttons on this bar are the shared `Button` at
          `size="icon"` with nothing inline (ADR-037 call 4). The 38px box,
          the card fill and the `--radius-surface` corner they used to draw by
          hand were a fourth icon button beside the three the product has. */}
      <Button
        variant="outline"
        size="icon"
        shape="rounded"
        id="pms-nav-toggle"
        className="pms-burger shrink-0"
        onClick={() => setNavOpen(!navOpen)}
        aria-label={navOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={navOpen}
      >
        <Icon name={navOpen ? "x" : "menu"} size={18} />
      </Button>

      <div className="pms-topbar-title">
        <h1
          className="pms-display"
          style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--foreground)" }}
        >
          {heading}
        </h1>
        <span className="pms-num pms-topbar-sub" style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {subtitle}
        </span>
      </div>

      {/* `display: contents` above 640px, so the desktop topbar is the same flat
          flex row it always was; a real box below it, carrying the four actions
          onto their own line rather than crushing the title to nothing. */}
      <div className="pms-topbar-actions">

      <Button variant="ghost"
        onClick={() => setCmdkOpen(true)}
        aria-label="Search — jump to a reservation, room or bill"
        className="pms-cmd"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          flex: "0 0 auto",
          border: "1px solid var(--card-bd)",
          background: "var(--card)",
          borderRadius: 999,
          padding: "8px 14px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Icon name="search" size={16} color="var(--faint)" />
        <span
          className="pms-cmd-label"
          style={{
            fontSize: 13,
            color: "var(--faint)",
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Jump to reservation, room, bill…
        </span>
        <span
          className="pms-cmd-kbd"
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "var(--faint)",
            border: "1px solid var(--line2)",
            borderRadius: 6,
            padding: "2px 6px",
          }}
        >
          ⌘K
        </span>
      </Button>

      {/* THE BELL OPENS THE INBOX, AND CARRIES NO COUNT (ADR-044, D-a).

          Two separate defects sat on this one control. The badge said "2" on
          every screen of every workspace for every operator, and the label read
          "Notifications — 2 unread": a number nothing produced, over a list that
          does not exist. And the button had no handler at all, so the one thing
          in the chrome shaped like "something is waiting for you" did nothing
          when pressed.

          It goes to the inbox rather than growing a notification feed of its
          own, because ADR-018 AC-11 already settled that: one inbox per app,
          and the bell is not a second destination. The count stays off until a
          feed answers for it — `nav-context.ts` holds the same line for every
          sidebar pill, that a fixture supplied number is not a count. */}
      {/* The support assistant (ADR-061). In the bar, not floating: a floating
          button sat under the demo guide and over table rows. */}
      <AssistantLauncher />

      <Button asChild variant="outline" size="icon" shape="rounded" className="shrink-0">
        <Link href={wsHref("/inbox")} aria-label="Inbox">
          <Icon name="bell" size={18} />
        </Link>
      </Button>

      <Button
        variant="outline"
        size="icon"
        shape="rounded"
        className="shrink-0"
        onClick={() => dispatch({ type: "setTheme", theme: dark ? "light" : "dark" })}
        aria-label="Toggle dark mode"
      >
        <Icon name={dark ? "sun" : "moon"} size={18} />
      </Button>
      </div>
    </header>
  );
}
