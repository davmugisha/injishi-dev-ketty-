"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@injishi/web-ui";
import {
  TRAINING_CREDENTIAL_WORDING,
  type TrainingMeResponse,
  type TrainingMyCertificate,
  type TrainingMyRegistration,
} from "@injishi/contracts";
import {
  fetchCertificatePdfUrl,
  fetchMyTraining,
  withdrawRegistration,
} from "@/data/training-api";
import { apiResultMessage, type ApiResult } from "@/lib/api";
import { formatSessionDate, formatSessionWhen } from "@/lib/training-format";

/**
 * My training: the sessions I registered for, and the certificates I hold.
 *
 * WHAT REPLACED WHAT. This screen used to render a certificate from
 * `localStorage` and an SVG built in the browser, for a course completed in the
 * browser. It now reads `GET /api/v1/training/me`, and the certificate it shows
 * exists on a server, has a serial, and can be checked by a stranger.
 *
 * A CLIENT ISLAND BECAUSE IT NEEDS THE COOKIE. `apiFetch` sends
 * `credentials: "include"`, which only attaches the session cookie in a
 * browser: the API is on :8000 and the web app on :3000, so a server render
 * here would be an anonymous call. The route is gated at the edge as well
 * (AC-19), so an anonymous visitor never reaches this component.
 *
 * THE PDF LINK IS MINTED ON CLICK, not on render. A signed url expires inside
 * 900 seconds, so one minted while the page loaded would often be dead by the
 * time somebody finished reading and reached for it.
 *
 * IT SAYS "ATTENDED" AND NOTHING STRONGER (AC-31). The wording comes from
 * `TRAINING_CREDENTIAL_WORDING` in the contracts rather than being typed here,
 * so the PDF, this page and the public verification page cannot drift into
 * three different claims about what the credential means.
 *
 * A WITHDRAWAL RELOADS THE LIST, it does not patch it (AC-29). The seat count,
 * the status and whether the button still belongs on the row are all the
 * server's to say, and a row edited in place would disagree with the server the
 * first time a refusal carried news (a session that started while the dialog was
 * open). The reload is quiet: the list stays on screen while it runs, so the row
 * that asked keeps its own message. `router.refresh()` drops the client's cached
 * copy of the routes, so `/training` shows the freed seat when visited next.
 */
