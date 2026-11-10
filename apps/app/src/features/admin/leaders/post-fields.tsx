"use client";

import { FieldError, Input, Label, TextField } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import {
  AppointOfficerRequest,
  type GovernmentBody,
  isLeaderRole,
  LEADER_ROLE_BODY,
  LEADER_ROLE_LABEL,
  OVERSIGHT_ROLE_LABEL,
  OVERSIGHT_ROLE_POSTING,
  OVERSIGHT_ROLE_SCOPES,
  type OversightRole,
  type OversightScopeLevel,
} from "@injishi/contracts";
import { isPlaceComplete, type PlaceChain, type PlaceLevel, PlacePicker, SelectField } from "@injishi/ui";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { loadGuestPlaces } from "../../guests/places";
import { findPersonByEmail, type KnownPerson } from "./actions";

/** The roles in the order the form offers them: local leaders, then business reviewers, then other officers. */
export const ROLE_CHOICES: { id: OversightRole; label: string; description: string }[] = [
  { id: "village_leader", label: LEADER_ROLE_LABEL.village_leader, description: "Every guest in one village" },
  { id: "cell_executive", label: LEADER_ROLE_LABEL.cell_executive, description: "Every guest in one cell" },
  { id: "dasso", label: OVERSIGHT_ROLE_LABEL.dasso, description: "Every guest in one sector" },
  { id: "sector_executive", label: OVERSIGHT_ROLE_LABEL.sector_executive, description: "Every guest in one sector" },
  { id: "district_officer", label: LEADER_ROLE_LABEL.district_officer, description: "Every guest in one district" },
  { id: "dgie_village", label: LEADER_ROLE_LABEL.dgie_village, description: "Guests from abroad in one village" },
  { id: "dgie_cell", label: LEADER_ROLE_LABEL.dgie_cell, description: "Guests from abroad in one cell" },
  {
    id: "district_immigration",
    label: LEADER_ROLE_LABEL.district_immigration,
    description: "Guests from abroad in one district",
  },
  { id: "dgie_province", label: OVERSIGHT_ROLE_LABEL.dgie_province, description: "Guests from abroad in one province" },
  {
    id: "dgie_national",
    label: OVERSIGHT_ROLE_LABEL.dgie_national,
    description: "Guests from abroad, the whole country",
  },
  { id: "business_field_verifier", label: "Document reviewer", description: "Reviews a business's documents online" },
  {
    id: "business_approver",
    label: "Business approver",
    description: "Approves businesses whose documents are checked",
  },
  { id: "tax_compliance_officer", label: OVERSIGHT_ROLE_LABEL.tax_compliance_officer, description: "Tax compliance" },
  {
    id: "psf_membership_officer",
    label: "PSF National and Regional Managers",
    // 2026-11-02: Injishi appoints PSF's Regional Managers only; each appoints its districts' District
    // Managers from the PSF console's Team screen.
    description:
      "National: the whole country, the split, bands and form. Regional: one province, and appoints its District Managers",
  },
  // Admin creates BDEs (2026-11-05, the owner), each for one district, with their ID.
  {
    id: "psf_business_officer",
    label: "PSF BDE (Business Development & Empowerment)",
    description: "Reads one district's PSF console. Approvals come later",
  },
];

/**
 * What the Role list offers. PSF's National and Regional Managers are two posts (the owner, 2026-11-09)
 * held as one role at two levels, so each is its own choice with its level fixed: "role@level".
 */
export const POST_CHOICES: { id: string; label: string; description: string }[] = ROLE_CHOICES.flatMap((c) =>
  c.id === "psf_membership_officer"
    ? [
        {
          id: "psf_membership_officer@country",
          label: "PSF National Manager",
          description: "The whole country: the split, levels and bands, and the form",
        },
        {
          id: "psf_membership_officer@province",
          label: "PSF Regional Manager",
          description: "One province, and appoints its District Managers",
        },
      ]
    : [c],
);

/** A Role-list choice: the role, and the level it is fixed at when the choice is a post of its own. */
function parseChoice(id: string): { role: OversightRole; level: OversightScopeLevel | null } {
  const [role, level] = id.split("@");
  return { role: role as OversightRole, level: (level as OversightScopeLevel | undefined) ?? null };
}

