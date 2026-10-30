"use client";

import { ArrowsRotateRight, ArrowUpFromLine, Receipt, TriangleExclamation } from "@gravity-ui/icons";
import { Button, Card, Chip, ProgressBar, Table } from "@heroui/react";
import { DropZone, ItemCard, Widget } from "@heroui-pro/react";
import { formatNumber, KeyValueList, LinkButton, toneColor } from "@injishi/ui";
import type { GroupsBlock, GroupsNight, GroupsRoomingFile, GroupsRoomType } from "../../model/commercial.ts";
import type { Tone } from "../../model/shared.ts";
import { useBoardHref } from "../mount.tsx";

/** A night of the block as shown now: rooms still held after any release, and the share picked up. */
export interface GroupsNightView extends GroupsNight {
  pct: number;
}

/** Organiser, contact, agent and payer, the master bill and the deposit. */
export function GroupsOrganiserCard({ block }: { block: GroupsBlock }) {
  const screenHref = useBoardHref();
  return (
    <Card<"section"> render={(props) => <section {...props} />} aria-labelledby="org-h" className="gap-3 p-[18px]">
      <Card.Header>
        <Card.Title id="org-h" className="text-[15px] font-semibold">
          Organiser and Billing
        </Card.Title>
        <Card.Description>Booking contact, payer and agent are separate parties</Card.Description>
      </Card.Header>
      <KeyValueList
        items={[
          { label: "Organiser", value: block.organiser },
          { label: "Contact", value: block.contact },
          { label: "Phone", value: <span className="tabular">{block.phone}</span> },
          { label: "Rooming list by", value: block.agent },
          { label: "Pays for", value: block.payer },
        ]}
      />
      <ItemCard variant="secondary" className="flex-wrap">
        <ItemCard.Icon>
          <Receipt />
        </ItemCard.Icon>
        <ItemCard.Content className="min-w-[160px]">
          <ItemCard.Title>{block.bill.title}</ItemCard.Title>
          <ItemCard.Description className="whitespace-normal">{block.bill.desc}</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <LinkButton href={screenHref("Folios")} size="sm" variant="secondary">
            Master bill
          </LinkButton>
        </ItemCard.Action>
      </ItemCard>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Deposit</span>
        <span className="text-[13px] font-medium tabular">{block.deposit}</span>
        <Chip size="sm" variant="soft" color={toneColor(block.depositTone)}>
          {block.depositStatus}
        </Chip>
      </div>
    </Card>
  );
}

