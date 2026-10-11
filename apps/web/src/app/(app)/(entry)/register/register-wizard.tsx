"use client";

import {
  ACCOMMODATION_CLASS_LABEL,
  BusinessDetails,
  CreateRegistrationRequest,
  IntendedOwner,
  OPERATOR_CONTRACT_VERSION,
  PersonalDetails,
  type BrokerRegistrationSummary,
  type IdentityStatus,
  type MyProfile,
  type OrgRegistrationStatus,
  type RegistryBusiness,
  type VerifiedPerson,
  type RegistrantCapacity,
  type RegistrantRole,
  type RegistrationFeeQuote,
  type RegistrationSummary,
  businessTypeFor,
  isRwandanAddress,
} from "@injishi/contracts";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, Button } from "@injishi/ui";

import { fetchMyWorkspaces, type LabelledWorkspace } from "@/data/me";
import { fetchIdentity } from "@/data/identity";
import {
  acceptRegistrationContract,
  createRegistration,
  fetchMyProfile,
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
import {
  type ContractSignature,
  type RegistrationContractInput,
} from "@/lib/registration-contract";
import { formatNationalId, nationalIdError } from "@/lib/rwanda-id";
import { upiError } from "@/lib/upi";

import { EMPTY_ADDRESS, addressFromDraft } from "./address-picker";
import { documentErrors, type DocumentDraft } from "./business-documents";
import { FixBusiness, InReview } from "./in-review";
import { RegisterRail, type RailStep } from "./register-rail";
import { RegisterShell, StepCard, StepSkeleton } from "./register-shell";
import {
  REGISTRATION_KINDS,
  findRegistrationKind,
  registrationForKind,
  type RegistrationKind,
} from "./registration-kinds";
import {
  fromServerDraft,
  isDraftPhase,
  restoredPhase,
  toServerDraft,
  type DraftPhase,
} from "./register-draft";
import { composeFullName, splitFullName, type PersonalDraft } from "./step-about-you";
import { newBranchDraft, type BranchDraft } from "./step-branches";
import {
  StepBusiness,
  formatTin,
  normalizeTin,
  registryAddressDraft,
  type BusinessDraft,
  type TinCheck,
} from "./step-business";
import { downloadSignedContract } from "./step-contract";
import { StepPlace } from "./step-place";
import { StepReviewPay, type ReadBackRow } from "./step-review-pay";
import { StepYou, maskedPhone } from "./step-you";
import { Notice, formatRwf } from "./wizard-ui";
import {
  openingPhase,
  resumePhase,
  savesOnEntry,
  showsRail,
  stepsToShow,
} from "./wizard-path";

/**
 * The business registration (F-S03 / FL01) as the RegisterIA and Journey boards
 * cut it, on the real API.
 *
 * THREE STEPS AND ONE PAGE. You (one ID number, checked once), Business (one
 * TIN or UPI, the rest from the registers, and one optional section), and
 * Check, sign and pay (one read back, the fee, the agreement, the payment).
 * Then In review: one page for every owner whose business is past payment and
 * not yet open, carrying the officers' steps inside it. A broker walks You
 * alone. It used to be five screens, a PSF form, and a pipeline that opened on
 * a check already passed (the Registration IA audit has the sources).
 *
 * A KIND THAT ARRIVES ANSWERED IS NOT ASKED AGAIN. The `/host` tile press is
 * the answer; it rides in `?kind=` and the wizard opens on You, showing the
 * kind once, as a chip in the header with Change (`wizard-path.ts`).
 *
 * Nothing here can skip the fee: `POST /registrations/:id/pay` is the only door
 * into `submitted`, and the server owns it. Every draft is checked against the
 * same Zod contract the API validates with, so a person is told which field is
 * wrong before a round trip; that is an affordance, never the control.
 */

type Phase =
  /** Opening: what this person already has is being read. */
  | "resume"
  /** More than one registration in flight: which to open. */
  | "pending"
  /** The kind tiles, behind Change or for a `/register` opened cold. */
  | "place"
  | "about"
  | "business"
  /** Check, sign and pay. */
  | "pay"
  /** In review: past payment, not yet open. */
  | "review"
  /** Business in fix mode, for a registration sent back. */
  | "fix"
  | "broker_done";

/** Past payment and not yet open, or not yet paid: a registration in flight. */
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

const EMPTY_BUSINESS: BusinessDraft = {
  legalName: "",
  accommodationClass: "",
  accommodationClassOther: "",
  residenceClass: "residential_landlord",
  tin: "",
  upi: "",
  tourismLicenseNumber: "",
  chamberOfTourismMember: null,
  psfMember: null,
  psfApply: null,
  psfMembershipNumber: "",
  eacStarGrade: "",
  address: { ...EMPTY_ADDRESS },
};

/** The kind a stored registration is, for the header chip and the agreement. */
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

  const [phase, setPhase] = useState<Phase>("resume");
  const [kind, setKind] = useState<RegistrationKind | null>(arrivalKind);
  /**
   * Whether the kind is still the one that arrived in the URL, which is what
   * keeps Place out of the rail. Pressing Change clears it for good.
   */
  const [carried, setCarried] = useState(arrivalKind !== null);
  const [capacity, setCapacity] = useState<RegistrantCapacity>("owner");
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
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [quote, setQuote] = useState<RegistrationFeeQuote | null>(null);
  const [summary, setSummary] = useState<RegistrationSummary | null>(null);
  const [broker, setBroker] = useState<BrokerRegistrationSummary | null>(null);
  const [pending, setPending] = useState<LabelledWorkspace[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exiting, setExiting] = useState(false);
  /** Where the caller's identity stands, and which checks can run here (ADR-060). */
  const [identity, setIdentity] = useState<IdentityStatus | null>(null);
  /** The company the register holds for the TIN, once Business asked. */
  const [registry, setRegistry] = useState<RegistryBusiness | null>(null);
  /** RRA's answer, kept against the TIN it answered. */
  const [tinCheck, setTinCheck] = useState<TinCheck>(null);
  const [addressMode, setAddressMode] = useState<"registered" | "other">("other");
  /** The signed agreement, kept for its download once the registration exists. */
  const [signed, setSigned] = useState<ContractSignature | null>(null);
  /** Each step answered and continued from, which is what unlocks the next one. */
  const [aboutDone, setAboutDone] = useState(false);
  const [businessDone, setBusinessDone] = useState(false);

  const sessionName = user?.name ?? null;
  const role: RegistrantRole | null = kind ? registrationForKind(kind).role : null;
  const identityVerified = identity?.kycStatus === "verified";

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
    // Where to resume is read from the SERVER, never from this browser: a
    // registrant who accepted on another device is exactly as far along as
    // the business says (AC-R8). Unpaid lands on Check, sign and pay, which
    // skips a contract already accepted; anything past payment is In review.
    setPhase(res.data.status === "pending_payment" ? "pay" : "review");
    return true;
  }, []);

  // What this person already has: a registration in flight opens straight on
  // its page; otherwise the draft the server kept, or the first question.
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
      // Verified before this page opened: the fields the verified card stands
      // for still have to be filled, or the contract would refuse a name and a
      // birth date nobody can see to type.
      const verifiedOnFile =
        ident.status === "ok" && ident.data.kycStatus === "verified" ? ident.data.verified : null;
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
      // What an incomplete profile already holds fills the boxes rather than
      // being asked again; a complete one is confirmed, never copied.
      const fromProfile = (p: PersonalDraft): PersonalDraft =>
        prof.status === "ok" && !prof.data.complete ? seedFromPartialProfile(prof.data, p) : p;
      setPersonal((p) => fillVerified(fromProfile(p)));

      const inFlight =
        ws.status === "ok"
          ? ws.workspaces.filter(
              (w) =>
                w.kind === "business" &&
                w.orgId !== null &&
                w.registrationStatus !== null &&
                IN_FLIGHT.has(w.registrationStatus),
            )
          : [];
      setPending(inFlight);
      if (inFlight.length === 1 && inFlight[0]?.orgId) {
        if (!(await openPending(inFlight[0].orgId)) && !cancelled) setPhase("pending");
        return;
      }
      if (inFlight.length > 1) {
        setPhase("pending");
        return;
      }

      // The draft the server kept (ADR-060), unless the person has since
      // arrived from `/host` with a different answer.
      const saved =
        stored.status === "ok" && stored.data
          ? fromServerDraft(
              stored.data,
              { personal: EMPTY_PERSONAL, business: EMPTY_BUSINESS, address: EMPTY_ADDRESS },
              newBranchDraft,
            )
          : null;
      const savedKind =
        saved?.kind && findRegistrationKind(saved.kind as RegistrationKind)
          ? (saved.kind as RegistrationKind)
          : null;
      if (saved && (arrivalKind === null || savedKind === arrivalKind)) {
        const carriedNow = savedKind !== null && savedKind === arrivalKind;
        setKind(savedKind);
        setCarried(carriedNow);
        setCapacity(saved.capacity);
        setIntendedOwner(saved.intendedOwner);
        if (saved.typedPersonal) setPersonal(fillVerified(saved.personal));
        setBusiness(saved.business);
        setBranches(saved.branches);
        const verifiedNow = ident.status === "ok" && ident.data.kycStatus === "verified";
        const resume = restoredPhase(saved, verifiedNow);
        setAboutDone(resume.phase === "business");
        setPhase(resumePhase(resume.phase, carriedNow));
        if (resume.owesId) {
          setFormError(
            resume.phase === "about"
              ? "We kept your answers from before. An ID number is never kept in a draft, so check yours again here."
              : "We kept your answers from before. The owner's National ID is never kept in a draft, so give it again below, and check the TIN again.",
          );
        }
        return;
      }
      setPhase(openingPhase(arrivalKind));
    })();
    return () => {
      cancelled = true;
    };
    // Once, on mount. The gate renders the wizard only for a resolved session.
  }, []);

  /** The answers in the server's draft shape, saved at `phase`. */
  const saveDraft = useCallback(
    (at: DraftPhase) =>
      saveRegistrationDraft(
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
      ),
    [kind, capacity, profile, editingProfile, personal, intendedOwner, business, branches],
  );

  /**
   * Save the answers each time a step is left (ADR-060), so a person can come
   * back to them on another day or device. Keyed on the phase alone: typing
   * does not save, moving on does. Check, sign and pay is saved as Business,
   * the last step whose answers can be resumed; once the registration exists
   * the server has cleared the draft and nothing is saved again.
   */
  const previousPhase = useRef<Phase>("resume");
  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = phase;
    const saveAs = phase === "pay" ? "business" : phase;
    if (summary !== null || !isDraftPhase(saveAs) || !savesOnEntry(previous, phase)) return;
    void saveDraft(saveAs);
    // Deliberately the phase only; see above.
  }, [phase]);

  /** The name a Google sign in brought, offered once to empty name boxes. */
  useEffect(() => {
    if (phase !== "about" || !sessionName || sessionName.includes("@")) return;
    if (identity?.verified) return;
    setPersonal((p) => (p.firstName.trim() || p.lastName.trim() ? p : { ...p, ...splitFullName(sessionName) }));
  }, [phase, sessionName, identity?.verified]);

  /** The person the register or the passport named, onto the draft (ADR-060). */
  const onVerified = useCallback((person: VerifiedPerson) => {
    setPersonal((p) => ({
      ...p,
      ...splitFullName(person.fullName),
      dateOfBirth: person.dateOfBirth,
      gender: person.gender ?? p.gender,
      phoneE164: p.phoneE164 || person.phoneE164 || "",
      documentType: person.documentType,
      issuingCountry: person.issuingCountry,
    }));
    setErrors({});
    setFormError("");
    void (async () => {
      const res = await fetchIdentity();
      if (res.status === "ok") setIdentity(res.data);
    })();
  }, []);

  // The fee, keyed by the role, which falls out of the kind.
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
  const fee = resolveRegistrationFee({
    summary,
    quote,
    accommodationType: role === "broker" ? null : kind,
  }).amountRwf;

  // --- the kind, behind Change ----------------------------------------------
  const chooseKind = (next: RegistrationKind) => {
    const before = kind ? registrationForKind(kind).role : null;
    setKind(next);
    setCarried(false);
    setErrors({});
    setFormError("");
    const derived = registrationForKind(next);
    // A changed register (RRA for a TIN, the land register for a UPI) starts
    // the lookup over, as the board does.
    if (before !== derived.role) {
      setTinCheck(null);
      setRegistry(null);
      setBusinessDone(false);
    }
    setBusiness((b) => ({
      ...b,
      accommodationClass: derived.accommodationClass ?? "",
      accommodationClassOther:
        derived.accommodationClassOther ??
        (derived.accommodationClass === "other" ? b.accommodationClassOther : ""),
    }));
  };
  const changeKind = () => {
    setCarried(false);
    setFormError("");
    setPhase("place");
  };

  // --- You -------------------------------------------------------------------
  const submitAbout = () => {
    setErrors({});
    setFormError("");
    if (identity?.required && !identityVerified) {
      setFormError("Check your ID first.");
      return;
    }
    // A returning registrant confirming stored details sends no `personal`
    // block: the server reads the profile it already holds.
    if (!(profile?.complete === true && !editingProfile)) {
      const local: Record<string, string> = {};
      if (!identityVerified) {
        if (personal.firstName.trim().length === 0) local["firstName"] = "Tell us your first name.";
        if (personal.lastName.trim().length === 0) local["lastName"] = "Tell us your last name.";
        if (personal.documentType === "national_id") {
          const idProblem = nationalIdError(personal.documentNumber);
          if (idProblem !== null) local["document.documentNumber"] = idProblem;
        }
      }
      if (Object.keys(local).length > 0) {
        setErrors(local);
        setFormError("Some of your details need fixing.");
        return;
      }
      const parsed = PersonalDetails.safeParse(personalCandidate(personal, identityVerified));
      if (!parsed.success) {
        setErrors(issuesToErrors(parsed.error.issues));
        setFormError(
          identityVerified
            ? "Give the phone and the address the register does not hold."
            : "Some of your details need fixing.",
        );
        return;
      }
    }
    setAboutDone(true);
    // A broker's registration is complete here: no business, no fee, no gate.
    if (role === "broker") {
      void submitBroker();
      return;
    }
    setPhase("business");
  };

  const submitBroker = async () => {
    setBusy(true);
    setFormError("");
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    const res = await registerAsBroker(
      sendPersonal ? { personal: PersonalDetails.parse(personalCandidate(personal, identityVerified)) } : {},
    );
    setBusy(false);
    if (res.status !== "ok") {
      setFormError(apiResultMessage(res));
      return;
    }
    setBroker(res.data);
    setPhase("broker_done");
  };

  // --- Business --------------------------------------------------------------
  const onRegistry = (found: RegistryBusiness | null, registrantIsDirector: boolean | null) => {
    if (!found) {
      // The TIN is being changed: drop what the old answer filled in.
      setBusiness((b) =>
        registry && b.legalName === registry.legalName
          ? { ...b, legalName: "", address: { ...EMPTY_ADDRESS } }
          : b,
      );
      setRegistry(null);
      setAddressMode("other");
      setBusinessDone(false);
      return;
    }
    setRegistry(found);
    const registered = registryAddressDraft(found);
    setBusiness((b) => ({ ...b, legalName: found.legalName, address: registered ?? b.address }));
    setAddressMode(registered ? "registered" : "other");
    // Ownership, derived from the directors (ADR-060): `create` enforces it,
    // this only saves a refusal.
    if (registrantIsDirector === false) {
      setCapacity("on_behalf_of");
      setIntendedOwner((o) => ({ ...o, name: o.name || found.directors[0]?.name || "" }));
    }
    if (registrantIsDirector === true && capacity === "on_behalf_of") setCapacity("owner");
  };

  const submitBusiness = () => {
    setErrors({});
    setFormError("");
    if (role === "host") {
      const tin = normalizeTin(business.tin);
      const verdict = tinCheck?.tin === tin ? tinCheck.verdict : null;
      if (!verdict) {
        setErrors({ "business.tin": /^\d{9}$/.test(tin) ? "Check the TIN with RRA first." : "Enter the 9-digit TIN." });
        setFormError("Check the TIN with RRA first.");
        return;
      }
      if (verdict.result === "failed" || verdict.result === "taken") {
        setFormError(verdict.message);
        return;
      }
    }
    // The UPI in the field's own words: the contract accepts any five runs of
    // digits, and `upiError` knows the widths. Named with every other problem
    // on the step, so one press shows them all.
    const upiProblem = role === "landlord" ? upiError(business.upi) : null;
    const parsed = BusinessDetails.safeParse(
      businessCandidate(business, role, kind, docs, role === "host" ? branches : []),
    );
    const owner = capacity === "on_behalf_of" ? IntendedOwner.safeParse(intendedOwner) : null;
    const docProblems = documentErrors(docs);
    if (!parsed.success || (owner && !owner.success) || Object.keys(docProblems).length > 0 || upiProblem !== null) {
      const ownerErrors = owner && !owner.success ? prefix("intendedOwner", issuesToErrors(owner.error.issues)) : {};
      const idProblem =
        capacity === "on_behalf_of" && intendedOwner.nationalId.trim() !== ""
          ? nationalIdError(intendedOwner.nationalId)
          : null;
      if (idProblem !== null) ownerErrors["intendedOwner.nationalId"] = idProblem;
      setErrors({
        ...(parsed.success ? {} : prefix("business", issuesToErrors(parsed.error.issues))),
        ...ownerErrors,
        ...docProblems,
        ...(upiProblem !== null ? { "business.upi": upiProblem } : {}),
      });
      setFormError(
        Object.keys(docProblems).length > 0 && parsed.success && (!owner || owner.success) && upiProblem === null
          ? "Say which document each file is, or remove it, under Add more now."
          : "Some of your business details need fixing.",
      );
      return;
    }
    setBusinessDone(true);
    setPhase("pay");
  };

  // --- Check, sign and pay: one press (ADR-060) --------------------------------
  const createFromAnswers = async (): Promise<ApiResult<RegistrationSummary> | null> => {
    if (!role) return null;
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    const request = {
      role,
      capacity,
      ...(sendPersonal ? { personal: personalCandidate(personal, identityVerified) } : {}),
      business: businessCandidate(business, role, kind, docs, branches),
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
    const parsed = CreateRegistrationRequest.safeParse(request);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      setFormError("Something in the form is still wrong. Use Change to go back and fix it.");
      return null;
    }
    return createRegistration(parsed.data);
  };

  /**
   * Sign, then create, accept and pay: the server's own order (ADR-053,
   * AC-R8), from one press. Each call is skipped once it has happened, so a
   * press after a partial failure resumes where it stopped. Only the version
   * on screen is sent; the drawn mark stays here for the download.
   */
  const signAndPay = async (signature: ContractSignature | null): Promise<void> => {
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
        setPhase("review");
        return;
      }
      if (current.contractAcceptedAt === null) {
        const accepted = await acceptRegistrationContract(current.orgId, OPERATOR_CONTRACT_VERSION);
        if (accepted.status !== "ok") {
          if (accepted.status === "refused" && accepted.code === "contract_not_open") {
            // It already moved past the bill, most likely paid from another tab.
            const now = await fetchRegistration(current.orgId);
            if (now.status === "ok") {
              setSummary(now.data);
              setPhase("review");
              return;
            }
          }
          setFormError(apiResultMessage(accepted));
          return;
        }
        current = accepted.data;
        setSummary(current);
      }
      if (signature) setSigned(signature);
      const paid = await payRegistrationFee(current.orgId);
      if (paid.status !== "ok") {
        setFormError(apiResultMessage(paid));
        return;
      }
      setSummary(paid.data);
      setPhase("review");
    } finally {
      setBusy(false);
    }
  };

  // --- In review --------------------------------------------------------------
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
    setPhase("review");
  };

  /** A fresh registration, beside whatever is already in flight. */
  const startNew = () => {
    setSummary(null);
    setSigned(null);
    setErrors({});
    setFormError("");
    setTinCheck(null);
    setRegistry(null);
    setDocs([]);
    setBranches([]);
    setBusinessDone(false);
    setCapacity("owner");
    setIntendedOwner({ name: "", nationalId: "", email: "" });
    const derived = arrivalKind ? registrationForKind(arrivalKind) : null;
    setBusiness({
      ...EMPTY_BUSINESS,
      accommodationClass: derived?.accommodationClass ?? "",
      accommodationClassOther: derived?.accommodationClassOther ?? "",
    });
    setKind(arrivalKind);
    setCarried(arrivalKind !== null);
    setPhase(openingPhase(arrivalKind));
  };

  const saveAndExit = async () => {
    setExiting(true);
    const at: DraftPhase | null =
      phase === "pay" ? "business" : phase === "about" || phase === "business" ? phase : null;
    if (at && summary === null && kind) await saveDraft(at);
    window.location.assign("/start");
  };

  // --- render -----------------------------------------------------------------
  const kindEntry = kind ? (REGISTRATION_KINDS.find((k) => k.value === kind) ?? null) : null;
  const summaryKindLabel = summary
    ? summary.domain === "residence"
      ? "Residence"
      : summary.accommodationClass
        ? (ACCOMMODATION_CLASS_LABEL[summary.accommodationClass as keyof typeof ACCOMMODATION_CLASS_LABEL] ?? null)
        : null
    : null;
  const kindLabel = kindEntry?.label ?? summaryKindLabel;
  const walking = phase === "about" || phase === "business" || (phase === "pay" && summary === null);

  const RAIL: ReadonlyArray<{ id: string; title: string; sub: string }> = [
    { id: "place", title: "What you register", sub: kindLabel ?? "One choice, asked once" },
    { id: "about", title: "You", sub: "Your ID, checked once" },
    {
      id: "business",
      title: "Business",
      sub: role === "landlord" ? "Land register UPI and address" : "RRA TIN and address",
    },
    {
      id: "pay",
      title: "Check, sign and pay",
      sub: fee !== null ? `${formatRwf(fee)}, one time` : "The one time fee",
    },
  ];
  const railSteps = stepsToShow(
    role === "broker" ? RAIL.filter((s) => s.id === "place" || s.id === "about") : RAIL,
    carried,
  );
  const at = railSteps.findIndex((s) => s.id === phase);
  const rail: RailStep[] = railSteps.map((s, i) => ({
    ...s,
    current: s.id === phase,
    done:
      at > i &&
      (s.id === "place" ? kind !== null : s.id === "about" ? aboutDone : s.id === "business" ? businessDone : false),
    locked:
      summary !== null
        ? s.id !== "pay"
        : s.id === "about"
          ? kind === null
          : s.id === "business"
            ? !aboutDone
            : s.id === "pay"
              ? !(aboutDone && businessDone)
              : false,
  }));
  const railShown = at >= 0 && showsRail(railSteps.length);

  const verifiedName = identity?.verified?.fullName ?? null;
  const registrantName =
    profile?.complete === true && !editingProfile
      ? (profile.fullName ?? composeFullName(personal))
      : verifiedName ?? composeFullName(personal);

  let body: ReactNode;
  if (phase === "resume") {
    body = <StepSkeleton />;
  } else if (phase === "pending") {
    body = (
      <PendingList
        pending={pending}
        busy={busy}
        error={formError}
        onOpen={(orgId) => void openPending(orgId)}
        onStartNew={startNew}
      />
    );
  } else if (phase === "review" && summary) {
    body = (
      <InReview
        summary={summary}
        onSummary={setSummary}
        onFix={() => {
          setFormError("");
          setPhase("fix");
        }}
        onStartNew={startNew}
        signedDownload={
          signed
            ? () =>
                downloadSignedContract(
                  contractInputFor({ summary, kind, personal, business, profile, editingProfile }),
                  signed,
                )
            : null
        }
      />
    );
  } else if (phase === "fix" && summary) {
    body = (
      <FixBusiness
        summary={summary}
        busy={busy}
        error={formError}
        onResubmit={() => void resubmit()}
        onBack={() => {
          setFormError("");
          setPhase("review");
        }}
      />
    );
  } else if (phase === "broker_done" && broker) {
    body = <BrokerDone broker={broker} onOwnPlace={changeKind} />;
  } else if (phase === "place") {
    body = (
      <div className="rounded-card border border-border bg-card p-5 sm:p-7">
        <StepPlace kind={kind} onChoose={chooseKind} onNext={() => setPhase("about")} />
      </div>
    );
  } else if (phase === "about" && role) {
    body = (
      <StepYou
        identity={identity}
        profile={profile}
        showStored={profile?.complete === true && !editingProfile}
        onEditProfile={() => {
          setEditingProfile(true);
          setPersonal(personalFromProfile(profile, personal));
        }}
        draft={personal}
        onDraftChange={setPersonal}
        onVerified={onVerified}
        errors={errors}
        formError={formError}
        busy={busy}
        demo={demo}
        email={user?.email ?? null}
        nextLabel={role === "broker" ? "Register as a broker" : "Continue to your business"}
        onNext={submitAbout}
        onBack={carried ? undefined : () => setPhase("place")}
      />
    );
  } else if (phase === "business" && (role === "host" || role === "landlord")) {
    body = (
      <StepBusiness
        role={role}
        kind={kind}
        draft={business}
        onChange={setBusiness}
        branches={branches}
        onBranchesChange={setBranches}
        docs={docs}
        onDocsChange={setDocs}
        tinCheck={tinCheck}
        onTinCheck={setTinCheck}
        registry={registry}
        onRegistry={onRegistry}
        registrantName={registrantName}
        capacity={capacity}
        onCapacityChange={setCapacity}
        intendedOwner={intendedOwner}
        onIntendedOwnerChange={setIntendedOwner}
        addressMode={addressMode}
        onAddressModeChange={setAddressMode}
        errors={errors}
        formError={formError}
        busy={busy}
        onBack={() => {
          setFormError("");
          setPhase("about");
        }}
        onNext={submitBusiness}
      />
    );
  } else if (phase === "pay" && (summary || role === "host" || role === "landlord")) {
    body = (
      <StepReviewPay
        rows={readBackRows({
          summary,
          kindLabel,
          business,
          role,
          tinCheck,
          registrantName,
          identity,
          profile,
          editingProfile,
          personal,
          capacity,
          intendedOwner,
        })}
        whereAddress={summary ? null : business.address}
        branches={summary ? [] : branches}
        documents={docs}
        amount={fee}
        signerName={registrantName}
        signerSource={
          identityVerified ? (identity?.method === "document_scan" ? "passport" : "NIDA") : null
        }
        payPhone={maskedPhone(
          profile?.complete === true && !editingProfile ? profile.phoneE164 : personal.phoneE164,
        )}
        contractInput={contractInputFor({ summary, kind, personal, business, profile, editingProfile })}
        summary={summary}
        busy={busy}
        error={formError}
        onSignAndPay={signAndPay}
        onBack={
          summary
            ? null
            : () => {
                setFormError("");
                setPhase("business");
              }
        }
        onChange={(step) => {
          setFormError("");
          if (step === "place") changeKind();
          else setPhase(step);
        }}
        onStartNew={startNew}
      />
    );
  } else {
    body = <StepSkeleton />;
  }

  return (
    <RegisterShell
      kindLabel={phase === "resume" || phase === "pending" ? null : kindLabel}
      onChangeKind={walking ? changeKind : undefined}
      exit={
        walking
          ? { label: "Save & exit", onPress: () => void saveAndExit(), busy: exiting }
          : { label: "Exit", href: "/start" }
      }
      rail={railShown ? <RegisterRail steps={rail} onGo={(id) => { setFormError(""); setPhase(id as Phase); }} /> : null}
    >
      {body}
    </RegisterShell>
  );
}

