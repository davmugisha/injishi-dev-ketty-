"use client";

import type { AdminTrainingSession, AdminTrainingVenue } from "@injishi/contracts";
import {
  Button,
  Input,
  Label,
  NativeDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  cancelSession,
  editSession,
  rescheduleSession,
} from "@/lib/actions/training";
import { useAdminUi } from "@/lib/store";

import { formatKigali, kigaliLocalValue } from "../../kigali-time";
import { OutcomeNotice, type Notice } from "../../outcome-notice";

/**
 * Edit, reschedule and cancel one session (ADR-049).
 *
 * THREE FORMS, NOT ONE, because they are three different messages to other
 * people. Editing the venue, fee or seats tells nobody. Rescheduling a
 * PUBLISHED session mails every registrant the new time and the reason typed
 * here (AC-21), so it asks for that reason and cannot be sent without one.
 * Cancelling mails everybody too and is final.
 *
 * A DRAFT'S TIMES are edited with its details, since a draft has no registrants
 * to tell; the reschedule form appears only once a session is published.
 *
 * Times are typed and shown in Kigali time (`kigali-time.ts`).
 *
 * THE WINDOW IS NOT CHECKED IN THE BROWSER. An end before the start goes to the
 * API, which refuses it in its own words; that sentence is what the staffer
 * reads, from one definition of the rule rather than two.
 */
export function SessionManageForm({
  session,
  venues,
}: {
  session: AdminTrainingSession;
  /** Venues still in use. A retired venue is never offered (AC-32). */
  venues: AdminTrainingVenue[];
}) {
  const router = useRouter();
  const toast = useAdminUi((state) => state.toast);
  const [notice, setNotice] = useState<Notice | null>(null);

  function report(message: string, tone: Notice["tone"], ok: boolean) {
    setNotice({ message, tone });
    toast(message, tone);
    if (ok) router.refresh();
  }

  const isDraft = session.status === "draft";

  return (
    <div className="mt-6">
      <OutcomeNotice notice={notice} />
      <DetailsForm session={session} venues={venues} isDraft={isDraft} onDone={report} />
      {isDraft ? null : <RescheduleForm session={session} onDone={report} />}
      <CancelForm session={session} onDone={report} />
    </div>
  );
}

type Done = (message: string, tone: Notice["tone"], ok: boolean) => void;

function DetailsForm({
  session,
  venues,
  isDraft,
  onDone,
}: {
  session: AdminTrainingSession;
  venues: AdminTrainingVenue[];
  isDraft: boolean;
  onDone: Done;
}) {
  const currentIsActive = venues.some((venue) => venue.id === session.venue.id);
  const [venueId, setVenueId] = useState(currentIsActive ? session.venue.id : "");
  const [feeRwf, setFeeRwf] = useState(String(session.feeRwf));
  const [seatCount, setSeatCount] = useState(String(session.seatCount));
  const [startsAt, setStartsAt] = useState(kigaliLocalValue(session.startsAt));
  const [endsAt, setEndsAt] = useState(kigaliLocalValue(session.endsAt));
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const out = await editSession(session.id, {
        venueId,
        feeRwf: Number(feeRwf),
        seatCount: Number(seatCount),
        ...(isDraft ? { startsAt, endsAt } : {}),
      });
      onDone(out.message, out.tone, out.ok);
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Session details"
      className="mt-4 rounded-card border border-border bg-field p-5"
    >
      <p className="text-sm font-semibold">Details</p>
      <p className="mt-1 max-w-read text-sm text-muted-foreground">
        Changing these mails nobody.
        {isDraft ? " It is a draft, so its time is edited here too." : " To move the time, reschedule below."}
      </p>

      {currentIsActive ? null : (
        <p className="mt-3 max-w-read text-sm">
          {session.venue.name} has been retired, so this session can&apos;t be
          published there. Pick a venue still in use.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="session-venue">Venue</Label>
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger id="session-venue" aria-label="Venue">
              <SelectValue placeholder="Pick a venue" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name} · {venue.districtName}
                  {venue.isOffice ? " · Injishi office" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isDraft ? (
          <>
            <div>
              <Label htmlFor="session-starts">Starts (Kigali time)</Label>
              <Input
                id="session-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="session-ends">Ends (Kigali time)</Label>
              <Input
                id="session-ends"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            </div>
          </>
        ) : null}
        <div>
          <Label htmlFor="session-fee">Fee in RWF</Label>
          <Input
            id="session-fee"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={feeRwf}
            onChange={(event) => setFeeRwf(event.target.value)}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Shown on the public page. Nothing collects it yet.
          </p>
        </div>
        <div>
          <Label htmlFor="session-seats">Seats</Label>
          <Input
            id="session-seats"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={seatCount}
            onChange={(event) => setSeatCount(event.target.value)}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Advisory: registering past it still succeeds.
          </p>
        </div>
      </div>

      <Button type="submit" size="sm" className="mt-4" pending={pending} disabled={venueId === ""}>
        {pending ? "Saving…" : "Save the details"}
      </Button>
    </form>
  );
}

