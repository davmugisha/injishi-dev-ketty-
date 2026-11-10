"use client";

import { FieldError, Input, Label, TextArea, TextField, toast } from "@heroui/react";
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
import {
  ConfirmDialog,
  EmailInput,
  isPlaceComplete,
  type PlaceChain,
  type PlaceLevel,
  PlacePicker,
  SelectField,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { loadGuestPlaces } from "../../guests/places";
import { useStepUp } from "../step-up/step-up-dialog";
import { appointOfficer } from "./actions";

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
    label: "PSF National or Regional Manager",
    // 2026-11-02: Injishi appoints PSF's Regional Managers only; each appoints its districts' District
    // Managers from the PSF console's Team screen.
    description: "National: the whole country, the split, bands and form. Regional: one province, and appoints its District Managers",
  },
  // Admin creates BDEs (2026-11-05, the owner), each for one district, with their ID.
  {
    id: "psf_business_officer",
    label: "PSF BDE (Business Development & Empowerment)",
    description: "Reads one district's PSF console. Approvals come later",
  },
];

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
  return allowed.includes("district") ? "district" : allowed.includes("province") ? "province" : (allowed[0] ?? "country");
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
  role: OversightRole;
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

/**
 * Appoint a person to a post: their email (they sign in with an emailed code; an account is made if they
 * have none), the role, the government body and its own title for the post, the area at the level the
 * role covers (picked down the place cascade), and why. A confirmation names exactly what happens before
 * anything is written; the admin API holds it to `admin.user.role.grant` behind the step-up.
 */
