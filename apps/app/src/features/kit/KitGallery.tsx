"use client";

import { Card, FieldError, Input, Label, type Selection, TextField } from "@heroui/react";
import {
  ActionButton,
  ActionLink,
  AgeingStackedBar,
  BoundedDatePicker,
  CashFlowComposed,
  CategoryDonut,
  CollectedVsExpectedBar,
  ConfirmDialog,
  DataTable,
  DateText,
  EmptyBlock,
  ErrorBlock,
  EventTimeline,
  FilterTabs,
  FlowStepper,
  FormDialog,
  IconAction,
  KeyValueList,
  KpiStrip,
  LoadingBlock,
  Money,
  MoneyInput,
  OccupancyArea,
  PageContent,
  PageHeader,
  PersonCell,
  ProgressRadial,
  RelativeDay,
  RowActions,
  SearchBar,
  SectionCard,
  SectionHeader,
  SelectField,
  SidePanel,
  STATUS_VALUES,
  StatusChip,
  type StatusKind,
  UnitCell,
} from "@injishi/ui";
import { useMemo, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CalendarSection, DatesSection, MediaSection, PlacesSection, SigningSection } from "./KitInputs";
import {
  addDays,
  ageingByMonth,
  type DemoLease,
  EXPENSES,
  figures,
  flowByMonth,
  leaseHistory,
  leases,
  occupancyByMonth,
  rentByMonth,
} from "./kit-data";
import { Section, Specimen, SpecimenRow } from "./kit-parts";

const SECTIONS = [
  { id: "buttons", label: "Buttons" },
  { id: "status", label: "Status" },
  { id: "money", label: "Money and dates" },
  { id: "layout", label: "Page parts" },
  { id: "figures", label: "Figures" },
  { id: "charts", label: "Charts" },
  { id: "states", label: "Page states" },
  { id: "dialogs", label: "Dialogs and panels" },
  { id: "lists", label: "Lists" },
  { id: "records", label: "People, units, history" },
  { id: "dates", label: "Dates and periods" },
  { id: "media", label: "Photos and video" },
  { id: "signing", label: "Signing and codes" },
  { id: "places", label: "Places and contacts" },
  { id: "calendar", label: "Rent calendar" },
] as const;

const KIND_LABEL: Record<StatusKind, string> = {
  lease: "Lease",
  charge: "Charge",
  payment: "Payment",
  deposit: "Deposit",
  notice: "Move-out notice",
  fault: "Fault",
  guest: "Guest",
  filing: "RRA filing",
  payout: "Payout",
  unit: "Unit",
};

export function KitGallery({ today }: { today: string }) {
  return (
    <div className="min-h-dvh bg-surface">
      <PageContent className="gap-8">
        <PageHeader
          eyebrow={
            <>
              <span>packages/ui</span>
              <span aria-hidden="true">·</span>
              <StatusChip tone="info">Illustrative values</StatusChip>
            </>
          }
          title="Component gallery"
          description="Every shared component in every state, as screens use them. Names and amounts here are made up."
          actions={<ThemeToggle />}
        />
        <nav aria-label="Gallery sections" className="-mt-2 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border px-3 py-1 text-sm text-muted no-underline transition-colors hover:bg-default hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <ButtonsSection />
        <StatusSection />
        <MoneySection today={today} />
        <LayoutSection />
        <FiguresSection />
        <ChartsSection today={today} />
        <StatesSection />
        <DialogsSection today={today} />
        <ListsSection today={today} />
        <RecordsSection today={today} />
        <DatesSection today={today} />
        <MediaSection />
        <SigningSection />
        <PlacesSection today={today} />
        <CalendarSection today={today} />
      </PageContent>
    </div>
  );
}

