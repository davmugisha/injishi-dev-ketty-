"use client";

import { Button, Card, Input, Label, TextArea, TextField } from "@heroui/react";
import type { PsfClaimsPage, PsfMemberListRow, PsfMembershipClaim } from "@injishi/contracts";
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
import { confirmClaimAction, rejectClaimAction, uploadMemberListAction } from "./psf-claims-actions";

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
}: {
  scope: PsfScope;
  page: PsfClaimsPage;
  status: Status;
  tiers: { code: string; nameEn: string }[];
}) {
  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Membership claims"
        description="Businesses that said at registration they are already PSF members, with the number they typed. They show as members only once PSF confirms the number."
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
          {
            id: "list",
            label: "PSF member list",
            value: page.list.rows,
            format: "count",
            icon: "FileText",
            footnote: page.list.uploadedAt ? `Uploaded ${formatDay(page.list.uploadedAt)}` : "Not uploaded yet",
          },
        ]}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <section aria-labelledby="claims-h" className="flex min-w-0 flex-col gap-3 lg:col-span-2">
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
                    ? "A business that types a PSF membership number at registration shows here, unless PSF's member list already confirmed it."
                    : undefined
                }
              />
            </Card>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {page.items.map((c) => (
                <li key={c.id}>
                  <ClaimCard claim={c} tiers={tiers} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <MemberListCard list={page.list} />
      </div>
    </PageContent>
  );
}

function ClaimCard({ claim: c, tiers }: { claim: PsfMembershipClaim; tiers: { code: string; nameEn: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "confirm" | "reject">("view");
  const dates = yearFromToday();
  const listedTier = c.listed?.tierCode && tiers.some((t) => t.code === c.listed?.tierCode) ? c.listed.tierCode : "";
  const [tier, setTier] = useState(listedTier || tiers[0]?.code || "");
  const [startsOn, setStartsOn] = useState(dates.start);
  const [expiresOn, setExpiresOn] = useState(c.listed?.expiresOn ?? dates.end);
  const [reason, setReason] = useState("");
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
          <span className="text-[11px] text-muted">Number they typed</span>
          <span className="font-mono text-[15px] font-semibold tabular">{c.membershipNumber}</span>
        </span>
        <span className="flex flex-col">
          <span className="text-[11px] text-muted">Claimed</span>
          <span className="text-[13px]">
            {formatDay(c.claimedAt)}
            {c.claimedByName ? ` · ${c.claimedByName}` : ""}
          </span>
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
          This number is not on PSF's member list on Injishi. Check it against PSF's records before confirming.
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
            void act(confirmClaimAction(c.id, { tierCode: tier, startsOn, expiresOn }));
          }}
        >
          <p className="m-0 text-[13px] text-muted">The tier and dates as PSF's records give them.</p>
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
            <Button size="sm" type="submit" isDisabled={busy || !tier || expiresOn <= startsOn}>
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

/** One CSV line into its cells, quotes honoured. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const COLUMN: Record<keyof PsfMemberListRow, string[]> = {
  membershipNumber: ["membership_number", "membership number", "number", "membership"],
  legalName: ["legal_name", "legal name", "name", "business"],
  tin: ["tin"],
  tierCode: ["tier_code", "tier", "tier code"],
  startsOn: ["starts_on", "start", "member since", "starts"],
  expiresOn: ["expires_on", "expiry", "expires", "member until"],
};

/** PSF's spreadsheet, saved as CSV, into rows; the header names the columns. */
function parseList(text: string): { rows: PsfMemberListRow[]; problem: string | null } {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], problem: "The file has no rows under its header." };
  const header = cells(lines[0] ?? "").map((h) => h.toLowerCase());
  const at = (k: keyof PsfMemberListRow) => header.findIndex((h) => COLUMN[k].includes(h));
  const numberAt = at("membershipNumber");
  if (numberAt < 0) return { rows: [], problem: "The header needs a membership_number column." };
  const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const rows = lines.slice(1).flatMap((line) => {
    const c = cells(line);
    const number = c[numberAt];
    if (!number) return [];
    const get = (k: keyof PsfMemberListRow) => (at(k) >= 0 ? c[at(k)] || null : null);
    return [
      {
        membershipNumber: number,
        legalName: get("legalName"),
        tin: get("tin"),
        tierCode: get("tierCode"),
        startsOn: day(get("startsOn") ?? undefined),
        expiresOn: day(get("expiresOn") ?? undefined),
      },
    ];
  });
  return { rows, problem: rows.length ? null : "No row has a membership number." };
}

function MemberListCard({ list }: { list: PsfClaimsPage["list"] }) {
  const router = useRouter();
  const [rows, setRows] = useState<PsfMemberListRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  return (
    <SectionCard
      title="PSF's member list"
      description="Upload PSF's own list of members. A claim whose number and TIN match a row is confirmed on the spot, now and at every registration."
    >
      <p className="m-0 text-[13px] text-muted">
        {list.rows
          ? `${formatNumber(list.rows)} members on the list${list.uploadedAt ? `, last uploaded ${formatDay(list.uploadedAt)}` : ""}.`
          : "No list uploaded yet."}
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Spreadsheet saved as CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-default file:px-3 file:py-2 file:text-foreground"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setDone(null);
            if (!file) return;
            setFileName(file.name);
            const parsed = parseList(await file.text());
            setRows(parsed.rows);
            setProblem(parsed.problem);
          }}
        />
        <span className="text-xs font-normal text-muted">
          Columns: membership_number, legal_name, tin, tier_code, starts_on, expires_on (dates as yyyy-mm-dd).{" "}
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
            download="psf-member-list-template.csv"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Download a template
          </a>
        </span>
      </label>
      {problem ? <p className="m-0 text-[13px] text-danger">{problem}</p> : null}
      {rows && rows.length > 0 ? (
        <Button
          isDisabled={busy}
          onPress={async () => {
            setBusy(true);
            const res = await uploadMemberListAction(rows);
            setBusy(false);
            if (res.ok) {
              const v = res.value;
              setDone(
                `${formatNumber(v.rows)} rows kept from ${fileName}. ${v.confirmedClaims ? `${v.confirmedClaims} waiting ${v.confirmedClaims === 1 ? "claim" : "claims"} confirmed.` : "No waiting claim matched."}${v.skipped.length ? ` Skipped: ${v.skipped.slice(0, 3).join("; ")}${v.skipped.length > 3 ? "…" : ""}` : ""}`,
              );
              setRows(null);
              router.refresh();
            } else setProblem(res.error);
          }}
        >
          <Icon name="ArrowUpFromLine" className="size-4" />
          {busy ? "Uploading…" : `Upload ${formatNumber(rows.length)} rows`}
        </Button>
      ) : null}
      {done ? <p className="m-0 text-[13px] text-success">{done}</p> : null}
    </SectionCard>
  );
}
