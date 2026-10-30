"use client";

import {
  BranchesRight,
  Eye,
  EyeSlash,
  Medal,
  PersonMagnifier,
  PersonPlus,
  Plus,
  ShieldExclamation,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  Modal,
  ProgressBar,
  SearchField,
  Separator,
  Skeleton,
  Switch,
  Table,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, ItemCard, ListView, RadioButtonGroup, Segment } from "@heroui-pro/react";
import { formatNumber, GateChip, Icon, KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import type { Selection } from "react-aria-components";
import type { Persona } from "../../model/shared.ts";
import type { DirectoryGuest, GuestProfile, InfoItem, ViewPurpose } from "../../model/stays.ts";
import { useBoardHref } from "../mount.tsx";
import { CardHeading, InfoRow, SelectField, ToneChip } from "./parts.tsx";

type DupState = "open" | "merged" | "dismissed";

const MERGE_REASONS = ["Guest confirmed at the desk", "Guest confirmed by email", "Same phone and documents checked"];
const DUP_CHIP: Record<DupState, { label: string; tone: "warning" | "success" | "default" }> = {
  open: { label: "Waiting for review", tone: "warning" },
  merged: { label: "Merged", tone: "success" },
  dismissed: { label: "Not the same person", tone: "default" },
};

function InfoItemRow({ item }: { item: InfoItem }) {
  return (
    <InfoRow
      icon={item.icon}
      title={item.title}
      detail={item.detail}
      trailing={
        <ToneChip size="sm" tone={item.tone} emphasis={item.emphasis}>
          {item.state}
        </ToneChip>
      }
    />
  );
}

export function GuestsView({
  directory,
  profiles,
  purposes,
}: {
  persona: Persona;
  directory: DirectoryGuest[];
  profiles: GuestProfile[];
  purposes: ViewPurpose[];
}) {
  const screenHref = useBoardHref();
  const [sel, setSel] = useState(profiles[0]?.id ?? directory[0]?.id ?? "");
  const [scope, setScope] = useState<"property" | "group">("property");
  const [q, setQ] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mReason, setMReason] = useState("");
  const [ack, setAck] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [newPref, setNewPref] = useState("");
  /**
   * The directory and profiles are the prototype's sample: guest profiles per business (merges, consents,
   * preferences, privacy requests, the document access log) are not built. Every change here says so and
   * changes nothing, and no document number is shown.
   */
  const unavailable = (what: string) => toast.warning(`${what} is not available yet. Nothing was changed.`);
  const dup: DupState = "open";
  const merged = false;
  const idShown = false;
  const mkt = true;
  const guests = directory.filter((g) => !(g.candidate && merged));
  const needle = q.trim().toLowerCase();
  const list = guests.filter(
    (g) => (scope === "group" || g.here) && (!needle || `${g.name} ${g.id} ${g.status}`.toLowerCase().includes(needle)),
  );
  const curG = guests.find((g) => g.id === sel) ?? guests[0];
  const profile = profiles.find((p) => p.id === curG?.id);

  const pick = (keys: Selection) => {
    const k = keys === "all" ? null : [...keys][0];
    if (k) setSel(String(k));
  };

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow="Guest directory · sample guests"
        title="Guests"
        description="A preview with sample guests: guest profiles are not built yet. Identity documents stay masked unless you give a purpose."
        actions={
          <LinkButton href={screenHref("WalkIn")} variant="secondary">
            <PersonPlus className="size-4" />
            New walk-in guest
          </LinkButton>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <Card aria-labelledby="dir-h" className="min-w-[min(280px,100%)] flex-[0_1_330px] gap-2.5 p-3.5">
          <CardHeading id="dir-h" title="Directory" />
          <Segment
            aria-label="Directory scope"
            selectedKey={scope}
            onSelectionChange={(k) => setScope(String(k) as "property" | "group")}
            className="w-full"
          >
            <Segment.Item id="property" className="flex-1">
              This property
            </Segment.Item>
            <Segment.Item id="group" className="flex-1">
              All properties
            </Segment.Item>
          </Segment>
          <SearchField aria-label="Search guests" value={q} onChange={setQ} variant="secondary" fullWidth>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Name, phone, email or booking" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <p className="text-[12px] leading-4 text-muted">
            {scope === "property"
              ? "Guests with a booking or stay at this property."
              : "All of the business's properties. Other properties show names and stay dates only."}{" "}
            ID numbers cannot be searched.
          </p>
          <ListView
            aria-label="Guests"
            items={list}
            variant="secondary"
            className="flex flex-col gap-0.5"
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={curG ? [curG.id] : []}
            onSelectionChange={pick}
            renderEmptyState={() => (
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <PersonMagnifier />
                  </EmptyState.Media>
                  <EmptyState.Title>No guest found</EmptyState.Title>
                  <EmptyState.Description>
                    Check the spelling or try a phone number. You can also widen the scope.
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            )}
          >
            {(g) => {
              const isDup = g.duplicate && dup === "open";
              return (
                <ListView.Item
                  id={g.id}
                  textValue={g.name}
                  className="rounded-xl border-0 px-2.5 py-2 data-[selected=true]:bg-default"
                >
                  <ListView.ItemContent className="gap-2.5">
                    <Avatar size="sm" variant="soft" color={isDup ? "warning" : "default"}>
                      <Avatar.Fallback>{g.initials}</Avatar.Fallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ListView.Title className="text-[13px] font-medium">{g.name}</ListView.Title>
                        {isDup ? (
                          <ToneChip size="sm" tone="warning">
                            Possible duplicate
                          </ToneChip>
                        ) : null}
                      </span>
                      <ListView.Description className="text-[12px] leading-4 whitespace-normal tabular">
                        {g.id} · {g.status}
                      </ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  {g.tier ? (
                    <ListView.ItemAction>
                      <ToneChip size="sm" tone="default">
                        {g.tier}
                      </ToneChip>
                    </ListView.ItemAction>
                  ) : null}
                </ListView.Item>
              );
            }}
          </ListView>
        </Card>

        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-4">
          <Card aria-labelledby="pf-h" className="gap-3 p-[18px]">
            <div className="flex flex-wrap items-start gap-3">
              <Avatar size="lg" variant="soft" color="accent">
                <Avatar.Fallback>{curG?.initials}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                <h2 id="pf-h" className="text-[20px] leading-7 font-semibold">
                  {profile?.name ?? curG?.name}
                </h2>
                <span className="text-[13px] text-muted tabular">
                  {profile
                    ? `${profile.id} · ${profile.since} · ${profile.nationality} · ${profile.pastStays + (merged ? 1 : 0)} past stays in the group`
                    : `${curG?.id} · ${curG?.status}`}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {profile ? (
                    <>
                      {profile.chips.map((c) => (
                        <ToneChip key={c.label} tone={c.tone}>
                          {c.label}
                        </ToneChip>
                      ))}
                      {dup === "open" ? <ToneChip tone="warning">Possible duplicate</ToneChip> : null}
                    </>
                  ) : curG && !curG.here ? (
                    <ToneChip tone="default">Held by another property · stay dates only</ToneChip>
                  ) : null}
                </div>
              </div>
              {profile ? (
                <div className="flex flex-wrap items-center gap-2">
                  {profile.links.map((l) => (
                    <LinkButton
                      key={l.label}
                      href={screenHref(l.board)}
                      size="sm"
                      variant={l.primary ? "primary" : "secondary"}
                    >
                      {l.label}
                    </LinkButton>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          {!profile ? (
            <Card aria-busy="true" aria-label="Loading profile" className="gap-3 p-[18px]">
              <Skeleton className="h-3.5 w-2/5 rounded-md" />
              <Skeleton className="h-3.5 w-3/4 rounded-md" />
              <Skeleton className="h-3.5 w-3/5 rounded-md" />
              <Skeleton className="h-[120px] w-full rounded-[14px]" />
              <p className="text-[12px] text-muted">Loading the profile within your property scope…</p>
            </Card>
          ) : (
            <>
              <Card aria-labelledby="dup-h" className="gap-3 p-[18px]">
                <CardHeading
                  id="dup-h"
                  title="Possible Duplicate · Review Before Merging"
                  sub="Found by matching phone and name. Nothing is merged without a person confirming it."
                  action={<ToneChip tone={DUP_CHIP[dup].tone}>{DUP_CHIP[dup].label}</ToneChip>}
                />
                {dup === "open" ? (
                  <>
                    <Table>
                      <Table.ScrollContainer>
                        <Table.Content aria-label="Profile and duplicate candidate compared">
                          <Table.Header>
                            <Table.Column isRowHeader>Field</Table.Column>
                            <Table.Column>This profile · {profile.id}</Table.Column>
                            <Table.Column>Candidate · {profile.candidateId}</Table.Column>
                            <Table.Column>Match</Table.Column>
                          </Table.Header>
                          <Table.Body>
                            {profile.compare.map((c) => (
                              <Table.Row key={c.field} id={c.field}>
                                <Table.Cell className="text-[13px] text-muted">{c.field}</Table.Cell>
                                <Table.Cell className="text-[13px] tabular">{c.profile}</Table.Cell>
                                <Table.Cell className="text-[13px] tabular">{c.candidate}</Table.Cell>
                                <Table.Cell>
                                  <ToneChip size="sm" tone={c.tone}>
                                    {c.match}
                                  </ToneChip>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Content>
                      </Table.ScrollContainer>
                    </Table>
                    <p className="text-[12px] leading-4 text-muted">
                      If merged, {profile.id} stays the main profile, the Ishyamba stay moves across, both identity
                      documents stay separate records, and the stricter marketing choice is kept. A manager can undo it
                      for 30 days.
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" onPress={() => unavailable("Recording two profiles as different people")}>
                        Not the same person
                      </Button>
                      <Button
                        variant="secondary"
                        onPress={() => {
                          setMReason("");
                          setAck(false);
                          setMergeOpen(true);
                        }}
                      >
                        <BranchesRight className="size-4" />
                        Merge into {profile.id}…
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-[13px]">{profile.candidateId} has not been reviewed.</p>
                )}
              </Card>

              <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr))]">
                <div className="flex flex-col gap-4">
                  <Card aria-labelledby="ct-h" className="gap-2.5 px-[18px] py-4">
                    <CardHeading id="ct-h" title="Contact and Relationships" />
                    <KeyValueList
                      items={profile.contact.map((c) => ({
                        label: c.label,
                        value: c.muted ? <span className="font-normal text-muted">{c.value}</span> : c.value,
                      }))}
                    />
                  </Card>

                  <Card aria-labelledby="id-h" className="gap-2.5 px-[18px] py-4">
                    <CardHeading
                      id="id-h"
                      title="Identity Documents"
                      className="items-center"
                      nowrap
                      action={
                        <GateChip icon={<ShieldExclamation className="size-3" />}>
                          Retention 7 years · configured, unverified
                        </GateChip>
                      }
                    />
                    <ItemCard variant="secondary">
                      <ItemCard.Icon>
                        <Icon name="Passport" />
                      </ItemCard.Icon>
                      <ItemCard.Content>
                        <ItemCard.Title className="tabular">
                          {profile.document.title} · {idShown ? profile.document.number : profile.document.masked}
                        </ItemCard.Title>
                        <ItemCard.Description className="whitespace-normal">
                          {profile.document.detail}
                        </ItemCard.Description>
                      </ItemCard.Content>
                      <ItemCard.Action>
                        {idShown ? (
                          <Button size="sm" variant="ghost">
                            <EyeSlash className="size-4" />
                            Hide
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => {
                              setPurpose("");
                              setViewOpen(true);
                            }}
                          >
                            <Eye className="size-4" />
                            View
                          </Button>
                        )}
                      </ItemCard.Action>
                    </ItemCard>
                    <span className="text-[12px] text-muted">Access log</span>
                    <ul className="flex flex-col gap-1">
                      {profile.accessLog.map((l) => (
                        <li key={l.text} className="flex items-center gap-2 text-[12px] leading-4 tabular">
                          <Icon name={l.icon} className="size-3.5 shrink-0 text-muted" />
                          <span>{l.text}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card aria-labelledby="cs-h" className="gap-2.5 px-[18px] py-4">
                    <CardHeading id="cs-h" title="Consent and Privacy Requests" />
                    <Switch
                      isSelected={mkt}
                      isDisabled={!mkt}
                      onChange={() => unavailable("Recording a marketing opt-out")}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        Marketing email from the business
                      </Switch.Content>
                    </Switch>
                    <span className="text-[12px] leading-4 text-muted">{profile.marketing.optedIn}</span>
                    <KeyValueList items={profile.consent.map((c) => ({ label: c.label, value: c.value }))} />
                    <Separator />
                    {profile.requests.map((r) => (
                      <InfoItemRow key={r.title} item={r} />
                    ))}
                    <InfoItemRow
                      item={{
                        icon: "FileArrowDown",
                        title: "Copy of data (portability)",
                        detail: "No request open",
                        state: "None",
                        tone: "default",
                        emphasis: "tertiary",
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="self-start"
                      onPress={() => unavailable("Logging a data copy request")}
                    >
                      <Plus className="size-4" />
                      Log a data copy request
                    </Button>
                  </Card>
                </div>

                <div className="flex flex-col gap-4">
                  <Card aria-labelledby="pr-h" className="gap-2.5 px-[18px] py-4">
                    <CardHeading
                      id="pr-h"
                      title="Preferences"
                      className="items-center"
                      action={
                        <ToneChip size="sm" tone="success">
                          {profile.personalisation}
                        </ToneChip>
                      }
                    />
                    {profile.preferences.map((p) => (
                      <InfoRow key={p.text} icon={p.icon} title={p.text} detail={p.src} />
                    ))}
                    <div className="flex items-end gap-2">
                      <TextField value={newPref} onChange={setNewPref} className="flex-1">
                        <Label>Add a preference</Label>
                        <Input variant="secondary" placeholder="e.g. Quiet room away from the lift" />
                      </TextField>
                      <Button
                        variant="secondary"
                        isDisabled={!newPref.trim()}
                        onPress={() => unavailable("Adding a preference")}
                      >
                        Add
                      </Button>
                    </div>
                    <Description>Adding preferences is not available yet: nothing typed here is kept.</Description>
                  </Card>

                  <Card aria-labelledby="sy-h" className="gap-2.5 px-[18px] py-4">
                    <CardHeading id="sy-h" title="Stays Across Properties" />
                    <ul className="flex flex-col gap-2.5">
                      {[...profile.stays, ...(merged ? [profile.mergedStay] : [])].map((s) => (
                        <InfoRow
                          key={s.title}
                          as="li"
                          icon={s.icon}
                          title={s.title}
                          detail={s.detail}
                          trailing={
                            <ToneChip size="sm" tone={s.tone} emphasis={s.emphasis}>
                              {s.state}
                            </ToneChip>
                          }
                        />
                      ))}
                    </ul>
                  </Card>

                  <Card aria-labelledby="ly-h" className="gap-2.5 px-[18px] py-4">
                    <CardHeading
                      id="ly-h"
                      title="Loyalty programme"
                      className="items-center"
                      action={
                        <Chip size="sm" variant="primary" color="accent">
                          <Medal className="size-3" aria-hidden="true" />
                          <Chip.Label>{profile.rewards.tier}</Chip.Label>
                        </Chip>
                      }
                    />
                    <ProgressBar
                      value={Math.floor((profile.rewards.points / profile.rewards.nextAt) * 100)}
                      aria-label={`Points towards ${profile.rewards.next}`}
                      className="gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label className="tabular">{formatNumber(profile.rewards.points)} points</Label>
                        <ProgressBar.Output className="tabular">
                          {profile.rewards.next} at {formatNumber(profile.rewards.nextAt)}
                        </ProgressBar.Output>
                      </div>
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                    <ul className="flex flex-col gap-1">
                      {profile.points.map((p) => (
                        <li key={p.text} className="flex justify-between gap-2 text-[12px] leading-4 tabular">
                          <span className="text-muted">{p.text}</span>
                          <span className="font-medium">{p.points}</span>
                        </li>
                      ))}
                    </ul>
                    <span className="text-[12px] leading-4 text-muted">
                      Points have no cash value on a folio. Redemptions follow the programme rules set by your manager.
                    </span>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal.Backdrop isOpen={viewOpen} onOpenChange={setViewOpen}>
        <Modal.Container placement="center">
          <Modal.Dialog aria-labelledby="vw-h" className="max-w-[520px]">
            <Modal.Header className="flex flex-col items-start gap-1">
              <Modal.Heading id="vw-h" className="text-[17px] leading-6 font-semibold">
                Why do you need to see this passport?
              </Modal.Heading>
              <p className="text-[13px] text-muted">
                {profile?.name} · passport · Kenya. Opening a document with a purpose is not available yet.
              </p>
            </Modal.Header>
            <Modal.Body>
              <RadioButtonGroup aria-label="Purpose" value={purpose} onChange={setPurpose} className="flex-col gap-2">
                {purposes.map((p) => (
                  <RadioButtonGroup.Item key={p.id} value={p.id} className="px-3.5 py-2.5">
                    <RadioButtonGroup.ItemContent>
                      <span className="text-[13px] font-medium">{p.id}</span>
                      <span className="text-[12px] text-muted">{p.hint}</span>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setViewOpen(false)}>
                Cancel
              </Button>
              <Button
                isDisabled={!purpose}
                onPress={() => {
                  if (!purpose) return;
                  setViewOpen(false);
                  unavailable("Showing a guest's document and logging the view");
                }}
              >
                Show and log
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={mergeOpen} onOpenChange={setMergeOpen}>
        <Modal.Container placement="center">
          <Modal.Dialog role="alertdialog" aria-labelledby="mg-h" className="max-w-[520px]">
            <Modal.Header className="flex flex-col items-start gap-1">
              <Modal.Heading id="mg-h" className="text-[17px] leading-6 font-semibold">
                Merge {profile?.candidateId} into {profile?.id}?
              </Modal.Heading>
              <p className="text-[13px] text-muted">
                One stay at Ishyamba Forest Lodge would move to {profile?.name}’s profile. Merging profiles is not
                available yet.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <SelectField
                label="Reason"
                value={mReason}
                onChange={setMReason}
                options={MERGE_REASONS}
                placeholder="Choose a reason"
              />
              <Checkbox isSelected={ack} onChange={setAck}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  I checked these are the same person
                </Checkbox.Content>
              </Checkbox>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setMergeOpen(false)}>
                Cancel
              </Button>
              <Button
                isDisabled={!mReason || !ack}
                onPress={() => {
                  if (!mReason || !ack) return;
                  setMergeOpen(false);
                  unavailable("Merging guest profiles");
                }}
              >
                Merge profiles
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
