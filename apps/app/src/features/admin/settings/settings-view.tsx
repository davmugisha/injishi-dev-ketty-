"use client";

import { Tabs, toast } from "@heroui/react";
import type {
  AdminConfiguration,
  AdminFeeSchedule,
  AdminRegistrationBusinessType,
  AdminRegistrationFee,
  GovernmentBody,
  PsfCatalogue,
  PsfTier,
} from "@injishi/contracts";
import {
  DataTable,
  DateText,
  EmptyBlock,
  FormDialog,
  formatMoney,
  IconAction,
  MoneyInput,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TextInput } from "@/features/rentals/fields";
import { ListUrlProvider, useListUrl } from "../list/list-kit";
import { setRegistrationFee } from "./actions";

export type SettingsTab = "fees" | "psf" | "bodies" | "platform";

const TAB_LABEL: Record<SettingsTab, string> = {
  fees: "Fees and plans",
  psf: "PSF levels and sectors",
  bodies: "Government bodies",
  platform: "Platform",
};

const BUSINESS: Record<AdminRegistrationBusinessType, string> = {
  hospitality: "Hotels and stays",
  residence: "Landlords and property managers",
  broker: "Brokers",
  enterprise: "Other businesses",
};

/** A setting's value in words: on/off, a number, or its JSON. */
function valueWords(v: unknown): string {
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (typeof v === "number" || typeof v === "string") return String(v);
  return JSON.stringify(v);
}

interface Props {
  tab: SettingsTab;
  fees: AdminFeeSchedule | null;
  tiers: PsfTier[] | null;
  catalogue: PsfCatalogue | null;
  bodies: GovernmentBody[] | null;
  config: AdminConfiguration | null;
  canEditFees: boolean;
}

/**
 * Settings (2026-11-09, real records): what businesses pay to register and for their plan (a finance
 * staffer sets a new registration fee here), PSF's levels and sectors (PSF's National Manager keeps them),
 * the government bodies posts are held under, and the platform's settings and flags. One tab at a time.
 */
export function SettingsView(props: Props) {
  return (
    <ListUrlProvider>
      <Settings {...props} />
    </ListUrlProvider>
  );
}

