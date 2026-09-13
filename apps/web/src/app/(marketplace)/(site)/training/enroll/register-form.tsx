"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Input, Label } from "@injishi/ui";
import type {
  TrainingRegistrationResult,
  TrainingSessionDetail,
} from "@injishi/contracts";
import { fetchMyWorkspaces, type LabelledWorkspace } from "@/data/me";
import { registerForSession } from "@/data/training-api";
import { useSessionUser } from "@/lib/session";
import { formatSessionWhen } from "@/lib/training-format";
import { formatRwf } from "@/lib/money";
import { PhoneField } from "./phone-field";

/**
 * Registering for one in person session (ADR-049 AC-2, AC-3).
 *
 * WHAT REPLACED WHAT. The old `enrol-form.tsx` wrote four answers, including a
 * National ID, into a `localStorage` key and called that an enrolment. Nothing
 * reached a server. This form posts to the API, and the differences are all
 * deliberate:
 *
 * NO E-MAIL FIELD. The API takes the address from the session, because an
 * address typed into a form is one the sender does not have to own, and this
 * request is what a certificate eventually hangs from. The form shows which
 * address will be used so nobody is surprised.
 *
 * NO NATIONAL ID. The old form asked for one. ADR-049 deliberately does not
 * collect it, which is what keeps this feature outside the isolated personal
 * data machinery the platform builds for stay identities. Asking for an ID to
 * attend a training session was collecting a national identifier because a form
 * had a slot for it.
 *
 * THE BUSINESS IS NAMED EXACTLY ONE WAY (AC-3). Either an org the caller
 * already holds, offered from `GET /me/workspaces`, or free text for somebody
 * whose business is not on the platform. Never both, never neither, and the
 * database holds that rule with a CHECK constraint as well.
 *
 * AN ANONYMOUS VISITOR IS SENT TO SIGN IN AND COMES BACK HERE (AC-2). Through
 * the existing e-mail code screen on web, with a `redirect` carrying this page
 * and the chosen session. No second sign-in screen is created; there is one, and
 * this is a caller of it.
 */
