"use client";

import { TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Description, type Key, Label, ListBox, Select, Table } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { toneColor } from "@injishi/ui";
import { useState } from "react";
import type { ItemCode } from "../../model/accounting.ts";
import type { Tone } from "../../model/shared.ts";

const STATE: Record<"mapped" | "done" | "unmapped" | "review", { label: string; tone: Tone }> = {
  mapped: { label: "Mapped", tone: "success" },
  done: { label: "Mapped 10:13", tone: "success" },
  unmapped: { label: "Unmapped", tone: "danger" },
  review: { label: "Awaiting review", tone: "warning" },
};

const TAX_TREATMENTS = [
  { id: "vat-standard", label: "VAT standard · rule v3" },
  { id: "exempt", label: "Exempt or zero-rated" },
];

function MapEditor({
  item,
  classes,
  onSave,
  onCancel,
}: {
  item: ItemCode;
  classes: string[];
  onSave: (code: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState<Key | null>(item.suggestion ?? classes[0] ?? null);
  return (
    <Card variant="secondary" role="region" aria-labelledby="map-h" className="gap-3 p-4">
      <h2 id="map-h" className="text-[15px] leading-[22px] font-semibold">
        Map “{item.name}”
      </h2>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
        <Select fullWidth value={code} onChange={(v) => setCode(v as Key | null)}>
          <Label>RRA item class</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Description>Suggested from similar items already mapped</Description>
          <Select.Popover>
            <ListBox>
              {classes.map((c) => (
                <ListBox.Item key={c} id={c} textValue={c}>
                  {c}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select fullWidth defaultValue="vat-standard">
          <Label>Tax treatment</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Description>Rule awaiting tax specialist sign-off</Description>
          <Select.Popover>
            <ListBox>
              {TAX_TREATMENTS.map((t) => (
                <ListBox.Item key={t.id} id={t.id} textValue={t.label}>
                  {t.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onPress={() => code && onSave(String(code))} isDisabled={!code}>
          Save mapping
        </Button>
        <Button size="sm" variant="ghost" onPress={onCancel}>
          Cancel
        </Button>
        <span className="text-xs text-muted">Applies to new documents only. Recorded in the audit log.</span>
      </div>
    </Card>
  );
}

/** Item codes tab: catalog items and their RRA item class; unmapped items are rejected by the VSDC. */
export function FiscalItemCodesPanel({
  items,
  allItems,
  mapped,
  mapItem,
  onlyUnmapped,
  onFilterChange,
  onStartMap,
  onSave,
  onCancel,
  actorName,
}: {
  items: ItemCode[];
  /** Every catalog item, for the item classes already in use. */
  allItems: ItemCode[];
  mapped: Record<string, string>;
  mapItem: string;
  onlyUnmapped: boolean;
  onFilterChange: (onlyUnmapped: boolean) => void;
  onStartMap: (id: string) => void;
  onSave: (id: string, code: string) => void;
  onCancel: () => void;
  actorName: string;
}) {
  const rows = items.map((x) => {
    const state: keyof typeof STATE = mapped[x.id] ? "done" : x.status;
    return {
      ...x,
      state,
      code: state === "done" ? mapped[x.id] : (x.code ?? "—"),
      tax: state === "unmapped" ? "—" : "VAT standard · rule v3",
      hint: state === "done" ? `By ${actorName} · audit logged` : (x.hint ?? ""),
    };
  });
  const unmapped = rows.filter((r) => r.state === "unmapped");
  const target = rows.find((r) => r.id === mapItem && r.state === "unmapped");
  const classes = [
    ...new Set(allItems.flatMap((i) => [i.code, i.suggestion]).filter((c): c is string => Boolean(c))),
  ].sort();
  const shown = onlyUnmapped ? unmapped : rows;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {unmapped.length > 0 ? (
          <Alert status="warning" className="flex-[1_1_420px]">
            <Alert.Indicator>
              <TriangleExclamation />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>
                {unmapped.length} {unmapped.length === 1 ? "catalog item has" : "catalog items have"} no RRA item class
              </Alert.Title>
              <Alert.Description>
                The VSDC rejects any sale that contains an item without an RRA item class. Map them before they are
                sold.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        <Segment
          aria-label="Filter items"
          selectedKey={onlyUnmapped ? "unmapped" : "all"}
          onSelectionChange={(k) => onFilterChange(k === "unmapped")}
        >
          <Segment.Item id="all">All items</Segment.Item>
          <Segment.Item id="unmapped">Unmapped only</Segment.Item>
        </Segment>
      </div>

      {target ? (
        <MapEditor
          key={target.id}
          item={target}
          classes={classes}
          onSave={(code) => onSave(target.id, code)}
          onCancel={onCancel}
        />
      ) : null}

      <Table>
        <Table.ScrollContainer>
          <Table.Content className="min-w-[760px]" aria-label="Catalog items and RRA item classes">
            <Table.Header>
              <Table.Column isRowHeader>Catalog item</Table.Column>
              <Table.Column>Sold at</Table.Column>
              <Table.Column>RRA item class</Table.Column>
              <Table.Column>Tax treatment</Table.Column>
              <Table.Column>Status</Table.Column>
              <Table.Column>
                <span className="sr-only">Action</span>
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {shown.map((i) => {
                const st = STATE[i.state];
                return (
                  <Table.Row key={i.id} id={i.id}>
                    <Table.Cell className="font-medium">{i.name}</Table.Cell>
                    <Table.Cell>{i.soldAt}</Table.Cell>
                    <Table.Cell className="tabular">{i.code}</Table.Cell>
                    <Table.Cell className="text-muted">{i.tax}</Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col gap-0.5">
                        <Chip size="sm" variant="soft" color={toneColor(st.tone)} className="self-start">
                          {st.label}
                        </Chip>
                        {i.hint ? <span className="text-xs text-muted">{i.hint}</span> : null}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {i.state === "unmapped" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Map ${i.name}`}
                          onPress={() => onStartMap(i.id)}
                        >
                          Map
                        </Button>
                      ) : null}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
