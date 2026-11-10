"use client";

import { Alert, Button, Input } from "@heroui/react";
import {
  PSF_TEAM_ROLE_DESCRIPTION,
  PSF_TEAM_ROLE_LABEL,
  type PsfTeamRole,
  type PsfTeamView as Team,
} from "@injishi/contracts";
import { DataTable, EmptyBlock, formatDay, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PsfScope } from "@/server/sources/psf";
import { appointPsfTeamAction, endPsfTeamAction } from "./psf-team-actions";

type Member = Team["members"][number];

/** A post's name: the catalog's for the two district posts; the Regional Manager (2026-11-09) is not in it yet. */
function postName(t: (key: "dm" | "bde") => string, role: PsfTeamRole): string {
  return role === "regional_manager"
    ? PSF_TEAM_ROLE_LABEL.regional_manager
    : role === "district_manager"
      ? t("dm")
      : t("bde");
}

/**
 * The PSF team: the National Manager appoints Regional Managers, District Managers and BDEs anywhere
 * (2026-11-09); a Regional Manager appoints its districts' District Managers; each ends what it may appoint,
 * with a reason. A District Manager reads who is who. Every appointment takes the person's ID.
 */
export function PsfTeamView({ scope, initial }: { scope: PsfScope; initial: Team }) {
  const t = useTranslations("psfTeam");
  const [team, setTeam] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const managers = team.members.filter((m) => m.role === "district_manager").length;
  const regionals = team.members.filter((m) => m.role === "regional_manager").length;
  const appointsManagers = team.appointRoles.includes("district_manager");
  const national = team.appointRoles.includes("regional_manager");
  const areaOf = (m: Member): string =>
    m.role === "regional_manager" ? (m.provinceName ?? "the province") : (m.districtName ?? "the district");
  // A Regional Manager ends anyone in its districts; a District Manager reads.
  const mayEnd = (_m: Member): boolean => appointsManagers;
  const roleName = (role: PsfTeamRole) => postName(t, role);

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title={t("title")}
        description={
          national
            ? "PSF's Regional Managers, District Managers and BDEs across Rwanda. You appoint all three."
            : appointsManagers
              ? t("provinceLead")
              : t("districtLead")
        }
      />

      <Alert status="accent">
        <Alert.Content>
          <Alert.Title>
            {national
              ? "Who appoints whom: you appoint Regional Managers, District Managers and BDEs; a Regional Manager appoints its own District Managers"
              : "Two posts in each district: the Regional Manager appoints the first, PSF's National Manager or Injishi's admin the second"}
          </Alert.Title>
          <Alert.Description>
            {national ? (
              <>
                <strong>{PSF_TEAM_ROLE_LABEL.regional_manager}:</strong> {
                  PSF_TEAM_ROLE_DESCRIPTION.regional_manager
                }{" "}
              </>
            ) : null}
            <strong>{t("dm")}:</strong> {t("districtManagerDescription")} <strong>{t("bde")}:</strong>{" "}
            {t("bdeDescription")}
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {note ? (
        <Alert status="success">
          <Alert.Content>
            <Alert.Description>{note}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <SectionCard
        title={t("people")}
        description={`${t("personCount", { count: team.members.length })}${
          national ? ` · ${regionals} Regional ${regionals === 1 ? "Manager" : "Managers"}` : ""
        } · ${t("managerCount", { count: managers })}`}
        actions={
          team.appointRoles.length > 0 && !adding ? (
            <Button size="sm" variant="primary" onPress={() => setAdding(true)}>
              {t("appoint")}
            </Button>
          ) : null
        }
        contentClassName="gap-3"
      >
        {adding ? (
          <AppointForm
            roles={team.appointRoles}
            districts={team.districts}
            provinces={team.provinces}
            onCancel={() => setAdding(false)}
            onDone={(next, text) => {
              setTeam(next);
              setAdding(false);
              setNote(text);
            }}
          />
        ) : null}
        <DataTable
          label={t("table")}
          rows={team.members}
          rowKey={(m) => m.assignmentId}
          empty={
            <EmptyBlock
              size="sm"
              icon="Persons"
              title={t("none")}
              description={appointsManagers ? t("appointDistricts") : t("noneDistrict")}
            />
          }
          columns={[
            {
              id: "person",
              header: t("person"),
              isRowHeader: true,
              sortValue: (m) => m.name ?? m.email,
              cell: (m) => (
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{m.name ?? m.email}</span>
                  <span className="text-xs text-muted">{m.email}</span>
                  {m.idDocumentLine ? <span className="text-xs text-muted">{m.idDocumentLine}</span> : null}
                </span>
              ),
            },
            {
              id: "role",
              header: t("post"),
              sortValue: (m) => m.role,
              cell: (m) => (
                <StatusChip
                  tone={m.role === "regional_manager" ? "warning" : m.role === "district_manager" ? "success" : "info"}
                >
                  {roleName(m.role)}
                </StatusChip>
              ),
            },
            {
              id: "area",
              header: "Area",
              sortValue: (m) => `${m.provinceName ?? ""} ${m.districtName ?? ""}`,
              cell: (m) => (m.role === "regional_manager" ? (m.provinceName ?? "—") : (m.districtName ?? "—")),
            },
            {
              id: "since",
              header: t("since"),
              sortValue: (m) => m.appointedAt,
              cell: (m) => (
                <span className="flex flex-col gap-0.5">
                  <span className="tabular">{formatDay(m.appointedAt)}</span>
                  {m.appointedByName ? (
                    <span className="text-xs text-muted">{t("appointedBy", { name: m.appointedByName })}</span>
                  ) : null}
                </span>
              ),
            },
            ...(team.appointRoles.length > 0
              ? [
                  {
                    id: "end",
                    header: "",
                    align: "end" as const,
                    cell: (m: Member) =>
                      mayEnd(m) ? (
                        <EndAppointment
                          member={m}
                          onDone={(next) => {
                            setTeam(next);
                            setNote(
                              t("noLonger", { name: m.name ?? m.email, role: roleName(m.role), district: areaOf(m) }),
                            );
                          }}
                        />
                      ) : null,
                  },
                ]
              : []),
          ]}
          mobile={{
            title: (m) => m.name ?? m.email,
            description: (m) => [roleName(m.role), areaOf(m)].filter(Boolean).join(" · "),
          }}
        />
      </SectionCard>
    </PageContent>
  );
}

function AppointForm({
  roles,
  districts,
  provinces,
  onCancel,
  onDone,
}: {
  roles: PsfTeamRole[];
  districts: Team["districts"];
  provinces: Team["provinces"];
  onCancel: () => void;
  onDone: (next: Team, note: string) => void;
}) {
  const t = useTranslations("psfTeam");
  const roleName = (r: PsfTeamRole) => postName(t, r);
  const [role, setRole] = useState<PsfTeamRole>(roles[0] ?? "business_officer");
  const [districtId, setDistrict] = useState(String(districts[0]?.id ?? ""));
  const [provinceId, setProvince] = useState(String(provinces[0]?.id ?? ""));
  const regional = role === "regional_manager";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [idType, setIdType] = useState<"national_id" | "passport">("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const multipleProvinces = new Set(districts.map((d) => d.provinceName)).size > 1;

  return (
    <form
      className="flex flex-col gap-4 rounded-xl bg-default/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setProblem(null);
        const res = await appointPsfTeamAction({
          email,
          name,
          role,
          idDocument: { documentType: idType, documentNumber: idNumber },
          ...(regional ? { provinceId: Number(provinceId) } : { districtId: Number(districtId) }),
          reason,
        });
        setBusy(false);
        if (!res.ok) return setProblem(res.error);
        const place = regional
          ? (provinces.find((p) => String(p.id) === provinceId)?.name ?? "the province")
          : (districts.find((d) => String(d.id) === districtId)?.name ?? "the district");
        onDone(res.value, t("noteInvite", { name, role: roleName(role), place }));
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("postRole")}</legend>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("postRole")}>
          {roles.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={role === r ? "primary" : "ghost"}
              aria-pressed={role === r}
              onPress={() => setRole(r)}
            >
              {roleName(r)}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {regional
            ? PSF_TEAM_ROLE_DESCRIPTION.regional_manager
            : role === "district_manager"
              ? t("appointDistricts")
              : t("appointBdes")}
        </p>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {regional ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Province
            <select
              value={provinceId}
              onChange={(e) => setProvince(e.target.value)}
              className="h-10 rounded-xl border border-border bg-field px-3 text-sm font-normal"
            >
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("district")}
            <select
              value={districtId}
              onChange={(e) => setDistrict(e.target.value)}
              className="h-10 rounded-xl border border-border bg-field px-3 text-sm font-normal"
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {multipleProvinces && d.provinceName ? `${d.name}, ${d.provinceName}` : d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("fullName")}
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("email")}
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            placeholder={t("signInEmail")}
          />
        </label>
      </div>
      {/* Their ID (2026-11-02): every PSF manager and BDE is appointed with one. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("id")}
          <select
            value={idType}
            onChange={(e) => setIdType(e.target.value === "passport" ? "passport" : "national_id")}
            className="h-10 rounded-xl border border-border bg-field px-3 text-sm font-normal"
          >
            <option value="national_id">{t("nationalId")}</option>
            <option value="passport">{t("passport")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          {idType === "passport" ? t("passportNumber") : t("nationalIdNumber")}
          <Input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            inputMode={idType === "passport" ? "text" : "numeric"}
            autoComplete="off"
            placeholder={idType === "passport" ? t("passportHelp") : t("nationalIdHelp")}
            className="tabular"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("why")}
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonExample")} />
      </label>
      {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" isPending={busy}>
          {t("appointButton")}
        </Button>
        <Button variant="ghost" isDisabled={busy} onPress={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/** End an appointment: asks why, then ends it. What they did stays on record. */
function EndAppointment({ member, onDone }: { member: Member; onDone: (next: Team) => void }) {
  const t = useTranslations("psfTeam");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onPress={() => setOpen(true)}>
        {t("end")}
      </Button>
    );
  }
  return (
    <span className="flex min-w-[18rem] flex-col items-end gap-1.5">
      <span className="flex w-full items-center gap-2">
        <Input
          aria-label={t("whyEnd", { name: member.name ?? member.email })}
          placeholder={t("why")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-w-0 flex-1"
          autoFocus
        />
        <Button
          size="sm"
          variant="danger"
          isPending={busy}
          onPress={async () => {
            setBusy(true);
            const res = await endPsfTeamAction(member.assignmentId, reason);
            setBusy(false);
            if (!res.ok) return setProblem(res.error);
            onDone(res.value);
          }}
        >
          {t("end")}
        </Button>
        <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </span>
      {problem ? <span className="text-xs text-danger">{problem}</span> : null}
    </span>
  );
}
