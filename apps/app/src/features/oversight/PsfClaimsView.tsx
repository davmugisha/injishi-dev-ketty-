"use client";

import { Button, Card, Input, Label, TextArea, TextField } from "@heroui/react";
import type { PsfClaimsPage, PsfMembershipClaim } from "@injishi/contracts";
import {
  EmptyBlock,
  formatDay,
  formatNumber,
  Icon,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PsfScope } from "@/server/sources/psf";
import { SELECT } from "../shared/setup-ui";
import { confirmClaimAction, rejectClaimAction } from "./psf-claims-actions";

type Status = "claimed" | "confirmed" | "rejected";

const TABS: { id: Status; label: string }[] = [
  { id: "claimed", label: "Waiting" },
  { id: "confirmed", label: "Confirmed" },
  { id: "rejected", label: "Rejected" },
];

const TEMPLATE = [
  "membership_number,legal_name,tin,tier_code,starts_on,expires_on",
  "PSF/GAS/2026/0001,Example Hotel Ltd,123456789,indatwa_10k,2026-01-01,2027-01-01",
].join("\n");

/** Today and a year on, as yyyy-mm-dd, for the confirm form's dates. */
function yearFromToday(): { start: string; end: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
  const [y, m, d] = today.split("-");
  return { start: today, end: `${Number(y) + 1}-${m}-${d}` };
}

/**
 * Membership claims (0121, 2026-10-30): a PSF membership number a business typed is a claim, not a
 * membership, until PSF confirms it. Here the District Manager confirms a claim against PSF's records
 * (its tier and dates) or rejects it with the reason the business is told, and uploads PSF's own member
 * list so that claims whose number and TIN match confirm themselves.
 */
