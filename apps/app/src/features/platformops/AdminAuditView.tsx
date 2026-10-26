"use client";

import { ArrowDownToLine, Ban, Check, EyeSlash, Link, ShieldKeyhole } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  Table,
  TextArea,
  TextField,
} from "@heroui/react";
import { Segment, Timeline } from "@heroui-pro/react";
import type { AuditCategory, AuditEvent, AuditKpi } from "@injishi/data/fixtures/platformops";
import { Icon, KeyValueList, PageContent, PageHeader } from "@injishi/ui";
import { type Key, useState } from "react";
import { firstKey, KpiStrip, selectableRow, ToneChip } from "./shared";

interface AdminAuditData {
  kpis: AuditKpi[];
  events: AuditEvent[];
}

const CATS: { id: "all" | AuditCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "personal", label: "Personal data" },
  { id: "viewas", label: "View-as" },
  { id: "priv", label: "Privileged" },
  { id: "denied", label: "Denied" },
];

const ACTORS = [
  { id: "all", label: "Everyone" },
  { id: "staff", label: "Injishi staff" },
  { id: "biz", label: "Business users" },
];

const FORMATS = [
  { id: "csv", label: "CSV" },
  { id: "json", label: "JSON" },
];

const CAT_LABEL: Record<string, string> = {
  all: "All categories",
  personal: "Personal data",
  viewas: "View-as",
  priv: "Privileged",
  denied: "Denied",
};

const ICON: Record<AuditCategory, string> = {
  personal: "PersonMagnifier",
  viewas: "Eye",
  priv: "Key",
  denied: "Ban",
};

const VIEWAS_SESSION = [
  { t: "09:38:10", text: "Session started · read-only · 30 min", status: "success" as const },
  { t: "09:38:11", text: "Owner Theoneste Bizimana notified", status: "default" as const },
  { t: "09:39:30", text: "Opened Registration › Owner details", status: "default" as const },
  { t: "09:41:52", text: "Opened Registration › Documents", status: "current" as const },
];

const PRIV_SESSION = [
  { t: "09:05:31", text: "Override requested by maker", status: "success" as const },
  { t: "09:06:02", text: "Approval request sent to Clarisse Umutoni", status: "current" as const },
];

const DENIED_WHY =
  "Platform staff cannot read or export tenant guest data outside a view-as session, and guest-list exports are never available to support. Kevin Mugisha, as lead, was notified.";

function sessionFor(event: AuditEvent) {
  if (event.category === "viewas") return { title: "Session VS-0384 · so far", items: VIEWAS_SESSION };
  if (event.id === "AUD-7781150") return { title: "Related events", items: PRIV_SESSION };
  return null;
}

