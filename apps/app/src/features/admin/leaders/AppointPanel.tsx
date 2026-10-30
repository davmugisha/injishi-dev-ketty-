"use client";

import { Description, FieldError, Input, Label, TextArea, TextField, toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import {
  AppointOfficerRequest,
  type GovernmentBody,
  isLeaderRole,
  LEADER_ROLE_BODY,
  LEADER_ROLE_LABEL,
  OVERSIGHT_ROLE_LABEL,
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
import { useState, useTransition } from "react";
import { loadGuestPlaces } from "../../guests/places";
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
  { id: "dgie_national", label: OVERSIGHT_ROLE_LABEL.dgie_national, description: "Guests from abroad, the whole country" },
  { id: "business_field_verifier", label: "Document reviewer", description: "Reviews a business's documents online" },
  { id: "business_approver", label: "Business approver", description: "Approves businesses whose documents are checked" },
  { id: "tax_compliance_officer", label: OVERSIGHT_ROLE_LABEL.tax_compliance_officer, description: "Tax compliance" },
  {
    id: "psf_membership_officer",
    label: OVERSIGHT_ROLE_LABEL.psf_membership_officer,
    description: "PSF membership: a district manager decides, province and national managers oversee",
  },
];

export function roleLabel(role: OversightRole): string {
  return ROLE_CHOICES.find((r) => r.id === role)?.label ?? OVERSIGHT_ROLE_LABEL[role];
}

const LEVEL_WORD: Record<OversightScopeLevel, string> = {
  country: "The whole country",
  province: "A province",
  district: "A district",
  sector: "A sector",
  cell: "A cell",
  village: "A village",
};

function defaultBody(role: OversightRole, bodies: readonly GovernmentBody[]): string {
  const wanted = isLeaderRole(role) ? LEADER_ROLE_BODY[role] : role === "psf_membership_officer" ? "PSF" : "MINALOC";
  return bodies.find((b) => b.code === wanted && b.active)?.code ?? bodies.find((b) => b.active)?.code ?? "";
}

function defaultLevel(role: OversightRole): OversightScopeLevel {
  const allowed = OVERSIGHT_ROLE_SCOPES[role];
  return allowed.includes("district") ? "district" : (allowed[0] ?? "country");
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
  const router = useRouter();
  const startRole = prefill?.role ?? "village_leader";
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [name, setName] = useState("");
  const [role, setRole] = useState<OversightRole>(startRole);
  const [level, setLevel] = useState<OversightScopeLevel>(defaultLevel(startRole));
  const [chain, setChain] = useState<PlaceChain>(prefill?.chain ?? {});
  const [body, setBody] = useState(defaultBody(startRole, bodies));
  const [title, setTitle] = useState(roleLabel(startRole));
  const [titleTouched, setTitleTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  // Editing a field takes its error away; Appoint checks everything again.
  const clear = (field: string): void => setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));
  const allowed = OVERSIGHT_ROLE_SCOPES[role];
  const depth: PlaceLevel | null = level === "country" ? null : (level as PlaceLevel);
  const area = depth ? areaWords(chain, level) : "the whole country";

  const chooseRole = (next: OversightRole) => {
    setRole(next);
    const nextLevel = defaultLevel(next);
    setLevel(nextLevel);
    setBody(defaultBody(next, bodies));
    if (!titleTouched) setTitle(roleLabel(next));
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
    if (depth && !isPlaceComplete(chain, depth)) {
      next.area = `Choose every level, down to the ${depth}.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const appoint = () => {
    start(async () => {
      const result = await appointOfficer(request());
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
      toast.success(`${result.value.name ?? result.value.email} is now ${result.value.roleLabel.toLowerCase()}`);
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? undefined : onClose())}
        title="Appoint a leader or officer"
        description="They sign in with this email and a code we send them."
        submitLabel="Appoint"
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
          label="Email"
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
          <Label>Full name</Label>
          <Input placeholder="As on their ID" />
          <Description>Optional. Used when they have no account yet.</Description>
          <FieldError>{errors.name}</FieldError>
        </TextField>
        <SelectField
          label="Role"
          name="role"
          value={role}
          options={ROLE_CHOICES}
          onChange={(v) => chooseRole(v as OversightRole)}
          errorMessage={errors.role}
        />
        {allowed.length > 1 ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Covers</span>
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
                  {LEVEL_WORD[l]}
                </Segment.Item>
              ))}
            </Segment>
          </div>
        ) : null}
        {depth ? (
          <PlacePicker
            label={`Area: ${LEVEL_WORD[level].toLowerCase()}`}
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
          <p className="text-sm text-muted">This role covers the whole country.</p>
        )}
        <SelectField
          label="Government body"
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
          <Label>Title</Label>
          <Input />
          <Description>What their institution calls the post.</Description>
          <FieldError>{errors.governmentTitle}</FieldError>
        </TextField>
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
          <Label>Why</Label>
          <TextArea rows={3} placeholder="Took office in October 2026" />
          <Description>Kept with the appointment in the audit log.</Description>
          <FieldError>{errors.reason}</FieldError>
        </TextField>
      </SidePanel>
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={`Appoint ${name.trim() || email}?`}
        confirmLabel="Appoint"
        confirmIcon="PersonPlus"
        isPending={pending}
        onConfirm={appoint}
      >
        {`${name.trim() || email} becomes ${roleLabel(role).toLowerCase()} for ${area || "the area chosen"}. `}
        {isLeaderRole(role)
          ? "They get an email to sign in, and the guests in that area reach them from now on, with any that were waiting."
          : "They get an email to sign in, and the businesses in that area reach their queue."}
      </ConfirmDialog>
    </>
  );
}