// ---------------------------------------------------------------------------
// Screens small enough to live here
// ---------------------------------------------------------------------------

/**
 * Where a broker lands (F-R09, ADR-026 assumption 2): no fee and no waiting,
 * so no pipeline, and a way on rather than a dead end (the audit).
 */
function BrokerDone({
  broker,
  onOwnPlace,
}: {
  broker: BrokerRegistrationSummary;
  onOwnPlace: () => void;
}) {
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
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Read back, draft → wire shape, and Zod issues → per-field messages
// ---------------------------------------------------------------------------

/** The read back rows of Check, sign and pay, in the board's order. */
function readBackRows({
  summary,
  kindLabel,
  business,
  role,
  tinCheck,
  registrantName,
  identity,
  profile,
  editingProfile,
  personal,
  capacity,
  intendedOwner,
}: {
  summary: RegistrationSummary | null;
  kindLabel: string | null;
  business: BusinessDraft;
  role: RegistrantRole | null;
  tinCheck: TinCheck;
  registrantName: string;
  identity: IdentityStatus | null;
  profile: MyProfile | null;
  editingProfile: boolean;
  personal: PersonalDraft;
  capacity: RegistrantCapacity;
  intendedOwner: { name: string; nationalId: string; email: string };
}): ReadBackRow[] {
  if (summary) {
    return [
      { label: "Registering", value: `${kindLabel ?? "Business"} · ${summary.legalName}`, change: null },
    ];
  }
  const name = business.legalName.trim() || "Not named yet";
  const tin = normalizeTin(business.tin);
  const verdict = tinCheck?.tin === tin ? tinCheck.verdict : null;
  const stored = profile?.complete === true && !editingProfile;
  const doc = identity?.verified
    ? `${identity.verified.documentType === "passport" ? "Passport" : "National ID"} ${identity.verified.documentNumberMasked}`
    : stored
      ? (profile?.document ? `${profile.document.documentType === "passport" ? "Passport" : "National ID"} ${profile.document.documentNumberMasked}` : null)
      : personal.documentNumber
        ? personal.documentType === "passport"
          ? `Passport ${personal.documentNumber}`
          : `National ID ${formatNationalId(personal.documentNumber)}`
        : null;
  const phone = maskedPhone(stored ? profile?.phoneE164 : personal.phoneE164);
  const optional = [
    business.eacStarGrade ? `${business.eacStarGrade} star EAC grade` : "",
    business.chamberOfTourismMember ? "Chamber of Tourism member" : "",
    business.psfMembershipNumber.trim() ? `PSF member ${business.psfMembershipNumber.trim()}` : "",
  ].filter(Boolean);
  return [
    { label: "Registering", value: `${kindLabel ?? "Business"} · ${name}`, change: "place" },
    role === "landlord"
      ? { label: "UPI", value: business.upi.trim() || "Not given", change: "business" }
      : {
          label: "TIN",
          value: `${formatTin(tin)}${verdict?.result === "verified" ? " · checked with RRA" : verdict?.result === "pending" ? " · RRA checks it again after payment" : ""}`,
          change: "business",
        },
    { label: "You", value: [registrantName || "Not named yet", doc, phone].filter(Boolean).join(" · "), change: "about" },
    {
      label: "Owner",
      value:
        capacity === "owner"
          ? "You"
          : `${intendedOwner.name.trim() || "Not named"} · claims it after approval`,
      change: "business",
    },
    ...(optional.length ? [{ label: "Also", value: optional.join(" · "), change: "business" as const }] : []),
  ];
}

/**
 * The draft holds strings because that is what the DOM produces. The contract
 * wants numbers, optionals actually absent, and no empty strings standing in
 * for "not answered". `verified`: the identity is verified (ADR-060), so no
 * document is sent and the server keeps the verified one.
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

/**
 * The business block, with its named documents. A membership is what the
 * optional section recorded: the Chamber box ticked, a PSF number given.
 */
function businessCandidate(
  d: BusinessDraft,
  role: RegistrantRole | null,
  kind: RegistrationKind | null,
  docs: DocumentDraft[],
  branches: BranchDraft[],
): unknown {
  const address = addressFromDraft(d.address);
  const certificates = docs
    .filter((c) => c.kind !== "")
    .map((c) => ({
      kind: c.kind,
      ...(c.kind === "other" ? { kindOther: c.kindOther.trim() } : {}),
      objectKey: c.objectKey,
    }));

  if (role === "landlord") {
    return {
      domain: "residence",
      legalName: d.legalName,
      residenceClass: d.residenceClass,
      upi: d.upi,
      address,
      certificates,
    };
  }
  const entityGroup = (kind ? registrationForKind(kind).entityGroup : null) ?? "accommodation";
  const psfNumber = d.psfMembershipNumber.trim();
  return {
    domain: "hospitality",
    legalName: d.legalName,
    entityGroup,
    accommodationClass: d.accommodationClass,
    ...(d.accommodationClass === "other" ? { accommodationClassOther: d.accommodationClassOther } : {}),
    tin: d.tin,
    // Kept only for a draft from before the licence became a document.
    ...(d.tourismLicenseNumber.trim() ? { tourismLicenseNumber: d.tourismLicenseNumber.trim() } : {}),
    chamberOfTourismMember: d.chamberOfTourismMember === true,
    psfMember: psfNumber !== "",
    ...(psfNumber ? { psfMembershipNumber: psfNumber } : {}),
    ...(d.eacStarGrade ? { eacStarGrade: Number(d.eacStarGrade) } : {}),
    address,
    certificates,
    branches: branches.map((b) => ({ name: b.name, address: addressFromDraft(b.address) })),
  };
}

/**
 * The registration, in the words the agreement prints it in. Every value
 * arrives formatted, because `lib/registration-contract.ts` formats nothing.
 * A null is a real answer: the row is left out rather than printed as a dash.
 */
function contractInputFor({
  summary,
  kind,
  personal,
  business,
  profile,
  editingProfile,
}: {
  summary: RegistrationSummary | null;
  kind: RegistrationKind | null;
  personal: PersonalDraft;
  business: BusinessDraft;
  profile: MyProfile | null;
  editingProfile: boolean;
}): RegistrationContractInput {
  const usingStoredProfile = profile?.complete === true && !editingProfile;

  const typedName = composeFullName(personal);
  const registrantName = usingStoredProfile
    ? (profile?.fullName ?? typedName)
    : typedName || (profile?.fullName ?? "");

  const storedDocument = profile?.document ?? null;
  const registrantIdLabel = usingStoredProfile
    ? storedDocument?.documentNumberMasked
      ? `${documentWord(storedDocument.documentType)} ${storedDocument.documentNumberMasked}`
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
    ? `RRA TIN ${business.tin.trim()}`
    : business.upi.trim()
      ? `UPI ${business.upi.trim()}`
      : null;

  const street = business.address.street.trim() || business.address.addressText.trim();

  return {
    registrantName,
    registrantIdLabel,
    registrantPhone: phone.trim() || null,
    businessName: summary?.legalName ?? (business.legalName.trim() || "Your business"),
    businessKindLabel: kindLabel,
    businessIdLabel,
    businessAddressLabel: street || null,
    reference: summary?.orgId ?? "Assigned when you submit",
    contractVersion: OPERATOR_CONTRACT_VERSION,
  };
}

function documentWord(documentType: string): string {
  return documentType === "passport" ? "Passport" : "National ID";
}

/** Prefill the edit form from what is already stored, minus the masked parts. */
function personalFromProfile(profile: MyProfile | null, current: PersonalDraft): PersonalDraft {
  if (!profile) return current;
  const a = profile.address;
  return {
    ...current,
    ...splitFullName(profile.fullName ?? ""),
    // Deliberately NOT prefilled: what we hold is masked.
    documentType: profile.document?.documentType ?? "national_id",
    documentNumber: "",
    issuingCountry: profile.document?.issuingCountry ?? "RW",
    gender: profile.gender ?? "",
    dateOfBirth: profile.dateOfBirth ?? "",
    phoneE164: profile.phoneE164 ?? "",
    address:
      a === null
        ? { ...EMPTY_ADDRESS }
        : isRwandanAddress(a)
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
  };
}

/** What an INCOMPLETE profile already holds, laid over the form, and nothing else. */
function seedFromPartialProfile(profile: MyProfile, current: PersonalDraft): PersonalDraft {
  const stored = personalFromProfile(profile, current);
  return {
    ...current,
    ...(profile.fullName?.trim() ? splitFullName(profile.fullName) : {}),
    ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
    ...(profile.gender ? { gender: profile.gender } : {}),
    ...(profile.phoneE164 ? { phoneE164: profile.phoneE164 } : {}),
    ...(profile.document ? { documentType: stored.documentType, issuingCountry: stored.issuingCountry } : {}),
    ...(profile.address ? { address: stored.address } : {}),
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
function issuesToErrors(
  issues: { path: (string | number | symbol)[]; message: string }[],
): Record<string, string> {
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
