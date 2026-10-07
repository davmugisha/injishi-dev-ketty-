"use client";

/**
 * The PMS top bar: the page title and the line that says where you are, the
 * command bar, the assistant, Messages, the theme, and the desk's two actions.
 *
 * WALK-IN AND NEW RESERVATION LIVE HERE, side by side (the Navigation board:
 * "New walk-in (sidebar) → Walk-in (top bar), beside New reservation, where the
 * desk looks for actions"). Each is offered on the permission its command
 * declares, never a role: Walk-in on `stay.checkin` (`POST /ops/stays/walk-in`),
 * New reservation on `reservation.approve`, the power that accepts a booking
 * for the property. An action the grant cannot take is absent, not disabled.
 */

import Link from "next/link";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@injishi/ui";
import { EmptyState } from "@injishi/ui/empty-state";
import { CalendarPlus, Plus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useCapability } from "../data/capability";
import { ds, TIMEZONE } from "../lib/format";
import { useWorkspaceHref } from "../lib/workspace-href";
import { currentGrant, workspaceName } from "../store/helpers";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";
import { useBranchInView } from "./branch-scope";
import { AssistantLauncher } from "./assistant/assistant-panel";
import { Icon } from "./icon";

/**
 * New reservation, honestly.
 *
 * The board draws a booking form here, and there is no route behind it: the API
 * takes a booking only from the guest who makes it (`POST /bookings`, the
 * guest's own session), and nothing lets the desk make one on a guest's behalf.
 * A form that collected a name and dates and then could not keep them would be
 * worse than none. So the action is where the desk looks for it, and it says
 * what exists today and where to go instead.
 */
function NewReservationDialog({
  open,
  onOpenChange,
  canWalkIn,
  onWalkIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWalkIn: boolean;
  onWalkIn: () => void;
}) {
  const wsHref = useWorkspaceHref();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New reservation</DialogTitle>
          <DialogDescription className="sr-only">Taking a booking from the desk is not available yet.</DialogDescription>
        </DialogHeader>
        <EmptyState size="sm">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <CalendarPlus aria-hidden className="size-5" />
            </EmptyState.Media>
            <EmptyState.Title>Not available yet</EmptyState.Title>
            <EmptyState.Description className="text-pretty">
              Booking a room for a guest from the desk is not built yet. Guests book on the hotel’s
              page on the marketplace, and every request lands on Reservations for you to approve.
              A guest standing at the counter is a walk-in.
            </EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
        <DialogFooter>
          <Button variant="outline" asChild>
            <Link href={wsHref("/reservations")} onClick={() => onOpenChange(false)}>
              Open Reservations
            </Link>
          </Button>
          {canWalkIn ? (
            <Button variant="primary" onClick={onWalkIn}>
              <UserPlus aria-hidden className="size-4" />
              Start a walk-in
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Topbar({ title }: { title: string }) {
  const { state, dispatch } = usePms();
  const { setCmdkOpen, navOpen, setNavOpen, record, openCheckIn } = usePmsUi();
  const { can } = useCapability();
  // Inside the workspace in view, never by kind (ADR-018, AC-1).
  const wsHref = useWorkspaceHref();
  const [reserving, setReserving] = useState(false);

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

  const year = new Date().getFullYear();

  /*
   * THE PROPERTY NAME COMES FROM THE SERVER (ADR-035, D-f wave 2 follow-up),
   * from the GRANT, which everyone who can open the workspace holds, never from
   * a listing read a receptionist would be refused, and never from the demo
   * fixture this line used to fall back to.
   *
   * With several branches it names the one in view (ADR-054 AC-S1): the chosen
   * branch, or All branches. The head office's name over every branch's rows
   * would say the wrong place.
   */
  const { branchId, branches } = useBranchInView();
  const inView = branches.find((b) => b.id === branchId)?.name;
  const served =
    inView ?? (branches.length > 1 ? "All branches" : (currentGrant(state)?.propertyName ?? null));
  const place =
    state.ws === "broker"
      ? null
      : (served ?? (state.grants && state.grants.length > 0 ? "No property yet" : null));
  // The workspace, first, on every screen (ADR-018, AC-14). The address no
  // longer says which business you are in — `/w/<id>/dashboard` is an id, not a
  // name — so this line is the only place that says, and an operator holding
  // two hotels needs it to know which one they are about to charge.
  const subtitle = [workspace, `${ds(0)} ${year}`, place, TIMEZONE].filter(Boolean).join(" · ");
  const dark = state.theme === "dark";

  // The desk's two actions, hotel only, each on its command's own permission.
  const isHost = state.ws === "host";
  const canWalkIn = isHost && can("stay.checkin");
  const canReserve = isHost && can("reservation.approve");

  return (
    /* Layout is `.pms-topbar` in pms-tokens.css so the breakpoints can reach
       it: below 640px the actions drop to their own line, and an inline
       `display: flex` here would pin them to the first one. */
    <header className="pms-topbar">
      {/* The drawer handle. `.pms-burger` hides it above 1024px, where the
          sidebar is always up and there is nothing to open. */}
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
          flex row it always was; a real box below it, carrying the actions
          onto their own line rather than crushing the title to nothing. */}
      <div className="pms-topbar-actions">

      <Button variant="ghost"
        onClick={() => setCmdkOpen(true)}
        aria-label="Search — jump to a reservation, room or folio"
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
          Jump to reservation, room, folio…
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

      {/* The support assistant (ADR-061). In the bar, not floating: a floating
          button sat under the demo guide and over table rows. */}
      <AssistantLauncher />

      {/* THE BELL OPENS MESSAGES, AND CARRIES NO COUNT (ADR-044, D-a): one
          inbox per app, and the bell is not a second destination. It is
          offered only to a grant that can open Messages (`message.send`), so
          it is never a door the route guard then refuses. The count stays off
          until a feed answers for it; a fixture supplied number is not a
          count. */}
      {can("message.send") ? (
        <Button asChild variant="outline" size="icon" shape="rounded" className="shrink-0">
          <Link href={wsHref("/inbox")} aria-label="Messages">
            <Icon name="bell" size={18} />
          </Link>
        </Button>
      ) : null}

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

      {canWalkIn ? (
        <Button variant="secondary" className="shrink-0" onClick={() => openCheckIn(null)} aria-label="Walk-in">
          <UserPlus aria-hidden className="size-4" />
          <span>Walk-in</span>
        </Button>
      ) : null}
      {canReserve ? (
        <Button variant="primary" className="shrink-0" onClick={() => setReserving(true)} aria-label="New reservation">
          <Plus aria-hidden className="size-4" />
          <span className="hidden sm:inline">New reservation</span>
        </Button>
      ) : null}
      </div>

      {canReserve ? (
        <NewReservationDialog
          open={reserving}
          onOpenChange={setReserving}
          canWalkIn={canWalkIn}
          onWalkIn={() => {
            setReserving(false);
            openCheckIn(null);
          }}
        />
      ) : null}
    </header>
  );
}