function ButtonsSection() {
  const [pending, setPending] = useState(false);
  return (
    <Section
      id="buttons"
      title="Buttons"
      description="As the feature screens use them: secondary (soft) by default, primary for the one main action, ghost for low emphasis, danger-soft beside other actions, danger only to confirm."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen label="ActionButton intents">
          <SpecimenRow>
            <ActionButton icon="ArrowDownToLine">Export</ActionButton>
            <ActionButton icon="FileText" intent="primary">
              New lease
            </ActionButton>
            <ActionButton icon="Sliders" intent="ghost">
              Approval limits
            </ActionButton>
            <ActionButton intent="danger-soft">Decline</ActionButton>
            <ActionButton icon="TrashBin" intent="danger">
              Delete lease
            </ActionButton>
          </SpecimenRow>
        </Specimen>
        <Specimen label="Small, pending, disabled, link">
          <SpecimenRow>
            <ActionButton icon="Bell" size="sm">
              Remind
            </ActionButton>
            <ActionButton
              icon="ArrowDownToLine"
              size="sm"
              isPending={pending}
              onPress={() => {
                setPending(true);
                setTimeout(() => setPending(false), 1500);
              }}
            >
              {pending ? "Exporting" : "Export"}
            </ActionButton>
            <ActionButton icon="Pencil" size="sm" isDisabled>
              Edit
            </ActionButton>
            <ActionLink icon="ArrowUpRightFromSquare" size="sm" href="#lists">
              Open list
            </ActionLink>
          </SpecimenRow>
        </Specimen>
        <Specimen label="IconAction (row actions, tooltip on hover and focus)">
          <RowActions className="justify-start">
            <IconAction icon="Bell" label="Send a reminder" />
            <IconAction icon="Wallet" label="Record a payment" />
            <IconAction icon="Eye" label="Open" />
            <IconAction icon="Pencil" label="Edit" />
            <IconAction icon="TrashBin" label="Delete" intent="danger" />
          </RowActions>
        </Specimen>
        <Specimen label="Disabled with a reason, pending">
          <RowActions className="justify-start">
            <IconAction icon="Bell" label="Send a reminder" disabledReason="Already reminded today" />
            <IconAction icon="ArrowsRotateRight" label="Refresh" isPending />
          </RowActions>
        </Specimen>
      </div>
    </Section>
  );
}

function StatusSection() {
  return (
    <Section
      id="status"
      title="Status"
      description="One tone per state, from one map, so a state looks the same for the landlord and the tenant."
    >
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {(Object.keys(STATUS_VALUES) as StatusKind[]).map((kind) => (
          <Specimen key={kind} label={KIND_LABEL[kind]}>
            <div className="flex flex-wrap gap-2">
              {STATUS_VALUES[kind].map((status) => (
                <StatusChip key={status} kind={kind} status={status} />
              ))}
            </div>
          </Specimen>
        ))}
        <Specimen label="Own words, map tone; medium size; a tone outside the maps">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip kind="charge" status="open">
              Due 5th
            </StatusChip>
            <StatusChip kind="lease" status="active" size="md" />
            <StatusChip tone="success">Up to date</StatusChip>
          </div>
        </Specimen>
      </div>
    </Section>
  );
}

