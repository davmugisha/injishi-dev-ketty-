"use client";

import {
  ACCOMMODATION_CLASS_LABEL,
  CreateRegistrationRequest,
  IntendedOwner,
  OPERATOR_CONTRACT_VERSION,
  PersonalDetails,
  PsfApplicationInput,
  type BrokerRegistrationSummary,
  type IdentityStatus,
  type MyProfile,
  type OrgRegistrationStatus,
  type PsfTier,
  type RegistrantCapacity,
  type RegistrationFeeQuote,
  type RegistrationSummary,
  type VerifiedPerson,
  businessTypeFor,
  isRwandanAddress,
} from "@injishi/contracts";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CircleAlert, Landmark, PenLine } from "lucide-react";
import { Badge, Button } from "@injishi/ui";

import { openAssistant } from "@/components/assistant/assistant-widget";
import { fetchMyWorkspaces, type LabelledWorkspace } from "@/data/me";
import { fetchIdentity } from "@/data/identity";
import {
  acceptRegistrationContract,
  checkTin,
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
  saveRegistrationDraft,
} from "@/data/registration";
import { apiResultMessage, type ApiResult, type RefusalIssue } from "@/lib/api";
import type { SessionUser } from "@/lib/session";
import { type ContractSignature, type RegistrationContractInput } from "@/lib/registration-contract";
import { formatNationalId } from "@/lib/rwanda-id";
import { upiError } from "@/lib/upi";

import { EMPTY_ADDRESS, addressFromDraft, useAddressLine } from "./address-picker";
import {
  EMPTY_BUSINESS,
  formatTin,
  maskedPhone,
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
  countWord,
  documentRows,
  draftPhaseFor,
  lockedReason,
  openableThrough,
  openingStep,
  pathFor,
  proofStep,
  resumeStep,
  savesOnLeave,
  sectionOrder,
  sectionStates,
  stepOrder,
  type RegisterPath,
  type SectionId,
  type StepId,
} from "./register-steps";
import { fromServerDraft, isDraftPhase, toServerDraft } from "./register-draft";
import { REGISTRATION_KINDS, findRegistrationKind, registrationForKind, type RegistrationKind } from "./registration-kinds";
import { SectionIdentity } from "./section-identity";
import { SectionLocation, missingLevels } from "./section-location";
import { SectionProperty } from "./section-property";
import { SectionTin, type TinView } from "./section-tin";
import type { SignatureCapture } from "./signature-pad";
import { composeFullName, IntendedOwnerFields, splitFullName, type PersonalDraft } from "./step-about-you";
import { StepBranchesPsf } from "./step-branches-psf";
import { downloadSignedContract } from "./step-contract";
import { StepDocuments, documentsReady } from "./step-documents";
import { StepOverview, type ReviewRow } from "./step-overview";
import { StepPay } from "./step-pay";
import { StepType } from "./step-type";
import { formatRwf } from "./wizard-ui";

/**
 * Business registration (F-S03 / FL01) as the Register.dc.html artboard draws
 * it (2026-10-19), on the real API.
 *
 * SIX STEPS: Business type; TIN and licences (sections that unlock in order:
 * the TIN with RRA, your ID and the director check, the classification, the
 * location); Branches and PSF; Documents; Overview, where the agreement is
 * signed and the registration created; Pay. A residence walks five, with
 * Property and owner. `register-steps.ts` owns the order, the sections and the
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
  /** The six steps. */
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

function clock(d: Date): string {
  return d.toLocaleTimeString("en-GB", { ...KIGALI, hour: "2-digit", minute: "2-digit" });
}

function onDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { ...KIGALI, day: "numeric", month: "short", year: "numeric" });
}

function kindOfSummary(summary: RegistrationSummary): RegistrationKind | null {
  if (summary.domain === "residence") return "residence";
  const cls = summary.accommodationClass;
  return cls && findRegistrationKind(cls) ? (cls as RegistrationKind) : null;
}