/** Rate plan, contracted rooms per type, and the cutoff, release and attrition terms. */
export function GroupsContractCard({
  block,
  roomTypes,
  cutoff,
}: {
  block: GroupsBlock;
  roomTypes: GroupsRoomType[];
  cutoff: string;
}) {
  return (
    <Card<"section"> render={(props) => <section {...props} />} aria-labelledby="ct-h" className="gap-3 p-[18px]">
      <Card.Header>
        <Card.Title id="ct-h" className="text-[15px] font-semibold">
          Contract Terms
        </Card.Title>
        <Card.Description>{block.plan}</Card.Description>
      </Card.Header>
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-labelledby="ct-h">
            <Table.Header>
              <Table.Column isRowHeader>Room type</Table.Column>
              <Table.Column className="text-right">Rate (RWF)</Table.Column>
              <Table.Column className="text-right">Held</Table.Column>
              <Table.Column className="text-right">Picked up</Table.Column>
            </Table.Header>
            <Table.Body>
              {roomTypes.map((t) => (
                <Table.Row key={t.id} id={t.id}>
                  <Table.Cell className="text-[13px]">{t.name}</Table.Cell>
                  <Table.Cell className="text-right text-[13px] tabular">{formatNumber(t.rate)}</Table.Cell>
                  <Table.Cell className="text-right text-[13px] tabular">{t.held}</Table.Cell>
                  <Table.Cell className="text-right text-[13px] font-semibold tabular">{t.picked}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <KeyValueList
        items={[
          { label: "Cutoff", value: <span className="tabular">{cutoff}</span> },
          { label: "Release", value: block.release },
          { label: "Attrition", value: block.attrition },
        ]}
      />
    </Card>
  );
}

/** Picked-up rooms against rooms still held, night by night. */
export function GroupsPickupWidget({ nights, asOf }: { nights: GroupsNightView[]; asOf: string }) {
  return (
    <Widget<"section"> render={(props) => <section {...props} />} aria-labelledby="pu-h">
      <Widget.Header>
        <h3 id="pu-h">
          <Widget.Title>Pickup per Night</Widget.Title>
        </h3>
        <Widget.Legend>
          <Widget.LegendItem color="var(--chart-1)">Picked up</Widget.LegendItem>
          <Widget.LegendItem color="var(--chart-5)">Still held</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-[14px]">
        {nights.map((n) => (
          <div key={n.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium">{n.date}</span>
              <span className="text-xs text-muted tabular">
                {n.picked} of {n.held} · {n.pct}%
              </span>
            </div>
            <ProgressBar value={n.pct} aria-label={`${n.date}: ${n.picked} picked up of ${n.held} held`}>
              <ProgressBar.Track className="h-3 bg-[var(--chart-5)]">
                {n.pct > 0 ? (
                  <ProgressBar.Fill
                    className={`bg-[var(--chart-1)] ${n.pct < 100 ? "border-e-2 border-surface" : ""}`}
                  />
                ) : null}
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        ))}
        <p className="text-xs leading-4 text-muted">
          Source: reservations linked to this block, {asOf}. Picked-up rooms are ordinary bookings and are never
          cancelled by a release.
        </p>
      </Widget.Content>
    </Widget>
  );
}

const fileFormat = (name: string) => name.split(".").pop()?.toUpperCase() ?? "";

/** Rooming list from the organiser or agent: current file, rows to fix, and a new version being matched. */
export function GroupsRoomingCard({
  due,
  status,
  tone,
  file,
  issues,
  matching,
  onUpload,
}: {
  due: string;
  status: string;
  tone: Tone;
  file: GroupsRoomingFile | null;
  issues: { id: string; text: string }[];
  matching: boolean;
  onUpload: () => void;
}) {
  const screenHref = useBoardHref();
  return (
    <Card<"section"> render={(props) => <section {...props} />} aria-labelledby="rl-h" className="gap-3 p-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Card.Header>
          <Card.Title id="rl-h" className="text-[15px] font-semibold">
            Rooming List
          </Card.Title>
          <Card.Description>{due}</Card.Description>
        </Card.Header>
        <Chip size="sm" variant="soft" color={toneColor(tone)}>
          {status}
        </Chip>
      </div>
      {file ? (
        <DropZone>
          <DropZone.FileList>
            <DropZone.FileItem key={file.name} status={matching ? "uploading" : "complete"}>
              <DropZone.FileFormatIcon format={fileFormat(file.name)} color="green" />
              <DropZone.FileInfo className="min-w-0 flex-1">
                <DropZone.FileName>{file.name}</DropZone.FileName>
                <DropZone.FileMeta className="text-xs">{file.meta}</DropZone.FileMeta>
              </DropZone.FileInfo>
              {matching ? (
                <span role="status" className="flex shrink-0 items-center gap-1.5 text-xs">
                  <ArrowsRotateRight className="size-3.5 animate-spin" aria-hidden="true" />
                  Matching names…
                </span>
              ) : null}
            </DropZone.FileItem>
          </DropZone.FileList>
        </DropZone>
      ) : null}
      {issues.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {issues.map((i) => (
            <li key={i.id} className="flex items-start gap-2 text-[13px] leading-[18px]">
              <TriangleExclamation className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onPress={onUpload}>
          <ArrowUpFromLine className="size-4" />
          Upload new version
        </Button>
        <LinkButton href={screenHref("Guests")} size="sm" variant="ghost">
          Matched guests
        </LinkButton>
      </div>
    </Card>
  );
}
