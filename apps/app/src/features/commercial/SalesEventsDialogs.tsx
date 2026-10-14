"use client";

import { Briefcase, Pencil } from "@gravity-ui/icons";
import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  Separator,
  TextField,
} from "@heroui/react";
import type { SalesEventsLead, SalesEventsQuoteLine, SalesEventsSeller } from "@injishi/data/fixtures/commercial";
import { formatNumber, formatRwf, toneColor } from "@injishi/ui";
import { Fragment, useState } from "react";

const SPACES = ["Kivu Hall", "Garden Terrace", "Kivu Hall + Garden Terrace", "Isangano Terrace"];
const SOURCES = [
  "Phone",
  "Email",
  "Website enquiry",
  "Injishi marketplace enquiry",
  "Referral",
  "Corporate account",
  "Walk-in",
];

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select fullWidth value={value} onChange={(k) => onChange(String(k))} className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o} id={o} textValue={o}>
              {o}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** "New lead": captures an enquiry into the New column, owned by the person who enters it. */
export function SalesEventsNewLeadDialog({
  isOpen,
  onOpenChange,
  owner,
  nextId,
  today,
  onCreate,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  nextId: string;
  today: string;
  onCreate: (lead: SalesEventsLead) => void;
}) {
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [pax, setPax] = useState<number>(50);
  const [value, setValue] = useState<number>(2000000);
  const [space, setSpace] = useState(SPACES[0] ?? "");
  const [source, setSource] = useState(SOURCES[0] ?? "");
  const [tried, setTried] = useState(false);
  const missing = { name: !name.trim(), org: !org.trim(), type: !type.trim(), date: !date.trim() };

  const create = () => {
    setTried(true);
    if (Object.values(missing).some(Boolean)) return;
    onCreate({
      id: nextId,
      stage: "new",
      name: name.trim(),
      org: org.trim(),
      type: type.trim(),
      date: date.trim(),
      pax,
      value,
      prob: 10,
      space,
      owner,
      source: `${source} · ${today}`,
      next: "Qualify the budget, date and headcount",
      planTitle: "No quote yet",
      planNote: `Space and catering are planned once the lead is qualified. ${space} is requested for ${date.trim()}.`,
    });
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md">
        <Modal.Dialog aria-labelledby="new-lead-h">
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="flex flex-col gap-0.5">
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Briefcase className="size-5" />
            </Modal.Icon>
            <Modal.Heading id="new-lead-h" className="text-lg leading-[26px] font-semibold">
              New lead
            </Modal.Heading>
            <p className="text-[13px] text-muted">
              {nextId} · added to New, owned by {owner}. No space is held until a proposal is sent.
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <TextField isRequired fullWidth value={name} onChange={setName} isInvalid={tried && missing.name}>
              <Label>Event name</Label>
              <Input placeholder="Mukamana family reunion" />
              <FieldError>Enter the event name.</FieldError>
            </TextField>
            <TextField isRequired fullWidth value={org} onChange={setOrg} isInvalid={tried && missing.org}>
              <Label>Organiser</Label>
              <Input placeholder="Person or organisation" />
              <FieldError>Enter who is organising the event.</FieldError>
            </TextField>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField isRequired fullWidth value={type} onChange={setType} isInvalid={tried && missing.type}>
                <Label>Event type</Label>
                <Input placeholder="Wedding, conference, dinner" />
                <FieldError>Enter the event type.</FieldError>
              </TextField>
              <TextField isRequired fullWidth value={date} onChange={setDate} isInvalid={tried && missing.date}>
                <Label>Date</Label>
                <Input placeholder="Sat 14 Nov" />
                <FieldError>Enter the event date.</FieldError>
              </TextField>
              <NumberField fullWidth minValue={1} value={pax} onChange={(v) => setPax(v ?? 1)}>
                <Label>Guests</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
              <NumberField
                fullWidth
                minValue={0}
                step={100000}
                value={value}
                onChange={(v) => setValue(v ?? 0)}
                formatOptions={{ style: "currency", currency: "RWF", maximumFractionDigits: 0 }}
              >
                <Label>Estimated value</Label>
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>
              <OptionSelect label="Space" value={space} options={SPACES} onChange={setSpace} />
              <OptionSelect label="Source" value={source} options={SOURCES} onChange={setSource} />
            </div>
          </Modal.Body>
          <Modal.Footer className="flex justify-end gap-2">
            <Button variant="secondary" slot="close">
              Cancel
            </Button>
            <Button onPress={create}>Add lead</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** "Edit quote": change line quantities on the live proposal; totals, deposits and seller splits follow. */
export function SalesEventsEditQuoteDialog({
  isOpen,
  onOpenChange,
  quoteRef,
  lines,
  sellers,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRef: string;
  lines: SalesEventsQuoteLine[];
  sellers: SalesEventsSeller[];
  onSave: (quantities: Record<string, number>) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.qty] as const)),
  );
  const amount = (l: SalesEventsQuoteLine) => (qty[l.id] ?? l.qty) * l.price;
  const total = lines.reduce((sum, l) => sum + amount(l), 0);
  const seller = (id: string) => sellers.find((s) => s.id === id);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog aria-labelledby="edit-quote-h">
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="flex flex-col gap-0.5">
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Pencil className="size-5" />
            </Modal.Icon>
            <Modal.Heading id="edit-quote-h" className="text-lg leading-[26px] font-semibold">
              Edit quote
            </Modal.Heading>
            <p className="text-[13px] text-muted">
              {quoteRef} · proforma, not a tax invoice. Unit prices come from the menu and venue rate card.
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            {lines.map((l, i) => {
              const s = seller(l.seller);
              return (
                <Fragment key={l.id}>
                  {i > 0 ? <Separator /> : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                        {l.item}
                        {s ? (
                          <Chip size="sm" variant="soft" color={toneColor(s.tone)}>
                            {s.short}
                          </Chip>
                        ) : null}
                      </span>
                      <span className="text-[12px] text-muted">{l.note}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <NumberField
                        minValue={0}
                        value={qty[l.id] ?? l.qty}
                        onChange={(v) => setQty((q) => ({ ...q, [l.id]: v ?? 0 }))}
                        aria-label={`Quantity: ${l.item}`}
                        className="w-[132px]"
                      >
                        <NumberField.Group>
                          <NumberField.DecrementButton />
                          <NumberField.Input className="tabular" />
                          <NumberField.IncrementButton />
                        </NumberField.Group>
                      </NumberField>
                      <span className="w-[84px] text-right text-[12px] text-muted tabular">
                        × {formatNumber(l.price)}
                      </span>
                      <span className="w-[112px] text-right text-[13px] font-semibold tabular">
                        {formatRwf(amount(l))}
                      </span>
                    </div>
                  </div>
                </Fragment>
              );
            })}
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">Quote total before tax</span>
              <span className="text-base font-semibold tabular">{formatRwf(total)}</span>
            </div>
          </Modal.Body>
          <Modal.Footer className="flex justify-end gap-2">
            <Button variant="secondary" slot="close">
              Cancel
            </Button>
            <Button
              onPress={() => {
                onSave(qty);
                onOpenChange(false);
              }}
            >
              Save quote
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
