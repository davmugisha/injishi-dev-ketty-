"use client";

import { useEffect, useState } from "react";
import { REJECTION_REASON_LABEL, type RegistrationSummary, stepForRejectionReason } from "@injishi/contracts";
import { Alert } from "@heroui/react";
import { formatLocale, isLocale } from "@injishi/i18n";
import { Avatar, AvatarFallback, Badge, Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";
import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { fetchRegistration } from "@/data/registration";
import { setupIsOpen, setupLink } from "@/lib/setup-link";

import { StepCard } from "./register-shell";
import { Notice } from "./wizard-ui";

/**
 * In review (RegisterIA board, Journey stage 2): ONE page from the payment to
 * the approval, for anyone whose business is past payment and not yet open.
 *
 * It used to be a pipeline that opened on "Checking your TIN with RRA", a check
 * the person had already passed on Business, and a sent-back registration was
 * a status line with no way to act on it. Here the officers' steps sit inside
 * one stage the owner reads: registered and paid (the TIN checked when it was
 * entered), the online document review, the approval, then set up. A sent-back
 * registration names its reason, in the officer's own words when they left any,
 * with a Fix button. A hospitality business may set up while it is reviewed and
 * publish once approved, so the link shows from payment; a residence's waits
 * for approval (lib/setup-link.ts).
 *
 * WHAT IT CANNOT SAY, AND DOES NOT INVENT. The board prints the payment method,
 * a receipt number and the reviewing officer's district.
 * `RegistrationSummary` carries none of them (only the submission time, the
 * status and a rejection reason), so the page says what is known and no more.
 */

type StageState = "done" | "current" | "todo" | "problem";

interface Stage {
  title: string;
  sub: string;
  state: StageState;
}

const KIGALI: Intl.DateTimeFormatOptions = { timeZone: "Africa/Kigali" };

/** The page's own messages, under `registerForms.inReview`. */
type InReviewMessages = ReturnType<typeof useTranslations<"registerForms.inReview">>;

function onDay(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(locale, { ...KIGALI, day: "numeric", month: "short", year: "numeric" });
}

/**
 * What the first stage says while the registration is `submitted`, and once it is past it. RRA checks a TIN; a
 * residence carries a UPI and no TIN, so it skips that check and goes straight on to the district (the API's
 * `runTinCheck`), and its UPI was only ever format checked, as Business said when it was typed.
 */
function firstStageSub(summary: RegistrationSummary, paid: string | null, t: InReviewMessages): string {
  // Each case is its own catalog message: the sentence is not built by gluing a paid clause onto a stem, so a
  // locale that words the two differently is free to.
  if (summary.domain === "residence") {
    if (summary.status === "submitted")
      return paid ? t("residenceSubmittedPaid", { paid }) : t("residenceSubmitted");
    return paid ? t("residenceCheckedPaid", { paid }) : t("residenceChecked");
  }
  if (summary.status === "submitted")
    return paid ? t("businessSubmittedPaid", { paid }) : t("businessSubmitted");
  return paid ? t("businessCheckedPaid", { paid }) : t("businessChecked");
}

function stagesFor(summary: RegistrationSummary, paid: string | null, t: InReviewMessages): Stage[] {
  const s = summary.status;
  const checked = s === "field_verified" || s === "approved" || s === "active";
  const approved = s === "approved" || s === "active";
  const open = setupIsOpen(summary);
  return [
    {
      title: t("stagePaid"),
      sub: firstStageSub(summary, paid, t),
      state: s === "submitted" ? "current" : "done",
    },
    {
      title: t("stageDocs"),
      sub: s === "rejected" ? t("sentBackBody") : checked ? t("docsChecked") : t("docsReviewing"),
      state: s === "rejected" ? "problem" : checked ? "done" : s === "tin_verified" ? "current" : "todo",
    },
    {
      title: t("stageApproval"),
      sub: approved ? (s === "approved" ? t("approvedOwner") : t("approved")) : t("approvalPending"),
      state: approved ? "done" : s === "field_verified" ? "current" : "todo",
    },
    {
      title: t("stageSetup"),
      sub: s === "active" ? t("setupActive") : open ? t("setupOpen") : t("setupLocked"),
      state: open ? "current" : "todo",
    },
  ];
}

/**
 * What the page says about setup, by where the registration stands. The rule is `setup-link.ts`'s (a hospitality
 * business may set up while it is reviewed; a residence waits for approval); only the words are here.
 */
function setupNote(summary: RegistrationSummary, t: InReviewMessages): string {
  switch (summary.status) {
    case "active":
      return t("setupNoteActive");
    case "approved":
      return t("setupNoteApproved");
    case "rejected":
      return t("setupNoteRejected");
    case "submitted":
    case "tin_verified":
    case "field_verified":
      return summary.domain === "residence" ? t("setupNoteReviewResidence") : t("setupNoteReviewStay");
    default:
      return t("setupNoteUnpaid");
  }
}

function chipFor(summary: RegistrationSummary, t: InReviewMessages): { label: string; variant: "accent" | "success" | "danger" } {
  switch (summary.status) {
    case "rejected":
      return { label: t("chipFix"), variant: "danger" };
    case "active":
      return { label: t("chipApproved"), variant: "success" };
    case "approved":
      return { label: t("chipApprovedOwner"), variant: "success" };
    case "field_verified":
      return { label: t("chipApproval"), variant: "accent" };
    case "tin_verified":
      return { label: t("chipDocs"), variant: "accent" };
    default:
      // A residence has no TIN, so it has no TIN check to be in.
      return { label: summary.domain === "residence" ? t("chipReview") : t("chipTin"), variant: "accent" };
  }
}

export function InReview({
  summary,
  onSummary,
  onFix,
  onStartNew,
}: {
  summary: RegistrationSummary;
  onSummary: (next: RegistrationSummary) => void;
  onFix: () => void;
  onStartNew: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const t = useTranslations("registerForms.inReview");
  const tk = useTranslations("register.kinds.items");
  const locale = useLocale();

  // Poll while a machine holds it (the RRA check settles in seconds), and stop
  // once a person does: a document review takes days, and asking the API every
  // few seconds for days would tell the owner nothing new. Coming back to the
  // tab asks once, which is when a person actually looks.
  useEffect(() => {
    const ask = async () => {
      const res = await fetchRegistration(summary.orgId);
      if (res.status === "ok") onSummary(res.data);
    };
    const onFocus = () => void ask();
    window.addEventListener("focus", onFocus);
    const timer = summary.status === "submitted" ? setInterval(() => void ask(), 5_000) : null;
    return () => {
      window.removeEventListener("focus", onFocus);
      if (timer) clearInterval(timer);
    };
  }, [summary.status, summary.orgId, onSummary]);

  const refresh = async () => {
    setChecking(true);
    const res = await fetchRegistration(summary.orgId);
    setChecking(false);
    if (res.status === "ok") onSummary(res.data);
  };

  const active = summary.status === "active";
  const rejected = summary.status === "rejected";
  const chip = chipFor(summary, t);
  // The kind the org carries (ADR-075 D-h), a venue's included: a Bar & Restaurant has no accommodation class, so
  // reading the class left it with no word. Other names no kind.
  const kindWord =
    summary.businessKind && summary.businessKind !== "other" ? tk(`${summary.businessKind}.label`) : null;
  const paid = onDay(summary.submittedAt, formatLocale(isLocale(locale) ? locale : "en"));
  const reason = summary.rejectionReason;
  const setupHref = setupLink(summary, process.env.NEXT_PUBLIC_WEB_URL, process.env.NEXT_PUBLIC_PMS_URL);

  return (
    <>
      <StepCard
        id="register-review"
        chip={
          <Badge variant={chip.variant} size="sm">
            {chip.label}
          </Badge>
        }
        title={
          active || summary.status === "approved"
            ? t("titleApproved", { name: summary.legalName })
            : rejected
              ? t("titleFix", { name: summary.legalName })
              : t("titleRegistered", { name: summary.legalName })
        }
        lead={
          active
            ? t("leadActive")
            : `${kindWord ? `${kindWord} · ` : ""}${paid ? t("leadPaid", { date: paid }) : t("leadNoDate")}`
        }
      >
        {rejected ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                {t("sentBackTitle", {
                  reason: reason ? REJECTION_REASON_LABEL[reason] : t("noReason"),
                })}
              </Alert.Title>
              <Alert.Description>
                {summary.rejectionNotes ? <>&ldquo;{summary.rejectionNotes}&rdquo; </> : null}
                {t("fixThat")}
              </Alert.Description>
            </Alert.Content>
            <Button variant="danger" size="sm" onClick={onFix} className="shrink-0 self-center">
              {t("fixIt")}
            </Button>
          </Alert>
        ) : null}

        {summary.status === "approved" ? (
          <Notice tone="info">{t("ownerNotice")}</Notice>
        ) : null}

        <ol className="flex flex-col">
          {stagesFor(summary, paid, t).map((stage, i) => (
            <li key={stage.title} className="flex gap-3.5 border-t border-border py-3.5 first:border-t-0">
              <Avatar className="size-8">
                <AvatarFallback
                  className={cn(
                    "text-xs font-semibold",
                    stage.state === "problem"
                      ? "bg-destructive/15 text-destructive"
                      : stage.state === "todo"
                        ? "bg-secondary text-muted-foreground"
                        : "bg-accent-brand/15 text-accent-text",
                  )}
                >
                  {stage.state === "done" ? (
                    <Check size={16} aria-label={t("done")} />
                  ) : stage.state === "problem" ? (
                    <X size={16} aria-label={t("sentBack")} />
                  ) : (
                    <span aria-hidden>{i + 1}</span>
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {stage.title}
                  {stage.state === "current" ? <span className="sr-only">{t("now")}</span> : null}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">{stage.sub}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {summary.status === "submitted" ? null : (
            <Button variant="link" size="sm" pending={checking} onClick={() => void refresh()}>
              {checking ? t("checking") : t("checkUpdate")}
            </Button>
          )}
          <Button variant="link" size="sm" onClick={onStartNew}>
            {t("registerAnother")}
          </Button>
        </div>
      </StepCard>

      {rejected ? null : (
        <section
          aria-labelledby="register-prepare"
          className="flex flex-wrap items-center gap-5 rounded-card border border-border bg-secondary p-5 sm:p-6"
        >
          <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1.5">
            <h2 id="register-prepare" className="text-lg font-semibold">
              {t("setupTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{setupNote(summary, t)}</p>
          </div>
          {setupHref ? (
            <Button asChild>
              <a href={setupHref}>{t("setupCta")}</a>
            </Button>
          ) : null}
        </section>
      )}
    </>
  );
}

/**
 * Business, in fix mode: what was sent back, and the one way on that exists.
 *
 * The board's fix mode reopens Business on the field that was wrong, takes a
 * clearer photo, and resubmits. The API has no route that changes a submitted
 * registration's details or attaches a document to it; `resubmit` only sends it
 * back for review. So this says plainly what can be done online (resubmit, with
 * no new fee) and where the fix itself goes (to the verifier), rather than
 * offering fields whose answers would be thrown away.
 */
export function FixBusiness({
  summary,
  busy,
  error,
  onResubmit,
  onBack,
}: {
  summary: RegistrationSummary;
  busy: boolean;
  error: string;
  onResubmit: () => void;
  onBack: () => void;
}) {
  const reason = summary.rejectionReason;
  const where = reason ? stepForRejectionReason(reason) : "none";
  const t = useTranslations("registerForms.inReview");
  const fixHint = {
    identity: t("fixHintIdentity"),
    business: t("fixHintBusiness"),
    documents: t("fixHintDocuments"),
    none: t("fixHintNone"),
  }[where];

  return (
    <StepCard
      id="register-fix"
      title={t("fixTitle")}
      lead={t("fixLead", { name: summary.legalName })}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            {t("back")}
          </Button>
          <Button onClick={onResubmit} pending={busy}>
            {busy ? t("sending") : t("resubmit")}
          </Button>
        </>
      }
    >
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{reason ? REJECTION_REASON_LABEL[reason] : t("fixNoReason")}</Alert.Title>
          <Alert.Description>
            {summary.rejectionNotes ? <>&ldquo;{summary.rejectionNotes}&rdquo; </> : null}
            {fixHint}
          </Alert.Description>
        </Alert.Content>
      </Alert>
      <Notice tone="info">{t("fixNotice")}</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </StepCard>
  );
}