function MoneySection({ today }: { today: string }) {
  const [rent, setRent] = useState<number | null>(350_000);
  const [empty, setEmpty] = useState<number | null>(null);
  return (
    <Section id="money" title="Money and dates" description="Whole francs with tabular figures. Days are Kigali days.">
      <div className="grid gap-6 lg:grid-cols-3">
        <Specimen label="Money">
          <KeyValueList
            items={[
              { label: "Exact", value: <Money value={1_234_567} /> },
              { label: "Compact", value: <Money value={1_234_567} compact /> },
              { label: "Signed, in", value: <Money value={350_000} signed /> },
              { label: "Signed, out", value: <Money value={-48_500} signed /> },
              { label: "Nothing owed", value: <Money value={0} /> },
              { label: "Bare, in a RWF column", value: <Money value={480_000} bare /> },
            ]}
          />
        </Specimen>
        <Specimen label="Dates">
          <KeyValueList
            items={[
              { label: "Short", value: <DateText value={today} /> },
              { label: "Long", value: <DateText value={today} style="long" /> },
              { label: "Weekday", value: <DateText value={addDays(today, 3)} style="weekday" /> },
              { label: "Month", value: <DateText value={today} style="month" /> },
              { label: "In 3 days", value: <RelativeDay value={addDays(today, 3)} today={today} /> },
              { label: "2 days ago", value: <RelativeDay value={addDays(today, -2)} today={today} /> },
              { label: "Tomorrow", value: <RelativeDay value={addDays(today, 1)} today={today} /> },
            ]}
          />
        </Specimen>
        <div className="flex flex-col gap-4">
          <MoneyInput
            label="Monthly rent"
            value={rent}
            onChange={setRent}
            description="Whole francs. Due on the 5th."
            minValue={1}
          />
          <MoneyInput label="Deposit" value={empty} onChange={setEmpty} placeholder="0" />
          <MoneyInput label="Amount paid" value={0} errorMessage="Enter an amount above 0." />
          <MoneyInput label="Agreed deposit" value={700_000} isDisabled />
        </div>
      </div>
    </Section>
  );
}

function LayoutSection() {
  return (
    <Section id="layout" title="Page parts" description="The page header, section cards and label lists.">
      <div className="flex flex-col gap-6 rounded-2xl border border-dashed border-border p-4 sm:p-6">
        <PageHeader
          eyebrow="Kacyiru Heights"
          title="Leases"
          description="Every lease, from the draft to the move-out."
          actions={
            <>
              <ActionButton icon="ArrowDownToLine">Export</ActionButton>
              <ActionButton icon="Plus" intent="primary">
                New lease
              </ActionButton>
            </>
          }
        />
        <PageHeader size="hello" title="Good morning, Aline" description="Two things need you today." />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="This month's rent"
          description="Rent due in October, by tenant."
          actions={
            <ActionButton icon="Bell" size="sm">
              Remind all
            </ActionButton>
          }
          footer={
            <>
              <span className="text-muted">12 of 14 paid</span>
              <Money value={4_385_000} className="font-semibold" />
            </>
          }
        >
          <KeyValueList
            items={[
              { label: "Expected", value: <Money value={4_900_000} /> },
              { label: "Collected", value: <Money value={4_385_000} /> },
              { label: "Overdue", value: <Money value={515_000} /> },
            ]}
          />
        </SectionCard>
        <SectionCard title="Landlord" headingLevel={3}>
          <PersonCell name="Aline Uwase" secondary="+250 788 000 000" size="md" />
        </SectionCard>
      </div>
    </Section>
  );
}

function FiguresSection() {
  const items = figures();
  return (
    <Section
      id="figures"
      title="Figures"
      description="KpiStrip: two to a row on a phone, one row on a desktop. Trends say which way is good."
    >
      <KpiStrip label="This month" items={items} />
      <KpiStrip label="Units" items={items.filter((k) => ["occupancy", "expected", "net"].includes(k.id))} />
    </Section>
  );
}

function ChartsSection({ today }: { today: string }) {
  return (
    <Section
      id="charts"
      title="Charts"
      description="Theme chart colours, readable axes, exact amounts in tooltips and the table view, fewer bars on a phone."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <CollectedVsExpectedBar data={rentByMonth(today)} description="Last 12 months" />
        <CashFlowComposed data={flowByMonth(today)} description="Last 12 months" />
        <OccupancyArea data={occupancyByMonth(today)} description="At each month's end" />
        <AgeingStackedBar data={ageingByMonth(today)} description="Last 6 months" />
        <CategoryDonut data={EXPENSES} description="This year" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ProgressRadial title="Collection rate" value={4_385_000} max={4_900_000} caption="collected" />
          <ProgressRadial title="Setup" value={3} max={5} caption="3 of 5 steps" />
        </div>
        <CollectedVsExpectedBar
          data={[]}
          title="Rent collected (no leases yet)"
          emptyAction={
            <ActionButton icon="Plus" size="sm">
              New lease
            </ActionButton>
          }
        />
        <LoadingBlock shape="chart" label="expenses" />
      </div>
    </Section>
  );
}

