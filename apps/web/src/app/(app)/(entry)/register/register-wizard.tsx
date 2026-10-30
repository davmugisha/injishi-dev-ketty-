"use client";

import {
  CreateRegistrationRequest,
  FranchiseDeclaration,
  IntendedOwner,
  PersonalDetails,
  looksLikePsfNumber,
  PsfApplicationInput,
  type BrokerRegistrationSummary,
  type BusinessKind,
  type IdentityStatus,
  type MyProfile,
  type OrgRegistrationStatus,
  type PsfTier,
  type RegistrantCapacity,
  type MobileMoneyNetwork,
  type RegistrationDraftChecks,
  type RegistrationDraftDone,
  type RegistrationFeeAttemptStatus,
  type RegistrationFeeQuote,
  type RegistrationPayRequest,
  type RegistrationSummary,
  BUSINESS_KIND_LABEL,
  isRwandanAddress,
  registerHeadingFor,
} from "@injishi/contracts";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CircleAlert, History, Landmark } from "lucide-react";
import { Badge, Button } from "@injishi/web-ui";

import { openAssistant } from "@/components/assistant/assistant-widget";
import { fetchMyWorkspaces, type LabelledWorkspace } from "@/data/me";
import { fetchIdentity } from "@/data/identity";
import {
  checkTin,
  clearRegistrationDraft,
  createRegistration,
  fetchMyProfile,
  fetchPsfTiers,
  fetchRegistration,
  fetchRegistrationDraft,
  fetchRegistrationFee,
  payRegistrationFee,
  registerAsBroker,
  resolveRegistrationFee,
  resubmitRegistration,
} from "@/data/registration";
import type { RegistrationFeeMode } from "@/data/platform";
import { useOnline } from "@/hooks/use-online";
import { apiResultMessage, type ApiResult, type RefusalIssue } from "@/lib/api";
import { chooseDraft, clearDeviceCopies, clearDeviceCopy, readDeviceCopy } from "@/lib/register-device-copy";
import type { SessionUser } from "@/lib/session";
import { formatNationalId } from "@/lib/rwanda-id";
import { upiError } from "@/lib/upi";

import { EMPTY_ADDRESS, addressFromDraft, useAddressLine } from "./address-picker";
import {
  EMPTY_BUSINESS,
  formatTin,
  newBranchDraft,
  normalizeTin,
  registryAddressDraft,
  sameName,
  type BranchDraft,
  type BusinessDraft,
  type DocumentDraft,
  type TinCheck,
} from "./business-draft";
import { FixBusiness, InReview } from "./in-review";
import { EMPTY_PSF, psfCandidate, type PsfDraft } from "./psf-application";
import { RegisterRail, type RailStep } from "./register-rail";
import { RegisterSection } from "./register-section";
import { Callout, RegisterShell, StepCard, StepFrame, StepSkeleton, type StepPrimary } from "./register-shell";
import {
  STEP_TITLE,
  clampToOpenable,
  documentRows,
  openableThrough,
  openingStep,
  pathFor,
  resumeStep,
  sectionOrder,
  sectionStates,
  stepOrder,
  type RegisterPath,
  type SectionId,
  type StepId,
} from "./register-steps";
import { fromServerDraft, toServerDraft, type WizardAnswers } from "./register-draft";
import {
  REGISTRATION_KINDS,
  findRegistrationKind,
  kindInSentence,
  registrationForKind,
  type RegistrationKind,
} from "./registration-kinds";
import { BrokerSignup } from "./broker-signup";
import { SectionIdentity } from "./section-identity";
import { SectionLocation, missingLevels } from "./section-location";
import { SectionProperty } from "./section-property";
import { SectionTin, type TinView } from "./section-tin";
import { composeFullName, IntendedOwnerFields, splitFullName, type PersonalDraft } from "./step-about-you";
import { franchiseCandidate, franchiseLine } from "./franchise-draft";
import { SectionFranchise } from "./section-franchise";
import { StepBranchesPsf } from "./step-branches-psf";
import { StepDocuments, documentsReady } from "./step-documents";
import { StepPay, feeInstrument, feeLimitProblem } from "./step-pay";
import { StepReview, type ReviewRow } from "./step-review";
import { StepType } from "./step-type";
import { useDraftAutosave } from "./use-draft-autosave";
import { formatRwf } from "./wizard-ui";

/**
 * Business registration (F-S03 / FL01) as ADR-075 A1 decides it, on the real
 * API: the owner presses List Business and walks five steps.
 *
 * FIVE STEPS, after the kind when none arrived: You (the person: the ID, a
 * phone, a home address, and nothing about the business), Business (sections
 * that show in order: the TIN with RRA, who is registering it and the director
 * check, on the helper path the owner, the classification, the location; then
 * branches and PSF), Documents, Review (no agreement, no signature) and Pay, whose first press
 * creates the registration. A residence walks the same five, with its property
 * and UPI in Business. `register-steps.ts` owns the order, the sections and the
 * saving; this component owns the state and the calls.
 *
 * WHAT THE ARTBOARD DRAWS AND THE API CANNOT DO is left out or said plainly,
 * never faked: the code to the company's RRA contact, the bank transfer with
 * its account check, the map pin, and the helper who hands a draft to the owner
 * before anything is created. Each is an owner decision in progress-tracker.md.
 *
 * Nothing here can skip the fee: `POST /registrations/:id/pay` is the only door
 * into `submitted`, and the server owns it. Every answer is checked against the
 * Zod contract the API validates with, so a person is told which field is
 * wrong before a round trip; that is an affordance, never the control.
 */

type Screen =
  /** Opening: what this person already has is being read. */
  | "resume"
  /** More than one registration in flight: which to open. */
  | "pending"
  /** The five steps. */
  | "steps"
  /** The broker's one short form. */
  | "broker"
  | "broker_done"
  /** In review: past payment, not yet open. */
  | "review"
  /** Business in fix mode, for a registration sent back. */
  | "fix";

const IN_FLIGHT: ReadonlySet<OrgRegistrationStatus> = new Set([
  "pending_payment",
  "submitted",
  "tin_verified",
  "field_verified",
  "approved",
  "rejected",
]);

const EMPTY_PERSONAL: PersonalDraft = {
  firstName: "",
  middleName: "",
  lastName: "",
  documentType: "national_id",
  documentNumber: "",
  issuingCountry: "RW",
  gender: "",
  dateOfBirth: "",
  phoneE164: "",
  address: { ...EMPTY_ADDRESS },
};

const KIGALI: Intl.DateTimeFormatOptions = { timeZone: "Africa/Kigali" };

function onDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { ...KIGALI, day: "numeric", month: "short", year: "numeric" });
}

function kindOfSummary(summary: RegistrationSummary): RegistrationKind | null {
  return findRegistrationKind(summary.businessKind) ? (summary.businessKind as RegistrationKind) : null;
}

/**
 * Business opens on the kind chooser: no kind yet, or Other with nothing said
 * about it, because Other is answered by the description under its tile and the
 * chooser is the only place that asks it (a `?kind=other` arrival included).
 */
function opensChooser(kind: RegistrationKind | null, other: string): boolean {
  return kind === null || (kind === "other" && other.trim() === "");
}