export function MyTraining() {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; data: TrainingMeResponse }
    | { kind: "failed"; message: string }
  >({ kind: "loading" });

  const load = useCallback(async (isCancelled: () => boolean) => {
    const result = await fetchMyTraining();
    if (isCancelled()) return;

    if (result.status === "ok") {
      setState({ kind: "ready", data: result.data });
      return;
    }
    // A failed QUIET reload keeps the list already on screen. Swapping a list
    // the person was just acting on for "we could not load" would hide the row
    // whose message says what happened.
    setState((previous) =>
      previous.kind === "ready"
        ? previous
        : {
            kind: "failed",
            message:
              result.status === "unauthenticated"
                ? "Your sign in has expired. Reload the page and sign in again."
                : "We could not load your training just now. Try again in a moment.",
          },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(async () => {
    await load(() => false);
    router.refresh();
  }, [load, router]);

  if (state.kind === "loading") {
    return <p className="text-muted-foreground">Loading your training…</p>;
  }

  if (state.kind === "failed") {
    return (
      <div className="max-w-form rounded-card border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  const certificates = state.data.certificates.items;
  const registrations = state.data.registrations.items;

  return (
    <div className="grid gap-12">
      <section>
        <h2 className="text-xl font-semibold text-foreground">
          My certificates
        </h2>

        {certificates.length === 0 ? (
          <p className="mt-3 max-w-read text-muted-foreground">
            You do not hold one yet. A certificate is issued when a trainer
            marks you present at a session, and never before, so there is
            nothing here until you have attended one.
          </p>
        ) : (
          <ul className="mt-6 grid gap-5">
            {certificates.map((certificate) => (
              <CertificateCard
                key={certificate.id}
                certificate={certificate}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground">
          Sessions I registered for
        </h2>

        {registrations.length === 0 ? (
          <div className="mt-3">
            <p className="max-w-read text-muted-foreground">
              You have not registered for a session yet.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/training#dates">See the dates</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4">
            {registrations.map((registration) => (
              <RegistrationRow
                key={registration.id}
                registration={registration}
                onChanged={reload}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CertificateCard({
  certificate,
}: {
  certificate: TrainingMyCertificate;
}) {
  const [pdf, setPdf] = useState<
    { kind: "idle" } | { kind: "working" } | { kind: "failed" }
  >({ kind: "idle" });

  const withdrawn = certificate.revokedAt !== null;

  async function openPdf() {
    setPdf({ kind: "working" });
    const result = await fetchCertificatePdfUrl(certificate.id);
    if (result.status !== "ok") {
      setPdf({ kind: "failed" });
      return;
    }
    setPdf({ kind: "idle" });
    window.open(result.data, "_blank", "noopener,noreferrer");
  }

  return (
    <li className="rounded-card border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground">
            {certificate.courseTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Version {certificate.courseVersion} ·{" "}
            <span className="font-mono">{certificate.serial}</span>
          </p>
        </div>
        {withdrawn ? (
          <Badge variant="danger">Withdrawn</Badge>
        ) : (
          <Badge variant="success">Valid</Badge>
        )}
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Fact label="Attended on">
          {formatSessionDate(certificate.sessionDate)}
        </Fact>
        <Fact label="Venue">
          {certificate.venueName}, {certificate.districtName}
        </Fact>
        <Fact label="Led by">{certificate.leadTrainerName}</Fact>
        <Fact label="Issued">
          {formatSessionDate(certificate.issuedAt)}
        </Fact>
      </dl>

      {withdrawn ? (
        <div className="mt-5 rounded border border-border bg-surface-secondary p-4">
          <p className="text-sm text-foreground">
            {TRAINING_CREDENTIAL_WORDING.revokedClaim}
          </p>
          {certificate.revocationReason ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Reason given: {certificate.revocationReason}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-5 text-sm text-muted-foreground">
        This records that you {TRAINING_CREDENTIAL_WORDING.pdfClaim}. No test
        was taken.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {certificate.hasPdf ? (
          <Button
            onClick={openPdf}
            disabled={pdf.kind === "working"}
            variant="outline"
          >
            {pdf.kind === "working" ? "Opening…" : "Open the PDF"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            The file is still being prepared. The record above is complete, so
            ask us and we can send it.
          </p>
        )}
        <Button asChild variant="ghost">
          {/*
            The same public page a stranger sees. Offered to the holder on
            purpose: the useful thing about this credential is what somebody
            ELSE sees when they scan it, and the holder should be able to look.
          */}
          <a href={certificate.verifyUrl} target="_blank" rel="noreferrer">
            See what a stranger sees
          </a>
        </Button>
      </div>

      {pdf.kind === "failed" ? (
        <p role="alert" className="mt-3 text-sm text-danger-text">
          We could not open the file just now. Try again in a moment.
        </p>
      ) : null}
    </li>
  );
}

/**
 * The clock, re-read every thirty seconds.
 *
 * So a Withdraw button disappears when its session starts while the page sits
 * open, instead of staying on screen to be refused. The server still decides;
 * this only stops offering what it would refuse. `refresh` re-reads it on
 * demand, for the moment a server answer is news about time: a 409 "already
 * started" landing between two ticks would otherwise leave the button up for
 * up to thirty seconds after the server said no.
 */
function useNow(intervalMs = 30_000): { now: number; refresh: () => void } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  const refresh = useCallback(() => setNow(Date.now()), []);
  return { now, refresh };
}

/**
 * Whether a registration may still be withdrawn from here (AC-29).
 *
 * Only `registered`, on a session that is still published and has not started.
 * Attended, absent, released and withdrawn are facts that have already
 * happened, and a cancelled or completed session has nothing left to pull out
 * of. The API applies the same test and is the one that counts.
 */
function canWithdraw(registration: TrainingMyRegistration, now: number) {
  return (
    registration.status === "registered" &&
    registration.session.status === "published" &&
    Date.parse(registration.session.startsAt) > now
  );
}

/**
 * A refused withdrawal, in words a person would use.
 *
 * Worded here rather than shown as the API wrote it, because the API speaks
 * about "that registration" and this row is about a day somebody planned
 * around. Two different 409s share one status, so the session's own start time
 * tells them apart: past it, the session began; before it, the row was already
 * withdrawn somewhere else (another tab, another device).
 */
function withdrawRefusal(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
  startsAt: string,
): string {
  if (result.status !== "refused") {
    return result.status === "failed"
      ? "We could not reach Injishi, so we cannot tell whether you were taken off the list. The list below has been checked again; if it still says Registered, try once more."
      : apiResultMessage(result);
  }
  switch (result.httpStatus) {
    case 403:
      return "This registration belongs to a different account, so we could not withdraw it. If you registered with another e-mail address, sign in with that one.";
    case 404:
      return "We could not find this registration any more, so nothing changed. The list below has been checked again.";
    case 409:
      return Date.parse(startsAt) <= Date.now() ||
        /started/i.test(result.message)
        ? "This session has already started, so it is too late to withdraw. Nothing changed. If you cannot attend, tell the trainer on the day."
        : "You had already withdrawn from this session, so nothing changed.";
    default:
      return result.message;
  }
}

function RegistrationRow({
  registration,
  onChanged,
}: {
  registration: TrainingMyRegistration;
  onChanged: () => Promise<void>;
}) {
  const { now, refresh: refreshNow } = useNow();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<
    { tone: "done" | "refused"; text: string } | null
  >(null);

  const { session, course } = registration;
  const when = formatSessionWhen(session.startsAt);
  const where = `${session.venue.name}, ${session.venue.districtName}`;
  const offerWithdraw = canWithdraw(registration, now);

  async function confirmWithdraw() {
    setWorking(true);
    setNotice(null);
    const result = await withdrawRegistration(registration.id);

    if (result.status === "ok") {
      setNotice({
        tone: "done",
        text: "You are off the list for this session, and your seat has gone back to other people.",
      });
    } else {
      setNotice({
        tone: "refused",
        text: withdrawRefusal(result, session.startsAt),
      });
    }
    setConfirmOpen(false);
    refreshNow();
    // Reload on every outcome except a lost sign in. A refusal is news too: a
    // 409 means the row on screen is out of date.
    if (result.status !== "unauthenticated") await onChanged();
    setWorking(false);
  }

  return (
    <li className="rounded border border-border bg-surface-secondary p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">{course.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {when} · {where}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={STATUS_BADGE[registration.status]}>
            {STATUS_LABEL[registration.status]}
          </Badge>
          {/* Stays mounted while its dialog is open, even if the clock passes
              the start meanwhile: a dialog vanishing under the cursor reads as
              a crash, and the confirm then gets the server's own answer. */}
          {offerWithdraw || confirmOpen ? (
            <Dialog
              open={confirmOpen}
              onOpenChange={(open) => {
                // Not closable mid request: closing would suggest the
                // withdrawal was abandoned when it may already have landed.
                if (!working) setConfirmOpen(open);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent showCloseButton={!working}>
                <DialogHeader>
                  <DialogTitle>Withdraw from this session?</DialogTitle>
                  <DialogDescription>
                    {course.title}, on {when}, at {where}.
                  </DialogDescription>
                </DialogHeader>
                <p className="mt-4 text-sm text-foreground">
                  Your seat goes back to other people straight away. Registering
                  again for this same date is not possible online yet, so if you
                  might still come, keep your seat.
                </p>
                <DialogFooter className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmOpen(false)}
                    disabled={working}
                  >
                    Keep my seat
                  </Button>
                  <Button
                    variant="danger"
                    onClick={confirmWithdraw}
                    disabled={working}
                  >
                    {working ? "Withdrawing…" : "Withdraw"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p
          role={notice.tone === "refused" ? "alert" : "status"}
          className={
            notice.tone === "refused"
              ? "mt-3 text-sm text-danger-text"
              : "mt-3 text-sm text-muted-foreground"
          }
        >
          {notice.text}
        </p>
      ) : null}
    </li>
  );
}

/**
 * A registration's state, in words a person would use about themselves.
 *
 * `released` and `withdrawn` are worded differently on purpose, because they
 * are different facts: one is the company cancelling the session, the other is
 * the person pulling out. Telling somebody they withdrew when a session was
 * cancelled under them is a small lie the data does not require.
 */
const STATUS_LABEL: Record<TrainingMyRegistration["status"], string> = {
  registered: "Registered",
  attended: "Attended",
  absent: "Marked absent",
  withdrawn: "You withdrew",
  released: "Session cancelled",
};

const STATUS_BADGE: Record<
  TrainingMyRegistration["status"],
  "success" | "subtle" | "warning"
> = {
  registered: "subtle",
  attended: "success",
  absent: "warning",
  withdrawn: "subtle",
  released: "warning",
};

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}
