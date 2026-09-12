"use client";

/* HAND-OWNED. Converted from the prototype capture web_app/claim-org to real
 * JSX, then given the one thing the capture never had: an outcome.
 *
 * This is the authorization gate of the on-behalf-of registration path. An
 * onboarding agent registers a business; the named owner claims it; only then
 * does money unlock. The capture stated all of that in prose and then wired the
 * primary button to nothing at all — #claim-btn had no handler and no script, so
 * the page described an irreversible, audited act and did not perform it.
 *
 * It performs it now, behind an attestation the claimant has to tick. That is
 * not friction for its own sake: the copy claims this act is written to the
 * audit trail and unlocks the business's money, and a control carrying that
 * weight should not fire on a stray click. The claimed state then shows what
 * actually changed and what to do next, because "you are the Owner" is only
 * useful next to "here is the payout destination you can now set."
 *
 * Still fixtures: the org shown is the seeded demo business. Wiring this to
 * `/api/v1/*` is the follow-up — the org module does not exist yet. */
import { useState } from "react";
import { Button, Checkbox } from "@heroui/react";
import { Badge, Button as UiButton } from "@injishi/ui";

import BrandLogo from "@/components/app/brand-logo";
import ThemeToggleButton from "@/components/app/theme-toggle-button";
import { Icon } from "@/components/app/icon";

/** The business being claimed. One object so the API swap has a single seam. */
const ORG = {
  initials: "UG",
  name: "Umurage Guesthouse",
  summary: "Hospitality · Serviced Apartment · Remera, Gasabo",
  registrant: "Jean Bosco (Injishi field agent)",
  registeredOn: "28 Jun 2026",
  owner: "Rayan Iraguha (you)",
  ownerEmail: "rayan@example.rw",
};

