"use client";

import { ArrowLeft, CircleCheck, MapPin } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { approvePsfAction, decidePsfBranchAction, sendBackPsfAction } from "@/features/oversight/psf-actions";
import { API_BASE } from "@/pms/data/api";
import { dayMonthYear, rwf } from "@/server/format";
import type { PsfApplicationBranch, PsfOfficerApplication } from "@/server/sources/psf";

/**
 * One PSF application on live data (ported from the old operator console, 2026-10-26): what the
 * business filed, where it trades, and the decision. Only the PSF District Manager of its district
 * decides it (`decidesHere`); a province or national manager reads it for reporting. Each branch is
 * admitted or declined by the District Manager of the branch's own district (`branch.canDecide`).
 */
export function PsfApplicationView({ initial, card = null }: { initial: PsfOfficerApplication; card?: { url: string; mime: string | null } | null }) {
  const t = useTranslations("psfConsole.queue");
  const a = useTranslations("psfApplication");
  const [app, setApp] = useState(initial);
  const f = app.form;
  const place = [f.streetAddress, app.districtName].filter(Boolean).join(", ");

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <div>
        <LinkButton href="/psf" variant="ghost" size="sm">
          <ArrowLeft className="size-4" /> {t("applications")}
        </LinkButton>
      </div>
      <PageHeader
        eyebrow={[app.docId, app.profile.businessCode, app.districtName].filter(Boolean).join(" · ")}
        title={app.businessName}
        description={`${app.intake === "card_holder" ? `${a("cardTitle")} · ` : ""}${app.requestedTierName} · ${t("sent")} ${dayMonthYear(app.queuedAt ?? app.submittedAt)} ${
          app.origin === "psf_form" ? t("fromPsf") : t("fromInjishi")
        }${
          app.status === "submitted" ? ` · ${t("waiting")} ${t("days", { count: app.waitingDays })}` : ""
        }`}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5 lg:order-1">
          <Card>
            <Card.Header>
            <Card.Title>{t("business")}</Card.Title>
            </Card.Header>
            <Card.Content>
              <KeyValueList
                items={[
                  { label: a("registeredName"), value: f.companyName },
                  { label: a("registration"), value: f.registrationNumber ? `${f.registrationType.toUpperCase()} ${f.registrationNumber}` : a("notRegistered") },
                  { label: t("sector"), value: app.profile.clusterName ?? a("notGiven") },
                  { label: a("businessKind"), value: app.profile.subsectorName ?? a("notGiven") },
                  { label: a("association"), value: app.profile.associationName ?? a("notGiven") },
                  {
                    label: a("ownedBy"),
                    value: app.profile.ownerGroups.length ? app.profile.ownerGroups.map((g) => a(`ownerGroups.${g}`)).join(", ") : a("notMarked"),
                  },
                  { label: t("location"), value: place || "Not recorded" },
                  { label: a("businessActivity"), value: f.businessActivity },
                  {
                    label: a("trade"),
                    value: f.tradeDirection === "none" ? a("no") : `${f.tradeDirection}: ${f.tradeGoods ?? ""} (${f.tradeCountries.join(", ")})`,
                  },
                ]}
              />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>{t("location")}</Card.Title>
              <Card.Description>
                {app.branches.length
                  ? a("headOfficeAndBranches", { count: app.branches.length })
                  : a("headOfficeOnly")}
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col divide-y divide-separator">
              <div className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
                <span className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
                  <span className="flex flex-col">
                    <span className="font-medium">{app.districtName ?? a("notRecorded")}</span>
                    <span className="text-[12px] leading-4 text-muted">{f.streetAddress}</span>
                  </span>
                </span>
                <Chip size="sm" variant="soft" color="default">
                  {a("headOffice")}
                </Chip>
              </div>
              {app.branches.map((b) => (
                <BranchRow key={b.id} applicationId={app.id} branch={b} onDecided={setApp} />
              ))}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>{t("submittedBy")}</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              <OwnerPhoto orgId={app.orgId} />
              <KeyValueList
                items={[
                  { label: a("name"), value: `${f.firstName} ${f.lastName}` },
                  { label: a("role"), value: f.contactRole.replace(/_/g, " ") },
                  { label: a("phone"), value: f.phoneE164 },
                  { label: a("email"), value: f.email || a("notGiven") },
                  ...app.extraAnswers.map((answer) => ({ label: answer.label, value: answer.value })),
                ]}
              />
            </Card.Content>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:order-2">
          {/* A card holder's old PSF card (2026-11-02), shown beside the decision: read the dates off it. */}
          {app.intake === "card_holder" ? (
            <Card>
              <Card.Header>
                <Card.Title>{a("cardTitle")}</Card.Title>
                <Card.Description>{a("cardBody")}</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-2">
                {card ? (
                  <>
                    {card.mime === "application/pdf" ? (
                    <iframe src={card.url} title={a("cardTitle")} className="h-72 w-full rounded-lg border border-separator bg-default" />
                    ) : (
                      <a href={card.url} target="_blank" rel="noreferrer" title={a("cardOpen")}>
                        {/* A short-lived link to the stored card. */}
                        <img src={card.url} alt={a("cardTitle")} className="max-h-80 w-full rounded-lg border border-separator bg-default object-contain" />
                      </a>
                    )}
                    <a href={card.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-accent hover:underline">
                      {a("cardOpenLink")}
                    </a>
                  </>
                ) : (
                  <p className="text-[13px] text-muted">{a("cardFailure")}</p>
                )}
              </Card.Content>
            </Card>
          ) : null}
          <DecisionPanel app={app} onDecided={setApp} />
        </div>
      </div>
    </PageContent>
  );
}