export function RegisterForm({ session }: { session: TrainingSessionDetail }) {
  const { status, user } = useSessionUser();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+250");
  const [orgId, setOrgId] = useState<string | "">("");
  const [businessName, setBusinessName] = useState("");
  const [workspaces, setWorkspaces] = useState<LabelledWorkspace[] | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<
    | {
        kind: "registered";
        alreadyRegistered: boolean;
        status: TrainingRegistrationResult["status"];
      }
    | { kind: "refused"; message: string }
    | null
  >(null);

  /**
   * Prefill the name from the account, once the session resolves.
   *
   * Prefilled and EDITABLE, which is what the spec's value sourcing asks for: a
   * certificate prints this name, and the name on somebody's account is often a
   * nickname or a first name only. The person should see what will be printed
   * and be able to correct it before it is.
   */
  useEffect(() => {
    if (status === "authenticated" && user?.name && fullName === "") {
      setFullName(user.name);
    }
  }, [status, user?.name, fullName]);

  /** The businesses this person actually holds, for the picker (AC-3). */
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      const result = await fetchMyWorkspaces();
      if (cancelled) return;
      setWorkspaces(
        result.status === "ok"
          ? result.workspaces.filter((w) => w.orgId !== null)
          : [],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") {
    return <p className="text-muted-foreground">Checking your account…</p>;
  }

  if (status === "unreachable") {
    return (
      <Panel title="We could not reach your account just now">
        <p className="text-sm text-muted-foreground">
          This says nothing about whether you are signed in, only that we could
          not ask. Reload the page in a moment.
        </p>
      </Panel>
    );
  }

  if (status === "anonymous") {
    const back = `/training/enroll?session=${session.id}`;
    return (
      <Panel title="Sign in to register">
        <p className="text-sm text-muted-foreground">
          We will send a code to your e-mail address. There is no password to
          remember, and you will come straight back to this session.
        </p>
        <Button asChild className="mt-4">
          <Link href={`/sign-in?redirect=${encodeURIComponent(back)}`}>
            Send me a code
          </Link>
        </Button>
      </Panel>
    );
  }

  /**
   * A registration this person withdrew comes BACK from the register call, as
   * `200` with `alreadyRegistered: true` and `status: "withdrawn"`: the API
   * finds the existing row on `(session_id, user_id)` and returns it untouched,
   * so no seat is taken. Saying "you were already registered" here would be a
   * false statement about a person who is not on the list. Until the API can
   * put somebody back, the screen says what is true.
   */
  if (outcome?.kind === "registered" && outcome.status === "withdrawn") {
    return (
      <Panel title="You withdrew from this session">
        <p className="text-sm text-muted-foreground">
          You took yourself off the list for this date earlier, and registering
          again for the same date is not possible online yet, so you are still
          not on the list. Pick another date, or contact us and we can put you
          back on this one.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/training#dates">Other dates</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/training/certificate">See my training</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  if (outcome?.kind === "registered") {
    return (
      <Panel
        title={
          outcome.alreadyRegistered
            ? "You were already registered"
            : "You are registered"
        }
      >
        <p className="text-sm text-muted-foreground">
          {outcome.alreadyRegistered
            ? "We already had you on the list for this session, so nothing changed."
            : "We have you on the list for this session."}{" "}
          Turn up on the day and the trainer will mark you present. That mark is
          what issues your certificate.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/training/certificate">See my training</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/training">Other dates</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  const holdsOrgs = (workspaces?.length ?? 0) > 0;
  const namedOneWay = orgId !== "" ? true : businessName.trim().length >= 2;
  const canSubmit =
    fullName.trim().length >= 2 && phone.length > 4 && namedOneWay;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setOutcome(null);

    const result = await registerForSession({
      sessionId: session.id,
      fullName: fullName.trim(),
      phone,
      // EXACTLY ONE of these is sent, never both. The contract refuses both and
      // so does the database; sending both would be refused correctly but the
      // form should not be the thing that has to be refused.
      ...(orgId !== ""
        ? { orgId }
        : { businessName: businessName.trim() }),
    });

    setSubmitting(false);

    if (result.status === "ok") {
      setOutcome({
        kind: "registered",
        alreadyRegistered: result.data.alreadyRegistered,
        status: result.data.status,
      });
      return;
    }

    setOutcome({
      kind: "refused",
      message:
        result.status === "refused"
          ? result.message
          : result.status === "unauthenticated"
            ? "Your sign in has expired. Reload the page and sign in again."
            : "We could not reach the API. Nothing was saved, so try again.",
    });
  }

  return (
    <form onSubmit={submit} className="max-w-form">
      <div className="rounded-card border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground">
          {session.course.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatSessionWhen(session.startsAt)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.venue.name}, {session.venue.districtName}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatRwf(session.feeRwf)}. Nothing is collected online yet.
        </p>
        {session.isOverSubscribed ? (
          <div className="mt-4">
            <Badge variant="warning">Over its seat count</Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              More people have registered than this venue has seats. You can
              still register, and we will tell you if we add a date.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5">
        <div>
          <Label htmlFor="fullName">Your full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            required
          />
          <p className="mt-1 text-sm text-muted-foreground">
            This is the name printed on your certificate, so put it the way you
            want it read.
          </p>
        </div>

        <div>
          <Label htmlFor="phone">Your phone number</Label>
          <PhoneField id="phone" value={phone} onChange={setPhone} />
          <p className="mt-1 text-sm text-muted-foreground">
            So a trainer can reach you if the date or the venue changes.
          </p>
        </div>

        <div>
          <Label htmlFor="business">Which business do you work for?</Label>
          {holdsOrgs ? (
            <>
              <select
                id="business"
                value={orgId}
                onChange={(event) => {
                  setOrgId(event.target.value);
                  if (event.target.value !== "") setBusinessName("");
                }}
                className="mt-1 h-10 w-full rounded border border-border bg-card px-3 text-foreground"
              >
                <option value="">Another business, not on Injishi</option>
                {workspaces?.map((workspace) => (
                  <option key={workspace.orgId} value={workspace.orgId ?? ""}>
                    {workspace.orgName ?? workspace.label}
                  </option>
                ))}
              </select>
              {orgId === "" ? (
                <Input
                  className="mt-3"
                  placeholder="Type its name"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  required
                />
              ) : null}
            </>
          ) : (
            <Input
              id="business"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="The name of your guesthouse, hotel or agency"
              required
            />
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded with your registration. It is not printed on the
            certificate and is never shown to anyone who scans it.
          </p>
        </div>

        {user?.email ? (
          <p className="text-sm text-muted-foreground">
            Your certificate and every message about this session go to{" "}
            <span className="text-foreground">{user.email}</span>, the address
            on your account.
          </p>
        ) : null}

        {outcome?.kind === "refused" ? (
          <p role="alert" className="text-sm text-danger-text">
            {outcome.message}
          </p>
        ) : null}

        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Registering…" : "Register for this session"}
        </Button>
      </div>
    </form>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-form rounded-card border border-border bg-card p-6">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}