/** The choice a role opens on (a coverage gap or a person's page names only the role). */
function choiceFor(role: OversightRole): string {
  return role === "psf_membership_officer" ? "psf_membership_officer@province" : role;
}

const choiceLabel = (id: string): string =>
  POST_CHOICES.find((c) => c.id === id)?.label ?? roleLabel(parseChoice(id).role);

export function roleLabel(role: OversightRole): string {
  return ROLE_CHOICES.find((r) => r.id === role)?.label ?? OVERSIGHT_ROLE_LABEL[role];
}

function defaultBody(role: OversightRole, bodies: readonly GovernmentBody[]): string {
  const wanted = isLeaderRole(role) ? LEADER_ROLE_BODY[role] : role === "psf_membership_officer" ? "PSF" : "MINALOC";
  return bodies.find((b) => b.code === wanted && b.active)?.code ?? bodies.find((b) => b.active)?.code ?? "";
}

/** The levels admin may post a role at: a posting rule narrows the role's own (PSF: province or country). */
function levelsFor(role: OversightRole): readonly OversightScopeLevel[] {
  return OVERSIGHT_ROLE_POSTING[role]?.scopeLevels ?? OVERSIGHT_ROLE_SCOPES[role];
}

function defaultLevel(role: OversightRole): OversightScopeLevel {
  const allowed = levelsFor(role);
  return allowed.includes("district")
    ? "district"
    : allowed.includes("province")
      ? "province"
      : (allowed[0] ?? "country");
}

/** "Kamatamu cell, Kacyiru sector, Gasabo": the place down to the level, each level named, no province. */
function areaWords(chain: PlaceChain, level: OversightScopeLevel): string {
  if (level === "province") return chain.province?.name ?? "";
  const deep = ["district", "sector", "cell", "village"].indexOf(level);
  const parts = [
    deep >= 3 && chain.village ? `${chain.village.name} village` : null,
    deep >= 2 && chain.cell ? `${chain.cell.name} cell` : null,
    deep >= 1 && chain.sector ? `${chain.sector.name} sector` : null,
    chain.district?.name ?? null,
  ];
  return parts.filter(Boolean).join(", ");
}

/** What a waiting area or a coverage gap hands the form. */
export interface AppointPrefill {
  /** Left out when the admin is to choose (Appoint from a person's page). */
  role?: OversightRole;
  chain: PlaceChain;
  /** The person, when the panel was opened from their page in People. */
  email?: string;
}

/** The request's place ids, from the chain, down to the level the role covers. */
function areaIds(chain: PlaceChain, level: OversightScopeLevel): Record<string, number | null> {
  const id = (l: PlaceLevel) => (chain[l] ? Number(chain[l]?.id) : null);
  const deep = ["province", "district", "sector", "cell", "village"].indexOf(level);
  return {
    provinceId: deep >= 0 ? id("province") : null,
    districtId: deep >= 1 ? id("district") : null,
    sectorId: deep >= 2 ? id("sector") : null,
    cellId: deep >= 3 ? id("cell") : null,
    villageId: deep >= 4 ? id("village") : null,
  };
}

/** The person's side of an appointment, which the form around the post fields owns. */
export interface PostPerson {
  email: string;
  name: string;
  reason: string;
}

/**
 * The post half of an appointment: role, the levels it covers, the area down the place cascade, the
 * government body and its title for the post, and a BDE's ID. Shared by Appoint (Government) and Add person
 * (People), so a person and their post are entered once, in one form.
 */