export function AdminAuditView({ data, exportOpen = false }: { data: AdminAuditData; exportOpen?: boolean }) {
  const [cat, setCat] = useState("all");
  const [actor, setActor] = useState("all");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState("AUD-7781199");
  const [exp, setExp] = useState<boolean | null>(null);
  const [fmt, setFmt] = useState("csv");
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);

  const q = query.trim().toLowerCase();
  const shown = data.events.filter((e) => {
    if (cat !== "all" && e.category !== cat) return false;
    if (actor === "staff" && !e.staff) return false;
    if (actor === "biz" && e.staff) return false;
    if (!q) return true;
    return [e.id, e.actor, e.action, e.context, e.purpose, e.universe].join(" ").toLowerCase().includes(q);
  });
  const event = data.events.find((e) => e.id === sel) ?? data.events[0];
  const open = exp === null ? exportOpen : exp;
  const session = event ? sessionFor(event) : null;
  const digits = code.replace(/[^0-9]/g, "").slice(0, 6);
  const scope = `${CAT_LABEL[cat] ?? "All categories"} · today · all tenants · ${cat === "all" ? "1,284" : String(shown.length)} events · ${fmt.toUpperCase()}`;

  return (
    <PageContent>
      <PageHeader
        eyebrow="Oversight › Audit · all tenants · Monday 12 October 2026"
        title="Audit"
        description="Personal-data access, view-as sessions and privileged actions across the platform. Rows are written with the change they record and cannot be edited."
        actions={
          <Button
            variant="secondary"
            onPress={() => {
              setExp(true);
              setDone(false);
              setCode("");
            }}
          >
            <ArrowDownToLine />
            Export…
          </Button>
        }
      />

      <KpiStrip label="Today" items={data.kpis} />

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField aria-label="Search audit events" value={query} onChange={setQuery} className="w-[260px]">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Actor, record, ticket or session" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Segment aria-label="Category" selectedKey={cat} onSelectionChange={(k) => setCat(String(k))}>
          {CATS.map((c, i) => (
            <Segment.Item key={c.id} id={c.id}>
              {i > 0 ? <Segment.Separator /> : null}
              {c.label}
            </Segment.Item>
          ))}
        </Segment>
        <Segment aria-label="Actor" selectedKey={actor} onSelectionChange={(k) => setActor(String(k))}>
          {ACTORS.map((a, i) => (
            <Segment.Item key={a.id} id={a.id}>
              {i > 0 ? <Segment.Separator /> : null}
              {a.label}
            </Segment.Item>
          ))}
        </Segment>
        <Choice label="Tenant" value="all" options={[{ id: "all", label: "All tenants" }]} />
        <Choice label="Period" value="today" options={[{ id: "today", label: "Today" }]} />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-2" aria-label="Audit events">
          <AuditTable events={shown} selected={event?.id ?? ""} onSelect={setSel} />
          <p className="text-xs text-muted">
            Showing {shown.length} of 1,284 events today · newest first · retention 7 years (configured, unverified)
          </p>
        </section>
        {event ? (
          <Card className="min-w-0 flex-[1_1_340px] gap-3 p-[18px]" aria-labelledby="ev-h">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted tabular">{event.id}</span>
              <ToneChip tone={event.tone}>{event.result}</ToneChip>
            </div>
            <h2 id="ev-h" className="text-[17px] leading-6 font-semibold">
              {event.action}
            </h2>
            <KeyValueList
              items={[
                { label: "When", value: <span className="tabular">12 Oct 2026 · {event.time} CAT</span> },
                { label: "Actor", value: event.actor },
                { label: "Universe", value: event.universe },
                { label: "Context", value: event.context },
                { label: "Purpose", value: event.purpose },
                { label: "Device", value: event.device },
              ]}
            />
            {event.category === "denied" ? (
              <Alert status="danger">
                <Alert.Indicator>
                  <Ban />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Why it was denied</Alert.Title>
                  <Alert.Description>{DENIED_WHY}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {session ? (
              <div className="flex flex-col gap-1.5">
                <Label>{session.title}</Label>
                <Timeline size="sm" density="compact" aria-label={session.title}>
                  {session.items.map((s) => (
                    <Timeline.Item key={s.t} status={s.status}>
                      <Timeline.Rail>
                        <Timeline.Marker />
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5">
                        <span className="text-[13px] font-medium">{s.text}</span>
                        <span className="text-xs text-muted tabular">{s.t}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            ) : null}
            <Card variant="secondary" className="gap-1 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Link className="size-3.5" />
                Hash chain
              </span>
              <span className="text-xs text-muted tabular">
                Previous {event.prev} · this {event.hash}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-success">
                <Check className="size-3.5" />
                Chain verified to 09:00 checkpoint
              </span>
            </Card>
          </Card>
        ) : null}
      </div>

      <Modal.Backdrop
        isOpen={open}
        onOpenChange={(next) => {
          if (!next) {
            setExp(false);
            setDone(false);
            setCode("");
          }
        }}
      >
        <Modal.Container>
          <Modal.Dialog aria-labelledby="ex-h" className="gap-4 sm:max-w-[560px]">
            <Modal.CloseTrigger aria-label="Close" />
            <Modal.Header className="flex-col items-start gap-0.5">
              <Modal.Heading id="ex-h" className="text-[18px] leading-[26px] font-semibold">
                Export audit events
              </Modal.Heading>
              <p className="text-[13px] text-muted">{scope}</p>
            </Modal.Header>
            <Modal.Body className="gap-3.5">
              {done ? (
                <Alert status="success" role="status">
                  <Alert.Indicator>
                    <Icon name="CircleCheck" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Export EXP-0093 is ready</Alert.Title>
                    <Alert.Description>
                      Masked {fmt.toUpperCase()} file. The link works once and expires at 10:00 CAT. This export is
                      itself recorded as AUD-7781211 with your purpose.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : (
                <>
                  <TextField
                    fullWidth
                    defaultValue="Quarterly review of support view-as sessions for the Q4 access review."
                    className="gap-1"
                  >
                    <Label htmlFor="ex-why">Purpose</Label>
                    <TextArea id="ex-why" rows={2} />
                  </TextField>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Segment aria-label="Format" selectedKey={fmt} onSelectionChange={(k) => setFmt(String(k))}>
                      {FORMATS.map((f, i) => (
                        <Segment.Item key={f.id} id={f.id}>
                          {i > 0 ? <Segment.Separator /> : null}
                          {f.label}
                        </Segment.Item>
                      ))}
                    </Segment>
                    <span className="flex items-center gap-1.5 text-[13px]">
                      <EyeSlash className="size-4 text-muted" />
                      Personal data masked
                    </span>
                  </div>
                  <p className="text-xs leading-4 text-muted">
                    Unmasked exports need a compliance reason and Bosco Rutayisire’s approval. They are not available
                    from this dialog.
                  </p>
                  <Alert status="accent">
                    <Alert.Indicator>
                      <ShieldKeyhole />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>Confirm it is you</Alert.Title>
                      <Alert.Description>
                        Exports always ask again, even inside your 30-minute step-up window. Enter the 6-digit code from
                        your authenticator.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  <TextField
                    value={digits}
                    onChange={(value) => setCode(value.replace(/[^0-9]/g, "").slice(0, 6))}
                    className="w-40 gap-1"
                  >
                    <Label htmlFor="ex-code">Authenticator code</Label>
                    <Input
                      id="ex-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      className="text-lg tracking-[0.3em] tabular"
                    />
                    <Description>
                      {digits.length === 6
                        ? "Ready to verify"
                        : `${6 - digits.length} digits to go · code changes every 30 seconds`}
                    </Description>
                  </TextField>
                </>
              )}
            </Modal.Body>
            <Modal.Footer className="justify-end gap-2">
              {done ? (
                <>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setExp(false);
                      setDone(false);
                      setCode("");
                    }}
                  >
                    Close
                  </Button>
                  <Button variant="primary">
                    <ArrowDownToLine />
                    Download
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setExp(false);
                      setDone(false);
                      setCode("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" isDisabled={digits.length !== 6} onPress={() => setDone(true)}>
                    Verify and export
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}

function AuditTable({
  events,
  selected,
  onSelect,
}: {
  events: AuditEvent[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Audit events"
          selectionMode="single"
          selectionBehavior="replace"
          selectedKeys={events.some((e) => e.id === selected) ? new Set([selected]) : new Set()}
          onSelectionChange={(keys) => {
            const k = firstKey(keys as "all" | Set<Key>);
            if (k) onSelect(k);
          }}
        >
          <Table.Header>
            <Table.Column isRowHeader>Time</Table.Column>
            <Table.Column>Actor</Table.Column>
            <Table.Column>Action</Table.Column>
            <Table.Column>Context</Table.Column>
            <Table.Column>Result</Table.Column>
          </Table.Header>
          <Table.Body>
            {events.map((r) => (
              <Table.Row key={r.id} id={r.id} className={selectableRow}>
                <Table.Cell className="text-[13px] whitespace-nowrap tabular">{r.time}</Table.Cell>
                <Table.Cell>
                  <span className="flex flex-col gap-0">
                    <span className="text-[13px] font-medium">{r.actor}</span>
                    <span className="text-xs text-muted">{r.universe}</span>
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <Icon name={ICON[r.category]} className="size-3.5 text-muted" />
                      <span className="text-[13px] font-medium">{r.action}</span>
                    </span>
                    <span className="text-xs text-muted">{r.purpose}</span>
                  </span>
                </Table.Cell>
                <Table.Cell className="text-xs leading-4">{r.context}</Table.Cell>
                <Table.Cell>
                  <ToneChip tone={r.tone}>{r.result}</ToneChip>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function Choice({ label, value, options }: { label: string; value: string; options: { id: string; label: string }[] }) {
  return (
    <Select aria-label={label} value={value} className="min-w-[140px]">
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
