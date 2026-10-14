"use client";

import { CircleCheckFill, EyeSlash, Key, Lock, PaperPlane, PersonsLock, ShieldExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Checkbox, Description, Label, Modal, Table, Toast, toast } from "@heroui/react";
import { EmptyState, ListView, RadioButtonGroup, Segment } from "@heroui-pro/react";
import type {
  AccessLogEntry,
  DataExport,
  DatasetTerm,
  ExportChannel,
  OccupancyMonth,
  OccupancySector,
  ReportingRequirement,
} from "@injishi/data/fixtures/oversight";
import { GateChip, Icon, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { CardHeading, FactGrid, HBar, ToneChip } from "./shared";

export interface DelegatedReportsData {
  months: OccupancyMonth[];
  sectors: OccupancySector[];
  terms: DatasetTerm[];
  requirements: ReportingRequirement[];
  exports: DataExport[];
  log: AccessLogEntry[];
  channels: ExportChannel[];
}

type MadeExport = DataExport & { sensitive: boolean };

const fmt = (n: number) => n.toLocaleString("en-US");

function occupancyRows(month: OccupancyMonth, sectors: OccupancySector[]) {
  let soldTotal = 0;
  const rows = sectors.map((s) => {
    const occ = s.suppressed ? 60 : (month.occupancy[s.id] ?? 0);
    const sold = Math.round((s.rooms * month.days * occ) / 100);
    soldTotal += sold;
    return {
      id: s.id,
      name: s.name,
      businesses: String(s.businesses),
      rooms: s.suppressed ? "—" : fmt(s.rooms),
      sold: s.suppressed ? "—" : fmt(sold),
      occ,
      shown: !s.suppressed,
      total: false,
    };
  });
  const roomsTotal = sectors.reduce((sum, s) => sum + s.rooms, 0);
  const bizTotal = sectors.reduce((sum, s) => sum + s.businesses, 0);
  const occTotal = roomsTotal && month.days ? Math.round((soldTotal / (roomsTotal * month.days)) * 100) : 0;
  rows.push({
    id: "district",
    name: "Rubavu District",
    businesses: String(bizTotal),
    rooms: fmt(roomsTotal),
    sold: fmt(soldTotal),
    occ: occTotal,
    shown: true,
    total: true,
  });
  return rows;
}

/** Occupancy shared with the district, and the guest-stay reporting that is not enabled. */
export function DelegatedReportsView({ data }: { data: DelegatedReportsData }) {
  const [monthId, setMonthId] = useState(data.months.find((m) => m.id === "sep")?.id ?? data.months.at(-1)?.id ?? "");
  const [exportOpen, setExportOpen] = useState(false);
  const [channel, setChannel] = useState(data.channels.find((c) => c.approved)?.id ?? "file");
  const [purpose, setPurpose] = useState(false);
  const [unsuppressed, setUnsuppressed] = useState(false);
  const [made, setMade] = useState<MadeExport[]>([]);
  const [requested, setRequested] = useState(false);

  const month = data.months.find((m) => m.id === monthId) ?? data.months[0];
  const rows = month ? occupancyRows(month, data.sectors) : [];
  const exports = [...made, ...data.exports];
  const extra: AccessLogEntry[] = [];
  if (requested) {
    extra.push({
      id: "log-mr-0027",
      when: "12 Oct · now",
      action: "Requested mandate",
      record: "MR-0027 · guest-stay reporting",
      purpose: "Mandate administration",
    });
  }
  for (const item of made) {
    extra.push({
      id: `log-${item.id}`,
      when: "12 Oct · now",
      action: item.sensitive ? "Requested sensitive export" : "Exported encrypted file",
      record: item.id,
      purpose: "Tourism planning",
    });
  }
  const log = [...extra, ...data.log].slice(0, 7);

  const submitExport = () => {
    if (!month || !purpose) return;
    const n = 20 + made.length;
    const id = `EX-00${n}`;
    const item: MadeExport = unsuppressed
      ? {
          id,
          sensitive: true,
          icon: "Clock",
          title: `${id} · ${month.name} with unsuppressed sectors`,
          detail: "Requested just now by you · sent to Jean-Claude Mugabo for review",
          state: "Awaiting second review",
          tone: "warning",
        }
      : {
          id,
          sensitive: false,
          icon: "FileCheck",
          title: `${id} · ${month.name}`,
          detail: "Encrypted file ready · key sent by SMS to phone ending 41 · link expires in 24 h",
          state: "Ready",
          tone: "success",
        };
    setMade((cur) => [item, ...cur]);
    setExportOpen(false);
    setPurpose(false);
    setUnsuppressed(false);
    toast.success(
      unsuppressed ? `${id} sent for second-officer review` : `${id} encrypted · key sent separately by SMS`,
      {
        indicator: <Lock className="size-4" />,
      },
    );
  };

  return (
    <PageContent className="text-[14px] leading-5">
      <PageHeader
        eyebrow="Rubavu District · Delegated data"
        title="Delegated Data"
        description="Datasets shared with Rubavu District under a verified legal basis, each with its purpose, fields and channel. Anything not listed here is not available to you."
      />

      <div className="flex flex-wrap items-start gap-4">
        <Card
          render={(p) => <section {...p} />}
          aria-labelledby="occ-h"
          className="min-w-0 flex-[999_1_600px] gap-[14px] p-[18px]"
        >
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="occ-h" className="text-[15px] leading-[22px] font-semibold">
                  Occupancy by Sector
                </h2>
                <ToneChip tone="success">Enabled · verified mandate</ToneChip>
              </div>
              <p className="text-[13px] leading-[18px] text-muted">
                Aggregated monthly totals from participating businesses. No guest data, no personal data, no business
                names.
              </p>
            </div>
            <Segment aria-label="Month" selectedKey={monthId} onSelectionChange={(k) => setMonthId(String(k))}>
              {data.months.map((m) => (
                <Segment.Item key={m.id} id={m.id}>
                  <Segment.Separator />
                  {m.label}
                </Segment.Item>
              ))}
            </Segment>
          </div>

          <FactGrid
            min={180}
            className="gap-x-5 gap-y-3"
            items={data.terms.map((t) => ({ id: t.id, label: t.label, value: t.value }))}
          />

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Occupancy by sector">
                <Table.Header>
                  <Table.Column isRowHeader>Sector</Table.Column>
                  <Table.Column className="text-right">Reporting businesses</Table.Column>
                  <Table.Column className="text-right">Rooms</Table.Column>
                  <Table.Column className="text-right">Room-nights sold</Table.Column>
                  <Table.Column className="min-w-[180px]">Occupancy</Table.Column>
                </Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={r.id} id={r.id}>
                      <Table.Cell className={r.total ? "font-semibold" : undefined}>{r.name}</Table.Cell>
                      <Table.Cell className="text-right tabular">{r.businesses}</Table.Cell>
                      <Table.Cell className="text-right tabular">{r.rooms}</Table.Cell>
                      <Table.Cell className="text-right tabular">{r.sold}</Table.Cell>
                      <Table.Cell>
                        {r.shown ? (
                          <span className="flex items-center gap-2.5">
                            <HBar
                              value={r.occ}
                              label={r.total ? `District occupancy ${r.occ} percent` : `Occupancy ${r.occ} percent`}
                              className="min-w-0 flex-1"
                            />
                            <span className="w-9 text-right tabular">{r.occ}%</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[13px] text-muted">
                            <EyeSlash className="size-4" aria-hidden="true" />
                            Suppressed · under 3 businesses
                          </span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="min-w-0 flex-[1_1_320px] text-[12px] leading-4 text-muted">
              {month?.note} Source: monthly room-night submissions from participating businesses, totalled by Injishi
              before sharing.
            </p>
            <Button onPress={() => setExportOpen(true)}>
              <Lock className="size-4" />
              Export via approved channel
            </Button>
          </div>
        </Card>

        <Card
          render={(p) => <section {...p} />}
          aria-labelledby="gs-h"
          className="min-w-0 flex-[1_1_340px] gap-3 p-[18px]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="gs-h" className="min-w-0 flex-1 text-[15px] leading-[22px] font-semibold">
              Guest-Stay Reporting
            </h2>
            <ToneChip tone="default">Not enabled</ToneChip>
          </div>
          <EmptyState size="sm" className="py-2">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Lock />
              </EmptyState.Media>
              <EmptyState.Title>Not enabled</EmptyState.Title>
              <EmptyState.Description>
                Legal authority, exact fields, frequency and secure channel have not been verified.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
          <span className="text-[12px] text-muted">Needed before any guest data is shared</span>
          <ul className="flex flex-col">
            {data.requirements.map((n) => (
              <li key={n.id} className="flex flex-col gap-0 border-t border-separator py-[7px]">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{n.title}</span>
                  <GateChip icon={<ShieldExclamation className="size-3" />}>{n.state}</GateChip>
                </span>
                <span className="text-[12px] leading-4 text-muted">{n.description}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-[18px]">
            Until every item is verified, no guest or stay data leaves any business for this purpose, and businesses are
            not asked to send it.
          </p>
          {requested ? (
            <Alert status="accent" role="status">
              <Alert.Indicator>
                <PaperPlane />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Sent to Emmanuel Nsengiyumva · MR-0027</Alert.Title>
                <Alert.Description>
                  The District decides whether to pursue it and must supply the legal basis. Injishi compliance only
                  checks what the District provides.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : (
            <Button variant="secondary" fullWidth onPress={() => setRequested(true)}>
              <PaperPlane className="size-4" />
              Ask the District to start a mandate request
            </Button>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Card
          render={(p) => <section {...p} />}
          aria-labelledby="ex-h"
          className="min-w-0 flex-[1_1_360px] gap-3 p-[18px]"
        >
          <Card.Header>
            <CardHeading id="ex-h">Exports and Reviews</CardHeading>
            <Card.Description>Encrypted files only · sensitive disclosures need a second officer</Card.Description>
          </Card.Header>
          <ListView aria-labelledby="ex-h" variant="secondary" items={exports}>
            {(x) => (
              <ListView.Item id={x.id} textValue={x.title}>
                <ListView.ItemContent>
                  <Icon name={x.icon} className="size-4 shrink-0 text-muted" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="whitespace-normal tabular">{x.title}</ListView.Title>
                    <ListView.Description className="whitespace-normal">{x.detail}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <ToneChip tone={x.tone}>{x.state}</ToneChip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </Card>

        <Card
          render={(p) => <section {...p} />}
          aria-labelledby="log-h"
          className="min-w-0 flex-[999_1_560px] gap-3 p-[18px]"
        >
          <Card.Header className="flex flex-row items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardHeading id="log-h">My Access Log</CardHeading>
              <Card.Description>
                Everything you opened or exported under this mandate · entries cannot be edited
              </Card.Description>
            </div>
            <GateChip icon={<ShieldExclamation className="size-3" />}>Retention configured · unverified</GateChip>
          </Card.Header>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="My access log">
                <Table.Header>
                  <Table.Column isRowHeader>When</Table.Column>
                  <Table.Column>Action</Table.Column>
                  <Table.Column>Record</Table.Column>
                  <Table.Column>Purpose</Table.Column>
                </Table.Header>
                <Table.Body>
                  {log.map((l) => (
                    <Table.Row key={l.id} id={l.id}>
                      <Table.Cell className="text-[13px] whitespace-nowrap text-muted tabular">{l.when}</Table.Cell>
                      <Table.Cell className="text-[13px]">{l.action}</Table.Cell>
                      <Table.Cell className="text-[13px] tabular">{l.record}</Table.Cell>
                      <Table.Cell className="text-[13px] text-muted">{l.purpose}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <p className="text-[12px] leading-4 text-muted">
            Your signatory and Injishi compliance can review this log. Corrections and revocations are added as new
            entries.
          </p>
        </Card>
      </div>

      <ExportDialog
        monthLabel={month?.name ?? ""}
        channels={data.channels}
        channel={channel}
        onChannel={setChannel}
        purpose={purpose}
        onPurpose={setPurpose}
        unsuppressed={unsuppressed}
        onUnsuppressed={setUnsuppressed}
        isOpen={exportOpen}
        onOpenChange={setExportOpen}
        onSubmit={submitExport}
      />
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}

function ExportDialog({
  monthLabel,
  channels,
  channel,
  onChannel,
  purpose,
  onPurpose,
  unsuppressed,
  onUnsuppressed,
  isOpen,
  onOpenChange,
  onSubmit,
}: {
  monthLabel: string;
  channels: ExportChannel[];
  channel: string;
  onChannel: (id: string) => void;
  purpose: boolean;
  onPurpose: (v: boolean) => void;
  unsuppressed: boolean;
  onUnsuppressed: (v: boolean) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog aria-labelledby="exd-h" className="sm:max-w-[640px]">
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="flex flex-col items-start gap-1">
            <Modal.Heading id="exd-h" className="text-lg leading-[26px] font-semibold">
              Export Occupancy by Sector · {monthLabel}
            </Modal.Heading>
            <p className="text-[13px] leading-[18px] text-muted">
              Only channels approved for this mandate can be used. The export is logged with your stated purpose.
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <RadioButtonGroup
              aria-label="Channel"
              layout="grid"
              value={channel}
              onChange={(v) => {
                const next = channels.find((c) => c.id === v);
                if (next?.approved) onChannel(v);
              }}
              className="grid-cols-1 gap-2.5 sm:grid-cols-3"
            >
              {channels.map((c) => (
                <RadioButtonGroup.Item key={c.id} value={c.id} isDisabled={!c.approved} className="gap-1 px-3.5 py-3">
                  <RadioButtonGroup.Indicator>
                    <CircleCheckFill />
                  </RadioButtonGroup.Indicator>
                  <RadioButtonGroup.ItemContent className="gap-0.5">
                    <Label className="text-[13px] font-semibold">{c.label}</Label>
                    <Description className="text-[12px] leading-4">{c.description}</Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              ))}
            </RadioButtonGroup>
            <div className="flex flex-col gap-2.5">
              <Checkbox isSelected={purpose} onChange={onPurpose}>
                <Checkbox.Content className="flex items-start gap-2.5">
                  <Checkbox.Control className="mt-0.5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">
                      I will use this only for tourism planning, as the mandate states
                    </span>
                    <span className="text-[12px] leading-4 text-muted">Required · recorded with the export</span>
                  </span>
                </Checkbox.Content>
              </Checkbox>
              <Checkbox isSelected={unsuppressed} onChange={onUnsuppressed}>
                <Checkbox.Content className="flex items-start gap-2.5">
                  <Checkbox.Control className="mt-0.5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">Include sectors with fewer than 3 businesses</span>
                    <span className="text-[12px] leading-4 text-muted">
                      Sensitive · needs a second officer’s review
                    </span>
                  </span>
                </Checkbox.Content>
              </Checkbox>
            </div>
            {unsuppressed ? (
              <Alert status="warning">
                <Alert.Indicator>
                  <PersonsLock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Sensitive disclosure · second officer review</Alert.Title>
                  <Alert.Description>
                    Unsuppressed sectors can identify a single business. Jean-Claude Mugabo must review your purpose
                    before the file is produced. Nothing is exported until then.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            <p className="flex items-start gap-2 text-[13px] leading-[18px] text-muted">
              <Key className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                The file is encrypted. Its key is sent separately by SMS to your registered phone ending 41, and the
                download link expires after 24 hours.
              </span>
            </p>
          </Modal.Body>
          <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button isDisabled={!purpose} onPress={onSubmit}>
              {unsuppressed ? "Send for second-officer review" : "Export encrypted file"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
