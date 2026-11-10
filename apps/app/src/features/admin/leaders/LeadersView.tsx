"use client";

import { Description, FieldError, Label, TextArea, TextField, toast } from "@heroui/react";
import {
  type GovernmentBody,
  type OversightAppointment,
  type OversightAppointmentList,
  tidyPlaceName,
  type WaitingArea,
} from "@injishi/contracts";
import {
  ActionButton,
  DataTable,
  EmptyBlock,
  FormDialog,
  formatDay,
  formatNumber,
  IconAction,
  PageContent,
  type PlaceChain,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import {
  ALL,
  AreaFilter,
  CountStrip,
  ListBar,
  ListFilter,
  ListSearch,
  ListUrlProvider,
  useListUrl,
} from "../list/list-kit";
import { EntityMark } from "../list/stat-cards";
import { AppointPanel, type AppointPrefill, ROLE_CHOICES } from "./AppointPanel";
import { endAppointment } from "./actions";

/** The kind tabs, in the order the list shows them: every post, then leaders, reviewers, other officers. */
const KIND_TABS = ["all", "leader", "reviewer", "officer"] as const;

/** A waiting area's (or a coverage gap's) place as the place picker holds it. */
export function chainOf(
  w: Pick<WaitingArea, "provinceId" | "districtId" | "sectorId" | "cellId" | "villageId" | "names">,
): PlaceChain {
  const chain: PlaceChain = {};
  if (w.provinceId && w.names.province) chain.province = { id: w.provinceId, name: tidyPlaceName(w.names.province) };
  if (chain.province && w.districtId && w.names.district)
    chain.district = { id: w.districtId, name: tidyPlaceName(w.names.district) };
  if (chain.district && w.sectorId && w.names.sector)
    chain.sector = { id: w.sectorId, name: tidyPlaceName(w.names.sector) };
  if (chain.sector && w.cellId && w.names.cell) chain.cell = { id: w.cellId, name: tidyPlaceName(w.names.cell) };
  if (chain.cell && w.villageId && w.names.village)
    chain.village = { id: w.villageId, name: tidyPlaceName(w.names.village) };
  return chain;
}

/** End an appointment, with the reason the audit log keeps. */
function EndDialog({ appointment, onClose }: { appointment: OversightAppointment; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useTranslations("adminLeaders.list");
  const tr = useTranslations("admin.roles");
  const person = appointment.name ?? appointment.email;
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("endTitle", { name: person })}
      description={`${tr(appointment.role)}, ${appointment.area}`}
      submitLabel={t("endSubmit")}
      submitIcon="PersonXmark"
      isPending={pending}
      validationErrors={error ? { reason: error } : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await endAppointment(appointment.id, reason);
          if (!result.ok) {
            setError(result.fieldErrors?.reason ?? result.error);
            return;
          }
          toast.success(t("ended"));
          onClose();
          router.refresh();
        });
      }}
    >
      <TextField
        name="reason"
        value={reason}
        onChange={setReason}
        isInvalid={error ? true : undefined}
        fullWidth
        className="gap-1"
      >
        <Label>{t("why")}</Label>
        <TextArea rows={3} placeholder={t("whyPlaceholder")} />
        <Description>{t("keptInAudit")}</Description>
        <FieldError>{error}</FieldError>
      </TextField>
    </FormDialog>
  );
}

/**
 * Local leaders and officers (P5): every oversight appointment (the local leaders guests are reported
 * to, the business reviewers, other officers) with their area and, for a leader, how many guests reached
 * them and how many they opened; filters by kind, role and area; appointing (by email, role, body, title
 * and area) and ending (with a reason); and the areas where guests wait for a leader, each with an
 * Appoint shortcut.
 */
export function LeadersView(props: {
  list: OversightAppointmentList;
  bodies: GovernmentBody[];
  canAppoint: boolean;
  /** The area filter in the address, as a chain. */
  areaChain: PlaceChain;
  /** `?appoint=` from the coverage page: open the form with this role and area. */
  initialAppoint: AppointPrefill | null;
}) {
  return (
    <ListUrlProvider>
      <Leaders {...props} />
    </ListUrlProvider>
  );
}