export function usePostFields(bodies: readonly GovernmentBody[], prefill: Omit<AppointPrefill, "email"> | null) {
  const t = useTranslations("admin.appointment");
  const tr = useTranslations("admin.roles");
  const descriptionFor = (id: OversightRole): string => {
    switch (id) {
      case "village_leader":
        return tr("villageLeader");
      case "cell_executive":
        return tr("cellExecutive");
      case "dasso":
      case "sector_executive":
        return tr("sectorScope");
      case "district_officer":
        return tr("districtScope");
      case "dgie_village":
        return tr("foreignVillage");
      case "dgie_cell":
        return tr("foreignCell");
      case "district_immigration":
        return tr("foreignDistrict");
      case "dgie_province":
        return tr("foreignProvince");
      case "dgie_national":
        return tr("foreignCountry");
      case "business_field_verifier":
        return t("reviewerDescription");
      case "business_approver":
        return t("approverDescription");
      case "tax_compliance_officer":
        return tr("taxCompliance");
      case "psf_membership_officer":
        return t("psfDescription");
      case "psf_business_officer":
        return t("bdeDescription");
      default:
        return id;
    }
  };
  // The catalog names each role; PSF's National and Regional Manager choices (2026-11-09) are not in it yet.
  const labelOf = (id: string): string => (parseChoice(id).level ? choiceLabel(id) : tr(parseChoice(id).role));
  // Nothing is chosen for the admin: a role comes from a coverage gap they pressed, or they pick it.
  const startRole = prefill?.role ?? null;
  const startChoice = startRole ? choiceFor(startRole) : null;
  const [choice, setChoice] = useState<string | null>(startChoice);
  const role = choice ? parseChoice(choice).role : null;
  const fixedLevel = choice ? parseChoice(choice).level : null;
  const [level, setLevel] = useState<OversightScopeLevel>(
    startChoice ? (parseChoice(startChoice).level ?? defaultLevel(parseChoice(startChoice).role)) : "country",
  );
  const [chain, setChain] = useState<PlaceChain>(prefill?.chain ?? {});
  const [body, setBody] = useState(startRole ? defaultBody(startRole, bodies) : "");
  // The title follows the role until the admin types their institution's own.
  const [title, setTitle] = useState(startChoice ? labelOf(startChoice) : "");
  const [titleTouched, setTitleTouched] = useState(false);
  // The body and title follow the role; they are one quiet line until the admin wants their own.
  const [customising, setCustomising] = useState(false);
  const [idType, setIdType] = useState<"national_id" | "passport">("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clear = (field: string): void => setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));
  const allowed = fixedLevel ? [fixedLevel] : role ? levelsFor(role) : [];
  const depth: PlaceLevel | null = !role || level === "country" ? null : (level as PlaceLevel);
  const area = depth ? areaWords(chain, level) : t("country");
  const bodyName = bodies.find((b) => b.code === body)?.nameEn ?? body;

  const choose = (next: string) => {
    const picked = parseChoice(next);
    setChoice(next);
    setLevel(picked.level ?? defaultLevel(picked.role));
    setBody(defaultBody(picked.role, bodies));
    if (!titleTouched) setTitle(labelOf(next));
    setErrors({});
  };

  const request = (person: PostPerson) => ({
    email: person.email,
    name: person.name.trim() || null,
    role,
    governmentBodyCode: body,
    governmentTitle: title,
    scopeLevel: level,
    ...areaIds(chain, level),
    ...(role === "psf_business_officer" ? { idDocument: { documentType: idType, documentNumber: idNumber } } : {}),
    reason: person.reason,
  });

  /** Every problem with the appointment, keyed by field ("area" for any place level); empty when it is fine. */
  const problems = (person: PostPerson): Record<string, string> => {
    const parsed = AppointOfficerRequest.safeParse(request(person));
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        const field = key.endsWith("Id") || key === "scopeLevel" ? "area" : key;
        if (!next[field]) next[field] = issue.message;
      }
    }
    if (!role) next.role = t("chooseError");
    if (depth && !isPlaceComplete(chain, depth)) next.area = t("levelError", { level: t(depth) });
    return next;
  };

  /** Shows the problems under the fields and returns them; empty when the appointment can go. */
  const check = (person: PostPerson): Record<string, string> => {
    const all = problems(person);
    setErrors(all);
    return all;
  };

  /** The API's field errors, mapped onto these fields. */
  const showServerErrors = (fieldErrors: Record<string, string>): Record<string, string> => {
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldErrors)) fields[k.endsWith("Id") || k === "scopeLevel" ? "area" : k] = v;
    setErrors(fields);
    return fields;
  };

  const fields: ReactNode = (
    <>
      <SelectField
        label={t("role")}
        name="role"
        value={choice}
        placeholder={t("chooseRole")}
        options={POST_CHOICES.map((c) =>
          parseChoice(c.id).level ? c : { ...c, label: tr(c.id), description: descriptionFor(c.id as OversightRole) },
        )}
        onChange={choose}
        errorMessage={errors.role}
      />
      {role ? (
        <>
          {allowed.length > 1 ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("covers")}</span>
              <Segment
                aria-label="Covers"
                selectedKey={level}
                onSelectionChange={(k) => {
                  setLevel(k as OversightScopeLevel);
                  setErrors({});
                }}
                className="w-fit max-w-full"
              >
                {allowed.map((l) => (
                  <Segment.Item key={l} id={l}>
                    {t(l)}
                  </Segment.Item>
                ))}
              </Segment>
            </div>
          ) : null}
          {depth ? (
            <PlacePicker
              label={t("area", { level: t(level) })}
              value={chain}
              depth={depth}
              onChange={(next) => {
                setChain(next);
                setErrors((e) => ({ ...e, area: "" }));
              }}
              loadPlaces={loadGuestPlaces}
              reserveSpace={false}
              errorMessage={errors.area || null}
            />
          ) : (
            <p className="text-sm text-muted">{t("coversCountry")}</p>
          )}
          {customising || !body || errors.governmentBodyCode || errors.governmentTitle ? (
            <>
              <SelectField
                label={t("governmentBody")}
                name="governmentBodyCode"
                value={body || null}
                options={bodies
                  .filter((b) => b.active)
                  .map((b) => ({ id: b.code, label: b.nameEn, description: b.abbreviation ?? undefined }))}
                onChange={(v) => {
                  setBody(v);
                  clear("governmentBodyCode");
                }}
                errorMessage={errors.governmentBodyCode}
              />
              <TextField
                name="governmentTitle"
                value={title}
                onChange={(v) => {
                  setTitle(v);
                  setTitleTouched(true);
                  clear("governmentTitle");
                }}
                isInvalid={errors.governmentTitle ? true : undefined}
                fullWidth
                className="gap-1"
              >
                <Label>Their title there</Label>
                <Input />
                <FieldError>{errors.governmentTitle}</FieldError>
              </TextField>
            </>
          ) : (
            <div className="flex items-start justify-between gap-3 rounded-xl bg-default/60 px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="text-muted">Title</span> <span className="font-medium">{title}</span>
                <span className="text-muted"> at </span>
                <span className="font-medium">{bodyName}</span>
              </span>
              <button
                type="button"
                className="shrink-0 font-medium text-accent hover:underline"
                onClick={() => setCustomising(true)}
              >
                Change
              </button>
            </div>
          )}
          {role === "psf_business_officer" ? (
            <>
              <SelectField
                label={t("idDocument")}
                name="idDocumentType"
                value={idType}
                onChange={(v) => setIdType(v === "passport" ? "passport" : "national_id")}
                options={[
                  { id: "national_id", label: t("nationalId") },
                  { id: "passport", label: t("passport") },
                ]}
              />
              <TextField
                name="idDocumentNumber"
                value={idNumber}
                onChange={(v) => {
                  setIdNumber(v);
                  clear("idDocument");
                }}
                isInvalid={errors.idDocument ? true : undefined}
                fullWidth
                className="gap-1"
              >
                <Label>{idType === "passport" ? t("passportNumber") : t("nationalIdNumber")}</Label>
                <Input
                  placeholder={idType === "passport" ? t("passportHelp") : t("nationalIdHelp")}
                  autoComplete="off"
                />
                <FieldError>{errors.idDocument}</FieldError>
              </TextField>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );

  const label = choice ? labelOf(choice) : "";
  /** What the person hears they become: "… becomes PSF BDE … for Gasabo." */
  const sentence = (who: string): string =>
    `${t("confirmLead", { person: who, role: label, area: area || t("chosenArea") })} ${
      role && isLeaderRole(role) ? t("confirmBodyLeader") : t("confirmBodyOfficer")
    }`;

  return { role, label, area, fields, errors, request, check, showServerErrors, sentence };
}

/**
 * Who already signs in with this email, looked up a moment after the last key (2026-11-09), so a form can
 * greet a known person by name instead of asking for it again. Null while unknown or not an account.
 */
export function useKnownPerson(email: string): KnownPerson | null {
  const [known, setKnown] = useState<KnownPerson | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void findPersonByEmail(email).then((p) => {
        if (live) setKnown(p);
      });
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [email]);
  return known;
}

/** The words under the email field once the person is known. */
export function knownWords(known: KnownPerson): string {
  return `${known.name ?? "This person"} already has an account${known.post ? `, now ${known.post}` : ""}${
    known.status === "suspended" ? ". It is suspended; appointing does not reactivate it" : ""
  }.`;
}
