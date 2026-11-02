"use client";

import { Alert, Button, Input } from "@heroui/react";
import { PSF_TEAM_ROLE_DESCRIPTION, PSF_TEAM_ROLE_LABEL, type PsfTeamRole, type PsfTeamView as Team } from "@injishi/contracts";
import { DataTable, EmptyBlock, formatDay, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import { useState } from "react";
import type { PsfScope } from "@/server/sources/psf";
import { appointPsfTeamAction, endPsfTeamAction } from "./psf-team-actions";

type Member = Team["members"][number];

/**
 * The PSF team (2026-11-02): the District Managers and District Business Officers of the officer's
 * districts. A Province Manager (or the National Manager) appoints them and ends their appointments
 * with a reason; a District Manager or DBO reads who is who.
 */
export function PsfTeamView({ scope, initial }: { scope: PsfScope; initial: Team }) {
  const [team, setTeam] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const managers = team.members.filter((m) => m.role === "district_manager").length;

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Team"
        description={
          team.canAppoint
            ? "The District Managers and District Business Officers of your districts. You appoint them, and end their appointments."
            : "The District Managers and District Business Officers of your district. Your PSF Province Manager appoints them."
        }
      />

      <Alert status="accent">
        <Alert.Content>
          <Alert.Title>Two posts in each district</Alert.Title>
          <Alert.Description>
            <strong>{PSF_TEAM_ROLE_LABEL.district_manager}:</strong> {PSF_TEAM_ROLE_DESCRIPTION.district_manager}{" "}
            <strong>{PSF_TEAM_ROLE_LABEL.business_officer}:</strong> {PSF_TEAM_ROLE_DESCRIPTION.business_officer}
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
        title="People"
        description={`${team.members.length} ${team.members.length === 1 ? "person" : "people"} · ${managers} District ${managers === 1 ? "Manager" : "Managers"}`}
        actions={
          team.canAppoint && !adding ? (
            <Button size="sm" variant="primary" onPress={() => setAdding(true)}>
              Appoint someone
            </Button>
          ) : null
        }
        contentClassName="gap-3"
      >
        {adding ? (
          <AppointForm
            districts={team.districts}
            onCancel={() => setAdding(false)}
            onDone={(next, text) => {
              setTeam(next);
              setAdding(false);
              setNote(text);
            }}
          />
        ) : null}
        <DataTable
          label="PSF team"
          rows={team.members}
          rowKey={(m) => m.assignmentId}
          empty={
            <EmptyBlock
              size="sm"
              icon="Persons"
              title="Nobody appointed yet"
              description={team.canAppoint ? "Appoint a District Manager for each district, and DBOs where you need them." : "Your Province Manager has not appointed anyone here yet."}
            />
          }
          columns={[
            {
              id: "person",
              header: "Person",
              isRowHeader: true,
              sortValue: (m) => m.name ?? m.email,
              cell: (m) => (
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{m.name ?? m.email}</span>
                  <span className="text-xs text-muted">{m.email}</span>
                </span>
              ),
            },
            {
              id: "role",
              header: "Post",
              sortValue: (m) => m.role,
              cell: (m) => <StatusChip tone={m.role === "district_manager" ? "success" : "info"}>{PSF_TEAM_ROLE_LABEL[m.role]}</StatusChip>,
            },
            { id: "district", header: "District", sortValue: (m) => m.districtName ?? "", cell: (m) => m.districtName ?? "—" },
            {
              id: "since",
              header: "Since",
              sortValue: (m) => m.appointedAt,
              cell: (m) => (
                <span className="flex flex-col gap-0.5">
                  <span className="tabular">{formatDay(m.appointedAt)}</span>
                  {m.appointedByName ? <span className="text-xs text-muted">by {m.appointedByName}</span> : null}
                </span>
              ),
            },
            ...(team.canAppoint
              ? [
                  {
                    id: "end",
                    header: "",
                    align: "end" as const,
                    cell: (m: Member) => (
                      <EndAppointment
                        member={m}
                        onDone={(next) => {
                          setTeam(next);
                          setNote(`${m.name ?? m.email} is no longer ${PSF_TEAM_ROLE_LABEL[m.role]} for ${m.districtName ?? "the district"}.`);
                        }}
                      />
                    ),
                  },
                ]
              : []),
          ]}
          mobile={{
            title: (m) => m.name ?? m.email,
            description: (m) => [PSF_TEAM_ROLE_LABEL[m.role], m.districtName].filter(Boolean).join(" · "),
          }}
        />
      </SectionCard>
    </PageContent>
  );
}

function AppointForm({
  districts,
  onCancel,
  onDone,
}: {
  districts: Team["districts"];
  onCancel: () => void;
  onDone: (next: Team, note: string) => void;
}) {
  const [role, setRole] = useState<PsfTeamRole>("district_manager");
  const [districtId, setDistrict] = useState(String(districts[0]?.id ?? ""));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
        const res = await appointPsfTeamAction({ email, name, role, districtId: Number(districtId), reason });
        setBusy(false);
        if (!res.ok) return setProblem(res.error);
        const place = districts.find((d) => String(d.id) === districtId)?.name ?? "the district";
        onDone(res.value, `${name} is now ${PSF_TEAM_ROLE_LABEL[role]} for ${place}. We emailed them how to sign in.`);
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Post</legend>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Post">
          {(Object.keys(PSF_TEAM_ROLE_LABEL) as PsfTeamRole[]).map((r) => (
            <Button key={r} size="sm" variant={role === r ? "primary" : "ghost"} aria-pressed={role === r} onPress={() => setRole(r)}>
              {PSF_TEAM_ROLE_LABEL[r]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted">{PSF_TEAM_ROLE_DESCRIPTION[role]}</p>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          District
          <select value={districtId} onChange={(e) => setDistrict(e.target.value)} className="h-10 rounded-xl border border-border bg-field px-3 text-sm font-normal">
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {multipleProvinces && d.provinceName ? `${d.name}, ${d.provinceName}` : d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Full name
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="They sign in with this" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Why
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Like “New Gasabo District Manager from November”" />
      </label>
      {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" isPending={busy}>
          Appoint
        </Button>
        <Button variant="ghost" isDisabled={busy} onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** End an appointment: asks why, then ends it. What they did stays on record. */
function EndAppointment({ member, onDone }: { member: Member; onDone: (next: Team) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onPress={() => setOpen(true)}>
        End
      </Button>
    );
  }
  return (
    <span className="flex min-w-[18rem] flex-col items-end gap-1.5">
      <span className="flex w-full items-center gap-2">
        <Input aria-label={`Why end ${member.name ?? member.email}'s appointment`} placeholder="Why" value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-0 flex-1" autoFocus />
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
          End
        </Button>
        <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => setOpen(false)}>
          Cancel
        </Button>
      </span>
      {problem ? <span className="text-xs text-danger">{problem}</span> : null}
    </span>
  );
}
