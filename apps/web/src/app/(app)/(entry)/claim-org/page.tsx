"use client";

/* The owner claim (FL02, ADR-053): the end an on behalf of registration could
 * never reach. An agent registers a business; the named owner claims it here;
 * only then is it theirs.
 *
 * DRIVEN BY THE API, NOT A FIXTURE (AC-R3). The business, where it is, who
 * registered it and where it got to all come from
 * `POST /api/v1/orgs/:orgId/claim/preview`, and the claim is
 * `POST /api/v1/orgs/:orgId/claim`. The hardcoded org and the 900 millisecond
 * timer that stood in for both are gone, and so is the "Not my business" button,
 * which said a report was written to the audit trail and wrote nothing.
 *
 * THE TOKEN IS HANDLED ONCE. The mail link carries it in the query, because a
 * link has to. On load the page copies it into a ref and replaces the address
 * with a bare `/claim-org`, so it does not sit in browser history, and the route
 * is served with `Referrer-Policy: no-referrer` (next.config.ts) so nothing the
 * page loads learns the URL. A ref rather than state, so React's development
 * double run of the effect reads the token the first run captured instead of the
 * address the first run already cleared.
 *
 * WHAT IT NEVER SAYS. Whether the signed in account's identity document matches.
 * The preview is a session plus the token; the match is the claim's, and every
 * refusal is the same answer, so the page lists what a claim needs rather than
 * reporting which part failed. */
import {
  type ClaimPreview,
  type OrgRegistrationStatus,
  type RegistrationSummary,
} from "@injishi/contracts";
import { useEffect, useRef, useState } from "react";
import { Button, Checkbox } from "@heroui/react";
import { Badge, Button as UiButton } from "@injishi/web-ui";

import BrandLogo from "@/components/app/brand-logo";
import ThemeToggleButton from "@/components/app/theme-toggle-button";
import { Icon } from "@/components/app/icon";
import { claimOrg, previewOrgClaim } from "@/data/registration";
import { apiResultMessage } from "@/lib/api";

/** Where the business is, in the words a claimant needs. */
const STAGE_LABEL: Readonly<Record<OrgRegistrationStatus, string>> = {
  pending_payment: "Waiting for the registration fee",
  submitted: "Checking the TIN with RRA",
  tin_verified: "Waiting for field verification",
  field_verified: "Waiting for approval",
  approved: "Approved, waiting for you to claim it",
  active: "Active",
  rejected: "Sent back to the registrant",
  suspended: "Suspended",
};

type View =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; preview: ClaimPreview }
  | { kind: "claimed"; preview: ClaimPreview; summary: RegistrationSummary };

