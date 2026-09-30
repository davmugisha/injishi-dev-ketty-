"use client";

import {
  ACCOMMODATION_CLASS_LABEL,
  BusinessDetails,
  CreateRegistrationRequest,
  IntendedOwner,
  OPERATOR_CONTRACT_VERSION,
  PersonalDetails,
  PsfApplicationInput,
  type BrokerRegistrationSummary,
  type IdentityStatus,
  type PsfTier,
  type MyProfile,
  type RegistryBusiness,
  type VerifiedPerson,
  type RegistrantCapacity,
  type RegistrantRole,
  type RegistrationFeeQuote,
  type RegistrationSummary,
  businessTypeFor,
  isRwandanAddress,
} from "@injishi/contracts";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { BadgeCheck } from "lucide-react";

import { fetchMyWorkspaces, type LabelledWorkspace } from "@/data/me";
import {
  BROKER_STEPS,
  REGISTRATION_STEPS,
  RESIDENCE_STEPS,
  RegistrationStepRail,
  type RegistrationStepId,
} from "@/components/shared/registration-step-rail";
import { fetchIdentity } from "@/data/identity";
import {
  acceptRegistrationContract,
  createRegistration,
  fetchMyProfile,
  fetchPsfTiers,
  fetchRegistration,
  fetchRegistrationDraft,
  fetchRegistrationFee,
  payRegistrationFee,
  registerAsBroker,
  saveRegistrationDraft,
} from "@/data/registration";
import { apiResultMessage, type ApiResult, type RefusalIssue } from "@/lib/api";
import { useSessionUser } from "@/lib/session";
import {
  type ContractSignature,
  type RegistrationContractInput,
} from "@/lib/registration-contract";
import { formatNationalId, nationalIdError } from "@/lib/rwanda-id";
import { upiError } from "@/lib/upi";

import { EMPTY_ADDRESS, addressFromDraft } from "./address-picker";
import { PipelineStatus } from "./pipeline-status";
import { downloadSignedContract } from "./step-contract";
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
} from "./register-draft";
import {
  StepAboutYou,
  composeFullName,
  splitFullName,
  type IdentityVerification,
  type PersonalDraft,
} from "./step-about-you";
import { newBranchDraft, type BranchDraft } from "./step-branches";
import { StepBusiness, type BusinessDraft } from "./step-business";
import { StepDocuments, type CertificateDraft } from "./step-documents";
import { StepPlace } from "./step-place";
import { StepPsf, psfCandidate, psfDraftFrom, type PsfDraft } from "./step-psf";
import { StepReviewPay } from "./step-review-pay";
import { Notice } from "./wizard-ui";

/**
 * The business registration wizard (F-S03 / FL01), on the real API.
 *
 * FIVE STEPS, AND THE FIRST ONE IS THE FIX (ADR-026). The order still follows
 * D23 — what you are registering picks the whole path and its price, then who
 * you are, then what you run, then the fee, and only once the fee settles does
 * anything reach a government officer. The price is PICKED at step one and
 * NEVER SHOWN: since 2026-09-21 no screen and no document in this flow states
 * the figure (the owner reversed ADR-026 AC-3, then removed it from the
 * contract and the pay screen too). The quote fetched below only decides
 * whether this kind of registration is open. What changed is that the path question
 * is now asked ONCE. It used to be asked three times: `/host` asked what kind
 * of place you have, step 0 asked whether you were a host, a landlord or a
 * broker, and step 2 asked what kind of place you have again. Those are one
 * answer wearing three hats, and `registrationForKind` is now the only thing
 * that derives the other two from it.
 *
 * Nothing here can skip the fee: `POST /registrations/:id/pay` is the only door
 * into `submitted`, and the server owns it. A broker pays nothing and passes no
 * gate (ADR-026 assumption 2), which is why that branch ends on its own screen
 * rather than in the pipeline.
 *
 * VALIDATION RUNS TWICE ON PURPOSE. Every draft is checked here against the
 * same Zod contract the API validates with, so a person is told which field is
 * wrong before a round trip. That is an affordance and never the control — the
 * server checks again, and the database checks after that.
 */

type Phase =
  | "resume"
  | "place"
  | "about"
  /**
   * The business, and for a hotel its other locations too: branches are
   * declared on this step since ADR-060 (they had a screen of their own under
   * ADR-054 AC-R1), so a single location business walks one screen fewer.
   */
  | "business"
  | "documents"
  /**
   * ADR-056. Only for a hotel that answered No to PSF and chose to apply now.
   * After Documents, so the required registration is complete first; before
   * Review, which shows the application with a Change control.
   */
  | "psf"
  /**
   * Review, sign and pay, on ONE screen since ADR-060. It used to be three
   * visits (review → create → contract → back to pay). One press now runs the
   * server's own order — create, accept the contract, pay — each call skipped
   * when it has already happened, so a press after a partial failure resumes
   * where it stopped. The server still refuses to settle an unaccepted
   * contract (ADR-053, AC-R8/AC-R13); this screen changed, that control did not.
   */
  | "pay"
  | "pipeline"
  | "broker_done";

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