function StatesSection() {
  const [retrying, setRetrying] = useState(false);
  return (
    <Section
      id="states"
      title="Page states"
      description="Every page has loading, empty (with the next step) and error (with Retry). Never a blank area."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label="EmptyBlock, page section">
          <Card>
            <EmptyBlock
              icon="FileText"
              title="No leases yet"
              description="Add a lease to invite your tenant and start collecting rent."
              action={
                <ActionButton icon="Plus" size="sm">
                  New lease
                </ActionButton>
              }
            />
          </Card>
        </Specimen>
        <Specimen label="EmptyBlock, small, in a card">
          <SectionCard title="Faults">
            <EmptyBlock
              size="sm"
              icon="Wrench"
              title="No faults reported"
              action={
                <ActionButton icon="Plus" size="sm">
                  Report a fault
                </ActionButton>
              }
            />
          </SectionCard>
        </Specimen>
        <Specimen label="ErrorBlock" className="lg:col-span-2">
          <ErrorBlock
            title="Couldn't load your leases"
            onRetry={() => {
              setRetrying(true);
              setTimeout(() => setRetrying(false), 1500);
            }}
            isRetrying={retrying}
          />
        </Specimen>
        <Specimen label="LoadingBlock: figures" className="lg:col-span-2">
          <LoadingBlock shape="kpi" label="figures" count={4} />
        </Specimen>
        <Specimen label="LoadingBlock: table">
          <LoadingBlock shape="table" label="leases" rows={4} />
        </Specimen>
        <Specimen label="LoadingBlock: list">
          <LoadingBlock shape="list" label="payments" rows={4} />
        </Specimen>
        <Specimen label="LoadingBlock: cards" className="lg:col-span-2">
          <LoadingBlock shape="cards" label="units" count={3} />
        </Specimen>
      </div>
    </Section>
  );
}

const METHODS = [
  { id: "mtn_momo", label: "MTN MoMo" },
  { id: "airtel_money", label: "Airtel Money" },
  { id: "bank_transfer", label: "Bank transfer" },
  { id: "cash", label: "Cash" },
  { id: "other", label: "Other" },
];

const BLOCKS = ["Block A", "Block B", "Block C", "Block D", "Annex"];