function Settings({ tab, fees, tiers, catalogue, bodies, config, canEditFees }: Props) {
  const url = useListUrl();
  return (
    <PageContent>
      <PageHeader
        title="Settings"
        description="Fees, PSF's levels and sectors, government bodies and platform switches."
      />
      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(k) => url.set({ tab: String(k) === "fees" ? null : String(k) })}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Settings">
            {(Object.keys(TAB_LABEL) as SettingsTab[]).map((t) => (
              <Tabs.Tab key={t} id={t}>
                {TAB_LABEL[t]}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      {fees ? <Fees fees={fees} canEdit={canEditFees} /> : null}
      {tiers && catalogue ? <Psf tiers={tiers} catalogue={catalogue} /> : null}
      {bodies ? <Bodies bodies={bodies} /> : null}
      {config ? <Platform config={config} /> : null}
    </PageContent>
  );
}

function Fees({ fees, canEdit }: { fees: AdminFeeSchedule; canEdit: boolean }) {
  const [editing, setEditing] = useState<AdminRegistrationFee | null>(null);
  // The fee in force per kind is the newest that has started; the one before it is shown beside it.
  const now = new Date().toISOString();
  const byType = new Map<string, AdminRegistrationFee[]>();
  for (const f of [...fees.registrationFees]
    .filter((x) => x.effectiveFrom <= now)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))) {
    byType.set(f.businessType, [...(byType.get(f.businessType) ?? []), f]);
  }
  const current = [...byType.values()].map((list) => list[0] as AdminRegistrationFee);
  const before = (f: AdminRegistrationFee) => byType.get(f.businessType)?.[1] ?? null;
  const p = fees.placementFeeSummary;
  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Registration fees"
        description="What a business pays once to register. A new fee applies to registrations from now; the old one stays in the history."
      >
        <DataTable<AdminRegistrationFee>
          label="Registration fees"
          rows={current}
          rowKey={(f) => f.id}
          columns={[
            { id: "type", header: "Business", isRowHeader: true, cell: (f) => BUSINESS[f.businessType] },
            {
              id: "amount",
              header: "Fee",
              align: "end",
              cell: (f) => <span className="tabular">{f.amountRwf === 0 ? "Free" : formatMoney(f.amountRwf)}</span>,
            },
            {
              id: "before",
              header: "Before",
              align: "end",
              cell: (f) => {
                const b = before(f);
                return b ? (
                  <span className="text-muted tabular">{b.amountRwf === 0 ? "Free" : formatMoney(b.amountRwf)}</span>
                ) : (
                  <span className="text-muted">—</span>
                );
              },
            },
            { id: "from", header: "Since", align: "end", cell: (f) => <DateText value={f.effectiveFrom} /> },
          ]}
          rowActions={
            canEdit
              ? (f) => (
                  <IconAction
                    icon="PencilToSquare"
                    label={`Change the fee for ${BUSINESS[f.businessType]}`}
                    onPress={() => setEditing(f)}
                  />
                )
              : undefined
          }
          empty={<EmptyBlock size="sm" icon="CreditCard" title="No registration fees set" />}
          mobile={{ title: (f) => BUSINESS[f.businessType], description: (f) => formatMoney(f.amountRwf) }}
        />
      </SectionCard>
      <SectionCard title="Subscription plans" description="What businesses pay each month.">
        <DataTable
          label="Subscription plans"
          rows={fees.subscriptionPlans}
          rowKey={(p) => p.id}
          columns={[
            { id: "name", header: "Plan", isRowHeader: true, cell: (p) => p.name },
            {
              id: "price",
              header: "A month",
              align: "end",
              cell: (p) => <span className="tabular">{p.priceRwf === 0 ? "Free" : formatMoney(p.priceRwf)}</span>,
            },
            {
              id: "rooms",
              header: "Rooms up to",
              align: "end",
              cell: (p) => (p.roomCountLimit === null ? "No limit" : p.roomCountLimit),
            },
            {
              id: "status",
              header: "Status",
              cell: (p) => <StatusChip tone={p.active ? "success" : "default"}>{p.active ? "On" : "Off"}</StatusChip>,
            },
          ]}
          empty={<EmptyBlock size="sm" icon="CreditCard" title="No plans" />}
          mobile={{ title: (p) => p.name, description: (p) => formatMoney(p.priceRwf) }}
        />
      </SectionCard>
      <SectionCard title="Placement fees" description="Fees owed to brokers for tenants they placed.">
        <p className="m-0 text-sm">
          {p.pendingCount} waiting ({formatMoney(p.pendingRwf)}) · {p.paidCount} paid ({formatMoney(p.paidRwf)})
        </p>
      </SectionCard>
      {editing ? <FeeDialog fee={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function FeeDialog({ fee, onClose }: { fee: AdminRegistrationFee; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState<number | null>(fee.amountRwf);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Registration fee: ${BUSINESS[fee.businessType]}`}
      submitLabel="Save fee"
      isPending={pending}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setFormError(null);
          const r = await setRegistrationFee({
            businessType: fee.businessType,
            amountRwf: amount ?? Number.NaN,
            reason,
          });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.fieldErrors ? null : r.error);
            return;
          }
          toast.success(`New registrations pay ${formatMoney(r.value.amountRwf)}`);
          onClose();
          router.refresh();
        });
      }}
    >
      <MoneyInput
        label="Fee"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setErrors((e) => ({ ...e, amountRwf: "" }));
        }}
        minValue={0}
        isRequired
        autoFocus
        errorMessage={errors.amountRwf || null}
      />
      <TextInput
        label="Reason"
        name="reason"
        value={reason}
        onChange={(v) => {
          setReason(v);
          setErrors((e) => ({ ...e, reason: "" }));
        }}
        isRequired
        errorMessage={errors.reason || null}
      />
    </FormDialog>
  );
}

function Psf({ tiers, catalogue }: { tiers: PsfTier[]; catalogue: PsfCatalogue }) {
  const price = (t: PsfTier) =>
    t.annualFeeRwf !== null
      ? formatMoney(t.annualFeeRwf)
      : t.annualFeeMinRwf !== null
        ? `${formatMoney(t.annualFeeMinRwf)} to ${t.annualFeeMaxRwf === null ? "any" : formatMoney(t.annualFeeMaxRwf)}`
        : "—";
  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-sm text-muted">
        PSF&rsquo;s National Manager keeps these in the PSF console. Shown here to read.
      </p>
      <SectionCard title="Membership levels" description="What a business pays PSF a year, by level and band.">
        <DataTable<PsfTier>
          label="PSF levels"
          rows={[...tiers].sort((a, b) => a.sortOrder - b.sortOrder)}
          rowKey={(t) => t.code}
          columns={[
            {
              id: "name",
              header: "Band",
              isRowHeader: true,
              cell: (t) => (
                <span className="flex flex-col text-sm">
                  <span className="font-medium">{t.nameEn}</span>
                  <span className="text-xs text-muted">{t.familyName}</span>
                </span>
              ),
            },
            { id: "price", header: "A year", align: "end", cell: (t) => <span className="tabular">{price(t)}</span> },
            {
              id: "status",
              header: "Status",
              cell: (t) => (
                <StatusChip tone={t.active ? "success" : "default"}>{t.active ? "Offered" : "Off"}</StatusChip>
              ),
            },
          ]}
          empty={<EmptyBlock size="sm" icon="Persons" title="No levels yet" />}
          mobile={{ title: (t) => t.nameEn, description: (t) => price(t) }}
        />
      </SectionCard>
      <SectionCard
        title="Sectors and associations"
        description="The clusters a business picks from, with their associations."
      >
        <ul className="m-0 flex list-none flex-col p-0">
          {catalogue.clusters.map((c) => (
            <li
              key={c.code}
              className="grid grid-cols-1 gap-1 border-b border-separator py-3 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4"
            >
              <span className="text-sm font-medium">
                {c.nameEn}
                {c.active ? null : <span className="ml-2 text-xs text-muted">(off)</span>}
              </span>
              <span className="text-sm text-muted">
                {c.associations.length
                  ? c.associations.map((a) => a.acronym ?? a.nameEn).join(" · ")
                  : "No associations yet"}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function Bodies({ bodies }: { bodies: GovernmentBody[] }) {
  return (
    <DataTable<GovernmentBody>
      label="Government bodies"
      rows={bodies}
      rowKey={(b) => b.code}
      noun={{ one: "body", many: "bodies" }}
      search={{ placeholder: "Name or code", text: (b) => `${b.nameEn} ${b.nameRw} ${b.abbreviation ?? ""} ${b.code}` }}
      columns={[
        {
          id: "name",
          header: "Body",
          isRowHeader: true,
          sortValue: (b) => b.nameEn,
          cell: (b) => (
            <span className="flex flex-col text-sm">
              <span className="font-medium">{b.nameEn}</span>
              <span className="text-xs text-muted">{b.nameRw}</span>
            </span>
          ),
        },
        { id: "abbr", header: "Short name", cell: (b) => b.abbreviation ?? "—" },
        { id: "code", header: "Code", cell: (b) => <span className="font-mono text-xs">{b.code}</span> },
        {
          id: "status",
          header: "Status",
          cell: (b) => (
            <StatusChip tone={b.active ? "success" : "default"}>{b.active ? "In use" : "Retired"}</StatusChip>
          ),
        },
      ]}
      empty={<EmptyBlock size="sm" icon="ShieldCheck" title="No government bodies" />}
      mobile={{ title: (b) => b.nameEn, description: (b) => b.abbreviation ?? b.code }}
    />
  );
}

function Platform({ config }: { config: AdminConfiguration }) {
  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="Switches" description="Features turned on or off, everywhere or in one district.">
        <DataTable
          label="Feature switches"
          rows={config.flags}
          rowKey={(f) => f.id}
          columns={[
            {
              id: "key",
              header: "Switch",
              isRowHeader: true,
              cell: (f) => <span className="font-mono text-xs">{f.key}</span>,
            },
            { id: "value", header: "Value", cell: (f) => valueWords(f.value) },
            {
              id: "where",
              header: "Where",
              cell: (f) => (f.scope === "global" ? "Everywhere" : (f.districtName ?? "One district")),
            },
            { id: "since", header: "Since", align: "end", cell: (f) => <DateText value={f.effectiveFrom} /> },
          ]}
          empty={<EmptyBlock size="sm" icon="Gear" title="No switches set" />}
          mobile={{ title: (f) => f.key, description: (f) => valueWords(f.value) }}
        />
      </SectionCard>
      <SectionCard title="Settings" description="The platform's own values, each versioned.">
        <DataTable
          label="Settings"
          rows={config.entries}
          rowKey={(e) => e.id}
          columns={[
            {
              id: "type",
              header: "Setting",
              isRowHeader: true,
              cell: (e) => <span className="font-mono text-xs">{e.configType}</span>,
            },
            {
              id: "value",
              header: "Value",
              cell: (e) => <span className="line-clamp-2 text-xs whitespace-normal">{valueWords(e.value)}</span>,
            },
            { id: "version", header: "Version", align: "end", cell: (e) => e.version },
            { id: "since", header: "Since", align: "end", cell: (e) => <DateText value={e.effectiveFrom} /> },
          ]}
          empty={<EmptyBlock size="sm" icon="Gear" title="No settings" />}
          mobile={{ title: (e) => e.configType, description: (e) => `Version ${e.version}` }}
        />
      </SectionCard>
    </div>
  );
}
