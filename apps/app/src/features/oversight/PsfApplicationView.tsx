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
import { approvePsfAction, decidePsfBranchAction, sendBackPsfAction } from "@/features/oversight/psf-actions";
import { API_BASE } from "@/pms/data/api";
import { dayMonthYear, rwf } from "@/server/format";
import {
  PSF_BRANCH_STATUS_LABEL,
  PSF_DECLINE_REASON_LABEL,
  PSF_OWNER_GROUP_LABEL,
  type PsfApplicationBranch,
  type PsfOfficerApplication,
} from "@/server/sources/psf";

/**
 * One PSF application on live data (ported from the old operator console, 2026-10-26): what the
 * business filed, where it trades, and the decision. Only the PSF District Manager of its district
 * decides it (`decidesHere`); a province or national manager reads it for reporting. Each branch is
 * admitted or declined by the District Manager of the branch's own district (`branch.canDecide`).
 */
export function PsfApplicationView({ initial, card = null }: { initial: PsfOfficerApplication; card?: { url: string; mime: string | null } | null }) {
  const [app, setApp] = useState(initial);
  const f = app.form;
  const place = [f.streetAddress, app.districtName].filter(Boolean).join(", ");

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <div>
        <LinkButton href="/psf" variant="ghost" size="sm">
          <ArrowLeft className="size-4" /> Applications
        </LinkButton>
      </div>
      <PageHeader
        eyebrow={[app.docId, app.profile.businessCode, app.districtName].filter(Boolean).join(" · ")}
        title={app.businessName}
        description={`${app.intake === "card_holder" ? "Card holder · " : ""}${app.requestedTierName} · sent ${dayMonthYear(app.queuedAt ?? app.submittedAt)} from ${
          app.origin === "psf_form" ? "the PSF form" : "Injishi registration"
        }${
          app.status === "submitted" ? ` · waiting ${app.waitingDays} day${app.waitingDays === 1 ? "" : "s"}` : ""
        }`}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5 lg:order-1">
          <Card>
            <Card.Header>
              <Card.Title>The business</Card.Title>
            </Card.Header>
            <Card.Content>
              <KeyValueList
                items={[
                  { label: "Registered name", value: f.companyName },
                  { label: "Registration", value: f.registrationNumber ? `${f.registrationType.toUpperCase()} ${f.registrationNumber}` : "Not registered yet" },
                  { label: "Sector", value: app.profile.clusterName ?? "Not given" },
                  { label: "Kind of business", value: app.profile.subsectorName ?? "Not given" },
                  { label: "Association", value: app.profile.associationName ?? "Not given" },
                  {
                    label: "Owned by",
                    value: app.profile.ownerGroups.length ? app.profile.ownerGroups.map((g) => PSF_OWNER_GROUP_LABEL[g]).join(", ") : "Not marked",
                  },
                  { label: "Address", value: place || "Not recorded" },
                  { label: "What it does", value: f.businessActivity },
                  {
                    label: "Export or import",
                    value: f.tradeDirection === "none" ? "No" : `${f.tradeDirection}: ${f.tradeGoods ?? ""} (${f.tradeCountries.join(", ")})`,
                  },
                ]}
              />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Where it trades</Card.Title>
              <Card.Description>
                {app.branches.length
                  ? `The head office and ${app.branches.length === 1 ? "1 branch" : `${app.branches.length} branches`}. Each branch is admitted by the PSF District Manager of its own district.`
                  : "One place: the head office."}
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col divide-y divide-separator">
              <div className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
                <span className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
                  <span className="flex flex-col">
                    <span className="font-medium">{app.districtName ?? "Not recorded"}</span>
                    <span className="text-[12px] leading-4 text-muted">{f.streetAddress}</span>
                  </span>
                </span>
                <Chip size="sm" variant="soft" color="default">
                  Head office
                </Chip>
              </div>
              {app.branches.map((b) => (
                <BranchRow key={b.id} applicationId={app.id} branch={b} onDecided={setApp} />
              ))}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Who applied</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              <OwnerPhoto orgId={app.orgId} />
              <KeyValueList
                items={[
                  { label: "Name", value: `${f.firstName} ${f.lastName}` },
                  { label: "Role", value: f.contactRole.replace(/_/g, " ") },
                  { label: "Phone", value: f.phoneE164 },
                  { label: "Email", value: f.email || "Not given" },
                  ...app.extraAnswers.map((a) => ({ label: a.label, value: a.value })),
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
                <Card.Title>The PSF card they sent</Card.Title>
                <Card.Description>A card holder joining the new module: no fee now. Check it, then give a new number and the year it shows.</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-2">
                {card ? (
                  <>
                    {card.mime === "application/pdf" ? (
                      <iframe src={card.url} title="The PSF card" className="h-72 w-full rounded-lg border border-separator bg-default" />
                    ) : (
                      <a href={card.url} target="_blank" rel="noreferrer" title="Open the card full size">
                        {/* A short-lived link to the stored card. */}
                        <img src={card.url} alt="The PSF card the business sent" className="max-h-80 w-full rounded-lg border border-separator bg-default object-contain" />
                      </a>
                    )}
                    <a href={card.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-accent hover:underline">
                      Open it full size
                    </a>
                  </>
                ) : (
                  <p className="text-[13px] text-muted">The card could not be opened just now. Reload the page to try again.</p>
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
          <Card.Title>Sent back to fix</Card.Title>
          <Card.Description>{dayMonthYear(app.returnedAt)}. It returns to your queue when they resend it.</Card.Description>
        </Card.Header>
        <Card.Content>
          <KeyValueList items={[{ label: "You asked", value: app.returnNote ?? "" }]} />
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
          <Card.Title>Decision</Card.Title>
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
          <Card.Title>Decision</Card.Title>
        </Card.Header>
        <Card.Content>
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>You hold a role in this business, so another PSF District Manager must decide its application.</Alert.Description>
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
        <Card.Title>Your decision</Card.Title>
        <Card.Description>
          {cardHolder ? "A card holder: nothing to pay now." : paid !== null ? `Paid ${rwf(paid)} when sent. Nothing is refunded.` : "Not paid yet."}
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {/* One action at a time (2026-11-03): the approve form with its one button, or the decline form. */}
        {mode === "approve" ? (
          <>
            <TextField fullWidth value={number} onChange={setNumber} className="gap-1">
              <Label htmlFor="psf-number">{cardHolder ? "New PSF membership number" : "PSF membership number"}</Label>
              <Input id="psf-number" className="tabular" />
              {app.suggestedMembershipNumber ? (
                <Description>
                  {cardHolder ? "Every card holder gets a new number. This is the district's next." : "The next number for this district. Change it if PSF gave another."}
                </Description>
              ) : null}
            </TextField>
            {cardHolder ? (
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-2 gap-2">
                  <TextField fullWidth value={startsOn} onChange={pickStart} className="gap-1">
                    <Label htmlFor="psf-card-from">Valid from, on the card</Label>
                    <Input id="psf-card-from" type="date" min={earliestStart} max={today} />
                  </TextField>
                  <TextField fullWidth value={expiresOn} onChange={pickEnd} className="gap-1">
                    <Label htmlFor="psf-card-until">Valid until, on the card</Label>
                    <Input id="psf-card-until" type="date" min={today} max={yearAhead} />
                  </TextField>
                </div>
                <Description>
                  {(startsOn || expiresOn) && !cardEndOk
                    ? `A card's year ends from today to ${dayMonthYear(yearAhead)}. One that ended before today has lapsed: it joins as a new member.`
                    : cardEndOk
                      ? `A member for a year: ${dayMonthYear(startsOn)} to ${dayMonthYear(expiresOn)}.`
                      : "Pick either date: the other is set a year away."}
                </Description>
              </div>
            ) : null}
          </>
        ) : (
          <TextField fullWidth value={note} onChange={setNote} className="gap-1">
            <Label htmlFor="psf-note">What should they fix?</Label>
            <TextArea id="psf-note" rows={3} />
            <Description>They read this, correct it and resend. Their application stays open, with its docID and any fee paid.</Description>
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
              {cardHolder ? "Confirm and make a member" : paid !== null ? "Approve and make a member" : "Approve"}
            </>
          ) : (
            <>
              <ArrowLeft className="size-4" /> Send back to fix
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
          {mode === "approve" ? "Send back to fix instead" : "Back to approving"}
        </Button>
      </Card.Content>
    </Card>
  );
}

function Outcome({ app }: { app: PsfOfficerApplication }) {
  const approved = app.status === "member" || app.status === "approved";
  return (
    <Card>
      <Card.Header>
        <Card.Title>Decision</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <Alert status={approved ? "success" : app.status === "declined" ? "danger" : "default"}>
          <Alert.Content>
            <Alert.Title>
              {app.status === "member" ? "Approved · a member" : app.status === "approved" ? "Approved · waiting for payment" : app.status === "declined" ? "Declined" : "Withdrawn"}
            </Alert.Title>
            {app.decidedAt ? <Alert.Description>{dayMonthYear(app.decidedAt)}</Alert.Description> : null}
          </Alert.Content>
        </Alert>
        <KeyValueList
          items={[
            ...(app.approvedMembershipNumber ? [{ label: "Membership number", value: app.approvedMembershipNumber }] : []),
            ...(app.approvedFeeRwf !== null ? [{ label: "A year", value: rwf(app.approvedFeeRwf) }] : []),
            ...(app.declineReason ? [{ label: "Reason", value: PSF_DECLINE_REASON_LABEL[app.declineReason] }] : []),
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
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const place = [branch.sectorName, branch.districtName].filter(Boolean).join(", ") || "Not recorded";

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
          {PSF_BRANCH_STATUS_LABEL[branch.status]}
        </Chip>
      </div>
      {branch.canDecide ? (
        declining ? (
          <div className="flex flex-col gap-2 pl-6">
            <TextField fullWidth value={note} onChange={setNote} className="gap-1">
              <Label htmlFor={`note-${branch.id}`}>Why is it declined?</Label>
              <TextArea id={`note-${branch.id}`} rows={2} />
            </TextField>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="danger" isPending={busy} isDisabled={busy || !note.trim()} onPress={() => void decide("decline")}>
                Decline branch
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setDeclining(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pl-6">
            <Button size="sm" variant="primary" isPending={busy} isDisabled={busy} onPress={() => void decide("admit")}>
              <CircleCheck className="size-4" /> Admit branch
            </Button>
            <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => setDeclining(true)}>
              Decline
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
