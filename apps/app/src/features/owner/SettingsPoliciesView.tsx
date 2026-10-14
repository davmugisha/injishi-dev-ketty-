"use client";

import { Check, ChevronDown, ClockArrowRotateLeft, ShieldExclamation } from "@gravity-ui/icons";
import { Button, Card, Chip, ListBox, ProgressBar, Select, Switch, Table } from "@heroui/react";
import { CellSelect, CellSwitch, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  SettingsPoliciesCard,
  SettingsPoliciesGroup,
  SettingsPoliciesGroupId,
  SettingsPoliciesOutlet,
  SettingsPoliciesProperty,
  SettingsPoliciesRow,
  SettingsPoliciesTier,
  SettingsPoliciesVersion,
} from "@injishi/data/fixtures/owner";
import { formatRwf, GateChip, LinkButton, PageContent, PageHeader, TextLink, toneColor } from "@injishi/ui";
import { useState, useTransition } from "react";
import { SettingsNav } from "./SettingsNav";
import { publishSettingsPoliciesVersion, saveSettingsPolicies } from "./SettingsPoliciesActions";

export interface SettingsPoliciesData {
  groups: SettingsPoliciesGroup[];
  properties: SettingsPoliciesProperty[];
  cards: SettingsPoliciesCard[];
  tiers: SettingsPoliciesTier[];
  versions: SettingsPoliciesVersion[];
  outlets: SettingsPoliciesOutlet[];
}

type Values = Record<string, string | boolean>;

/** Deposit used for the worked example in the refund tiers table. */
const EXAMPLE_DEPOSIT = 800000;