export default function RegisterWizard({
  initialKind = null,
  user,
  demo,
}: {
  initialKind?: RegistrationKind | null;
  /** The session the gate resolved. */
  user: SessionUser | null;
  /** The API said it is the demo, so the register's SMS code is the published one. */
  demo: boolean;
}) {
  const arrivalKind = initialKind;

  const [screen, setScreen] = useState<Screen>("resume");
  const [step, setStep] = useState<StepId>("type");
  const [kind, setKind] = useState<RegistrationKind | null>(arrivalKind);
  /** The kind is still the one `/host` sent, which keeps Business type out of the rail. */
  const [carried, setCarried] = useState(arrivalKind !== null);
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
  const [phoneFromRegister, setPhoneFromRegister] = useState(false);
  const [quote, setQuote] = useState<RegistrationFeeQuote | null>(null);
  const [summary, setSummary] = useState<RegistrationSummary | null>(null);
  const [broker, setBroker] = useState<BrokerRegistrationSummary | null>(null);
  const [pending, setPending] = useState<LabelledWorkspace[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Step two's sections: what has been answered and confirmed.
  const [tinCheck, setTinCheck] = useState<TinCheck>(null);
  const [tinChecking, setTinChecking] = useState(false);
  const [carryOnPending, setCarryOnPending] = useState(false);
  const [tinConfirmed, setTinConfirmed] = useState(false);
  const [idConfirmed, setIdConfirmed] = useState(false);
  const [intendedConfirmed, setIntendedConfirmed] = useState(false);
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const [locSaved, setLocSaved] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Overview: the drawn mark, and when it was drawn; kept for the signed copy.
  const [signature, setSignature] = useState<SignatureCapture | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signed, setSigned] = useState<ContractSignature | null>(null);

  const role = kind ? registrationForKind(kind).role : null;
  const path: RegisterPath = pathFor(role, capacity);
  const order = stepOrder(path, carried);
  const identityVerified = identity?.kycStatus === "verified";
  const canVerify = Boolean(identity && (identity.available.nationalId || identity.available.passport));
  const storedProfile = profile?.complete === true && !editingProfile;

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
    setCarried(false);
    // Where to resume is read from the SERVER, never from this browser (AC-R8):
    // unpaid opens the agreement if it is unsigned, else Pay; anything past
    // payment is In review.
    if (res.data.status === "pending_payment") {
      setScreen("steps");
      setStep(res.data.contractAcceptedAt === null ? "overview" : "pay");
    } else setScreen("review");
    return true;
  }, []);

  // What this person already has: a registration in flight opens straight on
  // it; otherwise the draft the server kept, or the first question.
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
      const verifiedOnFile = ident.status === "ok" && ident.data.kycStatus === "verified" ? ident.data.verified : null;
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

      // The draft the server kept (ADR-060), unless the person has since
      // arrived from `/host` with a different answer.
      const saved =
        stored.status === "ok" && stored.data
          ? fromServerDraft(stored.data, { personal: EMPTY_PERSONAL, business: EMPTY_BUSINESS, address: EMPTY_ADDRESS }, newBranchDraft)
          : null;
      const savedKind =
        saved?.kind && findRegistrationKind(saved.kind as RegistrationKind) ? (saved.kind as RegistrationKind) : null;
      if (saved && (arrivalKind === null || savedKind === arrivalKind)) {
        const carriedNow = savedKind !== null && savedKind === arrivalKind;
        const savedRole = savedKind ? registrationForKind(savedKind).role : null;
        setKind(savedKind);
        setCarried(carriedNow);
        setCapacity(saved.capacity);
        setCapPick(saved.capacity);
        setIntendedOwner(saved.intendedOwner);
        if (saved.typedPersonal) setPersonal(fillVerified(saved.personal));
        setBusiness(saved.business);
        setBranches(saved.branches);
        setScreen(savedKind === "broker" ? "broker" : "steps");
        setStep(resumeStep(pathFor(savedRole, saved.capacity), savedKind !== null));
        if (savedKind !== null && savedKind !== "broker") {
          setFormError(
            "We kept your answers from before. Checks are never kept in a draft, so validate the TIN with RRA again" +
              (verifiedOnFile ? "." : ", and check your ID."),
          );
        }
        return;
      }
      setScreen(arrivalKind === "broker" ? "broker" : "steps");
      setStep(openingStep(pathFor(arrivalKind ? registrationForKind(arrivalKind).role : null, "owner"), arrivalKind !== null));
    })();
    return () => {
      cancelled = true;
    };
    // Once, on mount. The gate renders the wizard only for a resolved session.
  }, []);

  /** The answers in the server's draft shape, saved at `phase`. */
  const saveDraft = useCallback(
    async (at: "place" | "business" | "documents") => {
      const res = await saveRegistrationDraft(
        toServerDraft({
          phase: at,
          kind,
          capacity,
          typedPersonal: !(profile?.complete === true && !editingProfile),
          personal,
          intendedOwner,
          business,
          branches,
        }),
      );
      if (res.status === "ok") setSavedAt(`Saved ${clock(new Date())}`);
    },
    [kind, capacity, profile, editingProfile, personal, intendedOwner, business, branches],
  );

  /** The steps this person has opened, which is what the rail ticks and unlocks. */
  const [visited, setVisited] = useState<ReadonlySet<StepId>>(() => new Set());
  useEffect(() => {
    if (screen === "steps") setVisited((v) => (v.has(step) ? v : new Set(v).add(step)));
  }, [step, screen]);

  // A step saves when it is LEFT (ADR-060), so the person can come back on
  // another day or device. Once the registration exists nothing is saved again.
  const previousStep = useRef<StepId | null>(null);
  useEffect(() => {
    if (screen !== "steps") return;
    const from = previousStep.current;
    previousStep.current = step;
    const phase = from ? draftPhaseFor(from) : null;
    if (summary !== null || kind === null || phase === null || !isDraftPhase(phase) || !savesOnLeave(from, step)) return;
    void saveDraft(phase);
    // Deliberately the step only: typing does not save, moving on does.
  }, [step, screen]);

  // The fee, keyed by the role.
  useEffect(() => {
    if (role === null || role === "broker") {
      setQuote(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchRegistrationFee(businessTypeFor(role));
      if (!cancelled) setQuote(res.status === "ok" ? res.data : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);
  const fee = resolveRegistrationFee({ summary, quote, accommodationType: role === "broker" ? null : kind }).amountRwf;

  // PSF's tiers, read once the step that offers them is reached.
  useEffect(() => {
    if (step !== "branches" || tiers !== null || tiersFailed) return;
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
    setCarried(false);
    setErrors({});
    setFormError("");
    // A changed register (RRA for a TIN, the land register for a UPI) starts
    // step two over.
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
      accommodationClassOther:
        derived.accommodationClassOther ?? (derived.accommodationClass === "other" ? b.accommodationClassOther : ""),
    }));
  };
  const changeKind = () => {
    setCarried(false);
    setFormError("");
    setScreen("steps");
    setStep("type");
  };

  // --- step two: the TIN --------------------------------------------------------
  async function validateTin() {
    if (!/^\d{9}$/.test(tin)) return;
    setTinChecking(true);
    setCarryOnPending(false);
    const res = await checkTin(tin);
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
    if (capPick === "on_behalf_of") {
      setIntendedOwner((o) => ({ ...o, name: o.name || registry?.directors[0]?.name || "" }));
    }
  };

  // --- step two: the ID -------------------------------------------------------
  const onVerified = useCallback(
    (person: VerifiedPerson) => {
      setPersonal((p) => ({
        ...p,
        ...splitFullName(person.fullName),
        dateOfBirth: person.dateOfBirth,
        gender: person.gender ?? p.gender,
        phoneE164: p.phoneE164 || person.phoneE164 || "",
        documentType: person.documentType,
        issuingCountry: person.issuingCountry,
      }));
      if (person.phoneE164) setPhoneFromRegister(true);
      setErrors({});
      setFormError("");
      void (async () => {
        const res = await fetchIdentity();
        if (res.status === "ok") setIdentity(res.data);
        // Whether this ID is one of the directors is RRA's answer to the TIN
        // ASKED BY A VERIFIED CALLER, so the TIN is asked again now.
        if (tinCheck && /^\d{9}$/.test(tinCheck.tin)) {
          const again = await checkTin(tinCheck.tin);
          if (again.status === "ok") setTinCheck({ tin: tinCheck.tin, verdict: again.data });
        }
      })();
    },
    [tinCheck],
  );

  const confirmId = () => {
    setErrors({});
    if (!(profile?.complete === true && !editingProfile)) {
      const parsed = PersonalDetails.safeParse(personalCandidate(personal, identityVerified));
      if (!parsed.success) {
        setErrors(issuesToErrors(parsed.error.issues));
        return;
      }
    }
    setIdConfirmed(true);
  };

  /** A complete profile on file, opened to change the phone or the home address. */
  const editStoredProfile = () => {
    setEditingProfile(true);
    setIdConfirmed(false);
    setPersonal((p) => (profile ? seedFromPartialProfile(profile, p) : p));
  };

  const prepareForOwner = () => {
    setCapacity("on_behalf_of");
    setCapPick("on_behalf_of");
    setIntendedOwner((o) => ({ ...o, name: o.name || registry?.directors[0]?.name || "" }));
    setIdConfirmed(true);
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
      : PersonalDetails.safeParse(personalCandidate(personal, identityVerified)).success;
  const identityOk = (identityVerified || !canVerify) && personalOk && idConfirmed;
  const satisfied = (id: SectionId): boolean => {
    switch (id) {
      case "tin":
        return (
          tinConfirmed &&
          ((verdict?.result === "verified" && !nameDiffers) || (verdict?.result === "pending" && carryOnPending)) &&
          legalName.length >= 2
        );
      case "owner":
        return identityOk && isDirector !== false;
      case "id":
        return identityOk;
      case "intended":
        return intendedConfirmed && IntendedOwner.safeParse(intendedOwner).success;
      case "cls":
        return true;
      case "loc":
        return locSaved && missingLevels(business.address).length === 0;
      case "upi":
        return upiConfirmed && business.legalName.trim().length >= 2 && upiError(business.upi) === null;
    }
  };
  const sections = sectionOrder(path);
  const { states: sectionState, allDone: proofDone } = sectionStates(sections, satisfied);

  const onFile = documentOnFileFor(identity, profile);
  /** The ID line PSF's form shows, saying where the number comes from. */
  const documentOnFile = onFile ? `${onFile.label}, ${onFile.source === "checked" ? "the one checked" : "on your account"}` : null;
  const psfReady =
    path === "landlord" ||
    business.psfMember !== false ||
    business.psfApply !== true ||
    PsfApplicationInput.safeParse(psfCandidate(psf, documentOnFile !== null)).success;
  const docsState = documentsReady(path, docs);
  const accepted = summary !== null && summary.contractAcceptedAt !== null;
  const paid = summary !== null && summary.status !== "pending_payment";

  const complete = (id: StepId): boolean => {
    if (summary !== null) return id !== "pay" ? (id === "overview" ? accepted : true) : paid;
    switch (id) {
      case "type":
        return kind !== null && kind !== "broker" && (kind !== "other" || business.accommodationClassOther.trim() !== "");
      case "tin":
      case "property":
        return proofDone;
      case "branches":
        return psfReady;
      case "documents":
        return docsState.ok;
      case "overview":
        return accepted;
      case "pay":
        return paid;
    }
  };
  const openable = openableThrough(order, complete);

  /** Every answer against the contract, before the overview is shown. */
  const requestCandidate = () => {
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    return {
      role,
      capacity,
      ...(sendPersonal ? { personal: personalCandidate(personal, identityVerified) } : {}),
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
    if (key.startsWith("business.branches") || key.startsWith("business.psf")) return "branches";
    if (key.startsWith("business.certificates")) return "documents";
    return proofStep(path);
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
    if (step === "branches" && !psfReady) {
      const parsed = PsfApplicationInput.safeParse(psfCandidate(psf, documentOnFile !== null));
      if (!parsed.success) setErrors(prefix("psf", issuesToErrors(parsed.error.issues)));
      setFormError("Some of the PSF application needs fixing.");
      return;
    }
    if (step === "documents") {
      const parsed = CreateRegistrationRequest.safeParse(requestCandidate());
      if (!parsed.success) {
        const found = issuesToErrors(parsed.error.issues);
        setErrors(found);
        const first = Object.keys(found)[0] ?? "";
        setStep(stepForIssue(first));
        setFormError(`Something needs fixing before the overview: ${Object.values(found)[0] ?? "check your answers"}`);
        return;
      }
    }
    const to = order[i + 1];
    if (to) setStep(to);
  };

  const createFromAnswers = async (): Promise<ApiResult<RegistrationSummary> | null> => {
    if (!role) return null;
    const parsed = CreateRegistrationRequest.safeParse(requestCandidate());
    if (!parsed.success) {
      const found = issuesToErrors(parsed.error.issues);
      setErrors(found);
      setFormError(`Something needs fixing: ${Object.values(found)[0] ?? "check your answers"}. Use Edit to go back to it.`);
      return null;
    }
    return createRegistration(parsed.data);
  };

  /**
   * Sign and continue: create, then accept the agreement, the server's own
   * order (ADR-053 AC-R8). Each call is skipped once it has happened, so a press
   * after a partial failure resumes where it stopped.
   */
  const signAndCreate = async () => {
    setBusy(true);
    setFormError("");
    try {
      let current = summary;
      if (!current) {
        const created = await createFromAnswers();
        if (created === null) return;
        if (created.status !== "ok") {
          if (created.status === "refused" && created.issues) setErrors(refusalToErrors(created.issues));
          setFormError(apiResultMessage(created));
          return;
        }
        current = created.data;
        setSummary(current);
      }
      if (current.status !== "pending_payment") {
        setScreen("review");
        return;
      }
      if (current.contractAcceptedAt === null) {
        const acc = await acceptRegistrationContract(current.orgId, OPERATOR_CONTRACT_VERSION);
        if (acc.status !== "ok") {
          if (acc.status === "refused" && acc.code === "contract_not_open") {
            const now = await fetchRegistration(current.orgId);
            if (now.status === "ok") {
              setSummary(now.data);
              setScreen("review");
              return;
            }
          }
          setFormError(apiResultMessage(acc));
          return;
        }
        current = acc.data;
        setSummary(current);
      }
      if (signature) {
        setSigned({
          dataUrl: signature.dataUrl,
          method: signature.method,
          signedName: registrantName,
          signedAt: signedAt ?? new Date().toISOString(),
        });
      }
      setStep("pay");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!summary) return;
    setBusy(true);
    setFormError("");
    const res = await payRegistrationFee(summary.orgId);
    setBusy(false);
    if (res.status !== "ok") {
      setFormError(apiResultMessage(res));
      return;
    }
    setSummary(res.data);
  };

  // --- broker ------------------------------------------------------------------
  const submitBroker = async () => {
    setErrors({});
    setFormError("");
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    if (sendPersonal) {
      const parsed = PersonalDetails.safeParse(personalCandidate(personal, identityVerified));
      if (!parsed.success) {
        setErrors(issuesToErrors(parsed.error.issues));
        setFormError("Some of your details need fixing.");
        return;
      }
    }
    setBusy(true);
    const res = await registerAsBroker(
      sendPersonal ? { personal: PersonalDetails.parse(personalCandidate(personal, identityVerified)) } : {},
    );
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

  /** A fresh registration, beside whatever is already in flight. */
  const startNew = () => {
    setSummary(null);
    setSigned(null);
    setSignature(null);
    setSignedAt(null);
    setErrors({});
    setFormError("");
    setTinCheck(null);
    setTinConfirmed(false);
    setIdConfirmed(false);
    setIntendedConfirmed(false);
    setUpiConfirmed(false);
    setLocSaved(false);
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
    setCarried(arrivalKind !== null);
    setScreen(arrivalKind === "broker" ? "broker" : "steps");
    setStep(openingStep(pathFor(derived?.role ?? null, "owner"), arrivalKind !== null));
  };

  const saveAndExit = async () => {
    setExiting(true);
    const at = draftPhaseFor(step);
    if (screen === "steps" && at && summary === null && kind) await saveDraft(at);
    window.location.assign("/start");
  };

  /** "Apply now": what the wizard already knows goes into PSF's form. */
  const seedPsf = () => {
    const verifiedPerson = identity?.verified ?? null;
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
  const summaryKindLabel = summary
    ? summary.domain === "residence"
      ? "Residence"
      : summary.accommodationClass
        ? (ACCOMMODATION_CLASS_LABEL[summary.accommodationClass as keyof typeof ACCOMMODATION_CLASS_LABEL] ?? null)
        : null
    : null;
  const kindLabel = kindEntry?.label ?? summaryKindLabel ?? "business";
  const landlord = path === "landlord";

  const verifiedName = identity?.verified?.fullName ?? null;
  const registrantName =
    profile?.complete === true && !editingProfile
      ? (profile.fullName ?? composeFullName(personal))
      : (verifiedName ?? composeFullName(personal));
  const idLine = onFile?.label ?? (personal.documentNumber ? `National ID ${formatNationalId(personal.documentNumber)}` : null);
  const checkedBy =
    identity?.method === "document_scan"
      ? "Checked from your passport"
      : identity?.method === "registry"
        ? "Checked by the population register"
        : identityVerified
          ? "Verified"
          : null;

  const businessNamed = summary?.legalName ?? (landlord ? (upiConfirmed ? business.legalName.trim() : "") : registry && tinConfirmed ? legalName : "");
  const heading = {
    eyebrow: landlord ? "Residence registration" : "Business registration",
    title: businessNamed ? `Register ${businessNamed}` : landlord ? "Register your residence" : "Register your business",
    sub: landlord
      ? `${countWord(order.length)} short steps for a property let on a lease. The population register confirms who you are.`
      : path === "helper"
        ? "You prepare it and name the owner, who claims it once Injishi approves it."
        : `${countWord(order.length)} short steps. RRA and the population register confirm the business is yours, so you type very little.`,
  };

  const SECTION_TITLE: Record<SectionId, string> = {
    tin: "Business name and TIN",
    owner: "You and the company",
    id: "Your identity",
    intended: "The owner",
    cls: "Classification",
    loc: "Location",
    upi: "The property",
  };
  const entityGroup = kind ? registrationForKind(kind).entityGroup : null;
  const sectionSummary = (id: SectionId): string => {
    switch (id) {
      case "tin":
        return `${legalName || "Not named"} · TIN ${formatTin(tin)} · ${capacity === "owner" ? "you own or direct it" : "you register it for the owner"}`;
      case "owner":
      case "id":
        return [registrantName || "You", idLine, id === "owner" && isDirector ? "a director" : null].filter(Boolean).join(" · ");
      case "intended":
        return `${intendedOwner.name.trim()} · ${intendedOwner.email.trim()} · claims it after approval`;
      case "cls":
        return kind === "other"
          ? `Other: ${business.accommodationClassOther.trim()}. An officer picks the closest RDB class.`
          : `${kindLabel}, in RDB's ${entityGroup === "restaurant_bar_nightclub" ? "restaurant, bar and nightclub" : "accommodation"} group. No licence number needed.`;
      case "loc":
        return locLine ?? "Saved";
      case "upi":
        return `${business.legalName.trim()} · UPI ${business.upi.trim()}`;
    }
  };
  const sectionChecked = (id: SectionId): string | null => {
    if (id === "tin") return verdict?.result === "verified" ? "Checked by RRA" : null;
    if (id === "owner" || id === "id") return checkedBy;
    if (id === "upi") return "Format checked";
    return null;
  };
  const editSection = (id: SectionId) => {
    setFormError("");
    if (id === "tin") {
      setTinCheck(null);
      setTinConfirmed(false);
      setCarryOnPending(false);
    } else if (id === "owner" || id === "id") setIdConfirmed(false);
    else if (id === "intended") setIntendedConfirmed(false);
    else if (id === "loc") setLocSaved(false);
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
            onNext={confirmTin}
            error={errors["business.legalName"] ?? errors["business.tin"]}
          />
        );
      case "owner":
      case "id":
        return (
          <SectionIdentity
            path={path}
            identity={identity}
            profile={profile}
            profileComplete={profile?.complete === true && !editingProfile}
            draft={personal}
            onDraftChange={setPersonal}
            onVerified={onVerified}
            phoneFromRegister={phoneFromRegister}
            needsExtras={!personalOk}
            isDirector={id === "owner" ? isDirector : null}
            directorNames={registry?.directors.map((d) => d.name) ?? []}
            demo={demo}
            errors={errors}
            onPrepareForOwner={prepareForOwner}
            onEditProfile={editStoredProfile}
            onNext={confirmId}
          />
        );
      case "intended":
        return (
          <>
            <p className="text-sm">
              The owner claims the business with this National ID once Injishi approves it, so it has to be one of
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
  const docLabel = (d: DocumentDraft) =>
    d.kind === "other"
      ? d.kindOther.trim() || "Another document"
      : (documentRows(path).find((r) => r.kind === d.kind)?.label ?? d.filename);
  const docsText = docs.length
    ? `${docLabel(docs[0]!)}${docs.length > 1 ? ` and ${docs.length - 1} more` : ""}`
    : "None yet";
  const psfText =
    business.psfMember === true
      ? `A member${business.psfMembershipNumber.trim() ? `, number ${business.psfMembershipNumber.trim()}` : ""}`
      : business.psfMember === false
        ? business.psfApply === true
          ? `Applying${tiers?.find((t) => t.code === psf.requestedTierCode)?.nameEn ? `: ${tiers.find((t) => t.code === psf.requestedTierCode)!.nameEn}` : ""}. Sent to PSF after approval`
          : "Not a member, not applying now"
        : "Not answered";
  const youRow = `${registrantName || "You"}${idLine ? `, ${idLine}` : ""}${checkedBy ? `, ${checkedBy.toLowerCase()}` : ""}`;
  const rows: ReviewRow[] = summary
    ? [{ title: "Registering", value: `${kindLabel} · ${summary.legalName}`, step: null }]
    : landlord
      ? [
          { title: "Business type", value: kindLabel, step: "type" },
          { title: "The property", value: `${business.legalName.trim()} · UPI ${business.upi.trim()}`, step: "property" },
          { title: "You", value: youRow, step: "property" },
          { title: "Location", value: locLine ?? "Not chosen", step: "property" },
          { title: "Documents", value: docsText, step: "documents" },
        ]
      : [
          { title: "Business type", value: kindLabel, step: "type" },
          {
            title: "The business",
            value: `${legalName} · TIN ${formatTin(tin)}${verdict?.result === "verified" ? " · checked by RRA" : " · RRA checks it after payment"}`,
            step: "tin",
          },
          path === "helper"
            ? { title: "You", value: youRow, step: "tin" }
            : { title: "Proof it is yours", value: `${youRow}${isDirector ? ", a director" : ""}`, step: "tin" },
          ...(path === "helper"
            ? [
                {
                  title: "The owner",
                  value: `${intendedOwner.name.trim()} · ${intendedOwner.email.trim()} · claims it after approval`,
                  step: "tin" as const,
                },
              ]
            : []),
          { title: "Location", value: locLine ?? "Not chosen", step: "tin" },
          {
            title: "Branches",
            value: branches.length
              ? `${branches.length} ${branches.length === 1 ? "branch" : "branches"}: ${branches.map((b) => b.name).join(", ")}`
              : "None",
            step: "branches",
          },
          { title: "PSF", value: psfText, step: "branches" },
          { title: "Documents", value: docsText, step: "documents" },
        ];

  const LEAD: Record<StepId, string> = {
    type: "What you register decides the steps, the documents we ask for and the fee.",
    tin:
      path === "helper"
        ? "Check the TIN, confirm who you are, and name the owner. The owner proves the business is theirs when they claim it."
        : "Prove the business is yours. RRA and the population register confirm it, so you type very little.",
    property: "Tell us about the property and confirm who you are. A Residence needs no TIN.",
    branches: "Add other sites that share this TIN, and tell us about PSF. Both are optional.",
    documents: landlord
      ? "Upload the land title. Everything else is optional."
      : "Upload the RDB certificate. Everything else is optional, and it helps the review.",
    overview: accepted
      ? "You signed. These details are with Injishi now."
      : "Check everything once. When you sign, the registration is created and these details lock until an Injishi officer sends them back to you.",
    pay: landlord
      ? "Pay the registration fee. It sends your residence to Injishi for review."
      : "Pay the registration fee. It sends your business to Injishi for review.",
  };

  let primary: StepPrimary | null = { label: "Continue", icon: <ArrowRight size={16} aria-hidden />, onPress: next };
  if (step === "type") {
    if (kind === "broker") {
      primary = {
        label: "Open the broker form",
        icon: <ArrowRight size={16} aria-hidden />,
        onPress: () => {
          setFormError("");
          setScreen("broker");
        },
      };
    } else if (!complete("type")) {
      primary = {
        ...primary,
        disabled: true,
        why: kind === "other" ? "Say what kind of place it is to continue." : "Pick a business type to continue.",
      };
    }
  } else if ((step === "tin" || step === "property") && !proofDone) {
    primary = { ...primary, disabled: true, why: "Finish the sections above to continue." };
  } else if (step === "documents" && !docsState.ok) {
    primary = { ...primary, disabled: true, why: docsState.why };
  } else if (step === "overview") {
    primary = accepted
      ? { label: "Continue to pay", icon: <ArrowRight size={16} aria-hidden />, onPress: () => goTo("pay") }
      : {
          label: "Sign and continue",
          icon: <PenLine size={16} aria-hidden />,
          onPress: () => void signAndCreate(),
          pending: busy,
          disabled: signature === null || fee === null,
          why:
            fee === null
              ? "The fee could not be read, so nothing can be signed yet."
              : signature
                ? "This creates the registration and locks these details."
                : "Sign the agreement to continue.",
        };
  } else if (step === "pay") {
    primary = paid
      ? null
      : {
          label: fee === null ? "Pay" : `Pay ${formatRwf(fee)}`,
          icon: <Landmark size={16} aria-hidden />,
          onPress: () => void pay(),
          pending: busy,
          disabled: summary === null,
        };
  }

  const stepIndex = Math.max(0, order.indexOf(step));
  // The artboard ticks and opens only what has been reached: a step whose
  // answers are all optional is complete before anyone has seen it.
  const reachedIndex = order.reduce((at, id, i) => (visited.has(id) || id === step ? i : at), 0);
  const rail: RailStep[] = order.map((id, i) => ({
    id,
    title: STEP_TITLE[id],
    status: id === step ? "active" : complete(id) && visited.has(id) ? "complete" : "inactive",
    // Once the registration exists, only what is left to do can be opened.
    locked: summary !== null ? id !== "overview" && id !== "pay" : i > Math.min(openable, reachedIndex),
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
        signedDownload={
          signed
            ? () =>
                downloadSignedContract(contractInputFor({ summary, kind, personal, business, legalName, profile, editingProfile }), signed)
            : null
        }
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
        lead="Your ID, checked once, and you are registered. A broker lists no property, so there is no TIN, no document and no fee."
        footer={
          <Button variant="ghost" onClick={changeKind}>
            Back to business type
          </Button>
        }
      >
        <SectionIdentity
          path="landlord"
          identity={identity}
          profile={profile}
          profileComplete={profile?.complete === true && !editingProfile}
          draft={personal}
          onDraftChange={setPersonal}
          onVerified={onVerified}
          phoneFromRegister={phoneFromRegister}
          needsExtras={!personalOk}
          isDirector={null}
          directorNames={[]}
          demo={demo}
          errors={errors}
          onPrepareForOwner={() => undefined}
          onEditProfile={editStoredProfile}
          onNext={() => void submitBroker()}
        />
        {formError ? (
          <Callout tone="danger" icon={<CircleAlert size={16} aria-hidden />} title="That did not go through">
            {formError}
          </Callout>
        ) : null}
      </StepCard>
    );
  } else if (screen === "steps") {
    // Signed and locked: true once the agreement is accepted. A registration
    // reopened before it was signed is not signed yet, whatever exists.
    const lockedBanner = accepted && step !== "pay";
    body = (
      <StepFrame
        position={{ n: stepIndex + 1, of: order.length }}
        title={STEP_TITLE[step]}
        lead={LEAD[step]}
        lockedBanner={lockedBanner}
        onBack={stepIndex > 0 && !(summary !== null && step === "overview") ? () => goTo(order[stepIndex - 1]!) : null}
        primary={primary}
      >
        {formError ? (
          <Callout tone="danger" icon={<CircleAlert size={16} aria-hidden />} title="Something needs your attention">
            {formError}
          </Callout>
        ) : null}

        {step === "type" ? (
          <StepType
            kind={kind}
            other={business.accommodationClassOther}
            otherError={errors["business.accommodationClassOther"]}
            onChoose={chooseKind}
            onOtherChange={(v) => setBusiness((b) => ({ ...b, accommodationClassOther: v }))}
          />
        ) : null}

        {step === "tin" || step === "property" ? (
          <div className="flex flex-col gap-2.5">
            {sections.map((id, i) => (
              <RegisterSection
                key={id}
                id={id}
                n={i + 1}
                title={SECTION_TITLE[id]}
                state={sectionState[id] ?? "locked"}
                summary={sectionState[id] === "locked" ? lockedReason(path, id) : sectionSummary(id)}
                checkedBy={sectionChecked(id)}
                editText={id === "cls" ? "Change" : "Edit"}
                onEdit={summary === null ? () => editSection(id) : null}
              >
                {sectionBody(id)}
              </RegisterSection>
            ))}
          </div>
        ) : null}

        {step === "branches" ? (
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

        {step === "documents" ? <StepDocuments path={path} docs={docs} onDocsChange={setDocs} errors={errors} /> : null}

        {step === "overview" ? (
          <StepOverview
            rows={rows}
            locked={summary !== null}
            onEdit={(to) => (to === "type" ? changeKind() : goTo(to))}
            kindLabel={kindLabel}
            fee={fee}
            feeNote="You pay it in the next step. The fee shown here is the one you are charged."
            agreeText={`By signing, ${landlord ? "you agree" : `${legalName || summary?.legalName || "the business"} agrees`} to Injishi's terms for businesses: how the platform works, its fees, and how your data and your guests' data are handled.`}
            contractInput={contractInputFor({ summary, kind, personal, business, legalName, profile, editingProfile })}
            accepted={accepted}
            signature={signature}
            onSignature={(s) => {
              setSignature(s);
              // In the handler, never during a render: a date read while
              // rendering differs between server and browser.
              setSignedAt(s ? new Date().toISOString() : null);
            }}
            signerName={registrantName}
            signLine={
              accepted
                ? `Signed${signed ? ` by ${signed.signedName}` : ""} · ${onDay(summary?.contractAcceptedAt ?? null) ?? "accepted"}`
                : signature && signedAt
                  ? `Signed by ${registrantName || "you"}${path === "owner" && isDirector ? ", director" : ""} · ${onDay(signedAt)}`
                  : "Not signed yet"
            }
          />
        ) : null}

        {step === "pay" ? (
          <StepPay
            kindLabel={kindLabel}
            fee={fee}
            paid={paid}
            paidOn={onDay(summary?.submittedAt ?? null)}
            onSeeStatus={() => setScreen("review")}
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
      onChangeKind={walking && carried ? changeKind : undefined}
      carried={carried && screen === "steps"}
      heading={screen === "steps" ? heading : null}
      saved={walking ? savedAt : null}
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

/** Where a broker lands (F-R09): no fee and no waiting, and a way on. */
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
      lead={`${broker.name ? `${broker.name}, n` : "N"}o fee and no waiting. Landlords can now add you to the residences you place tenants in.`}
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
  const v = identity?.kycStatus === "verified" ? identity.verified : null;
  if (v) {
    return {
      label:
        v.documentType === "passport"
          ? `Passport ${v.documentNumberMasked}`
          : `National ID ending ${v.documentNumberMasked.replace(/\D/g, "")}`,
      source: "checked",
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
 * `verified`: the identity is verified (ADR-060), so no document is sent and
 * the server keeps the verified one.
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
  const entityGroup = (kind ? registrationForKind(kind).entityGroup : null) ?? "accommodation";
  const member = d.psfMember === true;
  const number = d.psfMembershipNumber.trim();
  return {
    domain: "hospitality",
    legalName,
    entityGroup,
    accommodationClass: d.accommodationClass,
    ...(d.accommodationClass === "other" ? { accommodationClassOther: d.accommodationClassOther.trim() } : {}),
    tin: normalizeTin(d.tin),
    // Kept only for a draft from before the licence became a document.
    ...(d.tourismLicenseNumber.trim() ? { tourismLicenseNumber: d.tourismLicenseNumber.trim() } : {}),
    ...(d.eacStarGrade ? { eacStarGrade: Number(d.eacStarGrade) } : {}),
    chamberOfTourismMember: d.chamberOfTourismMember === true,
    psfMember: member,
    ...(member && number ? { psfMembershipNumber: number } : {}),
    ...(d.psfMember === false && d.psfApply === true ? { psfApplication: psfCandidate(psf, documentOnFile) } : {}),
    address,
    certificates,
    branches: branches.map((b) => ({ name: b.name.trim(), address: addressFromDraft(b.address) })),
  };
}

/**
 * The registration, in the words the agreement prints it in. Every value
 * arrives formatted, because `lib/registration-contract.ts` formats nothing.
 */
function contractInputFor({
  summary,
  kind,
  personal,
  business,
  legalName,
  profile,
  editingProfile,
}: {
  summary: RegistrationSummary | null;
  kind: RegistrationKind | null;
  personal: PersonalDraft;
  business: BusinessDraft;
  legalName: string;
  profile: MyProfile | null;
  editingProfile: boolean;
}): RegistrationContractInput {
  const usingStoredProfile = profile?.complete === true && !editingProfile;
  const typedName = composeFullName(personal);
  const registrantName = usingStoredProfile ? (profile?.fullName ?? typedName) : typedName || (profile?.fullName ?? "");
  const storedDocument = profile?.document ?? null;
  const registrantIdLabel = usingStoredProfile
    ? storedDocument?.documentNumberMasked
      ? `${storedDocument.documentType === "passport" ? "Passport" : "National ID"} ${storedDocument.documentNumberMasked}`
      : null
    : personal.documentNumber.trim()
      ? personal.documentType === "passport"
        ? `Passport ${personal.documentNumber.trim()}`
        : `National ID ${formatNationalId(personal.documentNumber)}`
      : null;
  const phone = (usingStoredProfile ? profile?.phoneE164 : personal.phoneE164) ?? "";
  const storedClass = summary?.accommodationClass ?? null;
  const kindLabel =
    (kind ? (REGISTRATION_KINDS.find((k) => k.value === kind)?.label ?? null) : null) ??
    (summary?.domain === "residence"
      ? "Residence"
      : storedClass
        ? (ACCOMMODATION_CLASS_LABEL[storedClass as keyof typeof ACCOMMODATION_CLASS_LABEL] ?? "Hospitality business")
        : "Hospitality business");
  const businessIdLabel = business.tin.trim()
    ? `RRA TIN ${normalizeTin(business.tin)}`
    : business.upi.trim()
      ? `UPI ${business.upi.trim()}`
      : null;
  const street = business.address.street.trim() || business.address.addressText.trim();
  return {
    registrantName,
    registrantIdLabel,
    registrantPhone: phone.trim() || null,
    businessName: summary?.legalName ?? (legalName || "Your business"),
    businessKindLabel: kindLabel,
    businessIdLabel,
    businessAddressLabel: street || null,
    reference: summary?.orgId ?? "Assigned when you sign",
    contractVersion: OPERATOR_CONTRACT_VERSION,
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