export function AppointPanel({
  bodies,
  prefill,
  onClose,
}: {
  bodies: readonly GovernmentBody[];
  prefill: AppointPrefill | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin.appointment");
  const tr = useTranslations("admin.roles");
  const descriptionFor = (id: OversightRole): string => {
    switch (id) {
      case "village_leader": return tr("villageLeader");
      case "cell_executive": return tr("cellExecutive");
      case "dasso":
      case "sector_executive": return tr("sectorScope");
      case "district_officer": return tr("districtScope");
      case "dgie_village": return tr("foreignVillage");
      case "dgie_cell": return tr("foreignCell");
      case "district_immigration": return tr("foreignDistrict");
      case "dgie_province": return tr("foreignProvince");
      case "dgie_national": return tr("foreignCountry");
      case "business_field_verifier": return t("reviewerDescription");
      case "business_approver": return t("approverDescription");
      case "tax_compliance_officer": return tr("taxCompliance");
      case "psf_membership_officer": return t("psfDescription");
      case "psf_business_officer": return t("bdeDescription");
      default: return id;
    }
  };
  const router = useRouter();
  // Nothing is chosen for the admin: a role comes from a coverage gap they pressed, or they pick it.
  const startRole = prefill?.role ?? null;
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [name, setName] = useState("");
  const [role, setRole] = useState<OversightRole | null>(startRole);
  const [level, setLevel] = useState<OversightScopeLevel>(startRole ? defaultLevel(startRole) : "country");
  const [chain, setChain] = useState<PlaceChain>(prefill?.chain ?? {});
  const [body, setBody] = useState(startRole ? defaultBody(startRole, bodies) : "");
  const [title, setTitle] = useState(startRole ? tr(startRole) : "");
  const [titleTouched, setTitleTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [idType, setIdType] = useState<"national_id" | "passport">("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Appointing gives authority, so the API may ask for a fresh code first (2026-11-02).
  const stepUp = useStepUp();
  const pending = stepUp.pending;

  // Editing a field takes its error away; Appoint checks everything again.
  const clear = (field: string): void => setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));
  // No role picked yet (main): no levels. A PSF post keeps its own posting levels (this branch).
  const allowed = role ? levelsFor(role) : [];
  const depth: PlaceLevel | null = !role || level === "country" ? null : (level as PlaceLevel);
  const area = depth ? areaWords(chain, level) : t("country");

  const chooseRole = (next: OversightRole) => {
    setRole(next);
    const nextLevel = defaultLevel(next);
    setLevel(nextLevel);
    setBody(defaultBody(next, bodies));
    if (!titleTouched) setTitle(tr(next));
    setErrors({});
  };

  const request = () => ({
    email,
    name: name.trim() || null,
    role,
    governmentBodyCode: body,
    governmentTitle: title,
    scopeLevel: level,
    ...areaIds(chain, level),
    ...(role === "psf_business_officer" ? { idDocument: { documentType: idType, documentNumber: idNumber } } : {}),
    reason,
  });

  const check = (): boolean => {
    const parsed = AppointOfficerRequest.safeParse(request());
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        const field = key.endsWith("Id") || key === "scopeLevel" ? "area" : key;
        if (!next[field]) next[field] = issue.message;
      }
    }
    if (!role) next.role = t("chooseError");
    if (depth && !isPlaceComplete(chain, depth)) {
      next.area = t("levelError", { level: t(depth) });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const appoint = () => {
    setConfirming(false);
    stepUp.guard(
      () => appointOfficer(request()),
      (result) => {
        setConfirming(false);
        if (!result.ok) {
          const fields: Record<string, string> = {};
          for (const [k, v] of Object.entries(result.fieldErrors ?? {})) {
            fields[k.endsWith("Id") || k === "scopeLevel" ? "area" : k] = v;
          }
          setErrors(fields);
          setFormError(Object.keys(fields).length > 0 ? null : result.error);
          return;
        }
        toast.success(t("appointmentSuccess", { person: result.value.name ?? result.value.email, role: tr(result.value.role) }));
        onClose();
        router.refresh();
      },
    );
  };

  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={t("title")}
        submitLabel={t("appoint")}
        submitIcon="PersonPlus"
        isPending={pending}
        validationErrors={errors}
        formError={formError}
        onSubmit={(event) => {
          event.preventDefault();
          setFormError(null);
          if (check()) setConfirming(true);
        }}
      >
        <EmailInput
          label={t("email")}
          name="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clear("email");
          }}
          isRequired
          errorMessage={errors.email || null}
        />
        <TextField
          name="name"
          value={name}
          onChange={(v) => {
            setName(v);
            clear("name");
          }}
          isInvalid={errors.name ? true : undefined}
          fullWidth
          className="gap-1"
        >
          <Label>{t("name")}</Label>
          <Input placeholder={t("nameHint")} />
          <FieldError>{errors.name}</FieldError>
        </TextField>
        <SelectField
          label={t("role")}
          name="role"
          value={role}
          placeholder={t("chooseRole")}
          options={ROLE_CHOICES.map((choice) => ({ ...choice, label: tr(choice.id), description: descriptionFor(choice.id) }))}
          onChange={(v) => chooseRole(v as OversightRole)}
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
              <Label>{t("titleLabel")}</Label>
              <Input />
              <FieldError>{errors.governmentTitle}</FieldError>
            </TextField>
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
                  <Input placeholder={idType === "passport" ? t("passportHelp") : t("nationalIdHelp")} autoComplete="off" />
                  <FieldError>{errors.idDocument}</FieldError>
                </TextField>
              </>
            ) : null}
            <TextField
              name="reason"
              value={reason}
              onChange={(v) => {
                setReason(v);
                clear("reason");
              }}
              isInvalid={errors.reason ? true : undefined}
              fullWidth
              className="gap-1"
            >
              <Label>{t("why")}</Label>
              <TextArea rows={3} placeholder={t("reasonPlaceholder")} />
              <FieldError>{errors.reason}</FieldError>
            </TextField>
          </>
        ) : null}
      </SidePanel>
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle", { person: name.trim() || email })}
        confirmLabel={t("appoint")}
        confirmIcon="PersonPlus"
        isPending={pending}
        onConfirm={appoint}
      >
        {t("confirmLead", { person: name.trim() || email, role: role ? tr(role).toLowerCase() : "", area: area || t("chosenArea") })}{" "}
        {role && isLeaderRole(role)
          ? t("confirmBodyLeader")
          : t("confirmBodyOfficer")}
      </ConfirmDialog>
      {stepUp.dialog}
    </>
  );
}