function DialogsSection({ today }: { today: string }) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitPending, setUnitPending] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [block, setBlock] = useState<string | null>(null);
  const [available, setAvailable] = useState<string | null>(addDays(today, 7));
  const [askingRent, setAskingRent] = useState<number | null>(350_000);

  return (
    <Section
      id="dialogs"
      title="Dialogs and panels"
      description="A question or short form is a dialog; a longer form or a record is a side panel (a bottom sheet on a phone)."
    >
      <SpecimenRow>
        <ActionButton icon="Wallet" onPress={() => setPaymentOpen(true)}>
          Record a payment
        </ActionButton>
        <ActionButton icon="Ban" intent="danger-soft" onPress={() => setConfirmOpen(true)}>
          Cancel lease
        </ActionButton>
        <ActionButton icon="Pencil" onPress={() => setUnitOpen(true)}>
          Edit unit
        </ActionButton>
        <ActionButton icon="Eye" onPress={() => setRecordOpen(true)}>
          Open lease
        </ActionButton>
      </SpecimenRow>
      {saved ? (
        <p role="status" className="text-sm text-muted">
          {saved}
        </p>
      ) : null}

      <FormDialog
        isOpen={paymentOpen}
        onOpenChange={(open) => {
          setPaymentOpen(open);
          if (!open) setPaymentErrors({});
        }}
        title="Record a payment"
        description="Money the tenant paid you outside Injishi."
        submitLabel="Record payment"
        submitIcon="Wallet"
        isPending={paymentPending}
        validationErrors={paymentErrors}
        footerHint="The tenant gets a receipt by email."
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const amount = Number(String(data.get("amount") ?? "").replace(/\D/g, ""));
          const errors: Record<string, string> = {};
          if (!amount) errors.amount = "Enter an amount above 0.";
          if (!data.get("method")) errors.method = "Choose how it was paid.";
          setPaymentErrors(errors);
          if (Object.keys(errors).length > 0) return;
          setPaymentPending(true);
          setTimeout(() => {
            setPaymentPending(false);
            setPaymentOpen(false);
            setSaved("Payment recorded (gallery only, nothing was saved).");
          }, 1200);
        }}
      >
        <MoneyInput label="Amount" name="amount" isRequired />
        <SelectField label="How it was paid" name="method" options={METHODS} isRequired />
        <TextField name="reference" className="gap-1">
          <Label>Reference</Label>
          <Input placeholder="MoMo or bank reference" />
          <FieldError />
        </TextField>
      </FormDialog>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cancel this lease?"
        confirmLabel="Cancel lease"
        confirmIcon="Ban"
        intent="danger"
        isPending={confirmPending}
        onConfirm={() => {
          setConfirmPending(true);
          setTimeout(() => {
            setConfirmPending(false);
            setConfirmOpen(false);
            setSaved("Lease cancelled (gallery only, nothing was saved).");
          }, 1200);
        }}
      >
        The tenant's invitation stops working and the unit is free again. This can't be undone.
      </ConfirmDialog>

      <SidePanel
        isOpen={unitOpen}
        onOpenChange={setUnitOpen}
        title="Edit unit A-01"
        description="Kacyiru Heights"
        submitLabel="Save"
        isPending={unitPending}
        onSubmit={(event) => {
          event.preventDefault();
          setUnitPending(true);
          setTimeout(() => {
            setUnitPending(false);
            setUnitOpen(false);
            setSaved("Unit saved (gallery only, nothing was saved).");
          }, 1200);
        }}
      >
        <TextField name="label" defaultValue="A-01" isRequired className="gap-1">
          <Label>Unit name</Label>
          <Input />
          <FieldError />
        </TextField>
        <SelectField label="Block" name="block" options={BLOCKS} value={block} onChange={setBlock} />
        <BoundedDatePicker
          label="Available from"
          name="availableFrom"
          value={available}
          onChange={setAvailable}
          minValue={today}
          maxValue={addDays(today, 365)}
        />
        <MoneyInput label="Asking rent" name="askingRent" value={askingRent} onChange={setAskingRent} minValue={1} />
        <MoneyInput label="Deposit" name="deposit" defaultValue={700_000} description="Usually two months of rent." />
      </SidePanel>

      <SidePanel
        isOpen={recordOpen}
        onOpenChange={setRecordOpen}
        title="Lease L-0151"
        description="Grace Mukamana · B-04"
        headerExtra={<StatusChip kind="lease" status="pending_signature" />}
        footer={
          <>
            <ActionButton icon="PencilToSquare">Edit terms</ActionButton>
            <ActionButton icon="PaperPlane" intent="primary">
              Resend invitation
            </ActionButton>
          </>
        }
      >
        <KeyValueList
          items={[
            { label: "Rent", value: <Money value={480_000} /> },
            { label: "Deposit", value: <Money value={960_000} /> },
            { label: "Starts", value: <DateText value={addDays(today, 12)} style="long" /> },
            { label: "Ends", value: <DateText value={addDays(today, 377)} style="long" /> },
            { label: "Due day", value: "5th of each month" },
          ]}
        />
        <SectionHeader title="History" />
        <EventTimeline label="Lease history" events={leaseHistory(today)} />
      </SidePanel>
    </Section>
  );
}

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "To sign" },
  { id: "pending_signature", label: "Waiting for tenant" },
  { id: "signed", label: "Ready to start" },
  { id: "active", label: "Active" },
  { id: "ending", label: "Ending" },
  { id: "ended", label: "Ended" },
];