function DecisionPanel({ app, onDecided }: { app: PsfOfficerApplication; onDecided: (a: PsfOfficerApplication) => void }) {
  const t = useTranslations("psfConsole.queue");
  const a = useTranslations("psfApplication");
  const [mode, setMode] = useState<"approve" | "send_back">("approve");
  const [number, setNumber] = useState(app.suggestedMembershipNumber ?? "");
  // A card holder's year, read off its card (2026-11-03): both dates, always exactly a year apart. Pick
  // either and the other follows. It may not have ended already: an older card has lapsed.
  const cardHolder = app.intake === "card_holder";
  const [startsOn, setStartsOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
  const yearAhead = shiftYears(today, 1);
  const earliestStart = shiftDays(shiftYears(today, -1), 1);
  const endOf = (start: string) => shiftDays(shiftYears(start, 1), -1);
  const startOf = (end: string) => shiftDays(shiftYears(end, -1), 1);
  const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const pickStart = (v: string) => {
    setStartsOn(v);
    if (isDay(v)) setExpiresOn(endOf(v));
  };
  const pickEnd = (v: string) => {
    setExpiresOn(v);
    if (isDay(v)) setStartsOn(startOf(v));
  };
  const cardEndOk = isDay(startsOn) && isDay(expiresOn) && expiresOn === endOf(startsOn) && expiresOn >= today && expiresOn <= yearAhead;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (app.status !== "submitted") return <Outcome app={app} />;

  // Sent back (2026-11-05): waiting on the business, and back in the queue when it resends.
  if (app.returnedAt) {
    return (
      <Card>
        <Card.Header>
          <Card.Title>{a("sentBackTitle")}</Card.Title>
          <Card.Description>{a("sentBackLead", { date: dayMonthYear(app.returnedAt) })}</Card.Description>
        </Card.Header>
        <Card.Content>
          <KeyValueList items={[{ label: a("youAsked"), value: app.returnNote ?? "" }]} />
        </Card.Content>
      </Card>
    );
  }

  // Only the District Manager of its district decides (2026-10-23). Here for a branch only,
  // or from a province or national post: read and report.
  if (!app.decidesHere) {
    return (
      <Card>
        <Card.Header>
          <Card.Title>{a("decision")}</Card.Title>
        </Card.Header>
        <Card.Content>
          <Alert status="accent">
            <Alert.Content>
              <Alert.Description>
                {app.headOfficeInScope
                  ? `For reporting: the PSF District Manager of ${app.districtName ?? "its district"} approves or declines it.`
                  : `The business is decided by the PSF District Manager of ${app.districtName ?? "its head office"}. You decide its branches in your district.`}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </Card.Content>
      </Card>
    );
  }

  if (!app.canDecide) {
    return (
      <Card>
        <Card.Header>
          <Card.Title>{a("decision")}</Card.Title>
        </Card.Header>
        <Card.Content>
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>{a("roleConflict")}</Alert.Description>
            </Alert.Content>
          </Alert>
        </Card.Content>
      </Card>
    );
  }

  const paid = app.payment?.amountRwf ?? null;

  const decide = async () => {
    setBusy(true);
    setError(null);
    const res =
      mode === "approve"
        ? await approvePsfAction(app.id, number, cardHolder ? { startsOn, expiresOn } : undefined)
        : await sendBackPsfAction(app.id, note);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDecided(res.value);
    toast.success(
      mode === "approve"
        ? cardHolder
          ? `${app.businessName} is a member, with its new number and certificate.`
          : `${app.businessName} is approved.`
        : `${app.businessName} was sent back to fix.`,
    );
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>{t("chamberDecision")}</Card.Title>
        <Card.Description>
          {cardHolder ? a("cardHolderNoFee") : paid !== null ? a("paidWhenSent", { amount: rwf(paid) }) : a("notPaidYet")}
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {/* One action at a time (2026-11-03): the approve form with its one button, or the decline form. */}
        {mode === "approve" ? (
          <>
            <TextField fullWidth value={number} onChange={setNumber} className="gap-1">
              <Label htmlFor="psf-number">{cardHolder ? a("newMembershipNumber") : a("membershipNumber")}</Label>
              <Input id="psf-number" className="tabular" />
              {app.suggestedMembershipNumber ? (
                <Description>
                  {cardHolder ? a("cardNumberHint") : a("nextNumberHint")}
                </Description>
              ) : null}
            </TextField>
            {cardHolder ? (
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-2 gap-2">
                  <TextField fullWidth value={startsOn} onChange={pickStart} className="gap-1">
                    <Label htmlFor="psf-card-from">{a("validFrom")}</Label>
                    <Input id="psf-card-from" type="date" min={earliestStart} max={today} />
                  </TextField>
                  <TextField fullWidth value={expiresOn} onChange={pickEnd} className="gap-1">
                    <Label htmlFor="psf-card-until">{a("validTo")}</Label>
                    <Input id="psf-card-until" type="date" min={today} max={yearAhead} />
                  </TextField>
                </div>
                <Description>
                  {(startsOn || expiresOn) && !cardEndOk
                    ? a("dateRangeHint", { date: dayMonthYear(yearAhead) })
                    : cardEndOk
                      ? a("cardYear", { from: dayMonthYear(startsOn), to: dayMonthYear(expiresOn) })
                      : a("datePairHint")}
                </Description>
              </div>
            ) : null}
          </>
        ) : (
          <TextField fullWidth value={note} onChange={setNote} className="gap-1">
            <Label htmlFor="psf-note">{a("sendBackLabel")}</Label>
            <TextArea id="psf-note" rows={3} />
            <Description>{a("sendBackHelp")}</Description>
          </TextField>
        )}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        <Button
          fullWidth
          variant="primary"
          isPending={busy}
          isDisabled={
            busy ||
            (mode === "approve" ? !number.trim() || (cardHolder && !cardEndOk) : note.trim().length < 3)
          }
          onPress={() => void decide()}
        >
          {mode === "approve" ? (
            <>
              <CircleCheck className="size-4" />
              {t("approve")}
            </>
          ) : (
            <>
              <ArrowLeft className="size-4" /> {a("sendBack")}
            </>
          )}
        </Button>
        <Button
          fullWidth
          size="sm"
          variant="ghost"
          isDisabled={busy}
          onPress={() => {
            setError(null);
            setMode(mode === "approve" ? "send_back" : "approve");
          }}
        >
          {mode === "approve" ? a("sendBackInstead") : a("backToApproving")}
        </Button>
      </Card.Content>
    </Card>
  );
}

function Outcome({ app }: { app: PsfOfficerApplication }) {
  const a = useTranslations("psfApplication");
  const approved = app.status === "member" || app.status === "approved";
  return (
    <Card>
      <Card.Header>
        <Card.Title>{a("decision")}</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <Alert status={approved ? "success" : app.status === "declined" ? "danger" : "default"}>
          <Alert.Content>
            <Alert.Title>
              {app.status === "member" ? a("memberOutcome") : app.status === "approved" ? a("waitingPayment") : app.status === "declined" ? a("declined") : a("withdrawn")}
            </Alert.Title>
            {app.decidedAt ? <Alert.Description>{dayMonthYear(app.decidedAt)}</Alert.Description> : null}
          </Alert.Content>
        </Alert>
        <KeyValueList
          items={[
            ...(app.approvedMembershipNumber ? [{ label: a("membershipNumberLabel"), value: app.approvedMembershipNumber }] : []),
            ...(app.approvedFeeRwf !== null ? [{ label: a("membershipYear"), value: rwf(app.approvedFeeRwf) }] : []),
            ...(app.declineReason ? [{ label: "Reason", value: a(`declineReasons.${app.declineReason}`) }] : []),
            ...(app.decisionNote ? [{ label: "Note", value: app.decisionNote }] : []),
          ]}
        />
      </Card.Content>
    </Card>
  );
}

function BranchRow({
  applicationId,
  branch,
  onDecided,
}: {
  applicationId: string;
  branch: PsfApplicationBranch;
  onDecided: (a: PsfOfficerApplication) => void;
}) {
  const a = useTranslations("psfApplication");
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const place = [branch.sectorName, branch.districtName].filter(Boolean).join(", ") || a("notRecorded");

  const decide = async (decision: "admit" | "decline") => {
    setBusy(true);
    setError(null);
    const res = await decidePsfBranchAction(applicationId, branch.id, decision, note);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDecided(res.value);
    toast.success(decision === "admit" ? `The ${place} branch is admitted.` : `The ${place} branch was declined.`);
  };

  return (
    <div className="flex flex-col gap-2 py-3 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
          <span className="flex flex-col">
            <span className="font-medium">{place}</span>
            <span className="text-[12px] leading-4 text-muted">{branch.street}</span>
            {branch.status === "declined" && branch.note ? <span className="text-[12px] leading-4 text-muted">“{branch.note}”</span> : null}
          </span>
        </span>
        <Chip size="sm" variant="soft" color={branch.status === "admitted" ? "success" : branch.status === "declined" ? "danger" : "default"}>
          {a(`branchStatus.${branch.status}`)}
        </Chip>
      </div>
      {branch.canDecide ? (
        declining ? (
          <div className="flex flex-col gap-2 pl-6">
            <TextField fullWidth value={note} onChange={setNote} className="gap-1">
            <Label htmlFor={`note-${branch.id}`}>{a("branchDeclineReason")}</Label>
              <TextArea id={`note-${branch.id}`} rows={2} />
            </TextField>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="danger" isPending={busy} isDisabled={busy || !note.trim()} onPress={() => void decide("decline")}>
                {a("declineBranch")}
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setDeclining(false)}>
                {a("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pl-6">
            <Button size="sm" variant="primary" isPending={busy} isDisabled={busy} onPress={() => void decide("admit")}>
              <CircleCheck className="size-4" /> {a("admitBranch")}
            </Button>
            <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => setDeclining(true)}>
              {a("decline")}
            </Button>
          </div>
        )
      ) : null}
      {error ? <p className="pl-6 text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}

/** A yyyy-mm-dd day moved by whole years; 29 February falls back to the 28th. */
function shiftYears(day: string, years: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** A yyyy-mm-dd day moved by whole days. */
function shiftDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The owner's passport photo (2026-11-05). A business from before photos has none, and shows nothing. */
function OwnerPhoto({ orgId }: { orgId: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    // biome-ignore lint/performance/noImgElement: the API's own route, behind the officer's session
    <img
      src={`${API_BASE}/api/v1/oversight/psf/businesses/${orgId}/photo`}
      alt="The owner"
      onError={() => setMissing(true)}
      className="h-28 w-22 rounded-lg object-cover ring-1 ring-border"
    />
  );
}