export default function RegisterWizard({
  initialKind = null,
  user,
  demo,
  feeMode = "unknown",
  feeNetworks = ["mtn_momo", "airtel_money"],
  feeMaxRwf = null,
}: {
  initialKind?: RegistrationKind | null;
  /** The session the gate resolved. */
  user: SessionUser | null;
  /** The API said it is the demo, so the header says the data is sample data. */
  demo: boolean;
  /** How the fee is taken on this stack, from `/platform` (073-gtbank-payments AC-17). */
  feeMode?: RegistrationFeeMode;
  /** The networks a fee prompt may go to. */
  feeNetworks?: MobileMoneyNetwork[];
  /** The bank's collection limit, from `/platform` (073-gtbank-payments AC-23). */
  feeMaxRwf?: number | null;
}) {
  const arrivalKind = initialKind;

  const [screen, setScreen] = useState<Screen>("resume");
  const [step, setStep] = useState<StepId>("business");
  const [kind, setKind] = useState<RegistrationKind | null>(arrivalKind);
  /** Business is showing the kind chooser: no kind yet, Other not yet described, or Change was pressed. */
  const [choosingKind, setChoosingKind] = useState(() => opensChooser(arrivalKind, ""));
  /**
   * A saved draft of ANOTHER kind was reopened instead of the kind this person arrived with: the kind it was
   * saved as, said above the step until they carry on with it or deliberately start over.
   */
  const [heldDraft, setHeldDraft] = useState<RegistrationKind | null>(null);
  const [capacity, setCapacity] = useState<RegistrantCapacity>("owner");
  const [capPick, setCapPick] = useState<RegistrantCapacity>("owner");
  const [intendedOwner, setIntendedOwner] = useState({ name: "", nationalId: "", email: "" });
  const [personal, setPersonal] = useState<PersonalDraft>(EMPTY_PERSONAL);
  const [business, setBusiness] = useState<BusinessDraft>(() => ({
    ...EMPTY_BUSINESS,
    ...(arrivalKind
      ? {
          accommodationClass: registrationForKind(arrivalKind).accommodationClass ?? "",
          accommodationClassOther: registrationForKind(arrivalKind).accommodationClassOther ?? "",
        }
      : {}),
  }));
  const [branches, setBranches] = useState<BranchDraft[]>([]);
  const [docs, setDocs] = useState<DocumentDraft[]>([]);
  const [psf, setPsf] = useState<PsfDraft>(EMPTY_PSF);
  const [tiers, setTiers] = useState<PsfTier[] | null>(null);
  const [tiersFailed, setTiersFailed] = useState(false);
  const [tierRetry, setTierRetry] = useState(0);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [identity, setIdentity] = useState<IdentityStatus | null>(null);
  const [quote, setQuote] = useState<RegistrationFeeQuote | null>(null);
  const [summary, setSummary] = useState<RegistrationSummary | null>(null);
  const [broker, setBroker] = useState<BrokerRegistrationSummary | null>(null);
  /** The broker's details checked: the district and the fee come next (2026-10-25). */
  const [brokerDetailsOk, setBrokerDetailsOk] = useState(false);
  const [pending, setPending] = useState<LabelledWorkspace[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  // --- paying the fee (073-gtbank-payments AC-17) ---
  const [payPhone, setPayPhone] = useState("");
  const [payProblem, setPayProblem] = useState<string | null>(null);
  /** The press waiting on the registrant's phone. */
  const [feeAttempt, setFeeAttempt] = useState<RegistrationFeeAttemptStatus | null>(null);
  /** Why the last press ended without paying, as the server said it. */
  const [feeEnded, setFeeEnded] = useState<string | null>(null);
  /** One token per press, kept across retries of that press so a retry never prompts twice. */
  const payToken = useRef<string | null>(null);
  const [exiting, setExiting] = useState(false);
  /** Where saving starts, once the wizard has opened on its answers (ADR-075 S9). */
  const [saveStart, setSaveStart] = useState<{ savedAt: string | null; push: boolean } | null>(null);
  /** A draft just reopened: moved back, once, to the first step still owing an answer. */
  const clampOnResume = useRef(false);
  /** The steps this person has opened, which is what the rail ticks and unlocks. */
  const [visited, setVisited] = useState<ReadonlySet<StepId>>(() => new Set());
  const online = useOnline();
  const userId = user?.id ?? null;

  // Business's and You's sections: what has been answered and confirmed.
  const [tinCheck, setTinCheck] = useState<TinCheck>(null);
  const [tinChecking, setTinChecking] = useState(false);
  const [carryOnPending, setCarryOnPending] = useState(false);
  const [tinConfirmed, setTinConfirmed] = useState(false);
  const [idConfirmed, setIdConfirmed] = useState(false);
  const [intendedConfirmed, setIntendedConfirmed] = useState(false);
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const [locSaved, setLocSaved] = useState(false);
  const [frConfirmed, setFrConfirmed] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Review was walked: its answers held against the contract and Continue pressed.
  const [reviewed, setReviewed] = useState(false);
  // Pay: "I understand the registration fee is not refundable."
  const [understood, setUnderstood] = useState(false);

  const role = kind ? registrationForKind(kind).role : null;
  const path: RegisterPath = pathFor(role, capacity);
  const order = stepOrder();
  // Scanned and checked, or typed for PSF to check (ADR-075 S4): either way the server keeps the document.
  const identityOnFile = identity?.onFile ?? null;

  const tin = normalizeTin(business.tin);
  const verdict = tinCheck?.tin === tin ? tinCheck.verdict : null;
  const registry = verdict?.result === "verified" ? verdict.business : null;
  const isDirector = verdict?.registrantIsDirector ?? null;
  const nameDiffers = registry !== null && business.legalName.trim() !== "" && !sameName(business.legalName, registry.legalName);
  const legalName = registry && !nameDiffers ? registry.legalName : business.legalName.trim();

  const openPending = useCallback(async (orgId: string): Promise<boolean> => {
    setBusy(true);
    const res = await fetchRegistration(orgId);
    setBusy(false);
    if (res.status !== "ok") {
      setFormError(apiResultMessage(res));
      return false;
    }
    setSummary(res.data);
    setKind(kindOfSummary(res.data));
    setChoosingKind(false);
    // Where to resume is read from the SERVER, never from this browser: an
    // unpaid registration opens on Pay, anything past payment is In review.
    if (res.data.status === "pending_payment") {
      setScreen("steps");
      setStep("pay");
    } else setScreen("review");
    return true;
  }, []);

  /**
   * Reopen a saved draft where it was left (ADR-075 S9, AC-9): its answers, its
   * step, what was marked done, and the checks the server kept, so a finished
   * TIN check is not asked again (D-m). Only for the TIN still typed: a check
   * counts while the answers still match it.
   */
  function restore(
    saved: WizardAnswers,
    savedKind: RegistrationKind,
    checks: RegistrationDraftChecks,
    stored: MyProfile | null,
    fillVerified: (p: PersonalDraft) => PersonalDraft,
  ) {
    const done = new Set<RegistrationDraftDone>(saved.done);
    setKind(savedKind);
    setChoosingKind(opensChooser(savedKind, saved.business.accommodationClassOther));
    setCapacity(saved.capacity);
    setCapPick(saved.capacity);
    setIntendedOwner(saved.intendedOwner);
    if (saved.typedPersonal) {
      setPersonal(fillVerified(saved.personal));
      // The stored profile was being changed: what was typed over it is kept, not the profile.
      if (stored?.complete) setEditingProfile(true);
    }
    setBusiness(saved.business);
    setBranches(saved.branches);
    setDocs(saved.documents);
    const tinNow = normalizeTin(saved.business.tin);
    const answered = checks.tin && checks.tin.tin === tinNow ? { tin: tinNow, verdict: checks.tin.answer } : null;
    setTinCheck(answered);
    const registered =
      answered?.verdict.result === "verified" && answered.verdict.business ? registryAddressDraft(answered.verdict.business) : null;
    const here = saved.business.address;
    setPrefilled(
      registered !== null &&
        registered.provinceId === here.provinceId &&
        registered.districtId === here.districtId &&
        registered.sectorId === here.sectorId,
    );
    setTinConfirmed(answered !== null && done.has("tin"));
    setCarryOnPending(answered?.verdict.result === "pending" && done.has("tin"));
    setIdConfirmed(done.has("owner") || done.has("id"));
    setIntendedConfirmed(done.has("intended"));
    setLocSaved(done.has("loc"));
    setFrConfirmed(done.has("fr"));
    setUpiConfirmed(done.has("upi"));
    setReviewed(done.has("review"));
    setVisited(new Set(order.slice(0, order.indexOf(saved.reached) + 1)));
    setScreen(savedKind === "broker" ? "broker" : "steps");
    setStep(resumeStep(saved.openStep));
    clampOnResume.current = true;
    // The one answer a draft never keeps on the helper path: the owner's National ID.
    if (saved.capacity === "on_behalf_of" && done.has("intended")) {
      setFormError("Type the owner's National ID again. A saved registration never keeps an ID number.");
    }
  }

  // What this person already has: a draft for a business not yet registered reopens where it was left (ADR-075
  // S9); otherwise a registration in flight opens straight on it, or the first question.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [ws, prof, ident, stored] = await Promise.all([
        fetchMyWorkspaces(),
        fetchMyProfile(),
        fetchIdentity(),
        fetchRegistrationDraft(),
      ]);
      if (cancelled) return;
      if (prof.status === "ok") setProfile(prof.data);
      if (ident.status === "ok") setIdentity(ident.data);
      const verifiedOnFile = ident.status === "ok" ? ident.data.onFile : null;
      const fillVerified = (p: PersonalDraft): PersonalDraft =>
        verifiedOnFile
          ? {
              ...p,
              ...splitFullName(verifiedOnFile.fullName),
              dateOfBirth: verifiedOnFile.dateOfBirth,
              gender: verifiedOnFile.gender ?? p.gender,
              documentType: verifiedOnFile.documentType,
              issuingCountry: verifiedOnFile.issuingCountry,
              phoneE164: p.phoneE164 || (prof.status === "ok" ? (prof.data.phoneE164 ?? "") : ""),
            }
          : p;
      const fromProfile = (p: PersonalDraft): PersonalDraft =>
        prof.status === "ok" && !prof.data.complete ? seedFromPartialProfile(prof.data, p) : p;
      setPersonal((p) => fillVerified(fromProfile(p)));

      // The answers: the server's, or this browser's copy when it holds typing the server has not had (AC-9).
      // Anyone else's copy on this browser goes.
      if (userId) clearDeviceCopies(userId);
      const device = userId ? readDeviceCopy(userId) : null;
      // A read that failed is not "nothing saved": this browser's copy, if any, stands in, and nothing is dropped.
      const read = stored.status === "ok" ? stored.data : null;
      const choice = read
        ? chooseDraft(read, device)
        : { draft: device?.draft ?? null, push: device?.pending ?? false, dropDevice: false };
      const checks = read?.checks ?? {};
      if (choice.dropDevice && userId) clearDeviceCopy(userId);
      const saved = choice.draft
        ? fromServerDraft(choice.draft, { personal: EMPTY_PERSONAL, business: EMPTY_BUSINESS, address: EMPTY_ADDRESS }, newBranchDraft)
        : null;
      const savedKind =
        saved?.kind && findRegistrationKind(saved.kind as RegistrationKind) ? (saved.kind as RegistrationKind) : null;
      // A draft for a business not yet registered reopens, whatever kind this person came for: a saved draft wins
      // over `?kind=`. Opening the arrival kind fresh beside it would have saved over the draft at the first
      // change, with nothing said. When the kinds differ the step says so, and starting over is a press that says
      // what it deletes. One the first Pay press already made into a registration opens on that registration instead.
      if (saved && savedKind !== null && checks.registrationId === undefined) {
        restore(saved, savedKind, checks, prof.status === "ok" ? prof.data : null, fillVerified);
        setSaveStart({ savedAt: read ? read.savedAt : (device?.basedOn ?? null), push: choice.push });
        if (arrivalKind !== null && savedKind !== arrivalKind) setHeldDraft(savedKind);
        return;
      }

      const inFlight =
        ws.status === "ok"
          ? ws.workspaces.filter(
              (w) => w.kind === "business" && w.orgId !== null && w.registrationStatus !== null && IN_FLIGHT.has(w.registrationStatus),
            )
          : [];
      setPending(inFlight);
      if (inFlight.length === 1 && inFlight[0]?.orgId) {
        if (!(await openPending(inFlight[0].orgId)) && !cancelled) setScreen("pending");
        return;
      }
      if (inFlight.length > 1) {
        setScreen("pending");
        return;
      }
      // A fresh start: what it opens on is where saving starts, and nothing is saved behind it yet.
      setScreen(arrivalKind === "broker" ? "broker" : "steps");
      setStep(openingStep());
      setSaveStart({ savedAt: null, push: false });
      if (!read && !device) {
        setFormError("We couldn't read the answers you saved before. If you had started, reload the page before you type.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Once, on mount. The gate renders the wizard only for a resolved session.
  }, []);

  useEffect(() => {
    if (screen === "steps") setVisited((v) => (v.has(step) ? v : new Set(v).add(step)));
  }, [step, screen]);

  // Save as you type (ADR-075 S9, AC-9): the answers as they stand, with the step that is open, how far the walk
  // has reached and what is marked done, while a business not yet registered is walked. Once the registration
  // exists nothing is saved from here: the first Pay press marked the draft with it, and its fee clears it.
  const reachedIndex = order.reduce((at, id, i) => (visited.has(id) || id === step ? i : at), 0);
  const marks: [boolean, RegistrationDraftDone][] = [
    [tinConfirmed, "tin"],
    [idConfirmed, path === "owner" ? "owner" : "id"],
    [intendedConfirmed, "intended"],
    [locSaved, "loc"],
    [frConfirmed, "fr"],
    [upiConfirmed, "upi"],
    [reviewed, "review"],
  ];
  const draftNow =
    screen === "steps" && summary === null && kind !== null && kind !== "broker" && saveStart !== null
      ? toServerDraft({
          openStep: step,
          reached: order[reachedIndex] ?? step,
          done: marks.filter(([on]) => on).map(([, mark]) => mark),
          kind,
          capacity,
          typedPersonal: !(profile?.complete === true && !editingProfile),
          personal,
          intendedOwner,
          business,
          branches,
          documents: docs,
        })
      : null;
  const autosave = useDraftAutosave({ userId, draft: draftNow, start: saveStart });

  // The fee, by kind (ADR-075 AC-13): 50,000 RWF for every business PSF reviews.
  useEffect(() => {
    if (kind === null || kind === "broker") {
      setQuote(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchRegistrationFee(registrationForKind(kind).businessKind);
      if (!cancelled) setQuote(res.status === "ok" ? res.data : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);
  const fee = resolveRegistrationFee({ summary, quote });

  // PSF's tiers, read once the step that offers them is reached.
  useEffect(() => {
    if (step !== "business" || tiers !== null || tiersFailed) return;
    let cancelled = false;
    void fetchPsfTiers().then((res) => {
      if (cancelled) return;
      if (res.status === "ok") setTiers(res.data);
      else setTiersFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [step, tiers, tiersFailed, tierRetry]);

  const locLine = useAddressLine(business.address);

  // --- the kind ---------------------------------------------------------------
  const chooseKind = (next: RegistrationKind) => {
    const before = kind ? registrationForKind(kind).role : null;
    const derived = registrationForKind(next);
    setKind(next);
    // Every tile is answered by its press but Other, whose answer is the description under it: the chooser stays
    // open on Other until that is given and Next pressed.
    setChoosingKind(next === "other");
    setErrors({});
    setFormError("");
    // A changed register (RRA for a TIN, the land register for a UPI) starts
    // Business's sections over.
    if (before !== derived.role) {
      setTinCheck(null);
      setTinConfirmed(false);
      setUpiConfirmed(false);
      setLocSaved(false);
      setCapacity("owner");
      setCapPick("owner");
    }
    setBusiness((b) => ({
      ...b,
      accommodationClass: derived.accommodationClass ?? "",
      // What Other was described as is kept through a press on another tile, so coming back to Other finds it.
      // Only Other sends it (`businessCandidate`).
      accommodationClassOther: derived.accommodationClassOther ?? b.accommodationClassOther,
    }));
  };
  /** Other is described: the chooser closes on Business's sections, as a press on any other tile does. */
  const otherDescribed = () => {
    if (kind !== "other" || business.accommodationClassOther.trim() === "") return;
    setErrors({});
    setChoosingKind(false);
  };
  const changeKind = () => {
    setChoosingKind(true);
    setFormError("");
    setScreen("steps");
    setStep(youDone ? "business" : "you");
  };

  // --- Business: the TIN ---------------------------------------------------------
  async function validateTin() {
    if (!/^\d{9}$/.test(tin)) return;
    setTinChecking(true);
    setCarryOnPending(false);
    const res = await checkTin(tin, capPick);
    setTinChecking(false);
    if (res.status !== "ok") {
      // No answer at all reads as RRA being down: never a refusal, because the
      // check after payment still runs.
      setTinCheck({
        tin,
        verdict: {
          tin,
          result: "pending",
          message: "We could not reach RRA just now.",
          business: null,
          registrantIsDirector: null,
        },
      });
      return;
    }
    setTinCheck({ tin, verdict: res.data });
    const found = res.data.result === "verified" ? res.data.business : null;
    if (found) {
      const registered = registryAddressDraft(found);
      setBusiness((b) => ({
        ...b,
        legalName: b.legalName.trim() ? b.legalName : found.legalName,
        address: registered ?? b.address,
      }));
      setPrefilled(Boolean(registered));
      setLocSaved(false);
      if (res.data.registrantIsDirector === false) setCapPick("on_behalf_of");
    }
  }

  /** The TIN is being changed: drop what the old answer filled in. */
  const changeTin = (raw: string) => {
    setBusiness((b) => ({
      ...b,
      tin: raw,
      ...(registry && sameName(b.legalName, registry.legalName) ? { legalName: "", address: { ...EMPTY_ADDRESS } } : {}),
    }));
    if (tinCheck) setTinCheck(null);
    setTinConfirmed(false);
    setCarryOnPending(false);
    setPrefilled(false);
    setLocSaved(false);
  };

  const confirmTin = () => {
    setErrors({});
    if (!registry && legalName.length < 2) {
      setErrors({ "business.legalName": "Give the registered name of the business." });
      return;
    }
    setCapacity(capPick);
    setTinConfirmed(true);
    if (capPick === "on_behalf_of") void nameTheOwner();
  };

  /**
   * The helper picks the owner from RRA's directors, which come by name only to
   * the helper's capacity (ADR-075 AC-7): asked again when the answer on hand
   * was given to an owner.
   */
  const nameTheOwner = async () => {
    let directors = registry?.directors ?? [];
    if (/^\d{9}$/.test(tin) && directors.length === 0) {
      const named = await checkTin(tin, "on_behalf_of");
      if (named.status === "ok") {
        setTinCheck({ tin, verdict: named.data });
        directors = named.data.result === "verified" ? (named.data.business?.directors ?? []) : [];
      }
    }
    setIntendedOwner((o) => ({ ...o, name: o.name || directors[0]?.name || "" }));
  };

  // --- You: the ID ---------------------------------------------------------------
  /** A scan or typed details changed what is on file: read it, fill the draft from it, and ask RRA again. */
  const onIdentity = useCallback(
    (next?: IdentityStatus) => {
      setErrors({});
      setFormError("");
      void (async () => {
        // Recording an identity rewrote the stored profile (name, birth date, ID), so the one loaded with the
        // page is stale: editing it would send the old name.
        const [res, prof] = await Promise.all([
          next ? Promise.resolve({ status: "ok" as const, data: next }) : fetchIdentity(),
          fetchMyProfile(),
        ]);
        if (prof.status === "ok") setProfile(prof.data);
        if (res.status !== "ok") return;
        setIdentity(res.data);
        const person = res.data.onFile;
        if (!person) return;
        setPersonal((p) => ({
          ...p,
          ...splitFullName(person.fullName),
          dateOfBirth: person.dateOfBirth,
          gender: person.gender ?? p.gender,
          documentType: person.documentType,
          // The server holds the number now; the browser never keeps it.
          documentNumber: "",
          issuingCountry: person.issuingCountry,
        }));
        // Whether this ID is one of the directors is RRA's answer to the TIN asked by a caller with an ID on
        // file, so the TIN is asked again now. The server matches again at creation (AC-7).
        if (tinCheck && /^\d{9}$/.test(tinCheck.tin)) {
          const again = await checkTin(tinCheck.tin, capacity);
          if (again.status === "ok") setTinCheck({ tin: tinCheck.tin, verdict: again.data });
        }
      })();
    },
    [tinCheck, capacity],
  );

  const confirmId = () => {
    setErrors({});
    if (!(profile?.complete === true && !editingProfile)) {
      const parsed = PersonalDetails.safeParse(personalCandidate(personal, identityOnFile !== null));
      if (!parsed.success) {
        const found = issuesToErrors(parsed.error.issues);
        setErrors(found);
        // Some fields (the date of birth read off the ID) have no input on this step, so say it here too.
        setFormError(Object.values(found)[0] ?? "Check your details.");
        return;
      }
    }
    setFormError("");
    setIdConfirmed(true);
  };

  /** A complete profile on file, opened to change the phone or the home address. */
  const editStoredProfile = () => {
    setEditingProfile(true);
    setIdConfirmed(false);
    setPersonal((p) => (profile ? seedFromPartialProfile(profile, p) : p));
  };

  /**
   * Franchise (ADR-075 AC-8): No, or an answer the contract accepts. A business
   * that is not a franchisee keeps no franchise agreement, so one uploaded
   * before the answer changed leaves the documents with it.
   */
  const confirmFranchise = () => {
    setErrors({});
    if (business.franchiseRole === "") return;
    if (business.franchiseRole !== "none") {
      const parsed = FranchiseDeclaration.safeParse(franchiseCandidate(business));
      if (!parsed.success) {
        setErrors(prefix("business.franchise", issuesToErrors(parsed.error.issues)));
        return;
      }
    }
    if (business.franchiseRole !== "franchisee") setDocs((d) => d.filter((doc) => doc.kind !== "franchise_agreement"));
    setFrConfirmed(true);
  };

  const prepareForOwner = () => {
    setCapacity("on_behalf_of");
    setCapPick("on_behalf_of");
    setTinConfirmed(true);
    void nameTheOwner();
  };

  const confirmIntended = () => {
    const parsed = IntendedOwner.safeParse(intendedOwner);
    if (!parsed.success) {
      setErrors(prefix("intendedOwner", issuesToErrors(parsed.error.issues)));
      return;
    }
    setErrors({});
    setIntendedConfirmed(true);
  };

  // --- section and step completeness ----------------------------------------
  const personalOk =
    profile?.complete === true && !editingProfile
      ? true
      : PersonalDetails.safeParse(personalCandidate(personal, identityOnFile !== null)).success;
  const identityOk = identityOnFile !== null && personalOk && idConfirmed;
  const satisfied = (id: SectionId): boolean => {
    switch (id) {
      case "tin":
        return (
          tinConfirmed &&
          ((verdict?.result === "verified" && !nameDiffers) || (verdict?.result === "pending" && carryOnPending)) &&
          legalName.length >= 2 &&
          // The owner must be one of RRA's directors; someone who is not registers it for the owner.
          !(capacity === "owner" && isDirector === false)
        );
      case "id":
        return identityOk;
      case "intended":
        return intendedConfirmed && IntendedOwner.safeParse(intendedOwner).success;
      case "cls":
        return true;
      case "loc":
        return locSaved && missingLevels(business.address).length === 0;
      case "fr":
        return (
          frConfirmed &&
          (business.franchiseRole === "none" ||
            (business.franchiseRole !== "" && FranchiseDeclaration.safeParse(franchiseCandidate(business)).success))
        );
      case "upi":
        return upiConfirmed && business.legalName.trim().length >= 2 && upiError(business.upi) === null;
    }
  };
  const bizSections = sectionOrder(path, "business");
  const youSections = sectionOrder(path, "you");
  const { states: bizState, allDone: businessDone } = sectionStates(bizSections, satisfied);
  const { states: youState, allDone: youDone } = sectionStates(youSections, satisfied);
  const sectionState: Record<string, string> = { ...bizState, ...youState };

  const onFile = documentOnFileFor(identity, profile);
  /** The ID line PSF's form shows, saying where the number comes from. */
  const documentOnFile = onFile ? `${onFile.label}, ${onFile.source === "checked" ? "already checked" : "on your account"}` : null;
  const psfReady =
    path === "landlord" ||
    (business.psfMember === true
      ? !business.psfMembershipNumber.trim() || looksLikePsfNumber(business.psfMembershipNumber)
      : business.psfMember !== false) ||
    business.psfApply !== true ||
    PsfApplicationInput.safeParse(psfCandidate(psf, documentOnFile !== null)).success;
  // The rows Documents asks for, by the kind the org will carry (ADR-075 S5).
  const documentKind: BusinessKind | null = kind && kind !== "broker" ? registrationForKind(kind).businessKind : null;
  const docsState = documentsReady(documentKind, docs);
  const paid = summary !== null && summary.status !== "pending_payment";
  const kindOk =
    kind !== null && kind !== "broker" && !choosingKind && (kind !== "other" || business.accommodationClassOther.trim() !== "");

  const complete = (id: StepId): boolean => {
    if (summary !== null) return id === "pay" ? paid : true;
    switch (id) {
      case "business":
        return kindOk && businessDone && psfReady;
      case "you":
        return youDone;
      case "documents":
        return docsState.ok;
      case "review":
        return reviewed;
      case "pay":
        return paid;
    }
  };
  const openable = openableThrough(order, complete);
  // Checked once, after a reopened draft's answers are on screen (ADR-075 S9).
  useEffect(() => {
    if (!clampOnResume.current || screen !== "steps") return;
    clampOnResume.current = false;
    setStep((at) => clampToOpenable(order, at, openable));
  }, [screen, openable, order]);

  /** Every answer against the contract, before the overview is shown. */
  const requestCandidate = () => {
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    return {
      role,
      capacity,
      ...(sendPersonal ? { personal: personalCandidate(personal, identityOnFile !== null) } : {}),
      business: businessCandidate(business, role, kind, legalName, docs, branches, psf, documentOnFile !== null),
      ...(capacity === "on_behalf_of"
        ? {
            intendedOwner: {
              name: intendedOwner.name.trim(),
              nationalId: intendedOwner.nationalId,
              email: intendedOwner.email.trim(),
            },
          }
        : {}),
    };
  };

  /** Where an issue at `key` is answered, so a refusal sends the person there. */
  const stepForIssue = (key: string): StepId => {
    if (key.startsWith("business.certificates")) return "documents";
    if (key.startsWith("personal")) return "you";
    return "business";
  };

  const goTo = (to: StepId) => {
    setFormError("");
    setStep(to);
  };

  // --- moving on ---------------------------------------------------------------
  const next = () => {
    setErrors({});
    setFormError("");
    const i = order.indexOf(step);
    if (step === "business" && !psfReady) {
      const parsed = PsfApplicationInput.safeParse(psfCandidate(psf, documentOnFile !== null));
      if (!parsed.success) setErrors(prefix("psf", issuesToErrors(parsed.error.issues)));
      setFormError("Some of the PSF application needs fixing.");
      return;
    }
    if (step === "documents" || step === "review") {
      const parsed = CreateRegistrationRequest.safeParse(requestCandidate());
      if (!parsed.success) {
        const found = issuesToErrors(parsed.error.issues);
        setErrors(found);
        const first = Object.keys(found)[0] ?? "";
        setStep(stepForIssue(first));
        setFormError(`Something needs fixing first: ${Object.values(found)[0] ?? "check your answers"}`);
        return;
      }
      if (step === "review") setReviewed(true);
    }
    const to = order[i + 1];
    if (to) setStep(to);
  };

  const createFromAnswers = async (idempotencyKey: string): Promise<ApiResult<RegistrationSummary> | null> => {
    if (!role) return null;
    const parsed = CreateRegistrationRequest.safeParse(requestCandidate());
    if (!parsed.success) {
      const found = issuesToErrors(parsed.error.issues);
      setErrors(found);
      setFormError(`Something needs fixing: ${Object.values(found)[0] ?? "check your answers"}. Use Edit on Review to go back to it.`);
      return null;
    }
    return createRegistration(parsed.data, idempotencyKey);
  };

  /**
   * Pay (ADR-075 D-l): the first press creates the registration from the
   * answers, then pays. The `Idempotency-Key` is minted HERE, once per press,
   * never inside a retry, so a double press or a retry lands on the one
   * registration this press created (AC-14). A press after a failed payment
   * finds the registration already made and only pays. Paying is a mobile money
   * Request to Pay (073-gtbank-payments AC-16, AC-17): settled at once when the
   * fee is free here, otherwise an attempt the pay step polls.
   */
  const payNow = async () => {
    setFormError("");
    setPayProblem(null);
    // The number is read before anything is created, so a press that cannot be charged creates nothing
    // (073-gtbank-payments AC-23). The token is one per press, kept across retries of that press, so a retry never
    // prompts twice.
    let body: RegistrationPayRequest = {};
    if (feeMode !== "free") {
      const chosen = feeInstrument(payPhone, feeNetworks, feeMaxRwf, fee);
      if (!chosen.instrument) {
        setPayProblem(chosen.problem);
        return;
      }
      payToken.current ??= crypto.randomUUID();
      body = { attemptToken: payToken.current, instrument: chosen.instrument };
    }
    setBusy(true);
    try {
      let current = summary;
      if (!current) {
        // The draft stays the answers' editable source until the fee settles (D-l), so it holds the last of them.
        await autosave.flush();
        const created = await createFromAnswers(crypto.randomUUID());
        if (created === null) return;
        if (created.status !== "ok") {
          if (created.status === "refused" && created.issues) {
            const found = refusalToErrors(created.issues);
            setErrors(found);
            const first = Object.keys(found)[0];
            if (first) setStep(stepForIssue(first));
          }
          setFormError(apiResultMessage(created));
          return;
        }
        current = created.data;
        setSummary(current);
      }
      if (current.status !== "pending_payment") {
        if (userId) clearDeviceCopy(userId);
        setScreen("review");
        return;
      }
      const res = await payRegistrationFee(current.orgId, body);
      if (res.status !== "ok") {
        // The token is kept: pressing again is the same press, so the server replays it rather than prompting a
        // second time.
        setFormError(apiResultMessage(res));
        return;
      }
      if (res.data.kind === "settled") {
        payToken.current = null;
        // Submitted: the server cleared its draft as the fee settled (D-m), and this browser's copy goes too (AC-9).
        if (res.data.registration.status !== "pending_payment" && userId) clearDeviceCopy(userId);
        setSummary(res.data.registration);
        return;
      }
      takeFeeAttempt(res.data.attempt);
    } finally {
      setBusy(false);
    }
  };

  /** A fee press reached an answer the wizard can show. */
  const takeFeeAttempt = (attempt: RegistrationFeeAttemptStatus) => {
    setSummary(attempt.registration);
    // Submitted: the server cleared its draft as the fee settled (D-m), and this browser's copy goes too (AC-9).
    if (attempt.registration.status !== "pending_payment" && userId) clearDeviceCopy(userId);
    if (attempt.state === "prompting") {
      setFeeAttempt(attempt);
      setFeeEnded(null);
      return;
    }
    // Final either way: the next press is a new press, with a new token.
    payToken.current = null;
    setFeeAttempt(null);
    setFeeEnded(attempt.state === "confirmed" ? null : (attempt.failureReason ?? "The payment did not go through."));
  };

  // --- broker ------------------------------------------------------------------
  /** Step 1 of the broker form: the person's details, checked before the district and the fee. */
  const checkBrokerDetails = () => {
    setErrors({});
    setFormError("");
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    if (sendPersonal) {
      const parsed = PersonalDetails.safeParse(personalCandidate(personal, identityOnFile !== null));
      if (!parsed.success) {
        setErrors(issuesToErrors(parsed.error.issues));
        setFormError("Some of your details need fixing.");
        setBrokerDetailsOk(false);
        return;
      }
    }
    setBrokerDetailsOk(true);
  };

  const submitBroker = async (homeDistrictId: number, feePaymentId: string) => {
    setErrors({});
    setFormError("");
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    if (sendPersonal) {
      const parsed = PersonalDetails.safeParse(personalCandidate(personal, identityOnFile !== null));
      if (!parsed.success) {
        setErrors(issuesToErrors(parsed.error.issues));
        setFormError("Some of your details need fixing.");
        setBrokerDetailsOk(false);
        return;
      }
    }
    setBusy(true);
    const res = await registerAsBroker({
      ...(sendPersonal ? { personal: PersonalDetails.parse(personalCandidate(personal, identityOnFile !== null)) } : {}),
      homeDistrictId,
      feePaymentId,
    });
    setBusy(false);
    if (res.status !== "ok") {
      setFormError(apiResultMessage(res));
      return;
    }
    setBroker(res.data);
    setScreen("broker_done");
  };

  // --- in review -----------------------------------------------------------------
  const resubmit = async () => {
    if (!summary) return;
    setBusy(true);
    setFormError("");
    const res = await resubmitRegistration(summary.orgId);
    setBusy(false);
    if (res.status !== "ok") {
      setFormError(apiResultMessage(res));
      return;
    }
    setSummary(res.data);
    setScreen("review");
  };

  /**
   * A fresh registration, beside whatever is already in flight, or in place of a
   * saved draft of another kind the person chose to start over from. It starts
   * from nothing saved: the draft, its checks and this browser's copy go first,
   * so nothing of the last business is carried into it.
   */
  const startNew = async () => {
    setHeldDraft(null);
    await clearRegistrationDraft();
    if (userId) clearDeviceCopy(userId);
    autosave.reset();
    setVisited(new Set());
    setSummary(null);
    setReviewed(false);
    setUnderstood(false);
    setErrors({});
    setFormError("");
    setTinCheck(null);
    setTinConfirmed(false);
    setIdConfirmed(false);
    setIntendedConfirmed(false);
    setUpiConfirmed(false);
    setLocSaved(false);
    setFrConfirmed(false);
    setPrefilled(false);
    setCarryOnPending(false);
    setDocs([]);
    setBranches([]);
    setPsf(EMPTY_PSF);
    setCapacity("owner");
    setCapPick("owner");
    setIntendedOwner({ name: "", nationalId: "", email: "" });
    const derived = arrivalKind ? registrationForKind(arrivalKind) : null;
    setBusiness({
      ...EMPTY_BUSINESS,
      accommodationClass: derived?.accommodationClass ?? "",
      accommodationClassOther: derived?.accommodationClassOther ?? "",
    });
    setKind(arrivalKind);
    setChoosingKind(opensChooser(arrivalKind, ""));
    setScreen(arrivalKind === "broker" ? "broker" : "steps");
    setStep(openingStep());
  };

  const saveAndExit = async () => {
    setExiting(true);
    if (draftNow) await autosave.flush();
    window.location.assign("/start");
  };

  /** "Apply now": what the wizard already knows goes into PSF's form. */
  const seedPsf = () => {
    const verifiedPerson = identity?.onFile ?? null;
    const names = verifiedPerson ? splitFullName(verifiedPerson.fullName) : personal;
    setPsf((p) => ({
      ...p,
      // The tier is the person's choice: the first in PSF's list is its dearest.
      companyName: p.companyName || legalName,
      streetAddress: p.streetAddress || business.address.street.trim() || locLine || "",
      companyType: registry?.companyType ?? p.companyType,
      firstName: p.firstName || names.firstName,
      lastName: p.lastName || [names.middleName, names.lastName].filter(Boolean).join(" "),
      gender: p.gender || (personal.gender === "male" || personal.gender === "female" ? personal.gender : ""),
      phoneE164: p.phoneE164 || personal.phoneE164 || profile?.phoneE164 || "",
      email: p.email || user?.email || "",
      dateOfBirth: p.dateOfBirth || verifiedPerson?.dateOfBirth || personal.dateOfBirth || profile?.dateOfBirth || "",
    }));
  };

  // --- render ------------------------------------------------------------------
  const kindEntry = kind ? (REGISTRATION_KINDS.find((k) => k.value === kind) ?? null) : null;
  const summaryKindLabel = summary?.businessKind ? BUSINESS_KIND_LABEL[summary.businessKind] : null;
  const kindLabel = kindEntry?.label ?? summaryKindLabel ?? "business";
  // Mid sentence, with its article: "Registration fee for an apartment".
  const kindPhrase = kindInSentence(summary?.businessKind ?? documentKind);
  const landlord = path === "landlord";

  const verifiedName = identity?.onFile?.fullName ?? null;
  const registrantName =
    profile?.complete === true && !editingProfile
      ? (profile.fullName ?? composeFullName(personal))
      : (verifiedName ?? composeFullName(personal));
  const idLine = onFile?.label ?? (personal.documentNumber ? `National ID ${formatNationalId(personal.documentNumber)}` : null);
  // "Checked" only after a machine check passed; otherwise PSF checks it (AC-6).
  const checkedBy = identityOnFile ? (identityOnFile.checked ? "Checked" : "PSF will check your ID") : null;

  const businessNamed = summary?.legalName ?? (landlord ? (upiConfirmed ? business.legalName.trim() : "") : registry && tinConfirmed ? legalName : "");
  // One h1 that names the type, and the business's name as one line under it once RRA has returned it (AC-2).
  const headingKind = summary?.businessKind ?? (kind && kind !== "broker" && !choosingKind ? registrationForKind(kind).businessKind : null);
  const heading = {
    title: headingKind ? registerHeadingFor(headingKind) : "List your business",
    sub: businessNamed || null,
  };

  const SECTION_TITLE: Record<SectionId, string> = {
    tin: "Business name and TIN",
    id: "Your identity",
    intended: "The owner",
    cls: "Classification",
    loc: "Location",
    fr: "Franchise",
    upi: "The property",
  };
  const entityGroup = kind ? registrationForKind(kind).entityGroup : null;
  const sectionSummary = (id: SectionId): string => {
    switch (id) {
      case "tin":
        return `${legalName || "Not named"} · TIN ${formatTin(tin)} · ${
          capacity === "owner" ? (isDirector ? "you're listed as a director" : "you own or direct it") : "you register it for the owner"
        }`;
      case "id":
        return [registrantName || "You", idLine].filter(Boolean).join(" · ");
      case "intended":
        return `${intendedOwner.name.trim()} · ${intendedOwner.email.trim()} · claims it after approval`;
      case "cls":
        return kind === "other"
          ? `Other: ${business.accommodationClassOther.trim()}. An officer picks the closest RDB class.`
          : `${kindLabel}, in RDB's ${entityGroup === "restaurant_bar_nightclub" ? "restaurant, bar and nightclub" : "accommodation"} group. No licence number needed.`;
      case "loc":
        return locLine ?? "Saved";
      case "fr":
        return franchiseLine(business);
      case "upi":
        return `${business.legalName.trim()} · UPI ${business.upi.trim()}`;
    }
  };
  const sectionChecked = (id: SectionId): string | null => {
    if (id === "tin") return verdict?.result === "verified" ? "Checked by RRA" : null;
    if (id === "id") return checkedBy;
    if (id === "upi") return "Format checked";
    return null;
  };
  const editSection = (id: SectionId) => {
    setFormError("");
    if (id === "tin") {
      setTinCheck(null);
      setTinConfirmed(false);
      setCarryOnPending(false);
    } else if (id === "id") setIdConfirmed(false);
    else if (id === "intended") setIntendedConfirmed(false);
    else if (id === "loc") setLocSaved(false);
    else if (id === "fr") setFrConfirmed(false);
    else if (id === "upi") setUpiConfirmed(false);
    else if (id === "cls") changeKind();
  };

  const tinView: TinView = tinChecking ? { kind: "checking" } : verdict ? { kind: "result", verdict } : { kind: "idle" };

  const sectionBody = (id: SectionId): ReactNode => {
    switch (id) {
      case "tin":
        return (
          <SectionTin
            typedName={business.legalName}
            onTypedNameChange={(legal) => setBusiness((b) => ({ ...b, legalName: legal }))}
            tin={business.tin}
            onTinChange={changeTin}
            view={tinView}
            carryOnPending={carryOnPending}
            capPick={capPick}
            onCapPick={setCapPick}
            onValidate={() => void validateTin()}
            onUseRraName={() => registry && setBusiness((b) => ({ ...b, legalName: registry.legalName }))}
            onCheckAnother={() => changeTin("")}
            onCarryOn={() => setCarryOnPending(true)}
            onAskInjishi={() => {
              if (!openAssistant()) window.location.assign("/help");
            }}
            isDirector={isDirector}
            onPrepareForOwner={prepareForOwner}
            onNext={confirmTin}
            error={errors["business.legalName"] ?? errors["business.tin"]}
            online={online}
          />
        );
      case "id":
        return (
          <SectionIdentity
            identity={identity}
            profileComplete={profile?.complete === true && !editingProfile}
            draft={personal}
            onDraftChange={setPersonal}
            onIdentity={onIdentity}
            needsExtras={!personalOk}
            errors={errors}
            onEditProfile={editStoredProfile}
            onNext={confirmId}
            online={online}
          />
        );
      case "intended":
        return (
          <>
            <p className="text-sm">
              The owner claims the business with this National ID once PSF approves it, so it has to be one of
              RRA&apos;s directors for this TIN. The claim link goes to their email.
            </p>
            <IntendedOwnerFields title="Who owns it" value={intendedOwner} onChange={setIntendedOwner} errors={errors} />
            <div>
              <Button onClick={confirmIntended}>Next</Button>
            </div>
          </>
        );
      case "loc":
        return (
          <SectionLocation
            address={business.address}
            onChange={(address) => setBusiness((b) => ({ ...b, address }))}
            prefilled={prefilled}
            errors={errors}
            errorPrefix="business.address"
            onSave={() => setLocSaved(true)}
          />
        );
      case "fr":
        return <SectionFranchise draft={business} onChange={setBusiness} errors={errors} onNext={confirmFranchise} />;
      case "upi":
        return (
          <SectionProperty
            draft={business}
            onChange={setBusiness}
            errors={errors}
            onNext={() => {
              setErrors({});
              setUpiConfirmed(true);
            }}
          />
        );
      case "cls":
        return null;
    }
  };

  // Overview rows, in the artboard's order.
  const franchisee = business.franchiseRole === "franchisee";
  const docLabel = (d: DocumentDraft) =>
    documentRows(documentKind, { franchisee }).find((r) => r.kind === d.kind)?.label ?? d.filename;
  const docsText = docs.length
    ? `${docLabel(docs[0]!)}${docs.length > 1 ? ` and ${docs.length - 1} more` : ""}`
    : "None yet";
  const psfText =
    business.psfMember === true
      ? `A member${business.psfMembershipNumber.trim() ? `, number ${business.psfMembershipNumber.trim()}` : ""}`
      : business.psfMember === false
        ? business.psfApply === true
          ? `Applying${tiers?.find((t) => t.code === psf.requestedTierCode)?.nameEn ? `: ${tiers.find((t) => t.code === psf.requestedTierCode)!.nameEn}` : ""}. Filed with this registration`
          : "Not a member, not applying now"
        : "Not answered";
  // Mid sentence: "checked", but PSF and ID keep their capitals.
  const statusInLine = identityOnFile ? (identityOnFile.checked ? "checked" : "PSF will check your ID") : null;
  const youRow = `${registrantName || "You"}${idLine ? `, ${idLine}` : ""}${statusInLine ? `, ${statusInLine}` : ""}`;
  const rows: ReviewRow[] = summary
    ? [{ title: "Registering", value: `${kindLabel} · ${summary.legalName}`, step: null }]
    : landlord
      ? [
          { title: "You", value: youRow, step: "you" },
          { title: "Business type", value: kindLabel, step: "business" },
          { title: "The property", value: `${business.legalName.trim()} · UPI ${business.upi.trim()}`, step: "business" },
          { title: "Location", value: locLine ?? "Not chosen", step: "business" },
          { title: "Documents", value: docsText, step: "documents" },
        ]
      : [
          { title: "You", value: youRow, step: "you" },
          { title: "Business type", value: kindLabel, step: "business" },
          {
            title: "The business",
            value: `${legalName} · TIN ${formatTin(tin)}${verdict?.result === "verified" ? " · checked by RRA" : " · RRA checks it after payment"}${
              path !== "helper" && isDirector ? " · you're listed as a director" : ""
            }`,
            step: "business",
          },
          ...(path === "helper"
            ? [
                {
                  title: "The owner",
                  value: `${intendedOwner.name.trim()} · ${intendedOwner.email.trim()} · claims it after approval`,
                  step: "business" as const,
                },
              ]
            : []),
          { title: "Location", value: locLine ?? "Not chosen", step: "business" },
          { title: "Franchise", value: franchiseLine(business), step: "business" },
          {
            title: "Branches",
            value: branches.length
              ? `${branches.length} ${branches.length === 1 ? "branch" : "branches"}: ${branches.map((b) => b.name).join(", ")}`
              : "None",
            step: "business",
          },
          { title: "PSF", value: psfText, step: "business" },
          { title: "Documents", value: docsText, step: "documents" },
        ];

  // No kind arrived, or Change was pressed: the kind is asked before You and Business, whichever is open.
  const pickingKind = summary === null && (choosingKind || !kind);
  // How this stack checks an ID: a National ID by its number with NIDA, unless that check is off here.
  const idLead =
    identity && identity.nationalIdMode !== "off"
      ? "Check your National ID with NIDA, or scan your passport, then take a selfie."
      : "Scan your ID, then take a selfie.";
  const LEAD: Record<StepId, string> = {
    business: landlord
      ? "Tell us about the property and where it is."
      : path === "helper"
        ? "Check the TIN with RRA, name the owner, then say where the business is. The owner claims it once Injishi approves it."
        : "Check the TIN with RRA, then say where the business is.",
    you:
      path === "helper"
        ? `${idLead} Then name the owner. They claim the business once PSF approves it.`
        : idLead,
    documents: landlord ? "Upload the land title." : "Upload your RDB certificate. The rest are optional.",
    review: "Check your answers. You can change them until you pay.",
    pay: "Pay the registration fee. PSF reviews your registration next.",
  };

  let primary: StepPrimary | null = { label: "Continue", icon: <ArrowRight size={16} aria-hidden />, onPress: next };
  if (pickingKind) {
    // What is actually missing: a kind, Other's description, or the Next under it.
    const why =
      kind === null
        ? "Pick a business type to continue."
        : kind === "other"
          ? business.accommodationClassOther.trim() === ""
            ? "Say what kind of place it is to continue."
            : "Press Next under your description to continue."
          : "Press the business type that fits to continue.";
    primary = { ...primary, disabled: true, why };
  } else if (step === "business") {
    if (!kindOk) {
      primary = { ...primary, disabled: true, why: "Say what kind of place it is to continue." };
    } else if (!businessDone) {
      primary = { ...primary, disabled: true, why: "Finish the sections above to continue." };
    }
  } else if (step === "you" && !youDone) {
    primary = { ...primary, disabled: true, why: "Finish the sections above to continue." };
  } else if (step === "documents" && !docsState.ok) {
    primary = { ...primary, disabled: true, why: docsState.why };
  } else if (step === "review") {
    primary =
      summary !== null
        ? { label: "Continue to pay", icon: <ArrowRight size={16} aria-hidden />, onPress: () => goTo("pay") }
        : {
            label: "Continue to pay",
            icon: <ArrowRight size={16} aria-hidden />,
            onPress: next,
            disabled: fee === null,
            why: fee === null ? "The fee could not be read, so nothing can be paid yet." : undefined,
          };
  } else if (step === "pay") {
    // While a prompt is out, the waiting screen carries its own controls.
    primary =
      paid || feeAttempt?.state === "prompting"
        ? null
        : {
            label: feeMode === "free" ? "Submit for review" : fee === null ? "Pay" : `Pay ${formatRwf(fee)}`,
            icon: <Landmark size={16} aria-hidden />,
            onPress: () => void payNow(),
            pending: busy,
            disabled: !understood || fee === null || !online,
            why: !online ? "You're offline. Connect to pay." : !understood ? "Tick the box to continue." : undefined,
          };
  }

  const stepIndex = Math.max(0, order.indexOf(step));
  // The artboard ticks and opens only what has been reached (`reachedIndex`, above): a step whose answers are
  // all optional is complete before anyone has seen it.
  const rail: RailStep[] = order.map((id, i) => ({
    id,
    title: STEP_TITLE[id],
    status: id === step ? "active" : complete(id) && visited.has(id) ? "complete" : "inactive",
    // Once the registration exists, only what is left to do can be opened.
    locked: summary !== null ? id !== "review" && id !== "pay" : i > Math.min(openable, reachedIndex),
  }));

  let body: ReactNode;
  if (screen === "resume") {
    body = <StepSkeleton />;
  } else if (screen === "pending") {
    body = (
      <PendingList pending={pending} busy={busy} error={formError} onOpen={(orgId) => void openPending(orgId)} onStartNew={startNew} />
    );
  } else if (screen === "review" && summary) {
    body = (
      <InReview
        summary={summary}
        onSummary={setSummary}
        onFix={() => {
          setFormError("");
          setScreen("fix");
        }}
        onStartNew={startNew}
      />
    );
  } else if (screen === "fix" && summary) {
    body = (
      <FixBusiness
        summary={summary}
        busy={busy}
        error={formError}
        onResubmit={() => void resubmit()}
        onBack={() => {
          setFormError("");
          setScreen("review");
        }}
      />
    );
  } else if (screen === "broker_done" && broker) {
    body = <BrokerDone broker={broker} onOwnPlace={changeKind} />;
  } else if (screen === "broker") {
    body = (
      <StepCard
        id="register-broker"
        title="Register as a broker"
        lead="Your ID, the district you work in, and the registration fee. No TIN and no documents."
        footer={
          <Button variant="ghost" onClick={changeKind}>
            Back to business type
          </Button>
        }
      >
        <SectionIdentity
          identity={identity}
          profileComplete={profile?.complete === true && !editingProfile}
          draft={personal}
          onDraftChange={setPersonal}
          onIdentity={onIdentity}
          needsExtras={!personalOk}
          errors={errors}
          onEditProfile={editStoredProfile}
          onNext={checkBrokerDetails}
          hideNext={brokerDetailsOk}
          online={online}
        />
        {brokerDetailsOk ? (
          <BrokerSignup busy={busy} onRegister={(districtId, paymentId) => void submitBroker(districtId, paymentId)} />
        ) : null}
        {formError ? (
          <Callout tone="danger" icon={<CircleAlert size={16} aria-hidden />} title="That did not go through">
            {formError}
          </Callout>
        ) : null}
      </StepCard>
    );
  } else if (screen === "steps") {
    const sectionList = (ids: SectionId[]) => (
      <div className="flex flex-col gap-2.5">
        {/* A section shows once the one before it is done (AC-3): no locked placeholders. */}
        {ids
          .filter((id) => sectionState[id] !== "locked")
          .map((id, i) => (
            <RegisterSection
              key={id}
              id={id}
              n={i + 1}
              title={SECTION_TITLE[id]}
              state={(sectionState[id] as "done" | "open") ?? "open"}
              summary={sectionSummary(id)}
              checkedBy={sectionChecked(id)}
              editText={id === "cls" ? "Change" : "Edit"}
              onEdit={summary === null ? () => editSection(id) : null}
            >
              {sectionBody(id)}
            </RegisterSection>
          ))}
      </div>
    );
    body = (
      <StepFrame
        position={{ n: stepIndex + 1, of: order.length }}
        title={pickingKind ? "What kind of business?" : STEP_TITLE[step]}
        lead={pickingKind ? "Pick the one that fits. It decides the documents we ask for." : LEAD[step]}
        onBack={stepIndex > 0 && !(summary !== null && step === "review") ? () => goTo(order[stepIndex - 1]!) : null}
        primary={primary}
      >
        {formError ? (
          <Callout tone="danger" icon={<CircleAlert size={16} aria-hidden />} title="Something needs your attention">
            {formError}
          </Callout>
        ) : null}
        {heldDraft !== null && arrivalKind !== null && summary === null ? (
          <HeldDraftNotice
            savedAs={kindInSentence(registrationForKind(heldDraft).businessKind)}
            arrivedFor={arrivalKind}
            onStartOver={() => void startNew()}
            onKeep={() => setHeldDraft(null)}
          />
        ) : null}
        {autosave.state === "failed" && autosave.message ? (
          <Callout tone="danger" icon={<CircleAlert size={16} aria-hidden />} title="Your answers are not saved">
            {autosave.message}
          </Callout>
        ) : null}

        {pickingKind ? (
          <StepType
            kind={kind}
            other={business.accommodationClassOther}
            otherError={errors["business.accommodationClassOther"]}
            onChoose={chooseKind}
            onOtherChange={(v) => setBusiness((b) => ({ ...b, accommodationClassOther: v }))}
            onOtherDone={otherDescribed}
          />
        ) : null}

        {step === "business" && !pickingKind ? (
          <>
            {sectionList(bizSections)}
            {!landlord && businessDone ? (
              <StepBranchesPsf
                tinLabel={formatTin(tin)}
                headOffice={business.address}
                branches={branches}
                onBranchesChange={setBranches}
                business={business}
                onBusinessChange={setBusiness}
                psf={psf}
                onPsfChange={setPsf}
                onApplyNow={seedPsf}
                tiers={tiers}
                tiersFailed={tiersFailed}
                onRetryTiers={() => {
                  setTiers(null);
                  setTiersFailed(false);
                  setTierRetry((n) => n + 1);
                }}
                documentLine={documentOnFile}
                errors={errors}
              />
            ) : null}
          </>
        ) : null}

        {step === "you" && !pickingKind ? sectionList(youSections) : null}

        {step === "documents" ? (
          <StepDocuments kind={documentKind} franchisee={franchisee} docs={docs} onDocsChange={setDocs} errors={errors} online={online} />
        ) : null}

        {step === "review" ? (
          <StepReview
            rows={rows}
            locked={summary !== null}
            onEdit={(to) => {
              setReviewed(false);
              goTo(to);
            }}
            kindPhrase={kindPhrase}
            fee={fee}
          />
        ) : null}

        {step === "pay" ? (
          <StepPay
            kindPhrase={kindPhrase}
            fee={fee}
            paid={paid}
            paidOn={onDay(summary?.submittedAt ?? null)}
            understood={understood}
            onUnderstood={setUnderstood}
            onSeeStatus={() => setScreen("review")}
            feeMode={feeMode}
            phone={payPhone}
            onPhone={(next) => {
              setPayPhone(next);
              setPayProblem(null);
            }}
            phoneProblem={payProblem ?? (feeMode === "free" ? null : feeLimitProblem(fee, feeNetworks, feeMaxRwf))}
            networks={feeNetworks}
            orgId={summary?.orgId ?? null}
            attempt={feeAttempt}
            endedReason={feeEnded}
            onSettled={takeFeeAttempt}
            onEnded={takeFeeAttempt}
          />
        ) : null}
      </StepFrame>
    );
  } else {
    body = <StepSkeleton />;
  }

  const walking = screen === "steps" && summary === null;
  return (
    <RegisterShell
      kindLabel={screen === "resume" || screen === "pending" ? null : (kindEntry?.label ?? summaryKindLabel)}
      demo={demo}
      onChangeKind={walking && kind !== null && !choosingKind ? changeKind : undefined}
      carried={walking && kind !== null && !choosingKind}
      heading={screen === "steps" ? heading : null}
      save={
        walking && autosave.state !== "idle"
          ? { state: autosave.state, savedAt: autosave.savedAt, onRetry: autosave.retry }
          : null
      }
      exit={walking ? { label: "Save and exit", onPress: () => void saveAndExit(), busy: exiting } : { label: "Exit", href: "/start" }}
      rail={screen === "steps" ? <RegisterRail steps={rail} onGo={(id) => goTo(id as StepId)} /> : null}
    >
      {body}
    </RegisterShell>
  );
}

// ---------------------------------------------------------------------------
// Screens small enough to live here
// ---------------------------------------------------------------------------

/** Where a broker lands (F-R09): registered and paid, and a way on. */
function BrokerDone({ broker, onOwnPlace }: { broker: BrokerRegistrationSummary; onOwnPlace: () => void }) {
  return (
    <StepCard
      id="register-broker-done"
      chip={
        <Badge variant="success" size="sm">
          Registered
        </Badge>
      }
      title="You are registered as a broker"
      lead={`${broker.name ? `${broker.name}, y` : "Y"}our fee is paid. Open your broker home to see the homes you can offer.`}
      footer={
        <div className="flex flex-wrap gap-2.5">
          <Button asChild>
            <a href="/start">Open your broker home</a>
          </Button>
          <Button variant="ghost" onClick={onOwnPlace}>
            List a place of your own
          </Button>
        </div>
      }
    />
  );
}

/**
 * A saved draft of another kind was reopened rather than overwritten (ADR-075
 * S9): which kind it is, and the two ways on. Starting over deletes it, and the
 * press says so; carrying on keeps it as it was left.
 */
function HeldDraftNotice({
  savedAs,
  arrivedFor,
  onStartOver,
  onKeep,
}: {
  /** "a hotel": the kind the saved draft is for. */
  savedAs: string;
  /** The kind this person arrived with, `?kind=`. */
  arrivedFor: RegistrationKind;
  onStartOver: () => void;
  onKeep: () => void;
}) {
  const instead = arrivedFor === "broker" ? "a broker" : kindInSentence(registrationForKind(arrivedFor).businessKind);
  const goal = arrivedFor === "broker" ? "register as a broker" : `register ${instead}`;
  return (
    <Callout tone="info" icon={<History size={16} aria-hidden />} title="You have a registration in progress">
      <p>
        You started registering {savedAs}, so it is open where you left it. To {goal} instead, start over: that
        deletes the answers you saved.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onStartOver}>
          Start over as {instead}
        </Button>
        <Button variant="ghost" size="sm" onClick={onKeep}>
          Keep going
        </Button>
      </div>
    </Callout>
  );
}

/** More than one registration in flight: open one, or start another. */
function PendingList({
  pending,
  busy,
  error,
  onOpen,
  onStartNew,
}: {
  pending: LabelledWorkspace[];
  busy: boolean;
  error: string;
  onOpen: (orgId: string) => void;
  onStartNew: () => void;
}) {
  return (
    <StepCard
      id="register-pending"
      title="Your registrations"
      lead="Open one to see where it has got to, or register another business."
      footer={
        <Button variant="ghost" onClick={onStartNew}>
          Register another business
        </Button>
      }
    >
      <ul className="flex flex-col gap-2.5">
        {pending.map((w) => (
          <li key={w.workspaceId} className="flex items-center gap-3 rounded-card border border-border p-4">
            <div className="min-w-0 grow">
              <p className="text-sm font-semibold">{w.orgName ?? w.label}</p>
              <p className="text-xs text-muted-foreground">
                {w.registrationStatus === "pending_payment"
                  ? "Waiting for the registration fee."
                  : w.registrationStatus === "rejected"
                    ? "Sent back for one fix."
                    : w.registrationStatus === "approved"
                      ? "Approved, waiting for the owner to claim it."
                      : "In review."}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={busy || w.orgId === null} onClick={() => w.orgId && onOpen(w.orgId)}>
              Open
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <Callout tone="danger" icon={<CircleAlert size={16} aria-hidden />} title="That did not open">
          {error}
        </Callout>
      ) : null}
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Drafts → wire shapes, and Zod issues → per-field messages
// ---------------------------------------------------------------------------

/** The ID on file, as a person reads it, and where it came from; null when none is. */
function documentOnFileFor(
  identity: IdentityStatus | null,
  profile: MyProfile | null,
): { label: string; source: "checked" | "account" } | null {
  const v = identity?.onFile ?? null;
  if (v) {
    return {
      label:
        v.documentType === "passport"
          ? `Passport ${v.documentNumberMasked}`
          : `National ID ending ${v.documentNumberMasked.replace(/\D/g, "")}`,
      source: v.checked ? "checked" : "account",
    };
  }
  if (profile?.document) {
    return {
      label: `${profile.document.documentType === "passport" ? "Passport" : "National ID"} ${profile.document.documentNumberMasked}`,
      source: "account",
    };
  }
  return null;
}

/**
 * The draft holds strings because that is what the DOM produces. The contract
 * wants optionals absent and no empty strings standing in for "not answered".
 * `verified`: an identity is on file, scanned or typed (ADR-075 S4), so no
 * document is sent and the server keeps the one it holds.
 */
function personalCandidate(d: PersonalDraft, verified = false): unknown {
  return {
    // THE ONE PLACE THE THREE NAME BOXES BECOME THE CONTRACT'S ONE FIELD.
    fullName: composeFullName(d),
    ...(verified
      ? {}
      : {
          document:
            d.documentType === "passport"
              ? { documentType: "passport", documentNumber: d.documentNumber, issuingCountry: d.issuingCountry }
              : { documentType: "national_id", documentNumber: d.documentNumber },
        }),
    ...(d.gender ? { gender: d.gender } : {}),
    dateOfBirth: d.dateOfBirth,
    phoneE164: d.phoneE164,
    address: addressFromDraft(d.address),
  };
}

/** The business block: its documents, its branches, and PSF as answered. */
function businessCandidate(
  d: BusinessDraft,
  role: ReturnType<typeof registrationForKind>["role"] | null,
  kind: RegistrationKind | null,
  legalName: string,
  docs: DocumentDraft[],
  branches: BranchDraft[],
  psf: PsfDraft,
  documentOnFile: boolean,
): unknown {
  const address = addressFromDraft(d.address);
  const certificates = docs.map((c) => ({
    kind: c.kind,
    ...(c.kind === "other" ? { kindOther: c.kindOther.trim() } : {}),
    objectKey: c.objectKey,
  }));
  if (role === "landlord") {
    return { domain: "residence", legalName: d.legalName.trim(), residenceClass: d.residenceClass, upi: d.upi, address, certificates };
  }
  const derived = kind ? registrationForKind(kind) : null;
  const entityGroup = derived?.entityGroup ?? "accommodation";
  const member = d.psfMember === true;
  const number = d.psfMembershipNumber.trim();
  // ADR-075 D-h: the kind the org carries. A venue (Bar & Restaurant, Coffee Shop) sends no accommodation class.
  const stay = derived?.accommodationClass != null;
  return {
    domain: "hospitality",
    legalName,
    ...(derived ? { businessKind: derived.businessKind } : {}),
    entityGroup,
    ...(stay ? { accommodationClass: d.accommodationClass } : {}),
    ...(stay && d.accommodationClass === "other" ? { accommodationClassOther: d.accommodationClassOther.trim() } : {}),
    tin: normalizeTin(d.tin),
    // Kept only for a draft from before the licence became a document.
    ...(d.tourismLicenseNumber.trim() ? { tourismLicenseNumber: d.tourismLicenseNumber.trim() } : {}),
    ...(d.eacStarGrade ? { eacStarGrade: Number(d.eacStarGrade) } : {}),
    chamberOfTourismMember: d.chamberOfTourismMember === true,
    psfMember: member,
    ...(member && number ? { psfMembershipNumber: number } : {}),
    ...(d.psfMember === false && d.psfApply === true ? { psfApplication: psfCandidate(psf, documentOnFile) } : {}),
    ...(franchiseCandidate(d) ? { franchise: franchiseCandidate(d) } : {}),
    address,
    certificates,
    branches: branches.map((b) => ({ name: b.name.trim(), address: addressFromDraft(b.address) })),
  };
}

/** What an INCOMPLETE profile already holds, laid over the form, and nothing else. */
function seedFromPartialProfile(profile: MyProfile, current: PersonalDraft): PersonalDraft {
  const a = profile.address;
  return {
    ...current,
    ...(profile.fullName?.trim() ? splitFullName(profile.fullName) : {}),
    ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
    ...(profile.gender ? { gender: profile.gender } : {}),
    ...(profile.phoneE164 ? { phoneE164: profile.phoneE164 } : {}),
    ...(profile.document
      ? { documentType: profile.document.documentType, issuingCountry: profile.document.issuingCountry ?? "RW" }
      : {}),
    ...(a
      ? {
          address: isRwandanAddress(a)
            ? {
                country: "RW",
                provinceId: String(a.provinceId),
                districtId: String(a.districtId),
                sectorId: String(a.sectorId),
                cellId: a.cellId === undefined ? "" : String(a.cellId),
                villageId: a.villageId === undefined ? "" : String(a.villageId),
                street: a.street ?? "",
                addressText: "",
              }
            : { ...EMPTY_ADDRESS, country: a.country, addressText: a.addressText },
        }
      : {}),
  };
}

/** A server refusal's field issues, keyed the way the steps read their errors. */
function refusalToErrors(issues: RefusalIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** One message per field path, so a field can render its own error. */
function issuesToErrors(issues: { path: (string | number | symbol)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Re-key errors from a sub-schema onto the field ids the step renders. */
function prefix(p: string, errors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) out[`${p}.${k}`] = v;
  return out;
}
