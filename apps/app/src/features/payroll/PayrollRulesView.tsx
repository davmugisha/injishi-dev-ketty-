"use client";

import { Check, ChevronRight, FileArrowUp, Hourglass, Paperclip, Plus, ShieldExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Drawer, Input, Label, Switch, Table, TextArea, TextField } from "@heroui/react";
import { DropZone, ItemCard, ItemCardGroup, ListView, NativeSelect, Timeline } from "@heroui-pro/react";
import type { Persona, RuleGovernanceStep, RuleSet } from "@injishi/product-hr";
import { useBoardHref } from "@injishi/product-hr/web";
import { GateChip, Icon, KeyValueList, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { PressableItemCard } from "./parts";

const MONTHS: Record<string, string> = {
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

/** "1 Jan 2027" → "1 January 2027". */
function longDate(short: string): string {
  return short.replace(/\b([A-Z][a-z]{2})\b/, (m) => MONTHS[m] ?? m);
}

const PROPOSABLE = [
  { id: "paye", label: "PAYE bands" },
  { id: "rssb", label: "RSSB contributions" },
  { id: "allw", label: "Allowance taxability" },
];

function StatusChip({ set }: { set: RuleSet }) {
  if (set.status === "approved") {
    return (
      <Chip size="sm" variant="soft" color="success">
        <Check className="size-3" aria-hidden="true" />
        <Chip.Label>{set.statusLabel}</Chip.Label>
      </Chip>
    );
  }
  return (
    <GateChip
      icon={
        set.status === "draft" ? (
          <Hourglass className="size-3" aria-hidden="true" />
        ) : (
          <ShieldExclamation className="size-3" aria-hidden="true" />
        )
      }
      className="h-auto max-w-full whitespace-normal py-0.5 text-left"
    >
      {set.statusLabel}
    </GateChip>
  );
}

interface Proposal {
  setId: string;
  version: string;
  effective: string;
  what: string;
  file: string | null;
}

const EMPTY_PROPOSAL: Proposal = { setId: "paye", version: "v2027-01", effective: "1 Jan 2027", what: "", file: null };

export function PayrollRulesView({
  persona,
  sets: initialSets,
  governance,
}: {
  persona: Persona;
  sets: RuleSet[];
  governance: RuleGovernanceStep[];
}) {
  const screenHref = useBoardHref();
  const [proposed, setProposed] = useState<RuleSet[]>([]);
  const sets = [...initialSets, ...proposed];
  const [selectedId, setSelectedId] = useState(() => initialSets.find((s) => s.status === "draft")?.id ?? "");
  const [compare, setCompare] = useState(true);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [proposeOpen, setProposeOpen] = useState(false);
  /** The drawer mounts on first use (HeroUI Drawer warns when mounted closed during hydration). */
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [draft, setDraft] = useState<Proposal>(EMPTY_PROPOSAL);

  const cur = sets.find((s) => s.id === selectedId) ?? sets[0];
  if (!cur) return null;
  const statutory = cur.status !== "approved";
  const isRequested = !!requested[cur.id];

  const submitProposal = () => {
    const base = initialSets.find((s) => s.id === draft.setId) ?? initialSets[0];
    if (!base) return;
    const version = draft.version.trim() || "v2027-01";
    const effective = draft.effective.trim() || "1 Jan 2027";
    const year = effective.match(/\d{4}$/)?.[0];
    const id = `new-${proposed.length + 1}`;
    const next: RuleSet = {
      ...base,
      id,
      icon: "PencilToSquare",
      version: `${version} draft`,
      prev: base.version,
      eff: effective,
      effRange: `Proposed from ${longDate(effective)}`,
      status: "draft",
      statusLabel: "Draft · awaiting sign-off and owner approval",
      kind: "Proposed change",
      by: `Proposed by ${persona.name} · just now`,
      owner: "Waiting · Didier Mugenzi approves after the expert",
      source: draft.file ? `${draft.file}, attached with the proposal` : "Source attached with the proposal",
      note:
        draft.what.trim() ||
        `${year ? `Re-confirmation for ${year}. ` : ""}Values are copied from ${base.version} until the expert confirms the published schedule.`,
      history: [
        { title: `${version} · draft`, detail: `Proposed today by ${persona.name}`, status: "current" },
        { title: `${base.version} · current`, detail: `From ${base.eff}`, status: "default" },
      ],
      used: [],
    };
    setProposed((p) => [...p, next]);
    setSelectedId(id);
    setCompare(false);
    setProposeOpen(false);
    setDraft(EMPTY_PROPOSAL);
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="People › Payroll rules · Rwanda · effective-dated versions"
        title="Payroll Rules"
        description="Every statutory value here is a configured version with its source. None is treated as verified law until a payroll expert signs it off."
        actions={
          <Button
            onPress={() => {
              setDrawerMounted(true);
              setProposeOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Propose new version
          </Button>
        }
      />

      <Alert status="warning" role="status">
        <Alert.Indicator>
          <ShieldExclamation aria-hidden="true" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>PAYE, RSSB and allowance rules are awaiting payroll expert sign-off</Alert.Title>
          <Alert.Description>
            Injishi ships no built-in rates. Each value was entered from the attached source and is applied only through
            its version. Until sign-off, a pay run using them can be confirmed only with the owner’s documented
            exception.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="flex flex-wrap items-start gap-[16px]">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-[16px]">
          <ItemCardGroup layout="list" aria-labelledby="sets-h" className="overflow-hidden">
            <ItemCardGroup.Header>
              <ItemCardGroup.Title id="sets-h">Rule Sets</ItemCardGroup.Title>
              <ItemCardGroup.Description>Current version per set, plus drafts</ItemCardGroup.Description>
            </ItemCardGroup.Header>
            {sets.map((s) => (
              <PressableItemCard key={s.id} isSelected={s.id === cur.id} onPress={() => setSelectedId(s.id)}>
                <ItemCard.Icon className="self-center">
                  <Icon name={s.icon} />
                </ItemCard.Icon>
                <ItemCard.Content className="items-start">
                  <ItemCard.Title>{s.name}</ItemCard.Title>
                  <ItemCard.Description>
                    {s.version} · from {s.eff}
                  </ItemCard.Description>
                  <span className="mt-1 flex max-w-full">
                    <StatusChip set={s} />
                  </span>
                </ItemCard.Content>
              </PressableItemCard>
            ))}
          </ItemCardGroup>

          <Card aria-labelledby="gov-h" className="gap-[10px] p-[16px]">
            <Card.Header>
              <Card.Title id="gov-h" className="text-[15px] font-semibold">
                How a Version Takes Effect
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <Timeline size="sm" density="compact">
                {governance.map((g) => (
                  <Timeline.Item key={g.id}>
                    <Timeline.Rail>
                      <Timeline.Marker>
                        <Icon name={g.icon} className="size-3" />
                      </Timeline.Marker>
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                      <span className="font-medium">{g.title}</span>
                      <span className="text-xs leading-4 text-muted">{g.detail}</span>
                    </Timeline.Content>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card.Content>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[16px]">
          <Card aria-labelledby="det-h" className="gap-[14px] p-[18px]">
            <div className="flex flex-wrap items-start gap-[12px]">
              <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
                <h2 id="det-h" className="text-[18px] leading-6 font-semibold">
                  {cur.name} · {cur.version}
                </h2>
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusChip set={cur} />
                  <Chip size="sm" variant="soft">
                    {cur.kind}
                  </Chip>
                </span>
              </div>
              <Switch isSelected={compare} onChange={setCompare}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Compare with {cur.prev}
                </Switch.Content>
              </Switch>
            </div>

            <KeyValueList
              items={[
                { label: "Effective", value: cur.effRange },
                {
                  label: "Source",
                  value: (
                    <span className="flex items-start gap-1.5">
                      <Paperclip className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      {cur.source}
                    </span>
                  ),
                },
                { label: "Configured by", value: cur.by },
                { label: "Owner approval", value: cur.owner },
                {
                  label: "Expert sign-off",
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>
                        {isRequested
                          ? "Requested today · invitation goes out once a payroll expert is assigned by the owner"
                          : cur.expert}
                      </span>
                      {statutory && !isRequested ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setRequested((r) => ({ ...r, [cur.id]: true }))}
                        >
                          Request sign-off
                        </Button>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />

            {compare ? (
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label={`${cur.name} ${cur.version} compared with ${cur.prev}`}>
                    <Table.Header>
                      <Table.Column isRowHeader>Line</Table.Column>
                      <Table.Column>{cur.prev}</Table.Column>
                      <Table.Column>{cur.version}</Table.Column>
                      <Table.Column>Change</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {cur.diff.map((x) => (
                        <Table.Row
                          key={x.line}
                          id={x.line}
                          className={x.change === "unchanged" ? undefined : "bg-accent-soft"}
                        >
                          <Table.Cell className="font-medium">{x.line}</Table.Cell>
                          <Table.Cell
                            className={
                              x.change === "changed"
                                ? "text-muted line-through tabular"
                                : x.change === "added"
                                  ? "text-muted tabular"
                                  : "tabular"
                            }
                          >
                            {x.old}
                          </Table.Cell>
                          <Table.Cell className="tabular">{x.now}</Table.Cell>
                          <Table.Cell>
                            <Chip
                              size="sm"
                              variant="soft"
                              color={x.change === "changed" ? "warning" : x.change === "added" ? "accent" : "default"}
                            >
                              {x.change === "changed" ? "Changed" : x.change === "added" ? "Added" : "Unchanged"}
                            </Chip>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            ) : (
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label={`${cur.name} ${cur.version} values`}>
                    <Table.Header>
                      {cur.cols.map((c, i) => (
                        <Table.Column key={c} isRowHeader={i === 0}>
                          {c}
                        </Table.Column>
                      ))}
                    </Table.Header>
                    <Table.Body>
                      {cur.rows.map((row) => (
                        <Table.Row key={row.join("|")} id={row.join("|")}>
                          {cur.cols.map((col, ci) => (
                            <Table.Cell key={col} className="tabular">
                              {row[ci]}
                            </Table.Cell>
                          ))}
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
            <p className="text-xs leading-4 text-muted">{cur.note}</p>
          </Card>

          <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
            <Card aria-labelledby="hist-h" className="gap-[10px] p-[16px]">
              <Card.Header>
                <Card.Title id="hist-h" className="text-[15px] font-semibold">
                  Version History
                </Card.Title>
                <Card.Description>Versions are never edited after use</Card.Description>
              </Card.Header>
              <Card.Content>
                <Timeline size="sm" density="compact">
                  {cur.history.map((h) => (
                    <Timeline.Item key={h.title} status={h.status}>
                      <Timeline.Rail>
                        <Timeline.Marker />
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                        <span className="font-medium">{h.title}</span>
                        <span className="text-xs leading-4 text-muted">{h.detail}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card.Content>
            </Card>

            <Card aria-labelledby="used-h" className="gap-[10px] p-[16px]">
              <Card.Header>
                <Card.Title id="used-h" className="text-[15px] font-semibold">
                  Used By
                </Card.Title>
                <Card.Description>Pay runs snapshot the versions they were calculated with</Card.Description>
              </Card.Header>
              <Card.Content>
                {cur.used.length ? (
                  <ListView
                    aria-label="Pay runs using this version"
                    variant="secondary"
                    items={cur.used.map((u) => ({ ...u, id: u.title }))}
                  >
                    {(u) => (
                      <ListView.Item id={u.id} textValue={u.title} href={screenHref(u.board)}>
                        <ListView.ItemContent>
                          <Icon name="Sack" className="size-4 shrink-0 text-muted" />
                          <div className="flex min-w-0 flex-col">
                            <ListView.Title>{u.title}</ListView.Title>
                            <ListView.Description>{u.detail}</ListView.Description>
                          </div>
                        </ListView.ItemContent>
                        <ListView.ItemAction>
                          <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                        </ListView.ItemAction>
                      </ListView.Item>
                    )}
                  </ListView>
                ) : (
                  <p className="text-[13px] text-muted">
                    Not used by any pay run yet. It applies from its effective date once approved.
                  </p>
                )}
              </Card.Content>
            </Card>
          </div>
        </div>
      </div>

      {drawerMounted ? (
        <Drawer.Backdrop isOpen={proposeOpen} onOpenChange={setProposeOpen}>
          <Drawer.Content placement="right">
            <Drawer.Dialog aria-labelledby="pp-h" className="w-full max-w-[460px]">
              <Drawer.CloseTrigger aria-label="Close" />
              <Drawer.Header className="flex flex-col gap-1">
                <Drawer.Heading id="pp-h" className="text-[18px] leading-6 font-semibold">
                  Propose a New Version
                </Drawer.Heading>
                <p className="text-[13px] text-muted">Nothing changes until it is signed off and approved.</p>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-[16px]">
                <NativeSelect fullWidth variant="secondary">
                  <Label htmlFor="pp-set">Rule set</Label>
                  <NativeSelect.Trigger
                    id="pp-set"
                    value={draft.setId}
                    onChange={(e) => setDraft((d) => ({ ...d, setId: e.target.value }))}
                  >
                    {PROPOSABLE.map((p) => (
                      <NativeSelect.Option key={p.id} value={p.id}>
                        {p.label}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
                <div className="grid grid-cols-2 gap-[10px]">
                  <TextField fullWidth value={draft.version} onChange={(v) => setDraft((d) => ({ ...d, version: v }))}>
                    <Label>Version</Label>
                    <Input variant="secondary" />
                  </TextField>
                  <TextField
                    fullWidth
                    value={draft.effective}
                    onChange={(v) => setDraft((d) => ({ ...d, effective: v }))}
                  >
                    <Label>Effective from</Label>
                    <Input variant="secondary" />
                  </TextField>
                </div>
                <TextField fullWidth value={draft.what} onChange={(v) => setDraft((d) => ({ ...d, what: v }))}>
                  <Label>What changes and why</Label>
                  <TextArea
                    variant="secondary"
                    rows={3}
                    placeholder="For example: re-confirm 2027 bands from the published RRA schedule"
                  />
                </TextField>
                <DropZone>
                  <DropZone.Area
                    className="p-[16px]"
                    onDrop={async (e) => {
                      for (const item of e.items) {
                        if (item.kind === "file") {
                          const file = await item.getFile();
                          setDraft((d) => ({ ...d, file: file.name }));
                          break;
                        }
                      }
                    }}
                  >
                    <DropZone.Icon>
                      <FileArrowUp aria-hidden="true" />
                    </DropZone.Icon>
                    <DropZone.Label>Attach the source document</DropZone.Label>
                    <DropZone.Description>
                      Gazette, RRA or RSSB publication, or the expert’s written opinion. Required.
                    </DropZone.Description>
                    <DropZone.Trigger>Choose file</DropZone.Trigger>
                  </DropZone.Area>
                  <DropZone.Input
                    accept=".pdf,.doc,.docx,.png,.jpg"
                    onSelect={(files) => {
                      const file = files[0];
                      if (file) setDraft((d) => ({ ...d, file: file.name }));
                    }}
                  />
                  {draft.file ? (
                    <DropZone.FileList>
                      <DropZone.FileItem status="complete">
                        <DropZone.FileFormatIcon format={draft.file.split(".").pop()?.toUpperCase() ?? "FILE"} />
                        <DropZone.FileInfo>
                          <DropZone.FileName>{draft.file}</DropZone.FileName>
                          <DropZone.FileMeta>Attached</DropZone.FileMeta>
                        </DropZone.FileInfo>
                        <DropZone.FileRemoveTrigger
                          aria-label={`Remove ${draft.file}`}
                          onPress={() => setDraft((d) => ({ ...d, file: null }))}
                        />
                      </DropZone.FileItem>
                    </DropZone.FileList>
                  ) : null}
                </DropZone>
                <Card variant="secondary" className="gap-2 p-3">
                  <span className="text-[13px] font-semibold">Approval route</span>
                  <span className="flex items-center gap-2 text-[13px]">
                    <Chip size="sm" variant="soft">
                      1
                    </Chip>
                    Payroll expert sign-off · not yet assigned
                  </span>
                  <span className="flex items-center gap-2 text-[13px]">
                    <Chip size="sm" variant="soft">
                      2
                    </Chip>
                    Owner approval · Didier Mugenzi
                  </span>
                  <span className="text-xs text-muted">You propose; you cannot approve your own proposal.</span>
                </Card>
              </Drawer.Body>
              <Drawer.Footer className="border-t border-separator">
                <Button variant="ghost" onPress={() => setProposeOpen(false)}>
                  Cancel
                </Button>
                <Button onPress={submitProposal}>Submit for sign-off</Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      ) : null}
    </PageContent>
  );
}