/**
 * `initialKind` is the answer the person already gave on `/host`. The chooser
 * writes it into the query and `page.tsx` validates it before it gets here.
 *
 * It is CARRIED, not skipped and not re-asked. Step 1 shows it back with a
 * Change control, so the choice made on another page is confirmed on the page
 * that uses it (ADR-026, AC-1).
 */
export default function RegisterWizard({
  initialKind = null,
}: {
  initialKind?: RegistrationKind | null;
}) {
  const arrivalKind = initialKind;

  const [phase, setPhase] = useState<Phase>("resume");
  const [kind, setKind] = useState<RegistrationKind | null>(arrivalKind);
  /**
   * Whether step 1 renders as a confirmation or as the ten tiles.
   *
   * True only while the answer is still the one that arrived. Pressing Change
   * clears it and never sets it again, because at that point the person is
   * answering here rather than confirming something they answered elsewhere.
   */
  const [carried, setCarried] = useState(arrivalKind !== null);
  const [capacity, setCapacity] = useState<RegistrantCapacity>("owner");
  const [intendedOwner, setIntendedOwner] = useState({
    name: "",
    nationalId: "",
    email: "",
  });
  const [personal, setPersonal] = useState<PersonalDraft>(EMPTY_PERSONAL);
  const [business, setBusiness] = useState<BusinessDraft>(() => ({
    ...EMPTY_BUSINESS,
    ...(arrivalKind
      ? {
          accommodationClass:
            registrationForKind(arrivalKind).accommodationClass ?? "",
          accommodationClassOther:
            registrationForKind(arrivalKind).accommodationClassOther ?? "",
        }
      : {}),
  }));
  /**
   * The locations beyond the head office (ADR-054). Kept when the registrant
   * goes back to the Business step, and sent only for a hospitality business.
   */
  const [branches, setBranches] = useState<BranchDraft[]>([]);
  const [certificates, setCertificates] = useState<CertificateDraft[]>([]);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [quote, setQuote] = useState<RegistrationFeeQuote | null>(null);
  const [summary, setSummary] = useState<RegistrationSummary | null>(null);
  const [broker, setBroker] = useState<BrokerRegistrationSummary | null>(null);
  const [pending, setPending] = useState<LabelledWorkspace[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  /**
   * The PSF application (ADR-056). Built from the steps before the first time
   * the PSF step opens, then kept, so going back to change a tier does not
   * lose what was typed.
   */
  const [psfDraft, setPsfDraft] = useState<PsfDraft | null>(null);
  const [psfTiers, setPsfTiers] = useState<PsfTier[] | null>(null);
  const [psfTiersFailed, setPsfTiersFailed] = useState(false);
  /**
   * Where the caller's identity stands, and which checks this deployment can
   * run (ADR-060). Null until the API answers, and on a stack that cannot say.
   */
  const [identity, setIdentity] = useState<IdentityStatus | null>(null);
  /** The company the register holds for the TIN, once the Business step asked. */
  const [registry, setRegistry] = useState<RegistryBusiness | null>(null);
  /** The signed agreement, kept for its download once the registration exists. */
  const [signed, setSigned] = useState<ContractSignature | null>(null);
  const session = useSessionUser();
  const userId = session.user?.id ?? null;
  /** The name a Google sign-in brought, offered once to the name boxes. */
  const sessionName = session.user?.name ?? null;

  const role: RegistrantRole | null = kind
    ? registrationForKind(kind).role
    : null;

  // What this person already has. A business workspace that is not `active` is
  // a registration in flight, and dropping someone back at step 1 when they
  // have one waiting is how a pipeline stops being legible.
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
      // Verified before this page opened (another device, an earlier visit):
      // the fields the verified card hides still have to be filled, or About
      // you would refuse a name and a birth date nobody can see to type.
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
      setPersonal(fillVerified);
      const inFlight =
        ws.status === "ok"
          ? ws.workspaces.filter(
              (w) =>
                w.kind === "business" &&
                w.orgId !== null &&
                w.registrationStatus !== null &&
                w.registrationStatus !== "active",
            )
          : [];
      setPending(inFlight);
      if (inFlight.length > 0) {
        setPhase("resume");
        return;
      }
      // The draft the server kept from an earlier visit (ADR-060), on this
      // device or another, unless the person has since arrived from `/host`
      // with a different answer.
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
        setKind(savedKind);
        setCarried(savedKind !== null && savedKind === arrivalKind);
        setCapacity(saved.capacity);
        setIntendedOwner(saved.intendedOwner);
        // The verified identity, where there is one, overrides what the draft
        // remembers about the same person.
        if (saved.typedPersonal) setPersonal(fillVerified(saved.personal));
        setBusiness(saved.business);
        setBranches(saved.branches);
        const verifiedNow = ident.status === "ok" && ident.data.kycStatus === "verified";
        const resume = restoredPhase(saved, verifiedNow);
        setPhase(resume.phase);
        if (resume.owesId && resume.phase === "about") {
          setFormError(
            "We kept your answers from before. An ID number is never kept in a draft, so give it again here.",
          );
        }
        return;
      }
      setPhase("place");
    })();
    return () => {
      cancelled = true;
    };
    // Once, on mount. The gate renders the wizard only for a resolved session.
  }, []);

  /**
   * Save the answers each time a step is left (ADR-060), so a person can come
   * back to it later. Keyed on the phase alone: typing does not save, finishing
   * a step does. Past Documents the server creates the registration, which
   * clears the draft there.
   */
  useEffect(() => {
    if (!isDraftPhase(phase) || phase === "place") return;
    void saveRegistrationDraft(
      toServerDraft({
        phase,
        kind,
        capacity,
        typedPersonal: !(profile?.complete === true && !editingProfile),
        personal,
        intendedOwner,
        business,
        branches,
      }),
    );
    // Deliberately the phase only; see above.
  }, [phase]);

  /**
   * The name a Google sign-in brought (ADR-060), offered to empty name boxes
   * once About you opens. Never over a typed name, never over a verified one,
   * and never when the "name" is only the email the account was made from.
   */
  useEffect(() => {
    if (phase !== "about" || !sessionName || sessionName.includes("@")) return;
    if (identity?.verified) return;
    setPersonal((p) =>
      p.firstName.trim() || p.lastName.trim() ? p : { ...p, ...splitFullName(sessionName) },
    );
  }, [phase, sessionName, identity?.verified]);

  /**
   * The person the register or the passport named, onto the form (ADR-060):
   * name, birth date and gender are now the source's and locked; the phone the
   * register holds fills a phone field still empty.
   */
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

  const verification: IdentityVerification | null =
    identity && (identity.available.nationalId || identity.available.passport || identity.verified)
      ? {
          available: identity.available,
          verified: identity.kycStatus === "verified" ? identity.verified : null,
          method: identity.method,
          required: identity.required,
          onVerified,
        }
      : null;
  const identityVerified = identity?.kycStatus === "verified";

  // The fee is keyed by the role, and the role falls out of the kind. Fetched
  // in an effect rather than inside the press handler so it is loaded the same
  // way whether the answer was pressed here or carried from `/host` — the old
  // version only fetched on a press, so an arrival reached the pay step on an
  // em dash and a "we couldn't load the fee" notice. It is still fetched
  // although nothing shows it: the review step refuses to create a
  // registration for a kind whose fee cannot be quoted.
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

  const openPending = useCallback(async (orgId: string) => {
    setBusy(true);
    const res = await fetchRegistration(orgId);
    setBusy(false);
    if (res.status !== "ok") {
      setFormError(apiResultMessage(res));
      return;
    }
    setSummary(res.data);
    // Where to resume is read from the SERVER, never from this browser: a
    // registrant who accepted on another device, or cleared their storage, is
    // exactly as far along as the business says they are (AC-R8). Anything
    // unpaid lands on Review, sign and pay, which skips a contract already
    // accepted and asks for it otherwise.
    setPhase(res.data.status !== "pending_payment" ? "pipeline" : "pay");
  }, []);

  // --- step 1: what you are registering ------------------------------------
  const chooseKind = (next: RegistrationKind) => {
    setKind(next);
    setCarried(false);
    setErrors({});
    setFormError("");
    // The class rides on the kind, so it is written here and nowhere else. A
    // residence and a broker both clear it, correctly: neither branch is ever
    // asked that question, and leaving a stale class behind is how a landlord
    // ends up sending `accommodationClass: "villa"` on a residence.
    const derived = registrationForKind(next);
    setBusiness((b) => ({
      ...b,
      accommodationClass: derived.accommodationClass ?? "",
      // A tile that already knows the name supplies it (`bar_restaurant`); the
      // `other` tile keeps whatever the registrant has typed; every other tile
      // clears it, because the contract forbids the field without `other`.
      accommodationClassOther:
        derived.accommodationClassOther ??
        (derived.accommodationClass === "other"
          ? b.accommodationClassOther
          : ""),
    }));
  };

  // --- step 2: about you ---------------------------------------------------
  const submitAbout = () => {
    setErrors({});
    setFormError("");

    // Where a check can run, registering is held to a verified identity
    // (ADR-060); the server refuses otherwise, so the step says it first.
    if (verification?.required && !identityVerified) {
      setFormError(
        "Verify your identity to continue: validate your National ID, or scan your passport.",
      );
      return;
    }

    // A returning registrant confirming stored details sends no `personal`
    // block at all: the server reads the profile it already holds, and
    // re-sending a masked document number would corrupt it.
    if (!(profile?.complete === true && !editingProfile)) {
      // The three name boxes and the National ID are checked HERE as well as by
      // the contract, because the contract cannot see them. It validates one
      // `fullName` and one `documentNumber`, so "Tell us your full name" would
      // land on a fieldset legend without saying which of the three boxes is
      // empty, and a bad ID would be reported in the contract's words rather
      // than in the ones the field itself uses as you type.
      const local: Record<string, string> = {};
      if (personal.firstName.trim().length === 0) {
        local["firstName"] = "Tell us your first name.";
      }
      if (personal.lastName.trim().length === 0) {
        local["lastName"] = "Tell us your last name.";
      }
      // A verified person sends no document: the server keeps the verified one.
      if (!identityVerified && personal.documentType === "national_id") {
        const idProblem = nationalIdError(personal.documentNumber);
        if (idProblem !== null) local["document.documentNumber"] = idProblem;
      }
      if (Object.keys(local).length > 0) {
        setErrors(local);
        setFormError("Some of your details need fixing.");
        return;
      }

      const candidate = personalCandidate(personal, identityVerified);
      const parsed = PersonalDetails.safeParse(candidate);
      if (!parsed.success) {
        setErrors(issuesToErrors(parsed.error.issues));
        setFormError("Some of your details need fixing.");
        return;
      }
    }
    // The owner's name, National ID and email, checked with the contract's own
    // `IntendedOwner` before this step is left (ADR-053 J25). All three are
    // required: no email means no claim invitation, and no National ID means
    // the owner can never be matched when they claim. A mistyped ID is named in
    // the field's own words, the ones it already shows as you type.
    if (capacity === "on_behalf_of") {
      const parsed = IntendedOwner.safeParse(intendedOwner);
      if (!parsed.success) {
        const local = prefix("intendedOwner", issuesToErrors(parsed.error.issues));
        const idProblem =
          intendedOwner.nationalId.trim() === ""
            ? null
            : nationalIdError(intendedOwner.nationalId);
        if (idProblem !== null) local["intendedOwner.nationalId"] = idProblem;
        setErrors(local);
        setFormError("Tell us who owns this business before you continue.");
        return;
      }
    }

    // A broker's registration is complete at this point: there is no business
    // to describe, no document that gates it and no fee to settle.
    if (role === "broker") {
      void submitBroker();
      return;
    }
    setPhase("business");
  };

  // --- the broker branch ends here (F-R09, ADR-026 assumption 2) ------------
  const submitBroker = async () => {
    setBusy(true);
    setFormError("");
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    const res = await registerAsBroker(
      sendPersonal
        ? { personal: PersonalDetails.parse(personalCandidate(personal, identityVerified)) }
        : {},
    );
    setBusy(false);
    if (res.status !== "ok") {
      setFormError(apiResultMessage(res));
      return;
    }
    // The server clears the draft once the broker registration exists.
    setBroker(res.data);
    setPhase("broker_done");
  };

  // --- step 3: your business ----------------------------------------------
  const submitBusiness = () => {
    setErrors({});
    setFormError("");

    // The UPI, in the field's own words rather than the contract's. `Upi` in
    // `@injishi/contracts` accepts any five runs of digits, so `1/2/3/4/5`
    // passes it and fails at the land registry weeks later; `upiError` knows
    // the widths, and refusing here is the only place that costs nobody a trip.
    if (role === "landlord") {
      const upiProblem = upiError(business.upi);
      if (upiProblem !== null) {
        setErrors({ "business.upi": upiProblem });
        setFormError("Some of your business details need fixing.");
        return;
      }
    }

    // Branches are declared on this step since ADR-060, so they are checked with
    // it, through the same contract the server validates with: a duplicate name
    // or a branch with no sector is named here, under the card that has it.
    const parsed = BusinessDetails.safeParse(
      businessCandidate(business, role, kind, [], role === "host" ? branches : []),
    );
    // Both memberships ANSWERED, for a host (ADR-026 assumption 5, AC-6). The
    // contract accepts an absent answer as false, which is exactly why the form
    // has to ask: the officer reads this answer, and "the registrant never said"
    // must not reach them as "No".
    const unanswered: Record<string, string> = {};
    if (role === "host" && business.chamberOfTourismMember === null) {
      unanswered["business.chamberOfTourismMember"] = "Answer Yes or No.";
    }
    if (role === "host" && business.psfMember === null) {
      unanswered["business.psfMember"] = "Answer Yes or No.";
    }
    // ADR-056: a No asks whether to apply now, and that is answered too.
    if (role === "host" && business.psfMember === false && business.psfApply === null) {
      unanswered["business.psfApply"] = "Answer Yes or No.";
    }
    // The register may have moved this registration onto the on behalf path
    // (ADR-060), in which case the owner's details are asked on this step.
    const owner =
      capacity === "on_behalf_of" ? IntendedOwner.safeParse(intendedOwner) : null;
    if (!parsed.success || Object.keys(unanswered).length > 0 || (owner && !owner.success)) {
      setErrors({
        ...(parsed.success ? {} : prefix("business", issuesToErrors(parsed.error.issues))),
        ...(owner && !owner.success ? prefix("intendedOwner", issuesToErrors(owner.error.issues)) : {}),
        ...unanswered,
      });
      setFormError("Some of your business details need fixing.");
      return;
    }
    setPhase("documents");
  };

  /**
   * What the company register said about the TIN (ADR-060): its legal name and
   * address fill the step, and a registrant it does not list as a director is
   * moved to the on behalf path, with the first director named as the owner.
   * `create` enforces both; this only saves the person a refusal.
   */
  const onRegistry = (found: RegistryBusiness | null, registrantIsDirector: boolean | null) => {
    setRegistry(found);
    if (!found) return;
    setBusiness((b) => ({
      ...b,
      legalName: found.legalName,
      address: found.address
        ? {
            ...EMPTY_ADDRESS,
            country: "RW",
            provinceId: String(found.address.provinceId),
            districtId: String(found.address.districtId),
            sectorId: String(found.address.sectorId),
            street: found.address.street ?? "",
          }
        : b.address,
    }));
    if (registrantIsDirector === false && capacity === "owner") {
      setCapacity("on_behalf_of");
      setIntendedOwner((o) => ({ ...o, name: o.name || found.directors[0]?.name || "" }));
    }
    if (registrantIsDirector === true && capacity === "on_behalf_of") {
      setCapacity("owner");
    }
  };

  // --- the PSF step, when the registrant chose to apply (ADR-056) ----------
  const needsPsf = role === "host" && business.psfMember === false && business.psfApply === true;

  const loadPsfTiers = useCallback(async () => {
    setPsfTiersFailed(false);
    const res = await fetchPsfTiers();
    if (res.status === "ok") setPsfTiers(res.data);
    else setPsfTiersFailed(true);
  }, []);

  const openPsf = () => {
    if (psfDraft === null) {
      // The stored profile only when it is COMPLETE, the same test every other
      // step uses: a new account's profile exists with every field null, and
      // reading it would blank what About you just collected.
      const usesStoredProfile = profile?.complete === true && !editingProfile;
      const personalNow = usesStoredProfile ? personalFromProfile(profile, personal) : personal;
      const built = psfDraftFrom({
        business,
        personal: personalNow,
        onBehalf: capacity === "on_behalf_of",
        intendedOwner,
        sessionEmail: session.user?.email ?? null,
        // The stored number is masked, so it is named and used server side
        // rather than left blank for the registrant to retype (Phase 0). A
        // verified identity is on file the same way, number and all (ADR-060).
        documentOnFile: usesStoredProfile
          ? profile.document
          : identityVerified && identity?.verified
            ? {
                documentType: identity.verified.documentType,
                documentNumberMasked: identity.verified.documentNumberMasked,
                issuingCountry: identity.verified.issuingCountry,
              }
            : null,
      });
      // The register's company type, when it named one (ADR-060): one fewer
      // question on PSF's form.
      setPsfDraft(registry?.companyType ? { ...built, companyType: registry.companyType } : built);
    }
    if (psfTiers === null) void loadPsfTiers();
    setErrors({});
    setFormError("");
    setPhase("psf");
  };

  const submitPsf = () => {
    if (!psfDraft) return;
    setErrors({});
    setFormError("");
    const parsed = PsfApplicationInput.safeParse(psfCandidate(psfDraft));
    if (!parsed.success) {
      setErrors(prefix("psf", issuesToErrors(parsed.error.issues)));
      setFormError("Some of your PSF application needs fixing.");
      return;
    }
    setPhase("pay");
  };

  // --- step 5: review, sign and pay, one press (ADR-060) --------------------
  /**
   * The request the answers make, or null after naming what is wrong.
   * Checked against the same contract the server validates with.
   */
  const createFromAnswers = async (): Promise<ApiResult<RegistrationSummary> | null> => {
    if (!role) return null;
    const sendPersonal = !(profile?.complete === true && !editingProfile);
    const request = {
      role,
      capacity,
      ...(sendPersonal ? { personal: personalCandidate(personal, identityVerified) } : {}),
      business: businessCandidate(
        business,
        role,
        kind,
        certificates,
        branches,
        needsPsf && psfDraft ? psfCandidate(psfDraft) : null,
      ),
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
   * Sign, then create, accept and pay: the server's own order (ADR-053, AC-R8),
   * run from one press (ADR-060).
   *
   * Every call is skipped once it has happened, so a press after a partial
   * failure resumes where it stopped: a registration already created is not
   * created twice, a contract already accepted is not asked again. The drawn
   * signature is NOT sent — only the version on screen is, and the server
   * stores its own constant; the mark stays here for the download.
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
          if (created.status === "refused" && created.issues) {
            setErrors(refusalToErrors(created.issues));
          }
          setFormError(apiResultMessage(created));
          return;
        }
        current = created.data;
        setSummary(current);
      }
      if (current.status !== "pending_payment") {
        setPhase("pipeline");
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
              setPhase("pipeline");
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
      setPhase("pipeline");
    } finally {
      setBusy(false);
    }
  };

  // --- render ---------------------------------------------------------------
  if (phase === "pipeline" && summary) {
    return (
      <>
        {/* The agreement signed on the review screen, now carrying the
            reference the server gave the registration. */}
        {signed ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-card border border-border p-4">
            <span className="grow text-sm">
              Your signed agreement for {summary.legalName} is ready to keep.
            </span>
            <Button
              variant="outline"
              onPress={() =>
                downloadSignedContract(
                  contractInputFor({ summary, kind, personal, business, profile, editingProfile }),
                  signed,
                )
              }
            >
              Download the signed contract
            </Button>
          </div>
        ) : null}
        <PipelineStatus summary={summary} onSummary={setSummary} />
      </>
    );
  }

  if (phase === "broker_done" && broker) {
    return <BrokerDone broker={broker} />;
  }

  if (phase === "resume") {
    return (
      <ResumePanel
        pending={pending}
        busy={busy}
        error={formError}
        onOpen={(orgId) => void openPending(orgId)}
        onStartNew={() => setPhase("place")}
      />
    );
  }

  return (
    <>
      <RegistrationStepRail
        active={stepRailActive(phase)}
        steps={
          role === "broker"
            ? BROKER_STEPS
            : role === "landlord"
              ? RESIDENCE_STEPS
              : REGISTRATION_STEPS
        }
      />
      <div className="mt-8">
        {phase === "place" ? (
          <StepPlace
            kind={kind}
            carried={carried}
            onChoose={chooseKind}
            onReopen={() => setCarried(false)}
            onNext={() => setPhase("about")}
          />
        ) : null}

        {phase === "about" && role ? (
          <StepAboutYou
            profile={profile}
            editing={editingProfile}
            onEdit={() => {
              setEditingProfile(true);
              setPersonal(personalFromProfile(profile, personal));
            }}
            draft={personal}
            onDraftChange={setPersonal}
            capacity={capacity}
            onCapacityChange={setCapacity}
            intendedOwner={intendedOwner}
            onIntendedOwnerChange={setIntendedOwner}
            errors={errors}
            formError={formError}
            busy={busy}
            onBack={() => setPhase("place")}
            onNext={submitAbout}
            verification={verification}
          />
        ) : null}

        {phase === "business" && role && role !== "broker" ? (
          <StepBusiness
            role={role}
            kind={kind}
            draft={business}
            onChange={setBusiness}
            errors={errors}
            formError={formError}
            busy={busy}
            onBack={() => setPhase("about")}
            onNext={submitBusiness}
            homeAddress={
              profile?.complete === true && !editingProfile
                ? personalFromProfile(profile, personal).address
                : personal.address
            }
            onChangeKind={() => {
              setCarried(false);
              setPhase("place");
            }}
            branches={branches}
            onBranchesChange={setBranches}
            registry={registry}
            onRegistry={onRegistry}
            capacity={capacity}
            intendedOwner={intendedOwner}
            onIntendedOwnerChange={setIntendedOwner}
          />
        ) : null}

        {phase === "documents" && role && role !== "broker" ? (
          <StepDocuments
            role={role}
            drafts={certificates}
            onChange={setCertificates}
            busy={busy}
            onBack={() => setPhase("business")}
            onNext={() => (needsPsf ? openPsf() : setPhase("pay"))}
          />
        ) : null}

        {phase === "psf" && needsPsf && psfDraft ? (
          <StepPsf
            tiers={psfTiers}
            tiersFailed={psfTiersFailed}
            onRetryTiers={() => void loadPsfTiers()}
            draft={psfDraft}
            onChange={setPsfDraft}
            registrationNumber={business.tin}
            errors={errors}
            formError={formError}
            busy={busy}
            onBack={() => setPhase("documents")}
            onNext={submitPsf}
            onSkip={() => {
              setBusiness({ ...business, psfApply: false });
              setPhase("pay");
            }}
          />
        ) : null}

        {phase === "pay" ? (
          <StepReviewPay
            kind={kind}
            personal={personal}
            profile={profile}
            editingProfile={editingProfile}
            capacity={capacity}
            intendedOwner={intendedOwner}
            business={business}
            branches={branches}
            certificates={certificates}
            quote={quote}
            summary={summary}
            busy={busy}
            error={formError}
            contractInput={contractInputFor({ summary, kind, personal, business, profile, editingProfile })}
            onSignAndPay={signAndPay}
            psf={
              needsPsf && psfDraft
                ? {
                    tierName: psfTiers?.find((t) => t.code === psfDraft.requestedTierCode)?.nameEn ?? null,
                    contactName: `${psfDraft.firstName} ${psfDraft.lastName}`.trim(),
                  }
                : null
            }
            onEditPsf={openPsf}
            onBack={() => setPhase(needsPsf ? "psf" : "documents")}
            onEditStep={(step) => {
              if (step === "place") setCarried(false);
              setFormError("");
              setPhase(step);
            }}
          />
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Steps that are small enough to live here
// ---------------------------------------------------------------------------

/**
 * Where a broker lands (F-R09, ADR-026 assumption 2).
 *
 * Its own screen rather than `PipelineStatus`, because there is no pipeline. A
 * broker passes neither government gate and pays nothing, so a rail showing
 * five stages with four of them greyed out would state something untrue about
 * what is going to happen next.
 */
function BrokerDone({ broker }: { broker: BrokerRegistrationSummary }) {
  return (
    <section aria-labelledby="broker-done">
      <div className="flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
        <BadgeCheck size={24} aria-hidden />
      </div>
      <h2
        id="broker-done"
        className="mt-4 text-xl font-semibold tracking-tight"
      >
        You are registered as a broker
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {broker.name
          ? `${broker.name}, your broker workspace is open.`
          : "Your broker workspace is open."}{" "}
        There was no fee and there is nothing to wait for.
      </p>

      <div className="mt-6">
        <Notice tone="info">
          The residence directory and placement tools open in your broker
          workspace. Landlord contact details are revealed to you one at a time,
          and every reveal is logged.
        </Notice>
      </div>
    </section>
  );
}

/** A registration already in flight gets picked up, not started again. */
function ResumePanel({
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
    <section aria-labelledby="resume">
      <h2 id="resume" className="text-xl font-semibold tracking-tight">
        You already have a registration in progress
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Open it to see where it got to, or start a different business.
      </p>
      <ul className="mt-6 space-y-3">
        {pending.map((w) => (
          <li
            key={w.workspaceId}
            className="flex items-center gap-3 rounded-card border border-border p-4"
          >
            <div className="grow">
              <p className="text-sm font-semibold">{w.orgName ?? w.label}</p>
              <p className="text-xs text-muted-foreground">
                {w.registrationStatus === "pending_payment"
                  ? "Waiting for the registration fee."
                  : "In review."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              isDisabled={busy || w.orgId === null}
              onPress={() => w.orgId && onOpen(w.orgId)}
            >
              Open
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="ghost" className="mt-6" onPress={onStartNew}>
        Register a different business
      </Button>
    </section>
  );
}

/** Where you are on the rail — the same rail `/host/start` previews. */
function stepRailActive(phase: Phase): RegistrationStepId | null {
  switch (phase) {
    case "place":
    case "about":
    case "business":
    case "documents":
    case "pay":
      return phase;
    // Still filling things in, on the node before Review (ADR-056).
    case "psf":
      return "documents";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Draft → wire shape, and Zod issues → per-field messages
// ---------------------------------------------------------------------------

/**
 * The draft holds strings because that is what the DOM produces. The contract
 * wants numbers, optionals actually absent, and no empty strings standing in
 * for "not answered" — an empty `gender` is NOT `gender: ""`, it is no gender.
 */
/**
 * `verified`: the identity is verified (ADR-060), so no document is sent and
 * the server keeps the verified one. The browser may not even hold the number
 * any more: a draft never keeps it.
 */
function personalCandidate(d: PersonalDraft, verified = false): unknown {
  return {
    // THE ONE PLACE THE THREE NAME BOXES BECOME THE CONTRACT'S ONE FIELD.
    // `PersonalDetails.fullName` is a single trimmed string and
    // `@injishi/contracts` is not modified by this work, so the split lives in
    // the draft and stops here. Recomposing at the edge rather than storing a
    // fourth combined field in the draft is what keeps the two from drifting:
    // there is no combined value to forget to update when a box is edited.
    fullName: composeFullName(d),
    ...(verified
      ? {}
      : {
          document:
            d.documentType === "passport"
              ? {
                  documentType: "passport",
                  documentNumber: d.documentNumber,
                  issuingCountry: d.issuingCountry,
                }
              : { documentType: "national_id", documentNumber: d.documentNumber },
        }),
    ...(d.gender ? { gender: d.gender } : {}),
    dateOfBirth: d.dateOfBirth,
    phoneE164: d.phoneE164,
    address: addressFromDraft(d.address),
  };
}

/**
 * The business block, with its attached documents.
 *
 * `certificates` is passed in rather than read from the draft because the two
 * are captured on different steps and the business step must be able to
 * validate itself before any document exists — so step 3 sends an empty array
 * and only the final submit sends the real one.
 */
function businessCandidate(
  d: BusinessDraft,
  role: RegistrantRole | null,
  kind: RegistrationKind | null,
  certificates: CertificateDraft[],
  branches: BranchDraft[],
  /** ADR-056: the PSF application a No carries, already in the wire's shape. */
  psfApplication: unknown = null,
): unknown {
  const address = addressFromDraft(d.address);
  const wire = certificates.map((c) => ({
    kind: c.kind,
    ...(c.kind === "other" ? { kindOther: c.kindOther.trim() } : {}),
    objectKey: c.objectKey,
    ...(c.certificateNumber.trim()
      ? { certificateNumber: c.certificateNumber.trim() }
      : {}),
  }));

  if (role === "landlord") {
    return {
      domain: "residence",
      legalName: d.legalName,
      residenceClass: d.residenceClass,
      upi: d.upi,
      address,
      certificates: wire,
    };
  }
  // The RDB entity group rides on the tile, not on a constant. It was hard
  // coded to `accommodation` while `accommodation` was the only group the card
  // offered; a bar & restaurant is `restaurant_bar_nightclub`, which §1 of the
  // classification and `orgs.rdb_entity_group` have both carried all along.
  const entityGroup =
    (kind ? registrationForKind(kind).entityGroup : null) ?? "accommodation";

  return {
    domain: "hospitality",
    legalName: d.legalName,
    entityGroup,
    accommodationClass: d.accommodationClass,
    ...(d.accommodationClass === "other"
      ? { accommodationClassOther: d.accommodationClassOther }
      : {}),
    tin: d.tin,
    ...(d.tourismLicenseNumber
      ? { tourismLicenseNumber: d.tourismLicenseNumber }
      : {}),
    ...(d.chamberOfTourismMember === null ? {} : { chamberOfTourismMember: d.chamberOfTourismMember }),
    ...(d.psfMember === null ? {} : { psfMember: d.psfMember }),
    // ADR-056: a number rides with a Yes, an application with a No.
    ...(d.psfMember === true && d.psfMembershipNumber.trim()
      ? { psfMembershipNumber: d.psfMembershipNumber.trim() }
      : {}),
    ...(d.psfMember === false && psfApplication !== null ? { psfApplication } : {}),
    ...(d.eacStarGrade ? { eacStarGrade: Number(d.eacStarGrade) } : {}),
    address,
    certificates: wire,
    // ADR-054: the other locations, hospitality only. The name is trimmed by
    // the contract, which is also where two equal names are refused.
    branches: branches.map((b) => ({
      name: b.name,
      address: addressFromDraft(b.address),
    })),
  };
}

/**
 * The registration, in the words the contract prints it in.
 *
 * EVERY VALUE ARRIVES ALREADY FORMATTED, because `lib/registration-contract.ts`
 * imports nothing and therefore formats nothing. That is deliberate: the
 * identity document goes through `formatNationalId` — the same helper the
 * review step reads it back with — so a person
 * proofreading the review screen and a person reading the signed contract are
 * looking at the same characters in the same grouping.
 *
 * THE NULLS ARE REAL ANSWERS. A registrant resuming an unpaid registration has
 * no business draft in memory: the server returns a legal name, a domain and a
 * status, and nothing about the TIN or the street. Those rows are omitted from
 * the contract rather than printed as an em dash, because a document that says
 * "TIN —" states something false about what was agreed.
 */
function contractInputFor({
  summary,
  kind,
  personal,
  business,
  profile,
  editingProfile,
}: {
  /** Null before the registration exists: the agreement is read first (ADR-060). */
  summary: RegistrationSummary | null;
  kind: RegistrationKind | null;
  personal: PersonalDraft;
  business: BusinessDraft;
  profile: MyProfile | null;
  editingProfile: boolean;
}): RegistrationContractInput {
  // The same test the review step makes: a returning registrant who confirmed
  // stored details never retyped them, so the profile is the truth about them.
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

  const phone =
    (usingStoredProfile ? profile?.phoneE164 : personal.phoneE164) ?? "";

  // The tile's own word first, because it is the word the person pressed. The
  // server's stored class is the fallback for a resumed registration, where no
  // tile was ever pressed in this browser.
  const storedClass = summary?.accommodationClass ?? null;
  const kindLabel =
    (kind
      ? (REGISTRATION_KINDS.find((k) => k.value === kind)?.label ?? null)
      : null) ??
    (summary?.domain === "residence"
      ? "Residence"
      : storedClass
        ? (ACCOMMODATION_CLASS_LABEL[
            storedClass as keyof typeof ACCOMMODATION_CLASS_LABEL
          ] ?? "Hospitality business")
        : "Hospitality business");

  // A hospitality org is known by its RRA TIN and a residence by the parcel its
  // building stands on, and no registration ever carries both.
  const businessIdLabel = business.tin.trim()
    ? `RRA TIN ${business.tin.trim()}`
    : business.upi.trim()
      ? `UPI ${business.upi.trim()}`
      : null;

  const street =
    business.address.street.trim() || business.address.addressText.trim();

  return {
    registrantName,
    registrantIdLabel,
    registrantPhone: phone.trim() || null,
    // The server's spelling once it holds one; the answer as typed before.
    businessName: summary?.legalName ?? (business.legalName.trim() || "Your business"),
    businessKindLabel: kindLabel,
    businessIdLabel,
    businessAddressLabel: street || null,
    reference: summary?.orgId ?? "Assigned when you submit",
    contractVersion: OPERATOR_CONTRACT_VERSION,
  };
}

/** How the contract names a document, given the type the profile stores. */
function documentWord(documentType: string): string {
  return documentType === "passport" ? "Passport" : "National ID";
}

/** Prefill the edit form from what is already stored, minus the masked parts. */
function personalFromProfile(
  profile: MyProfile | null,
  current: PersonalDraft,
): PersonalDraft {
  if (!profile) return current;
  const a = profile.address;
  return {
    ...current,
    ...splitFullName(profile.fullName ?? ""),
    // Deliberately NOT prefilled: what we hold is masked, and writing
    // "••••5670" back would replace a real document number with dots.
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
              // Optional on the wire, so absent stays "" rather than becoming
              // the string "undefined" that `String()` would hand back.
              cellId: a.cellId === undefined ? "" : String(a.cellId),
              villageId: a.villageId === undefined ? "" : String(a.villageId),
              street: a.street ?? "",
              addressText: "",
            }
          : {
              ...EMPTY_ADDRESS,
              country: a.country,
              addressText: a.addressText,
            },
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
function prefix(
  p: string,
  errors: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) out[`${p}.${k}`] = v;
  return out;
}