function Leaders({
  list,
  bodies,
  canAppoint,
  areaChain,
  initialAppoint,
}: {
  list: OversightAppointmentList;
  bodies: GovernmentBody[];
  canAppoint: boolean;
  areaChain: PlaceChain;
  initialAppoint: AppointPrefill | null;
}) {
  const router = useRouter();
  const url = useListUrl();
  const t = useTranslations("adminLeaders.list");
  // The kinds sit beside the list's words in the catalog, as adminLeaders.tabs.
  const tk = useTranslations("adminLeaders.tabs");
  // The posts as People and the appointment form name them: one catalog, one word per role.
  const tr = useTranslations("admin.roles");
  const [appoint, setAppoint] = useState<AppointPrefill | null | false>(initialAppoint ?? false);
  const [ending, setEnding] = useState<OversightAppointment | null>(null);
  // "Never opened a guest" is read from the rows this page already has.
  const neverOpened = url.get("opened") === "never";
  const rows = neverOpened
    ? list.appointments.filter((a) => a.kind === "leader" && a.delivered > 0 && a.seen === 0)
    : list.appointments;
  const total = list.counts.leader + list.counts.reviewer + list.counts.officer;
  const usedBodies = bodies.filter((b) => b.active);

  return (
    <PageContent>
      <AreaHeader
        actions={
          canAppoint ? (
            <ActionButton icon="PersonPlus" intent="primary" onPress={() => setAppoint(null)}>
              {t("appoint")}
            </ActionButton>
          ) : null
        }
      />
      <CountStrip
        label="Appointments by kind"
        param="kind"
        items={[
          { id: "leader", label: tk("leader"), icon: "House", value: list.counts.leader },
          { id: "reviewer", label: tk("reviewer"), icon: "ShieldCheck", value: list.counts.reviewer },
          { id: "officer", label: tk("officer"), icon: "Persons", value: list.counts.officer },
        ]}
      />
      <ListBar
        keys={["q", "kind", "role", "body", "opened"]}
        found={rows.length}
        noun={{ one: t("nounOne"), many: t("nounMany") }}
        search={<ListSearch placeholder="Name, email or title" />}
      >
        <ListFilter
          param="kind"
          name={t("show")}
          options={KIND_TABS.map((id) => ({
            id,
            label: tk(id),
            count: id === "all" ? total : list.counts[id],
          }))}
        />
        <ListFilter
          param="role"
          name={t("role")}
          icon="Persons"
          options={[{ id: ALL, label: t("all") }, ...ROLE_CHOICES.map((r) => ({ id: r.id, label: tr(r.id) }))]}
        />
        <ListFilter
          param="body"
          name="Body"
          icon="Briefcase"
          options={[
            { id: ALL, label: t("all") },
            ...usedBodies.map((b) => ({
              id: b.code,
              label: b.abbreviation ? `${b.abbreviation}, ${b.nameEn}` : b.nameEn,
            })),
          ]}
        />
        <AreaFilter chain={areaChain} depth="village" />
        <ListFilter
          param="opened"
          name={t("opened")}
          icon="Eye"
          options={[
            { id: ALL, label: t("all") },
            { id: "never", label: t("neverOpened") },
          ]}
        />
      </ListBar>

      <div className="flex min-w-0 flex-col gap-5">
        <DataTable<OversightAppointment>
          label={t("label")}
          rows={rows}
          rowKey={(a) => a.id}
          noun={{ one: t("nounOne"), many: t("nounMany") }}
          onRowAction={(a) => router.push(`/admin/people/${a.userId}`)}
          empty={
            <EmptyBlock
              icon="Persons"
              title={t("empty")}
              action={
                canAppoint ? (
                  <ActionButton icon="PersonPlus" onPress={() => setAppoint(null)}>
                    {t("appoint")}
                  </ActionButton>
                ) : undefined
              }
            />
          }
          columns={[
            {
              id: "person",
              header: t("person"),
              isRowHeader: true,
              sortValue: (a) => a.name ?? a.email,
              cell: (a) => (
                <span className="flex min-w-0 items-center gap-3 text-sm">
                  <EntityMark name={a.name ?? a.email} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{a.name ?? a.email}</span>
                    <span className="truncate text-xs text-muted">{a.name ? a.email : t("noNameYet")}</span>
                  </span>
                </span>
              ),
            },
            {
              id: "role",
              header: t("role"),
              sortValue: (a) => tr(a.role),
              cell: (a) => (
                <div className="flex min-w-0 flex-col text-sm">
                  <span className="truncate">{tr(a.role)}</span>
                  <span className="truncate text-xs text-muted">{a.title ?? a.bodyName ?? a.bodyCode}</span>
                </div>
              ),
            },
            {
              id: "area",
              header: t("area"),
              sortValue: (a) => a.area,
              cell: (a) => <span className="text-sm whitespace-normal">{a.area}</span>,
            },
            {
              id: "guests",
              header: t("guests"),
              align: "end",
              hideBelow: "lg",
              sortValue: (a) => a.delivered,
              cell: (a) =>
                a.kind === "leader" ? (
                  <span className="text-sm whitespace-nowrap tabular">
                    {t("openedOf", { seen: formatNumber(a.seen), delivered: formatNumber(a.delivered) })}
                  </span>
                ) : (
                  <span className="text-xs whitespace-nowrap text-muted">{t("notLeader")}</span>
                ),
            },
            {
              id: "since",
              header: t("since"),
              hideBelow: "xl",
              sortValue: (a) => a.grantedAt,
              cell: (a) => <span className="text-sm whitespace-nowrap">{formatDay(a.grantedAt)}</span>,
            },
          ]}
          rowActions={
            canAppoint
              ? (a) => (
                  <IconAction
                    icon="PersonXmark"
                    label={t("endAppointment", { name: a.name ?? a.email })}
                    onPress={() => setEnding(a)}
                  />
                )
              : undefined
          }
          mobile={{
            title: (a) => a.name ?? a.email,
            description: (a) => `${tr(a.role)} · ${a.area}`,
          }}
        />
      </div>

      {appoint !== false ? <AppointPanel bodies={bodies} prefill={appoint} onClose={() => setAppoint(false)} /> : null}
      {ending ? <EndDialog appointment={ending} onClose={() => setEnding(null)} /> : null}
    </PageContent>
  );
}