export default function Page() {
  const link = useRef<{ orgId: string; token: string } | null | undefined>(undefined);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState("");

  useEffect(() => {
    if (link.current === undefined) {
      const params = new URLSearchParams(window.location.search);
      const orgId = params.get("org");
      const token = params.get("token");
      link.current = orgId && token ? { orgId, token } : null;
      if (params.has("token") || params.has("org")) {
        window.history.replaceState(window.history.state, "", "/claim-org");
      }
    }
    const captured = link.current;
    if (captured === null) {
      setView({ kind: "invalid" });
      return;
    }

    let cancelled = false;
    void (async () => {
      const res = await previewOrgClaim(captured.orgId, captured.token);
      if (cancelled) return;
      if (res.status === "ok") setView({ kind: "ready", preview: res.data });
      else if (res.status === "refused" && res.httpStatus === 404) setView({ kind: "invalid" });
      else setView({ kind: "failed", message: apiResultMessage(res) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const claim = async () => {
    const captured = link.current;
    if (view.kind !== "ready" || !captured || !attested || busy) return;
    setBusy(true);
    setClaimError("");
    const res = await claimOrg(captured.orgId, captured.token);
    setBusy(false);
    if (res.status === "ok") {
      setView({ kind: "claimed", preview: view.preview, summary: res.data });
      return;
    }
    setClaimError(
      res.status === "refused" && res.httpStatus === 404
        ? "We could not complete this claim. It needs the account that holds the national ID the registrant recorded for you, and a link that has not expired or been used. Nothing changed."
        : apiResultMessage(res),
    );
  };

  return (
    <>
      <header className={"border-b border-border"}>
        <div className={"mx-auto flex h-16 max-w-read items-center gap-4 px-4 sm:px-6"}>
          <BrandLogo variant="extended" />
          <span className={"grow"}></span>
          <ThemeToggleButton />
        </div>
      </header>
      <main className={"mx-auto max-w-read px-4 py-10 sm:px-6"}>
        {view.kind === "loading" ? (
          <p role="status" className={"text-sm text-muted-foreground"}>
            {"Reading your claim link…"}
          </p>
        ) : null}

        {view.kind === "invalid" ? <InvalidLink /> : null}

        {view.kind === "failed" ? (
          <>
            <h1 className={"font-display text-3xl font-bold tracking-tight"}>
              {"We couldn't open this claim"}
            </h1>
            <p role="alert" className={"mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground"}>
              {view.message}
            </p>
          </>
        ) : null}

        {view.kind === "ready" || view.kind === "claimed" ? (
          <ClaimBody
            preview={view.preview}
            summary={view.kind === "claimed" ? view.summary : null}
            attested={attested}
            onAttest={setAttested}
            busy={busy}
            error={claimError}
            onClaim={() => void claim()}
          />
        ) : null}
      </main>
    </>
  );
}

/**
 * One answer for every link that is not live for this business: expired, used,
 * revoked, for another business, or never real. Distinguishing them would tell
 * the holder of a bad link that a real business sits behind it.
 */
function InvalidLink() {
  return (
    <>
      <h1 className={"font-display text-3xl font-bold tracking-tight"}>
        {"This claim link is not valid"}
      </h1>
      <p className={"mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground"}>
        {"A claim link works once and expires after 7 days. If you are the owner of a business someone registered for you, ask them to have a new invitation sent."}
      </p>
      <div className={"mt-6"}>
        <UiButton asChild variant="outline">
          <a href={"/start"}>{"Go to your account"}</a>
        </UiButton>
      </div>
    </>
  );
}

function ClaimBody({
  preview,
  summary,
  attested,
  onAttest,
  busy,
  error,
  onClaim,
}: {
  preview: ClaimPreview;
  summary: RegistrationSummary | null;
  attested: boolean;
  onAttest: (next: boolean) => void;
  busy: boolean;
  error: string;
  onClaim: () => void;
}) {
  const claimed = summary !== null;
  const stage = summary?.status ?? preview.registrationStatus;
  const initials = preview.legalName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      {/* The heading carries the page. The claim's state lives on the org card
          below, next to the other facts about this business. */}
      <h1 className={"font-display text-3xl font-bold tracking-tight"}>
        {claimed ? `You own ${preview.legalName}` : `Take ownership of ${preview.legalName}`}
      </h1>
      <p className={"mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground"}>
        {claimed
          ? stage === "active"
            ? "The claim is recorded and the business is yours and live."
            : "The claim is recorded and the business is yours. It goes live once the government review approves it."
          : "Someone registered this business on your behalf. Claiming makes you its owner."}
      </p>

      <div className={"mt-6 rounded-card border border-border bg-card p-6 text-card-foreground"}>
        <div className={"flex flex-wrap items-center gap-4"}>
          <span className={"flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-ramp-3 font-display text-lg font-bold text-white"}>
            {initials}
          </span>
          <div className={"min-w-0 grow"}>
            <h2 className={"font-display text-xl font-bold"}>{preview.legalName}</h2>
            <p className={"text-sm text-card-foreground/70"}>
              {preview.districtName ? `${preview.districtName} District` : "Rwanda"}
            </p>
          </div>
          <span className={"flex shrink-0 flex-wrap items-center gap-2"}>
            <Badge variant={claimed ? "success" : "warning"} size="sm">
              <Icon name={claimed ? "badge-check" : "clock"} className="h-3 w-3" />
              {claimed ? "Owned by you" : "Held by the registrant"}
            </Badge>
          </span>
        </div>
        <dl className={"mt-5 grid gap-3 sm:grid-cols-2"}>
          <div className={"rounded-card bg-background/60 p-3"}>
            <dt className={"text-xs font-bold uppercase tracking-wider text-card-foreground/60"}>
              {"Registered by"}
            </dt>
            <dd className={"mt-0.5 text-sm font-semibold"}>
              {preview.registrantName ?? "The registrant"}
            </dd>
            <dd className={"text-xs text-card-foreground/60"}>{"On your behalf"}</dd>
          </div>
          <div className={"rounded-card bg-background/60 p-3"}>
            <dt className={"text-xs font-bold uppercase tracking-wider text-card-foreground/60"}>
              {"Where it is"}
            </dt>
            <dd className={"mt-0.5 text-sm font-semibold"}>{STAGE_LABEL[stage]}</dd>
          </div>
        </dl>
      </div>

      {claimed ? (
        <>
          {summary.payoutLocked === true ? (
            <div className={"mt-4 flex items-start gap-3 rounded-card border border-warning/30 bg-warning/5 p-4"}>
              <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className={"text-sm"}>
                <p className={"font-semibold"}>{"Payouts wait for identity verification"}</p>
                <p className={"mt-1 leading-relaxed text-muted-foreground"}>
                  {stage === "active"
                    ? "Your business can take bookings, but no money is paid out until your identity is verified. Nothing more is needed from you on this screen."
                    : "Once it is live your business can take bookings, but no money is paid out until your identity is verified. Nothing more is needed from you on this screen."}
                </p>
              </div>
            </div>
          ) : (
            <div className={"mt-4 flex items-start gap-3 rounded-card border border-accent-brand/40 bg-accent-brand/5 p-4"}>
              <Icon name="circle-check" className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
              <div className={"text-sm"}>
                <p className={"font-semibold"}>{"Payouts are unlocked"}</p>
                <p className={"mt-1 leading-relaxed text-muted-foreground"}>
                  {"Your identity is verified, so you can set where the business's money goes."}
                </p>
              </div>
            </div>
          )}
          {/* ONE BUTTON, BECAUSE THERE IS ONE DESTINATION (ADR-044, D-a). `/start`
              asks what this person holds and opens it. */}
          <div className={"mt-6 flex flex-col gap-3 sm:flex-row-reverse"}>
            <UiButton asChild variant="primary" className="grow">
              <a href={"/start"}>
                {"Go to your workspace"}
                <Icon name="arrow-right" className="h-4 w-4" />
              </a>
            </UiButton>
          </div>
        </>
      ) : (
        <>
          <div className={"mt-4 flex items-start gap-3 rounded-card border border-border p-4"}>
            <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className={"text-sm"}>
              <p className={"font-semibold"}>{"What claiming needs"}</p>
              <p className={"mt-1 leading-relaxed text-muted-foreground"}>
                {"Sign in with the account that holds the national ID document the registrant recorded for you. Holding this link is not enough on its own. Payouts stay locked until your identity is verified."}
              </p>
            </div>
          </div>

          {/* The attestation. The claim writes an audit record; it should take a
              deliberate act, not a stray click on a page you landed on.

              COMPOSED, NOT BARE. In HeroUI 3.2 the root is a React Aria
              `CheckboxField` and only `Checkbox.Content` (a `CheckboxButton`) is
              pressable. The bare `<Checkbox>` this page used to render drew no
              box and ignored every press, so the claim button could never be
              enabled; it was found driving this page in a browser. */}
          <Checkbox
            isSelected={attested}
            onChange={onAttest}
            className={"mt-5 rounded-card border border-border text-sm leading-relaxed transition-colors hover:bg-muted data-[selected=true]:border-accent-brand data-[selected=true]:bg-muted"}
          >
            <Checkbox.Content className={"flex w-full cursor-pointer items-start gap-3 p-4"}>
              <Checkbox.Control className={"mt-0.5 shrink-0"}>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span>
                <span className={"font-semibold"}>{`I am the owner of ${preview.legalName}`}</span>
                <span className={"block text-muted-foreground"}>
                  {"and I authorized this registration. I understand this claim is recorded against my identity."}
                </span>
              </span>
            </Checkbox.Content>
          </Checkbox>

          {error ? (
            <p role="alert" className={"mt-4 rounded-card border border-border bg-field p-3 text-sm leading-relaxed text-destructive"}>
              {error}
            </p>
          ) : null}

          <div className={"mt-4 flex flex-col gap-3 sm:flex-row-reverse"}>
            <Button
              variant="primary"
              id={"claim-btn"}
              isDisabled={!attested || busy}
              isPending={busy}
              onPress={onClaim}
              className="grow"
            >
              {busy ? null : <Icon name="badge-check" className="h-4 w-4" />}
              {busy ? "Recording your claim…" : "Claim ownership"}
            </Button>
          </div>
          {!attested ? (
            <p className={"mt-3 text-xs text-muted-foreground"}>
              {"Confirm the statement above to claim."}
            </p>
          ) : null}
        </>
      )}

      <p className={"mt-6 text-xs leading-relaxed text-muted-foreground"}>
        <Icon name="info" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        {"Every on behalf of registration and every claim is written to the audit trail."}
      </p>
    </>
  );
}
