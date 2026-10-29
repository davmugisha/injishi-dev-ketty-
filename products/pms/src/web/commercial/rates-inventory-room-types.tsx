"use client";

import { FolderHouse } from "@gravity-ui/icons";
import { Card, Chip, Table } from "@heroui/react";
import { EmptyState, Segment } from "@heroui-pro/react";
import { formatNumber, KeyValueList } from "@injishi/ui";
import NextLink from "next/link";
import { useState } from "react";
import type { RatesInventoryDomain, RatesInventoryRoomStatus, RatesInventoryRoomType } from "../../model/commercial.ts";
import { useBoardHref } from "../mount.tsx";

const DOMAINS: { id: RatesInventoryDomain; label: string }[] = [
  { id: "hospitality", label: "Hospitality" },
  { id: "residence", label: "Residence" },
];

const STRIPES =
  "bg-[repeating-linear-gradient(135deg,var(--surface-secondary)_0_6px,var(--surface-tertiary)_6px_12px)] shadow-none";

/** Room tile look per status (artifact .ij-room[data-status]). */
const ROOM_STATUS: Record<RatesInventoryRoomStatus, { label: string; className: string }> = {
  inspected: { label: "Inspected", className: "bg-success/10 shadow-surface" },
  toInspect: { label: "To inspect", className: "bg-surface shadow-surface ring-[1.5px] ring-success/60 ring-inset" },
  dirty: { label: "Dirty", className: "bg-surface shadow-surface ring-[1.5px] ring-warning/75 ring-inset" },
  occupied: { label: "Occupied", className: "bg-surface-secondary shadow-none" },
  stayoverDue: { label: "Stayover due", className: "bg-surface-secondary shadow-none" },
  outOfOrder: { label: "Out of order", className: STRIPES },
  outOfService: { label: "Out of service", className: STRIPES },
};

/** Room types tab: unit domain switch, the room-type table and the selected type's rooms. */
export function RatesInventoryRoomTypes({ roomTypes }: { roomTypes: RatesInventoryRoomType[] }) {
  const screenHref = useBoardHref();
  const [domain, setDomain] = useState<RatesInventoryDomain>("hospitality");
  const [selectedId, setSelectedId] = useState(roomTypes.find((t) => t.id === "dlv")?.id ?? roomTypes[0]?.id ?? "");
  const shown = roomTypes.filter((t) => t.domain === domain);
  const hospitality = roomTypes.filter((t) => t.domain === "hospitality");
  const physicalRooms = hospitality.reduce((sum, t) => sum + t.rooms.length, 0);
  const selected = shown.find((t) => t.id === selectedId) ?? shown[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segment
          aria-label="Unit domain"
          selectedKey={domain}
          onSelectionChange={(key) => setDomain(key as RatesInventoryDomain)}
        >
          {DOMAINS.map((d) => (
            <Segment.Item key={d.id} id={d.id}>
              {d.label} · {roomTypes.filter((t) => t.domain === d.id).length}
            </Segment.Item>
          ))}
        </Segment>
        <span className="text-[12px] leading-4 text-muted">
          {physicalRooms} physical rooms · {hospitality.length} room types · Hospitality units are sold by the night
        </span>
      </div>

      {domain === "hospitality" && selected ? (
        <div className="flex flex-wrap items-start gap-[16px]">
          <Table className="min-w-0 flex-[1_1_560px]">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Room types"
                selectionMode="single"
                selectionBehavior="replace"
                disallowEmptySelection
                selectedKeys={new Set([selected.id])}
                onSelectionChange={(keys) => {
                  if (keys === "all") return;
                  const [key] = [...keys];
                  if (key !== undefined) setSelectedId(String(key));
                }}
              >
                <Table.Header>
                  <Table.Column isRowHeader>Room type</Table.Column>
                  <Table.Column>Domain</Table.Column>
                  <Table.Column>Beds</Table.Column>
                  <Table.Column>Capacity</Table.Column>
                  <Table.Column className="text-right">Rooms</Table.Column>
                  <Table.Column className="text-right">BAR from</Table.Column>
                </Table.Header>
                <Table.Body>
                  {shown.map((t) => (
                    <Table.Row key={t.id} id={t.id} className="cursor-pointer">
                      <Table.Cell>
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-[12px] leading-4 text-muted">
                            {t.size} · {t.range}
                          </span>
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color="accent">
                          Hospitality
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>{t.beds}</Table.Cell>
                      <Table.Cell>{t.capacity}</Table.Cell>
                      <Table.Cell className="text-right tabular">{t.rooms.length}</Table.Cell>
                      <Table.Cell className="text-right tabular">{formatNumber(t.barFrom)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          <Card role="region" aria-labelledby="rt-h" className="min-w-0 flex-[1_1_360px] gap-3 p-[18px]">
            <Card.Header>
              <h2 id="rt-h" className="text-[15px] leading-[22px] font-semibold">
                {selected.name}
              </h2>
              <Card.Description>
                {selected.rooms.length} rooms · {selected.range}
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <KeyValueList
                items={[
                  { label: "Beds", value: selected.bedsLong },
                  { label: "Maximum guests", value: selected.capacity },
                  { label: "Size", value: selected.size },
                  { label: "Amenities", value: selected.amenities },
                ]}
              />
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(76px,100%),1fr))] gap-[8px]">
                {selected.rooms.map((room) => {
                  const look = ROOM_STATUS[room.status];
                  return (
                    <NextLink
                      key={room.number}
                      href={screenHref("RoomRack")}
                      aria-label={`Room ${room.number}, ${look.label}`}
                      className={`flex min-w-0 flex-col gap-0.5 rounded-[14px] px-3 py-2.5 text-inherit no-underline ${look.className}`}
                    >
                      <span className="text-[15px] leading-[22px] font-semibold tabular">{room.number}</span>
                      <span className="truncate text-[11px] leading-[14px] text-muted">{look.label}</span>
                    </NextLink>
                  );
                })}
              </div>
              <p className="text-[12px] leading-4 text-muted">{selected.history}</p>
            </Card.Content>
          </Card>
        </div>
      ) : (
        <Card variant="secondary">
          <EmptyState size="md">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <FolderHouse />
              </EmptyState.Media>
              <EmptyState.Title>No Residence unit types at this hotel</EmptyState.Title>
              <EmptyState.Description>
                Residence units are leased by the month under Kacyiru Court Residences and never share nightly
                availability with hotel rooms. Moving a unit between domains runs a migration check first.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
