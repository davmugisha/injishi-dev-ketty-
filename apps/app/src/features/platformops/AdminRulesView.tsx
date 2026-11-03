"use client";

import { Calendar, CircleCheck, Clock, ClockArrowRotateLeft, ListCheck, ShieldExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Input, Label, ProgressBar, Switch, Table, Tabs, TextField } from "@heroui/react";
import { ListView, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  Catalog,
  FeatureFlag,
  LocaleString,
  MessageTemplate,
  PlatformSetting,
  PricePlan,
} from "@injishi/data/fixtures/platformops";
import { GateChip, Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { money, ToneChip } from "./shared";

interface AdminRulesData {
  catalogs: Catalog[];
  flags: FeatureFlag[];
  plans: PricePlan[];
  strings: LocaleString[];
  templates: MessageTemplate[];
  config: PlatformSetting[];
}

const BOOKS = [
  { id: "v2", label: "v2 · active since 1 Jul 2026" },
  { id: "v3", label: "v3 · draft for 1 Jan 2027" },
];

function deltaOf(v2: number, v3: number, editing: boolean): { text: string; tone: "default" | "warning" | "success" } {
  const d = editing ? Math.round(((v3 - v2) / v2) * 1000) / 10 : 0;
  if (d === 0) return { text: "No change", tone: "default" };
  return { text: `${d > 0 ? "+" : ""}${d}%`, tone: d > 0 ? "warning" : "success" };
}

export function AdminRulesView({ data }: { data: AdminRulesData }) {
  const [cat, setCat] = useState("tax");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [book, setBook] = useState("v3");
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(data.plans.map((p) => [p.id, p.v3])),
  );
  const [saved, setSaved] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const [checked, setChecked] = useState(false);
  const [tpl, setTpl] = useState("payment_pending");

  const catalog = data.catalogs.find((c) => c.id === cat) ?? data.catalogs[0];
  const editing = book === "v3";
  const template = data.templates.find((t) => t.id === tpl) ?? data.templates[0];
  const strings = data.strings.filter((s) => !missingOnly || s.status !== "Reviewed");

  return (
    <PageContent>
      <PageHeader
        eyebrow="Platform › Rules and catalogs · Production"
        title="Rules and Catalogs"
        actions={
          <LinkButton href={screenHref("AdminAudit")} variant="secondary">
            <ClockArrowRotateLeft />
            Change history
          </LinkButton>
        }
      />

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(440px,100%),1fr))]">
        <Card className="gap-3 p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="cat-h" className="text-[15px] leading-[22px] font-semibold">
                Catalogs
              </h2>
              <p className="text-[13px] leading-[18px] text-muted">{catalog?.meta}</p>
            </div>
            <Button size="sm" variant="secondary">
              New draft
            </Button>
          </div>
          <Tabs selectedKey={cat} onSelectionChange={(k) => setCat(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Catalog" className="gap-1">
                {data.catalogs.map((c) => (
                  <Tabs.Tab key={c.id} id={c.id} className="h-10 w-auto flex-none px-2 text-sm whitespace-nowrap">
                    {c.label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {data.catalogs.map((c) => (
              <Tabs.Panel key={c.id} id={c.id} className="flex flex-col gap-3 p-0 pt-3">
                {c.gate ? (
                  <GateChip icon={<ShieldExclamation className="size-3" />} className="self-start">
                    {c.gate}
                  </GateChip>
                ) : null}
                <Table variant="secondary">
                  <Table.ScrollContainer>
                    <Table.Content aria-label={c.label}>
                      <Table.Header>
                        <Table.Column isRowHeader>Code</Table.Column>
                        <Table.Column>Name</Table.Column>
                        <Table.Column>Value or note</Table.Column>
                        <Table.Column>Status</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {c.rows.map((r) => (
                          <Table.Row key={r.code} id={r.code}>
                            <Table.Cell className="text-xs text-muted tabular">{r.code}</Table.Cell>
                            <Table.Cell className="text-[13px] font-medium">{r.name}</Table.Cell>
                            <Table.Cell className="text-xs leading-4">{r.note}</Table.Cell>
                            <Table.Cell>
                              <ToneChip tone={r.tone}>{r.status}</ToneChip>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="ff-h">
          <div className="flex flex-col gap-0.5">
            <h2 id="ff-h" className="text-[15px] leading-[22px] font-semibold">
              Feature Flags
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Per tenant and per workstream. Flags stage rollout; they never remove approved v1 scope.
            </p>
          </div>
          <ListView variant="secondary" aria-label="Feature flags">
            {data.flags.map((f) => {
              const asked = pending[f.id] === true;
              const on = asked ? !f.on : f.on;
              return (
                <ListView.Item key={f.id} id={f.id} textValue={f.key}>
                  <ListView.ItemContent className="items-start">
                    <div className="flex flex-col gap-0.5">
                      <ListView.Title className="text-[13px] tabular">{f.key}</ListView.Title>
                      <ListView.Description className="whitespace-normal">
                        {f.workstream} · {f.scope}
                      </ListView.Description>
                      {asked ? (
                        <Chip size="sm" variant="soft" color="warning" className="self-start">
                          <Chip.Label>Change requested · {f.approver} approves</Chip.Label>
                        </Chip>
                      ) : null}
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <Switch
                      size="sm"
                      isSelected={on}
                      isDisabled={f.locked}
                      aria-label={f.key}
                      onChange={() => {
                        if (!f.locked) setPending((s) => ({ ...s, [f.id]: !asked }));
                      }}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </ListView.ItemAction>
                </ListView.Item>
              );
            })}
          </ListView>
          <p className="text-xs leading-4 text-muted">
            Toggling creates a change request with your reason. Locked flags depend on an external gate being verified
            first.
          </p>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="pp-h">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="pp-h" className="text-[15px] leading-[22px] font-semibold">
                Plan Prices
              </h2>
              <p className="text-[13px] leading-[18px] text-muted">
                Monthly, excluding VAT. Billed on the 1st; the first month is a pro-rated activation stub.
              </p>
            </div>
            <GateChip icon={<ShieldExclamation className="size-3" />}>Commercial terms awaiting sign-off</GateChip>
          </div>
          <Segment
            aria-label="Price book version"
            selectedKey={book}
            onSelectionChange={(k) => setBook(String(k))}
            className="self-start"
          >
            {BOOKS.map((b, i) => (
              <Segment.Item key={b.id} id={b.id}>
                {i > 0 ? <Segment.Separator /> : null}
                {b.label}
              </Segment.Item>
            ))}
          </Segment>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Plan prices">
                <Table.Header>
                  <Table.Column isRowHeader>Plan</Table.Column>
                  <Table.Column className="text-right">v2 active</Table.Column>
                  <Table.Column className="text-right">{editing ? "v3 draft" : "v2 active"}</Table.Column>
                  <Table.Column className="text-right">Change</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.plans.map((p) => {
                    const v3 = prices[p.id] ?? p.v3;
                    const delta = deltaOf(p.v2, v3, editing);
                    return (
                      <Table.Row key={p.id} id={p.id}>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-muted">{p.includes}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{money(p.v2)}</Table.Cell>
                        <Table.Cell className="text-right">
                          {editing ? (
                            <TextField
                              aria-label={`${p.name} draft price`}
                              value={String(v3)}
                              onChange={(value) => {
                                const n = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
                                if (!Number.isNaN(n)) {
                                  setPrices((s) => ({ ...s, [p.id]: n }));
                                  setSaved(false);
                                }
                              }}
                              className="ml-auto w-[110px]"
                            >
                              <Label className="sr-only" htmlFor={`price-${p.id}`}>
                                {p.name} draft price
                              </Label>
                              <Input id={`price-${p.id}`} className="text-right tabular" inputMode="numeric" />
                            </TextField>
                          ) : (
                            <span className="tabular">{money(p.v2)}</span>
                          )}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <ToneChip tone={delta.tone}>{delta.text}</ToneChip>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted" />
              Effective 1 Jan 2027 · tenants notified 60 days before
            </span>
            <span className="flex items-center gap-1.5">
              <CircleCheck className="size-3.5 text-success" />
              Product · Alain Ntwari · 10 Oct
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted" />
              Finance · Clarisse Umutoni · pending
            </span>
          </div>
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" onPress={() => setSaved(true)}>
                {saved ? "Draft saved 09:43 · sent to Finance" : "Save draft and request approval"}
              </Button>
              <span className="text-xs text-muted">
                Existing subscriptions keep v2 prices until their next renewal after the effective date.
              </span>
            </div>
          ) : null}
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="l10n-h">
          <div className="flex flex-col gap-0.5">
            <h2 id="l10n-h" className="text-[15px] leading-[22px] font-semibold">
              Localization
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              English and Kinyarwanda strings for every operator, guest and resident surface
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProgressBar aria-label="English coverage" value={100} color="success" className="gap-1">
              <div className="flex items-center justify-between gap-2">
                <Label>English</Label>
                <span className="text-sm tabular">2,418 of 2,418</span>
              </div>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <ProgressBar aria-label="Kinyarwanda coverage" value={92} color="warning" className="gap-1">
              <div className="flex items-center justify-between gap-2">
                <Label>Kinyarwanda</Label>
                <span className="text-sm tabular">2,226 of 2,418</span>
              </div>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Switch size="sm" isSelected={missingOnly} onChange={setMissingOnly} aria-label="Missing only">
              <Switch.Content className="flex items-center gap-2 text-[13px] font-normal">
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Missing only
              </Switch.Content>
            </Switch>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setChecked(true);
                setMissingOnly(true);
              }}
            >
              <ListCheck />
              Run missing-translation check
            </Button>
          </div>
          {checked ? (
            <Alert status="warning">
              <Alert.Indicator>
                <Icon name="TriangleExclamation" />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Checked 09:43 · 192 missing, 14 new since the last release</Alert.Title>
                <Alert.Description>
                  9 are on guest or resident screens. The next release is blocked until those 9 are translated and
                  reviewed.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Localization strings">
                <Table.Header>
                  <Table.Column isRowHeader>Key</Table.Column>
                  <Table.Column>English</Table.Column>
                  <Table.Column>Kinyarwanda</Table.Column>
                  <Table.Column>Status</Table.Column>
                </Table.Header>
                <Table.Body>
                  {strings.map((s) => (
                    <Table.Row key={s.id} id={s.id}>
                      <Table.Cell className="text-xs text-muted">{s.key}</Table.Cell>
                      <Table.Cell className="text-[13px]">{s.en}</Table.Cell>
                      <Table.Cell className={`text-[13px] ${s.rw ? "" : "text-muted"}`}>
                        {s.rw || "Not translated"}
                      </Table.Cell>
                      <Table.Cell>
                        <ToneChip tone={s.tone}>{s.status}</ToneChip>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="tp-h">
          <div className="flex flex-col gap-0.5">
            <h2 id="tp-h" className="text-[15px] leading-[22px] font-semibold">
              Email and SMS Templates
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Versioned per language. Placeholders are filled from the record, never typed by staff.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
              {data.templates.map((t) => (
                <Button
                  key={t.id}
                  variant="ghost"
                  aria-current={t.id === template?.id ? "true" : undefined}
                  onPress={() => setTpl(t.id)}
                  className="h-auto justify-start gap-2 px-2.5 py-2"
                >
                  <Icon name={t.icon} className="size-4 text-muted" />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0">
                    <span className="text-[13px] font-medium">{t.name}</span>
                    <span className="text-xs text-muted">
                      {t.channel} · {t.version}
                    </span>
                  </span>
                  {t.rwMissing ? (
                    <Chip size="sm" variant="soft" color="danger">
                      <Chip.Label>RW missing</Chip.Label>
                    </Chip>
                  ) : null}
                </Button>
              ))}
            </div>
            {template ? (
              <Card variant="secondary" className="min-w-0 flex-[1.3_1_240px] gap-2 p-3.5">
                <span className="text-xs text-muted">
                  {template.channel} · {template.version} · English preview
                </span>
                {template.subject ? <span className="text-[13px] font-semibold">{template.subject}</span> : null}
                <p className="text-[13px] leading-[19px]">{template.body}</p>
                <span className="text-xs text-muted">
                  {template.rwMissing
                    ? "Kinyarwanda version missing · English is sent to everyone until it is added"
                    : "English and Kinyarwanda reviewed · sent in the recipient’s language"}
                </span>
              </Card>
            ) : null}
          </div>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="cfg-h">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="cfg-h" className="text-[15px] leading-[22px] font-semibold">
                Platform Configuration
              </h2>
              <p className="text-[13px] leading-[18px] text-muted">Values in force in production now</p>
            </div>
            <Button size="sm" variant="ghost">
              Propose change
            </Button>
          </div>
          <ListView variant="secondary" aria-label="Platform configuration">
            {data.config.map((cf) => (
              <ListView.Item key={cf.id} id={cf.id} textValue={cf.label}>
                <ListView.ItemContent>
                  <div className="flex flex-col">
                    <ListView.Title className="text-[13px]">{cf.label}</ListView.Title>
                    <ListView.Description>{cf.meta}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction className="flex items-center gap-1.5">
                  <span className="text-right text-[13px] font-medium tabular">{cf.value}</span>
                  {cf.unverified ? (
                    <GateChip icon={<ShieldExclamation className="size-3" />}>Configured · unverified</GateChip>
                  ) : null}
                </ListView.ItemAction>
              </ListView.Item>
            ))}
          </ListView>
        </Card>
      </div>
    </PageContent>
  );
}
