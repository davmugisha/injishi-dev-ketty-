"use client";

import { Clock, PaperPlane, PersonPlus, PersonsLock, ShieldCheck, ShieldExclamation } from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Description,
  Drawer,
  Input,
  Label,
  ListBox,
  Meter,
  Select,
  Table,
  Tag,
  TagGroup,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { Segment, Timeline } from "@heroui-pro/react";
import type {
  AccessReviewItem,
  DistrictOfficer,
  DistrictSector,
  GovernmentBody,
  OfficerPermission,
} from "@injishi/data/fixtures/oversight";
import { GateChip, PageContent, PageHeader, SectionHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { CardHeading, ToneChip } from "./shared";

interface DistrictAdminData {
  bodies: GovernmentBody[];
  officers: DistrictOfficer[];
  permissions: OfficerPermission[];
  review: AccessReviewItem[];
  sectors: DistrictSector[];
}

type ReviewDecision = "keep" | "revoke";
type Scope = "district" | "sector";

const PATH = [
  { id: "draft", status: "current" as const, title: "Drafted by you", detail: "Now · nothing changes yet" },
  {
    id: "sign",
    status: "default" as const,
    title: "District signatory approves",
    detail: "Emmanuel Nsengiyumva · Director of Business Development",
  },
  {
    id: "verify",
    status: "default" as const,
    title: "Injishi compliance verifies",
    detail: "Checks the mandate reference and officer identity · does not choose officers",
  },
  {
    id: "start",
    status: "default" as const,
    title: "Access starts",
    detail: "On the valid-from date · officer is notified · logged",
  },
];

/** Bodies, scoped officer assignments and the quarterly access review. */
export function DistrictAdminView({ data }: { data: DistrictAdminData }) {
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("district");
  const [sectorsOn, setSectorsOn] = useState<string[]>(["gisenyi"]);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [basis, setBasis] = useState("RD/BDU/2026/118");
  const [reason, setReason] = useState("");
  const [body, setBody] = useState("");
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>(() => {
    const init: Record<string, ReviewDecision> = {};
    for (const item of data.review) if (item.decision) init[item.id] = item.decision;
    return init;
  });
  const [submitted, setSubmitted] = useState(false);

  const draft = data.officers.find((o) => o.id === drawerId) ?? null;
  const reviewTotal = data.review.filter((r) => !r.isSelf).length;
  const reviewed = data.review.filter((r) => !r.isSelf && decisions[r.id]).length;
  const reviewPct = reviewTotal ? Math.round((reviewed / reviewTotal) * 100) : 0;
  const verifiedBodies = data.bodies.filter((b) => b.mandateTone === "success");
  const bothRoles = !!(perms.verify && perms.approve);
  const noPerms = !data.permissions.some((p) => perms[p.id]);

  const openFor = (o: DistrictOfficer) => {
    const isNew = o.id === "fabrice";
    setDrawerId(o.id);
    setScope(o.sectorScoped ? "sector" : "district");
    setPerms(Object.fromEntries(data.permissions.map((p) => [p.id, o.permissions.includes(p.id)])));
    setFrom(isNew ? (o.draft?.from ?? "15 October 2026") : "12 October 2026");
    setUntil(o.validUntil === "31 Dec 2026" ? "31 December 2026" : "30 June 2027");
    setBasis("RD/BDU/2026/118");
    setReason(
      isNew
        ? (o.draft?.reason ??
            "Fabrice joins the tourism planning team and needs sector occupancy totals for the 2027 destination plan.")
        : "Scope change after Q4 access review.",
    );
    setBody(o.body);
  };

  const closeDrawer = () => setDrawerId(null);

  const sendDraft = () => {
    setDrawerId(null);
    toast.success("Sent to Emmanuel Nsengiyumva for approval · access has not started", {
      indicator: <PaperPlane className="size-4" />,
    });
  };

  const shortsOf = (o: DistrictOfficer) => {
    const labels = o.permissions
      .map((id) => data.permissions.find((p) => p.id === id)?.short)
      .filter((label): label is string => !!label);
    return labels.length ? labels : ["None"];
  };

  return (
    <PageContent className="text-[14px] leading-5">
      <PageHeader
        eyebrow="Rubavu District · Administration"
        title="Bodies and Officers"
        description="Who may act for which institution, where, and until when. A new assignment starts only after the District signatory approves it and Injishi verifies the mandate."
        actions={
          <Button
            onPress={() => {
              const fabrice = data.officers.find((o) => o.id === "fabrice");
              if (fabrice) openFor(fabrice);
            }}
          >
            <PersonPlus className="size-4" />
            Assign officer
          </Button>
        }
      />

      <section className="flex flex-col gap-2.5" aria-labelledby="bodies-h">
        <SectionHeader
          id="bodies-h"
          title="Government Bodies"
          description="Bodies relevant to Rubavu District · a body without a verified mandate has no officer access"
          action={
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Mandates verified by Injishi compliance from signed documents
            </span>
          }
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Government bodies">
              <Table.Header>
                <Table.Column isRowHeader>Body</Table.Column>
                <Table.Column>Jurisdiction</Table.Column>
                <Table.Column>Mandate</Table.Column>
                <Table.Column>Legal basis reference</Table.Column>
                <Table.Column className="text-right">Officers</Table.Column>
                <Table.Column>Last verified</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.bodies.map((b) => (
                  <Table.Row key={b.id} id={b.id}>
                    <Table.Cell>
                      <span className="flex items-center gap-2.5">
                        <Avatar size="sm" variant="soft" color={toneColor(b.avatarTone)} className="shrink-0">
                          <Avatar.Fallback>{b.initials}</Avatar.Fallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">{b.name}</span>
                          <span className="text-[12px] leading-4 text-muted">{b.kind}</span>
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>{b.jurisdiction}</Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ToneChip tone={b.mandateTone}>{b.mandate}</ToneChip>
                        {b.needsVerification ? (
                          <GateChip icon={<ShieldExclamation className="size-3" />}>Needs verification</GateChip>
                        ) : null}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span className="text-[13px] tabular">{b.basis}</span>
                        <span className="text-[12px] leading-4 text-muted">{b.basisNote}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right tabular">{b.officers}</Table.Cell>
                    <Table.Cell>
                      <span className="text-[13px] text-muted">{b.lastVerified}</span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[999_1_620px] flex-col gap-2.5" aria-labelledby="off-h">
          <SectionHeader
            id="off-h"
            title="Officers and Scoped Assignments"
            description="Each assignment names a body, a jurisdiction, exact permissions and an expiry. There is no general government role."
          />
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Officers and scoped assignments">
                <Table.Header>
                  <Table.Column isRowHeader>Officer</Table.Column>
                  <Table.Column>Jurisdiction</Table.Column>
                  <Table.Column>Permissions</Table.Column>
                  <Table.Column>Valid until</Table.Column>
                  <Table.Column>Status</Table.Column>
                  <Table.Column>
                    <span className="sr-only">Actions</span>
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.officers.map((o) => (
                    <Table.Row key={o.id} id={o.id}>
                      <Table.Cell>
                        <span className="flex items-center gap-2.5">
                          <Avatar size="sm" variant="soft" className="shrink-0">
                            <Avatar.Fallback>{o.initials}</Avatar.Fallback>
                          </Avatar>
                          <span className="flex min-w-0 flex-col">
                            <span className="font-medium">{o.name}</span>
                            <span className="text-[12px] leading-4 text-muted">{o.body}</span>
                          </span>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-[13px]">{o.jurisdiction}</Table.Cell>
                      <Table.Cell className="max-w-[260px]">
                        <span className="flex flex-wrap gap-1">
                          {shortsOf(o).map((label) => (
                            <ToneChip key={label} tone="default">
                              {label}
                            </ToneChip>
                          ))}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="flex flex-col">
                          <span className="text-[13px] tabular">{o.validUntil}</span>
                          <span className="text-[12px] leading-4 text-muted">{o.validNote}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <ToneChip tone={o.statusTone}>{o.status}</ToneChip>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {o.editable ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit scope for ${o.name}`}
                            onPress={() => openFor(o)}
                          >
                            Edit scope
                          </Button>
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <p className="flex items-start gap-2 text-[12px] leading-4 text-muted">
            <PersonsLock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              An officer may hold both verify and approve, but the system never lets the same person do both on one
              case. You cannot edit your own scope.
            </span>
          </p>
        </section>

        <Card
          id="review"
          render={(p) => <section {...p} />}
          aria-labelledby="rev-h"
          className="min-w-0 flex-[1_1_340px] gap-3 p-[18px]"
        >
          <Card.Header>
            <CardHeading id="rev-h">Access Review · Q4 2026</CardHeading>
            <Card.Description>You prepare it · Emmanuel Nsengiyumva signs off by 1 December</Card.Description>
          </Card.Header>
          <Meter
            aria-label="Officers reviewed"
            value={reviewPct}
            valueLabel={`${reviewed} of ${reviewTotal}`}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <Label>Reviewed</Label>
              <span className="text-[13px] tabular">
                {reviewed} of {reviewTotal}
              </span>
            </div>
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>
          <Alert status="warning">
            <Alert.Indicator>
              <Clock />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Vestine Uwamahoro has not signed in for 41 days</Alert.Title>
              <Alert.Description>
                Unused access is the usual reason to revoke. Her assignment also ends on 31 Dec.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <ul className="flex flex-col">
            {data.review.map((r) => {
              const decision = decisions[r.id];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2.5 border-t border-separator py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-[12px] leading-4 text-muted">{r.note}</span>
                  </div>
                  {r.isSelf ? <ToneChip tone="default">Signatory reviews you</ToneChip> : null}
                  {!r.isSelf && !decision ? (
                    <span className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => setDecisions((s) => ({ ...s, [r.id]: "keep" }))}
                      >
                        Keep
                      </Button>
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => setDecisions((s) => ({ ...s, [r.id]: "revoke" }))}
                      >
                        Revoke
                      </Button>
                    </span>
                  ) : null}
                  {!r.isSelf && decision ? (
                    <span className="flex items-center gap-1.5">
                      <ToneChip tone={decision === "revoke" ? "danger" : "success"}>
                        {decision === "revoke" ? "Revoke" : "Keep"}
                      </ToneChip>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Undo decision for ${r.name}`}
                        onPress={() => {
                          setDecisions((s) => {
                            const next = { ...s };
                            delete next[r.id];
                            return next;
                          });
                          setSubmitted(false);
                        }}
                      >
                        Undo
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Button
            fullWidth
            isDisabled={reviewed < reviewTotal || submitted}
            onPress={() => {
              setSubmitted(true);
              toast.success("Access review sent to Emmanuel Nsengiyumva · revocations apply when he signs", {
                indicator: <PaperPlane className="size-4" />,
              });
            }}
          >
            {submitted ? "Sent to Emmanuel Nsengiyumva for sign-off" : "Send review for sign-off"}
          </Button>
          <p className="text-[12px] leading-4 text-muted">
            Last review: Q3, signed 1 Sep 2026 · 1 assignment revoked (Pacifique Habimana). Revocations take effect
            within minutes of signing.
          </p>
        </Card>
      </div>

      <Drawer.Backdrop isOpen={draft != null} onOpenChange={(open) => (open ? null : closeDrawer())}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="drawer-h" className="w-[min(480px,100vw)]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header className="flex flex-col items-start gap-1">
              <Drawer.Heading id="drawer-h" className="text-lg leading-[26px] font-semibold">
                {draft?.id === "fabrice" ? "Assign Officer" : `Edit Scope · ${draft?.name ?? ""}`}
              </Drawer.Heading>
              <p className="text-[13px] leading-[18px] text-muted">
                Drafted by you · approved by the District signatory · verified by Injishi before access starts
              </p>
            </Drawer.Header>
            {draft ? (
              <Drawer.Body className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label>Officer</Label>
                    <Select
                      aria-label="Officer"
                      fullWidth
                      value={draft.id}
                      onChange={(key) => {
                        const next = data.officers.find((o) => o.id === key);
                        if (next) openFor(next);
                      }}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {data.officers
                            .filter((o) => o.editable)
                            .map((o) => (
                              <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
                                {o.name}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Description>{draft.identity ?? "Identity verified"}</Description>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Acting for</Label>
                    <Select
                      aria-label="Body"
                      fullWidth
                      value={body}
                      onChange={(key) => key != null && setBody(String(key))}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {verifiedBodies.map((b) => (
                            <ListBox.Item key={b.id} id={b.name} textValue={b.name}>
                              {b.name}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Description>Verified bodies only</Description>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Jurisdiction</Label>
                  <Segment
                    aria-label="Jurisdiction"
                    selectedKey={scope}
                    onSelectionChange={(k) => setScope(k === "sector" ? "sector" : "district")}
                  >
                    <Segment.Item id="district">
                      <Segment.Separator />
                      Whole district
                    </Segment.Item>
                    <Segment.Item id="sector">
                      <Segment.Separator />
                      Selected sectors
                    </Segment.Item>
                  </Segment>
                  {scope === "sector" ? (
                    <TagGroup
                      aria-label="Sectors"
                      size="sm"
                      selectionMode="multiple"
                      selectedKeys={new Set(sectorsOn)}
                      onSelectionChange={(keys) =>
                        setSectorsOn(keys === "all" ? data.sectors.map((s) => s.id) : [...keys].map(String))
                      }
                    >
                      <TagGroup.List className="flex flex-wrap gap-1.5">
                        {data.sectors.map((s) => (
                          <Tag key={s.id} id={s.id}>
                            {s.name}
                          </Tag>
                        ))}
                      </TagGroup.List>
                    </TagGroup>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Permissions</Label>
                  {data.permissions.map((p) => (
                    <Checkbox
                      key={p.id}
                      isSelected={!!perms[p.id]}
                      isDisabled={p.locked}
                      onChange={(v) => {
                        if (!p.locked) setPerms((cur) => ({ ...cur, [p.id]: v }));
                      }}
                      className={p.locked ? "opacity-[0.55]" : undefined}
                    >
                      <Checkbox.Content className="flex items-start gap-2.5">
                        <Checkbox.Control className="mt-0.5">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">{p.label}</span>
                          <span className="text-[12px] leading-4 text-muted">{p.description}</span>
                        </span>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                  {bothRoles ? (
                    <Alert>
                      <Alert.Indicator>
                        <PersonsLock />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Verify and approve together</Alert.Title>
                        <Alert.Description>
                          Allowed, but this officer will be excluded from approving any case they verified.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField fullWidth value={from} onChange={setFrom} className="gap-1">
                    <Label htmlFor="vf">Valid from</Label>
                    <Input id="vf" />
                  </TextField>
                  <TextField fullWidth value={until} onChange={setUntil} className="gap-1">
                    <Label htmlFor="vu">Valid until</Label>
                    <Input id="vu" />
                    <Description>Cannot pass the District mandate end, 30 Jun 2027</Description>
                  </TextField>
                </div>
                <TextField fullWidth value={basis} onChange={setBasis} className="gap-1">
                  <Label htmlFor="lb">Legal basis reference</Label>
                  <Input id="lb" />
                </TextField>
                <TextField fullWidth value={reason} onChange={setReason} className="gap-1">
                  <Label htmlFor="why">Reason</Label>
                  <TextArea id="why" rows={2} />
                </TextField>
                <Timeline size="sm" density="compact" aria-label="Approval path">
                  {PATH.map((pa) => (
                    <Timeline.Item key={pa.id} status={pa.status}>
                      <Timeline.Rail>
                        <Timeline.Marker />
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5">
                        <span className="text-[13px] font-medium">{pa.title}</span>
                        <span className="text-[12px] leading-4 text-muted">{pa.detail}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Drawer.Body>
            ) : null}
            <Drawer.Footer className="flex justify-end gap-2">
              <Button variant="secondary" onPress={closeDrawer}>
                Cancel
              </Button>
              <Button isDisabled={noPerms} onPress={sendDraft}>
                <PaperPlane className="size-4" />
                Send for signatory approval
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