function ListsSection({ today }: { today: string }) {
  const all = useMemo(() => leases(today), [today]);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selection>(new Set());
  const [view, setView] = useState("table");
  const [open, setOpen] = useState<DemoLease | null>(null);
  const rows = all.filter(
    (l) =>
      (tab === "all" || l.status === tab) &&
      (!query || `${l.tenant} ${l.unit} ${l.reference}`.toLowerCase().includes(query.toLowerCase())),
  );
  return (
    <Section
      id="lists"
      title="Lists"
      description="Filter tabs with counts, a search box, and one table that becomes a list on a phone. Select rows for bulk actions."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <FilterTabs
            label="Lease status"
            tabs={TABS.map((t) => ({
              ...t,
              count: t.id === "all" ? all.length : all.filter((l) => l.status === t.id).length,
            }))}
            selectedKey={tab}
            onSelectionChange={setTab}
          />
          <SearchBar label="Search leases" placeholder="Tenant, unit or reference" value={query} onChange={setQuery} />
        </div>
        <DataTable
          label="Leases"
          rows={rows}
          rowKey={(l) => l.id}
          defaultSort={{ column: "tenant", direction: "ascending" }}
          onRowAction={setOpen}
          selection={{
            selectedKeys: selected,
            onSelectionChange: setSelected,
            noun: "leases",
            bulkActions: (
              <>
                <ActionButton icon="Bell" size="sm">
                  Remind
                </ActionButton>
                <ActionButton icon="ArrowDownToLine" size="sm">
                  Export
                </ActionButton>
              </>
            ),
          }}
          columns={[
            {
              id: "tenant",
              header: "Tenant",
              cell: (l) => <PersonCell name={l.tenant} secondary={l.email} />,
              sortValue: (l) => l.tenant,
            },
            {
              id: "unit",
              header: "Unit",
              cell: (l) => <UnitCell label={l.unit} secondary={`${l.block} · ${l.bedrooms} bed`} />,
              sortValue: (l) => l.unit,
            },
            {
              id: "term",
              header: "Term",
              hideBelow: "xl",
              cell: (l) => (
                <span className="text-sm whitespace-nowrap text-muted">
                  <DateText value={l.start} /> to <DateText value={l.end} />
                </span>
              ),
              sortValue: (l) => l.start,
            },
            {
              id: "rent",
              header: "Rent",
              align: "end",
              cell: (l) => <Money value={l.rent} />,
              sortValue: (l) => l.rent,
            },
            {
              id: "status",
              header: "Status",
              cell: (l) => <StatusChip kind="lease" status={l.status} />,
              sortValue: (l) => l.status,
            },
          ]}
          rowActions={(l) => (
            <RowActions>
              {l.overdue > 0 ? (
                <IconAction icon="Bell" label={`Remind ${l.tenant}`} />
              ) : (
                <IconAction icon="Bell" label={`Remind ${l.tenant}`} disabledReason="Nothing overdue" />
              )}
              <IconAction icon="Eye" label={`Open ${l.reference}`} onPress={() => setOpen(l)} />
              <IconAction icon="Pencil" label={`Edit ${l.reference}`} />
            </RowActions>
          )}
          mobile={{
            title: (l) => l.tenant,
            description: (l) => (
              <>
                {l.unit} · <Money value={l.rent} /> a month
              </>
            ),
            trailing: (l) => <StatusChip kind="lease" status={l.status} />,
          }}
          empty={
            <EmptyBlock
              icon="Magnifier"
              title="No leases match"
              action={
                <ActionButton
                  icon="Xmark"
                  size="sm"
                  onPress={() => {
                    setTab("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </ActionButton>
              }
            />
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label="FilterTabs as a segment (two to four views)">
          <FilterTabs
            variant="segment"
            label="Faults view"
            tabs={[
              { id: "table", label: "Table" },
              { id: "board", label: "Board" },
            ]}
            selectedKey={view}
            onSelectionChange={setView}
          />
        </Specimen>
        <Specimen label="DataTable with no rows">
          <DataTable
            label="Payouts"
            rows={[]}
            rowKey={() => ""}
            columns={[{ id: "x", header: "Payout", cell: () => null }]}
            empty={<EmptyBlock size="sm" icon="Wallet" title="No payouts yet" />}
          />
        </Specimen>
      </div>

      <SidePanel
        isOpen={open !== null}
        onOpenChange={(o) => (o ? undefined : setOpen(null))}
        title={open ? `Lease ${open.reference}` : "Lease"}
        description={open ? `${open.tenant} · ${open.unit}` : undefined}
        headerExtra={open ? <StatusChip kind="lease" status={open.status} /> : null}
      >
        {open ? (
          <KeyValueList
            items={[
              { label: "Rent", value: <Money value={open.rent} /> },
              { label: "Overdue", value: <Money value={open.overdue} /> },
              { label: "Starts", value: <DateText value={open.start} style="long" /> },
              { label: "Ends", value: <DateText value={open.end} style="long" /> },
            ]}
          />
        ) : null}
      </SidePanel>
    </Section>
  );
}

const NEW_LEASE_STEPS = [
  { id: "unit", title: "Unit", description: "Which home" },
  { id: "tenant", title: "Tenant", description: "Who signs" },
  { id: "terms", title: "Terms", description: "Dates and rent" },
  { id: "occupants", title: "Occupants", description: "Who lives there" },
  { id: "review", title: "Review", description: "Check and sign" },
];

function RecordsSection({ today }: { today: string }) {
  const [step, setStep] = useState(2);
  return (
    <Section
      id="records"
      title="People, units, history"
      description="Cells for tables and lists, a record's timeline, and where a flow stands."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Cells">
          <div className="flex flex-col gap-4">
            <PersonCell name="Aline Uwase" secondary="aline.uwase@example.com" />
            <PersonCell name="Eric Nshimiyimana" secondary="Invited, not signed in yet" size="md" />
            <UnitCell label="A-01" secondary="Block A · 2 bedrooms" />
            <UnitCell label="Studio 3" secondary="Annex · furnished" />
          </div>
        </SectionCard>
        <SectionCard title="Lease history" className="lg:col-span-2">
          <EventTimeline label="Lease history" events={leaseHistory(today)} />
        </SectionCard>
      </div>
      <SectionCard
        title="New lease"
        description="Press a done step to go back."
        actions={
          <>
            <ActionButton icon="ArrowLeft" size="sm" isDisabled={step === 0} onPress={() => setStep((s) => s - 1)}>
              Back
            </ActionButton>
            <ActionButton
              icon="ArrowRight"
              size="sm"
              intent="primary"
              iconPlacement="end"
              isDisabled={step >= NEW_LEASE_STEPS.length}
              onPress={() => setStep((s) => s + 1)}
            >
              Next
            </ActionButton>
          </>
        }
      >
        <FlowStepper label="New lease steps" steps={NEW_LEASE_STEPS} current={step} onStepChange={setStep} />
      </SectionCard>
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Moving out" headingLevel={3}>
          <FlowStepper
            label="Move-out steps"
            orientation="vertical"
            current="acknowledged"
            steps={[
              { id: "submitted", title: "Notice given" },
              { id: "acknowledged", title: "Acknowledged" },
              { id: "moved", title: "Moved out" },
              { id: "settled", title: "Deposit settled" },
            ]}
          />
        </SectionCard>
        <SectionCard title="Declaration" headingLevel={3}>
          <FlowStepper
            label="Tax declaration steps"
            current={3}
            steps={[
              { id: "start", title: "Not started" },
              { id: "declared", title: "Declared" },
              { id: "paid", title: "Paid" },
            ]}
          />
        </SectionCard>
      </div>
    </Section>
  );
}