function RescheduleForm({
  session,
  onDone,
}: {
  session: AdminTrainingSession;
  onDone: Done;
}) {
  const [startsAt, setStartsAt] = useState(kigaliLocalValue(session.startsAt));
  const [endsAt, setEndsAt] = useState(kigaliLocalValue(session.endsAt));
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  // Nothing to send until the time differs: a "reschedule" to the time it
  // already has would succeed, move nothing, and still read as news.
  const unchanged =
    startsAt === kigaliLocalValue(session.startsAt) &&
    endsAt === kigaliLocalValue(session.endsAt);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const out = await rescheduleSession(session.id, {
        startsAt,
        endsAt,
        reason,
        previousStartsAt: session.startsAt,
      });
      onDone(out.message, out.tone, out.ok);
      if (out.ok) setReason("");
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Reschedule"
      className="mt-4 rounded-card border border-border bg-field p-5"
    >
      <p className="text-sm font-semibold">Reschedule</p>
      <p className="mt-1 max-w-read text-sm text-muted-foreground">
        Every registrant is mailed the new time and the reason below, and their
        reminder moves with it. It currently starts {formatKigali(session.startsAt)}.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="reschedule-starts">New start (Kigali time)</Label>
          <Input
            id="reschedule-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="reschedule-ends">New end (Kigali time)</Label>
          <Input
            id="reschedule-ends"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="reschedule-reason">Reason, mailed to every registrant</Label>
          <Textarea
            id="reschedule-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            required
            minLength={3}
            maxLength={500}
            placeholder="The hall is being renovated that week"
          />
        </div>
      </div>

      <Button
        type="submit"
        size="sm"
        className="mt-4"
        pending={pending}
        disabled={unchanged || reason.trim().length < 3}
      >
        {pending ? "Rescheduling…" : "Reschedule and tell registrants"}
      </Button>
    </form>
  );
}

function CancelForm({
  session,
  onDone,
}: {
  session: AdminTrainingSession;
  onDone: Done;
}) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const out = await cancelSession(session.id, reason);
      setConfirming(false);
      onDone(out.message, out.tone, out.ok);
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setConfirming(true);
      }}
      aria-label="Cancel the session"
      className="mt-4 rounded-card border border-border bg-field p-5"
    >
      <p className="text-sm font-semibold">Cancel the session</p>
      <p className="mt-1 max-w-read text-sm text-muted-foreground">
        Final. Everybody registered is mailed the reason. People already marked
        present stay attended and keep their certificates; everyone undecided is
        released.
      </p>
      <div className="mt-4">
        <Label htmlFor="cancel-reason">Reason, mailed to every registrant</Label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          required
          minLength={3}
          maxLength={500}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        variant="danger"
        className="mt-4"
        disabled={reason.trim().length < 3}
      >
        Cancel the session…
      </Button>

      <NativeDialog
        open={confirming}
        dismissible={!pending}
        onClose={() => {
          if (!pending) setConfirming(false);
        }}
        ariaLabel="Confirm cancelling the session"
      >
        <div className="p-7">
          <h2 className="font-display text-2xl font-bold">
            Cancel {session.course.title}?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {session.registrationCount.toLocaleString("en-RW")} registered
            {session.registrationCount === 1 ? " person is" : " people are"} mailed
            this reason: &ldquo;{reason.trim()}&rdquo;. It can&apos;t be undone.
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="danger"
              className="grow"
              pending={pending}
              onClick={cancel}
            >
              {pending ? "Waiting for the platform…" : "Cancel the session"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="grow"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Keep it
            </Button>
          </div>
        </div>
      </NativeDialog>
    </form>
  );
}