export function PsfClaimsView({
  scope,
  page,
  status,
  tiers,
  cards,
}: {
  scope: PsfScope;
  page: PsfClaimsPage;
  status: Status;
  tiers: { code: string; nameEn: string }[];
  /** The membership card each business sent, by org (2026-11-02). */
  cards: Record<string, { url: string; mime: string | null }>;
}) {
  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Card holders"
        description="Businesses that registered on Injishi with an old PSF card, no number or certificate in the new module. Check the card, then give a new number and the year it shows: they become members with a certificate."
      />

      <KpiStrip
        label="Claims"
        items={[
          {
            id: "claimed",
            label: "Waiting for PSF",
            value: page.counts.claimed,
            format: "count",
            icon: "Clock",
            status: page.counts.claimed > 0 ? "warning" : undefined,
            href: "/psf/claims",
            isCurrent: status === "claimed",
          },
          {
            id: "confirmed",
            label: "Confirmed",
            value: page.counts.confirmed,
            format: "count",
            icon: "CircleCheck",
            href: "/psf/claims?status=confirmed",
            isCurrent: status === "confirmed",
          },
          {
            id: "rejected",
            label: "Rejected",
            value: page.counts.rejected,
            format: "count",
            icon: "Xmark",
            href: "/psf/claims?status=rejected",
            isCurrent: status === "rejected",
          },
        ]}
      />

      {/* PSF's member list upload is set aside for now (2026-11-02): an officer checks each claim. */}
      <div className="min-w-0">
        <section aria-labelledby="claims-h" className="flex min-w-0 flex-col gap-3">
          <h2 id="claims-h" className="text-[15px] font-semibold">
            {TABS.find((t) => t.id === status)?.label} claims
          </h2>
          {page.items.length === 0 ? (
            <Card variant="secondary" className="p-8">
              <EmptyBlock
                icon={status === "claimed" ? "CircleCheck" : "FileText"}
                title={status === "claimed" ? "No claim is waiting for PSF" : `No ${status} claim yet`}
                description={
                  status === "claimed"
                    ? "A business that says at registration it is already a PSF member shows here, with the number and the card it sent."
                    : undefined
                }
              />
            </Card>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {page.items.map((c) => (
                <li key={c.id}>
                  <ClaimCard claim={c} tiers={tiers} card={cards[c.orgId] ?? null} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageContent>
  );
}

function ClaimCard({
  claim: c,
  tiers,
  card,
}: {
  claim: PsfMembershipClaim;
  tiers: { code: string; nameEn: string }[];
  card: { url: string; mime: string | null } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "confirm" | "reject">("view");
  const dates = yearFromToday();
  const listedTier = c.listed?.tierCode && tiers.some((t) => t.code === c.listed?.tierCode) ? c.listed.tierCode : "";
  const [tier, setTier] = useState(listedTier || tiers[0]?.code || "");
  const [startsOn, setStartsOn] = useState(dates.start);
  const [expiresOn, setExpiresOn] = useState(c.listed?.expiresOn ?? dates.end);
  const [reason, setReason] = useState("");
  // Every card holder gets a NEW number in the new module (2026-11-02): the district's next, suggested.
  const [typedNumber, setTypedNumber] = useState(c.suggestedMembershipNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const act = async (call: Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setError("");
    const res = await call;
    setBusy(false);
    if (res.ok) {
      setMode("view");
      router.refresh();
    } else setError(res.error);
  };

  const tone = c.status === "confirmed" ? "success" : c.status === "rejected" ? "danger" : "warning";
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <NextLink href={`/psf/register/${c.orgId}`} className="font-semibold text-foreground hover:underline">
            {c.legalName}
          </NextLink>
          <span className="text-xs text-muted">
            {[c.businessCode, c.districtName, c.tin ? `TIN ${c.tin}` : null].filter(Boolean).join(" · ")}
          </span>
        </div>
        <StatusChip tone={tone}>
          {c.status === "claimed" ? "Waiting for PSF" : c.status === "confirmed" ? "Confirmed" : "Rejected"}
        </StatusChip>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-default/60 px-3 py-2.5">
        <span className="flex flex-col">
          <span className="text-[11px] text-muted">Old card number</span>
          {c.membershipNumber ? (
            <span className="font-mono text-[15px] font-semibold tabular">{c.membershipNumber}</span>
          ) : (
            <span className="text-[13px] text-muted">Not given</span>
          )}
        </span>
        <span className="flex flex-col">
          <span className="text-[11px] text-muted">Claimed</span>
          <span className="text-[13px]">
            {formatDay(c.claimedAt)}
            {c.claimedByName ? ` · ${c.claimedByName}` : ""}
          </span>
        </span>
        <span className="flex flex-col">
          <span className="text-[11px] text-muted">Membership card</span>
          {card ? (
            <a href={card.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-accent hover:underline">
              Open the card{card.mime === "application/pdf" ? " (PDF)" : ""}
            </a>
          ) : (
            <span className="text-[13px] text-muted">None sent</span>
          )}
        </span>
      </div>

      {c.listed ? (
        <p
          className={`m-0 flex items-start gap-2 text-[13px] ${c.listed.tinMatches ? "text-success" : "text-warning"}`}
        >
          <Icon name={c.listed.tinMatches ? "CircleCheck" : "TriangleExclamation"} className="mt-0.5 size-4 shrink-0" />
          <span>
            {c.listed.tinMatches
              ? "PSF's member list has this number, with this business's TIN."
              : `PSF's member list has this number, for ${c.listed.legalName ?? "another business"}${c.listed.tin ? ` (TIN ${c.listed.tin})` : ""}: the TIN does not match.`}
            {c.listed.expiresOn ? ` Listed until ${formatDay(c.listed.expiresOn)}.` : ""}
          </span>
        </p>
      ) : c.status === "claimed" ? (
        <p className="m-0 flex items-start gap-2 text-[13px] text-muted">
          <Icon name="CircleInfo" className="mt-0.5 size-4 shrink-0" />
          Check the number and the membership card against PSF's records before confirming.
        </p>
      ) : null}

      {c.status !== "claimed" ? (
        <p className="m-0 text-[13px] text-muted">
          {c.status === "confirmed"
            ? `Confirmed ${c.decidedAt ? formatDay(c.decidedAt) : ""}${c.matchedBy === "member_list" ? " from PSF's member list" : c.decidedByName ? ` by ${c.decidedByName}` : ""}.`
            : `Rejected ${c.decidedAt ? formatDay(c.decidedAt) : ""}${c.decidedByName ? ` by ${c.decidedByName}` : ""}: ${c.decisionNote ?? ""}`}
        </p>
      ) : mode === "view" ? (
        <div className="flex flex-wrap gap-2 border-t border-separator pt-3">
          <Button size="sm" onPress={() => setMode("confirm")}>
            <Icon name="Check" className="size-4" />
            Confirm membership
          </Button>
          <Button size="sm" variant="secondary" onPress={() => setMode("reject")}>
            Reject
          </Button>
        </div>
      ) : mode === "confirm" ? (
        <form
          className="flex flex-col gap-3 border-t border-separator pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              confirmClaimAction(c.id, { tierCode: tier, startsOn, expiresOn, membershipNumber: typedNumber }),
            );
          }}
        >
          <p className="m-0 text-[13px] text-muted">A new number in the new module, and the level and year the card shows.</p>
          <label className="flex flex-col gap-1 text-sm font-medium sm:max-w-sm">
            New membership number
            <input
              className={SELECT}
              value={typedNumber}
              onChange={(e) => setTypedNumber(e.target.value)}
              placeholder="PSF/GAS/2026/0001"
              required
            />
            {c.suggestedMembershipNumber ? <span className="text-xs font-normal text-muted">The district&apos;s next number. Every card holder gets a new one.</span> : null}
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Tier
              <select className={SELECT} value={tier} onChange={(e) => setTier(e.target.value)} required>
                {tiers.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <TextField value={startsOn} onChange={setStartsOn} isRequired className="flex flex-col gap-1">
              <Label>Member since</Label>
              <Input type="date" />
            </TextField>
            <TextField value={expiresOn} onChange={setExpiresOn} isRequired className="flex flex-col gap-1">
              <Label>Member until</Label>
              <Input type="date" />
            </TextField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" isDisabled={busy || !tier || !typedNumber.trim() || expiresOn <= startsOn}>
              {busy ? "Confirming…" : "Confirm membership"}
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setMode("view")}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3 border-t border-separator pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act(rejectClaimAction(c.id, reason));
          }}
        >
          <TextField value={reason} onChange={setReason} isRequired className="flex flex-col gap-1">
            <Label>Why, in words the business reads</Label>
            <TextArea rows={2} placeholder="This number is not in PSF's records." />
          </TextField>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger-soft" type="submit" isDisabled={busy || reason.trim().length < 3}>
              {busy ? "Rejecting…" : "Reject claim"}
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setMode("view")}>
              Back
            </Button>
          </div>
        </form>
      )}
      {error ? <p className="m-0 text-[13px] text-danger">{error}</p> : null}
    </Card>
  );
}