export default function Page() {
  const [attested, setAttested] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);

  const claim = async () => {
    if (!attested || busy) return;
    setBusy(true);
    // Stands in for POST /api/v1/orgs/:id/claim. Kept deliberately visible as a
    // pending state: the real call writes an audit record and unlocks money, so
    // the button must never appear to succeed instantly and silently.
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    setClaimed(true);
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
        {/* The heading carries the page. The claim's state lives on the org card
            below, next to the other facts about this business, rather than as a
            label floating above the title. */}
        <h1 className={"font-display text-3xl font-bold tracking-tight"}>
          {claimed ? `You own ${ORG.name}` : `Take ownership of ${ORG.name}`}
        </h1>
        <p className={"mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground"}>
          {claimed
            ? "The claim is recorded and the business is yours. Money is unlocked — set where it should go, then you can start taking bookings."
            : "An onboarding agent registered this business on your behalf. Claiming makes you the Owner — and only then does money unlock."}
        </p>

        {/* Org card */}
        <div className={"mt-6 rounded-card border border-border bg-card p-6 text-card-foreground"}>
          <div className={"flex flex-wrap items-center gap-4"}>
            <span className={"flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-ramp-3 font-display text-lg font-bold text-white"}>
              {ORG.initials}
            </span>
            <div className={"min-w-0 grow"}>
              <h2 className={"font-display text-xl font-bold"}>
                {ORG.name}
              </h2>
              <p className={"text-sm text-card-foreground/70"}>
                {ORG.summary}
              </p>
            </div>
            <span className={"flex shrink-0 flex-wrap items-center gap-2"}>
              <Badge variant="success" size="sm">
                <Icon name="badge-check" className="h-3 w-3" />
                {"TIN verified"}
              </Badge>
              <Badge variant={claimed ? "success" : "warning"} size="sm">
                <Icon name={claimed ? "badge-check" : "clock"} className="h-3 w-3" />
                {claimed ? "Owned by you" : "Agent-held"}
              </Badge>
            </span>
          </div>
          <dl className={"mt-5 grid gap-3 sm:grid-cols-2"}>
            <div className={"rounded-card bg-background/60 p-3"}>
              <dt className={"text-xs font-bold uppercase tracking-wider text-card-foreground/60"}>
                {"Registered by"}
              </dt>
              <dd className={"mt-0.5 text-sm font-semibold"}>
                {ORG.registrant}
              </dd>
              <dd className={"money text-xs text-card-foreground/60"}>
                {`On behalf of · ${ORG.registeredOn}`}
              </dd>
            </div>
            <div className={"rounded-card bg-background/60 p-3"}>
              <dt className={"text-xs font-bold uppercase tracking-wider text-card-foreground/60"}>
                {claimed ? "Owner" : "Intended owner"}
              </dt>
              <dd className={"mt-0.5 text-sm font-semibold"}>
                {ORG.owner}
              </dd>
              <dd className={"money text-xs text-card-foreground/60"}>
                {ORG.ownerEmail}
              </dd>
            </div>
          </dl>
        </div>

        {claimed ? (
          <>
            {/* What actually changed, and the next thing to do about it. */}
            <div className={"mt-4 flex items-start gap-3 rounded-card border border-accent-brand/40 bg-accent-brand/5 p-4"}>
              <Icon name="circle-check" className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
              <div className={"text-sm"}>
                <p className={"font-semibold"}>
                  {"Money is unlocked"}
                </p>
                <p className={"mt-1 leading-relaxed text-muted-foreground"}>
                  {"You can now set a payout destination and start the subscription. The agent who registered this business keeps no financial access to it, and never had any."}
                </p>
              </div>
            </div>
            {/* ONE BUTTON, BECAUSE THERE IS ONE DESTINATION (ADR-044, D-a).

                These were two: "Set your payout destination" to
                `/host/payouts` and "Go to your dashboard" to `/host/today`.
                Both addresses name a KIND rather than a workspace, so both went
                through the operator app's deprecated shim, and D-a sends both
                to `/start`. Two buttons onto one address is two promises and
                one room, so the pair collapses into the promise `/start` keeps:
                it asks what this person holds and opens it. The label is the
                one `pipeline-status.tsx` already uses for the same door. */}
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
            {/* Money-locked notice */}
            <div className={"mt-4 flex items-start gap-3 rounded-card border border-warning/30 bg-warning/5 p-4"}>
              <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className={"text-sm"}>
                <p className={"font-semibold"}>
                  {"Money is locked until you claim"}
                </p>
                <p className={"mt-1 leading-relaxed text-muted-foreground"}>
                  {"No payout destination or subscription billing can be set while the business is agent-held, and the registrant can never receive its money. Claiming is the authorization gate — TIN verification proves the business is real, not that the agent was authorized to act for you."}
                </p>
              </div>
            </div>

            {/* The attestation. The claim writes an audit record; it should take
                a deliberate act, not a stray click on a page you landed on. */}
            {/* One control. HeroUI's Checkbox carries its own label, so the
                separate `<label>` wrapper is gone and React Aria wires the pair;
                `data-selected` replaces the `has-[:checked]` selectors, which
                only worked while there was a real `:checked` input inside. */}
            <Checkbox
              isSelected={attested}
              onChange={setAttested}
              className={"mt-5 flex cursor-pointer items-start gap-3 rounded-card border border-border p-4 text-sm leading-relaxed transition-colors hover:bg-muted data-[selected=true]:border-accent-brand data-[selected=true]:bg-muted"}
            >
              <span>
                <span className={"font-semibold"}>
                  {`I am the owner of ${ORG.name}`}
                </span>
                <span className={"block text-muted-foreground"}>
                  {"and I authorized this registration. I understand this claim is recorded against my identity."}
                </span>
              </span>
            </Checkbox>

            <div className={"mt-4 flex flex-col gap-3 sm:flex-row-reverse"}>
              <Button
                variant="primary"
                id={"claim-btn"}
                isDisabled={!attested || busy}
                isPending={busy}
                onPress={claim}
                className="grow"
              >
                {busy ? null : <Icon name="badge-check" className="h-4 w-4" />}
                {busy ? "Recording your claim…" : "Claim ownership"}
              </Button>
              <Button
                variant="outline"
                isDisabled={reported}
                onPress={() => setReported(true)}
              >
                {reported ? "Report sent" : "Not my business"}
              </Button>
            </div>
            {!attested ? (
              <p className={"mt-3 text-xs text-muted-foreground"}>
                {"Confirm the statement above to claim."}
              </p>
            ) : null}
            {reported ? (
              <p role={"status"} className={"mt-3 flex items-start gap-2 rounded-card border border-border bg-field p-3 text-xs leading-relaxed text-muted-foreground"}>
                <Icon name="flag" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {"Reported. Injishi will contact the agent who registered this business, and the claim stays locked until it is resolved. The report is written to the audit trail."}
              </p>
            ) : null}
          </>
        )}

        <p className={"mt-6 text-xs leading-relaxed text-muted-foreground"}>
          <Icon name="info" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          {"Every On-Behalf-Of registration and claim is written to the audit trail (who registered on whose behalf)."}
        </p>
      </main>
    </>
  );
}