function PolicyRow({
  row,
  value,
  onChange,
}: {
  row: SettingsPoliciesRow;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-[3px]">
      {row.kind === "select" ? (
        <CellSelect
          variant="secondary"
          aria-label={row.label}
          value={String(value)}
          onChange={(v) => (v === null ? null : onChange(String(v)))}
        >
          <CellSelect.Trigger className="w-full">
            <CellSelect.Label>{row.label}</CellSelect.Label>
            <CellSelect.Value />
            <CellSelect.Indicator>
              <ChevronDown className="size-4" />
            </CellSelect.Indicator>
          </CellSelect.Trigger>
          <CellSelect.Popover>
            <ListBox>
              {row.options.map((o) => (
                <ListBox.Item key={o} id={o} textValue={o}>
                  {o}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </CellSelect.Popover>
        </CellSelect>
      ) : (
        <CellSwitch
          variant="secondary"
          isSelected={value === true}
          isDisabled={row.locked}
          onChange={(on) => onChange(on)}
        >
          <CellSwitch.Trigger className="w-full">
            <CellSwitch.Label>{row.label}</CellSwitch.Label>
            <CellSwitch.Control />
          </CellSwitch.Trigger>
        </CellSwitch>
      )}
      {row.note ? (
        <span className="flex flex-wrap items-center gap-2 px-3">
          <span className="text-xs leading-4 text-muted">{row.note}</span>
          {row.kind === "select" && row.gate ? (
            <GateChip icon={<ShieldExclamation className="size-3" aria-hidden="true" />}>{row.gate}</GateChip>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export function SettingsPoliciesView({ data }: { data: SettingsPoliciesData }) {
  const [group, setGroup] = useState<SettingsPoliciesGroupId>("book");
  const [property, setProperty] = useState(data.properties[0]?.id ?? "");
  const [vals, setVals] = useState<Values>({});
  const [saved, setSaved] = useState(false);
  const [ver, setVer] = useState(data.versions.find((v) => v.state === "current")?.id ?? data.versions[0]?.id ?? "");
  const [published, setPublished] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (id: string, v: string | boolean) => {
    setVals((cur) => ({ ...cur, [id]: v }));
    setSaved(false);
  };
  const rowValue = (r: SettingsPoliciesRow) => (vals[r.id] !== undefined ? (vals[r.id] as string | boolean) : r.value);
  const outletValue = (o: SettingsPoliciesOutlet) => {
    const v = vals[`c.${o.id}`];
    return v !== undefined ? v === true : o.allowed;
  };

  const rowChanges = data.cards
    .flatMap((c) => c.rows)
    .filter((r) => vals[r.id] !== undefined && vals[r.id] !== r.value).length;
  const outletChanges = data.outlets.filter(
    (o) => vals[`c.${o.id}`] !== undefined && vals[`c.${o.id}`] !== o.allowed,
  ).length;
  const total = rowChanges + outletChanges;

  const save = () =>
    startTransition(async () => {
      await saveSettingsPolicies(vals);
      setVals({});
      setSaved(true);
    });

  const version = data.versions.find((v) => v.id === ver) ?? data.versions[0];
  const draft = data.versions.find((v) => v.state === "draft" || v.state === "scheduled");
  const isScheduled = version?.state === "scheduled" || (published && version?.id === draft?.id);
  const versionState =
    isScheduled && version
      ? { label: "Scheduled", tone: "accent" as const }
      : { label: version?.stateLabel ?? "", tone: version?.stateTone ?? "default" };
  const publish = () => {
    if (!draft) return;
    setPublished(true);
    startTransition(async () => {
      await publishSettingsPoliciesVersion(draft.id);
    });
  };

  const propertyName = data.properties.find((p) => p.id === property)?.name ?? "";
  const cards = data.cards.filter((c) => c.group === group);

  return (
    <PageContent>
      <PageHeader
        eyebrow={<>Settings · {propertyName}</>}
        title="Policies"
        description="Rules your team and guests work with. Changes are versioned and start on their effective date; existing bookings keep the terms they were sold with."
        actions={
          <>
            <Select
              aria-label="Property"
              className="min-w-[min(220px,100%)]"
              value={property}
              onChange={(v) => (v === null ? null : setProperty(String(v)))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {data.properties.map((p) => (
                    <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                      {p.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <LinkButton href={screenHref("AuditLog")} variant="ghost">
              <ClockArrowRotateLeft className="size-4" />
              Change history
            </LinkButton>
          </>
        }
      />

      <SettingsNav current="SettingsPolicies" />

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Segment
          aria-label="Policy group"
          selectedKey={group}
          onSelectionChange={(k) => setGroup(String(k) as SettingsPoliciesGroupId)}
        >
          {data.groups.map((g) => (
            <Segment.Item key={g.id} id={g.id}>
              {g.label}
            </Segment.Item>
          ))}
        </Segment>
        {total > 0 ? (
          <Card variant="secondary" role="status" className="flex-row flex-wrap items-center gap-2.5 py-2 pr-2 pl-3.5">
            <span className="text-[13px] font-medium">
              {total === 1 ? "1 change" : `${total} changes`} unsaved · applies to bookings made from saving
            </span>
            <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => setVals({})}>
              Discard
            </Button>
            <Button size="sm" isDisabled={pending} onPress={save}>
              Save changes
            </Button>
          </Card>
        ) : null}
        {saved && total === 0 ? (
          <Chip color="success" variant="soft" role="status">
            <Check className="size-3" aria-hidden="true" />
            <Chip.Label>Saved 10:42 · recorded in the audit log</Chip.Label>
          </Chip>
        ) : null}
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        {cards.map((c) => (
          <Card key={c.id} aria-label={c.title} className="gap-2.5 p-[18px]">
            <Card.Header>
              <Card.Title className="text-[15px] font-semibold">{c.title}</Card.Title>
              <Card.Description>{c.description}</Card.Description>
            </Card.Header>
            {c.rows.map((r) => (
              <PolicyRow key={r.id} row={r} value={rowValue(r)} onChange={(v) => set(r.id, v)} />
            ))}
            {c.foot ? (
              <p className="text-xs leading-4 text-muted">
                {c.foot}{" "}
                {c.footLink ? <TextLink href={screenHref(c.footLink.board)}>{c.footLink.label}</TextLink> : null}
              </p>
            ) : null}
          </Card>
        ))}

        {group === "book" && version ? (
          <Card aria-labelledby="tier-h" className="col-span-full gap-3 p-[18px]">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <Card.Header>
                <Card.Title id="tier-h" className="text-[15px] font-semibold">
                  Cancellation and Refund Tiers
                </Card.Title>
                <Card.Description>
                  Decides what a guest gets back. Payments carries out the refund; nothing is refunded from here.
                </Card.Description>
              </Card.Header>
              <Segment aria-label="Policy version" selectedKey={ver} onSelectionChange={(k) => setVer(String(k))}>
                {data.versions.map((v) => (
                  <Segment.Item key={v.id} id={v.id}>
                    {v.label}
                  </Segment.Item>
                ))}
              </Segment>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip size="sm" variant="soft" color={toneColor(versionState.tone)}>
                {versionState.label}
              </Chip>
              <span className="text-[13px] text-muted">
                {version.policyName} · {version.name} · {version.dates}
              </span>
            </div>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Cancellation and refund tiers">
                  <Table.Header>
                    <Table.Column isRowHeader>Tier</Table.Column>
                    <Table.Column>Cancelled</Table.Column>
                    <Table.Column>Refund of deposit</Table.Column>
                    <Table.Column className="text-right">Example: RWF 800,000 deposit</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.tiers.map((t, i) => {
                      const pct = version.refunds[i] ?? 0;
                      return (
                        <Table.Row key={t.id} id={t.id}>
                          <Table.Cell className="font-medium">{t.name}</Table.Cell>
                          <Table.Cell>{t.when}</Table.Cell>
                          <Table.Cell className="min-w-[180px]">
                            <span className="flex items-center gap-2.5">
                              <ProgressBar
                                value={pct}
                                size="sm"
                                aria-label={`${t.name} refund of deposit`}
                                className="flex-1"
                              >
                                <ProgressBar.Track>
                                  <ProgressBar.Fill />
                                </ProgressBar.Track>
                              </ProgressBar>
                              <span className="w-10 text-right font-medium tabular">{pct}%</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-right tabular">
                            {formatRwf((EXAMPLE_DEPOSIT * pct) / 100)}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="max-w-[640px] text-xs leading-4 text-muted">
                Refund approval limits: front desk RWF 50,000 · finance RWF 300,000 · above that, the owner. Each
                booking stores the version it was sold with; BK-20418 uses version 4.
              </span>
              {draft && version.id === draft.id && version.state === "draft" && !published ? (
                <Button size="sm" isDisabled={pending} onPress={publish}>
                  Publish version 5 from 1 Nov
                </Button>
              ) : null}
              {draft && version.state === "current" ? (
                <Button size="sm" variant="secondary" onPress={() => setVer(draft.id)}>
                  Open the version 5 draft
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {group === "stay" ? (
          <Card aria-labelledby="ctr-h" className="col-span-full gap-3 p-[18px]">
            <Card.Header>
              <Card.Title id="ctr-h" className="text-[15px] font-semibold">
                Charge to Room by Outlet
              </Card.Title>
              <Card.Description>
                Outlet sales posted to a guest folio keep their outlet and department. Only outlets run by your own
                legal entity can post.
              </Card.Description>
            </Card.Header>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Charge to room by outlet">
                  <Table.Header>
                    <Table.Column isRowHeader>Outlet</Table.Column>
                    <Table.Column>Operator</Table.Column>
                    <Table.Column>Rule</Table.Column>
                    <Table.Column className="text-right">Allowed</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.outlets.map((o) => (
                      <Table.Row key={o.id} id={o.id}>
                        <Table.Cell className="font-medium">{o.name}</Table.Cell>
                        <Table.Cell className="text-[13px]">{o.operator}</Table.Cell>
                        <Table.Cell className="max-w-[320px] text-[13px] whitespace-normal">{o.rule}</Table.Cell>
                        <Table.Cell className="text-right">
                          <Switch
                            aria-label={`Charge to room at ${o.name}`}
                            isSelected={outletValue(o)}
                            isDisabled={o.locked}
                            onChange={(on) => set(`c.${o.id}`, on)}
                            className="inline-flex"
                          >
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card>
        ) : null}
      </div>
    </PageContent>
  );
}
