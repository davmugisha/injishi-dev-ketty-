"use client";

import {
  ArrowDownToLine,
  Camera,
  CircleCheckFill,
  Clock,
  Lock,
  PersonMagnifier,
  Printer,
  ShieldExclamation,
} from "@gravity-ui/icons";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  Switch,
  Table,
  TextArea,
  TextField,
} from "@heroui/react";
import { DropZone, Segment } from "@heroui-pro/react";
import type { Persona } from "@injishi/data";
import type { FoundItem, FoundItemStatus, HistoryEvent, RegisterAccess, Tone } from "@injishi/data/fixtures/operations";
import { GateChip, PageContent, PageHeader, SectionHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import {
  advance,
  downloadCsv,
  FieldLabel,
  FooterHint,
  FormDialog,
  firstKey,
  HistoryTimeline,
  NOW,
  SelectField,
} from "./shared";

const TODAY = "12 Oct";

const STATUS: Record<FoundItemStatus, { label: string; tone: Tone }> = {
  claim: { label: "Claim · verifying", tone: "warning" },
  stored: { label: "In storage", tone: "default" },
  returned: { label: "Returned", tone: "success" },
  disposal: { label: "Disposal · needs approval", tone: "warning" },
  disposed: { label: "Donated", tone: "default" },
};
type Method = "person" | "agent" | "courier";
const METHODS: { id: Method; label: string; phrase: string }[] = [
  { id: "person", label: "In person", phrase: "in person" },
  { id: "agent", label: "Authorised person", phrase: "via an authorised person" },
  { id: "courier", label: "Courier", phrase: "by courier" },
];
const CATEGORIES = ["Electronics", "Jewellery", "Clothing", "Accessories", "Documents", "Cash", "Other"];
const AREAS = [
  "Room 309",
  "Room 204",
  "Room 211",
  "Room 311",
  "Lobby",
  "Isangano Terrace",
  "Lake Bar",
  "Kivu Hall",
  "Garden Terrace",
];

interface PhotoFile {
  id: string;
  name: string;
  size: number;
}

const ev = (what: string, who: string, tone: HistoryEvent["tone"] = "default"): HistoryEvent => ({ what, who, tone });
const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

interface OpenedClaim {
  claimant: string;
  booking: string;
  statement: string;
}

export function LostFoundView({
  persona,
  items: baseItems,
  access,
}: {
  persona: Persona;
  items: FoundItem[];
  access: RegisterAccess[];
}) {
  const custodian = access.find((a) => a.role.includes("custodian"))?.name ?? "the custodian";
  const finders = [...new Set(["Emmanuel Nsengimana", ...baseItems.map((i) => i.foundBy)])];

  const [selectedId, setSelectedId] = useState(baseItems[0]?.id ?? "");
  const [descOk, setDescOk] = useState(false);
  const [idOk, setIdOk] = useState(false);
  const [method, setMethod] = useState<Method>("person");
  // Item id → how it went back to the claimant.
  const [released, setReleased] = useState<Record<string, Method>>({});
  // Claims opened on this screen for items in storage.
  const [claims, setClaims] = useState<Record<string, OpenedClaim>>({});
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimName, setClaimName] = useState("");
  const [claimBooking, setClaimBooking] = useState("");
  const [claimStatement, setClaimStatement] = useState("");
  const [disposed, setDisposed] = useState<string[]>([]);
  const [kept, setKept] = useState<string[]>([]);
  const [added, setAdded] = useState<FoundItem[]>([]);
  // Intake form
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [foundBy, setFoundBy] = useState("Emmanuel Nsengimana");
  const [area, setArea] = useState(AREAS[0]);
  const [foundAt, setFoundAt] = useState("12 Oct 2026, 12:20");
  const [spot, setSpot] = useState("Under the bed, window side");
  const [valuable, setValuable] = useState(true);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);

  // Items with this screen's decisions applied (extension, new claims, release, disposal).
  const items = [...added, ...baseItems].map((x0): FoundItem => {
    let x = x0;
    if (kept.includes(x.id))
      x = {
        ...x,
        status: "stored",
        custody: advance(
          x.custody,
          ev("Kept 30 more days", `${persona.name} · ${NOW} · reason: guest may return in November`, "current"),
        ),
        retention: `Retention extended to 11 Nov 2026 by ${persona.name}.`,
      };
    const opened = claims[x.id];
    if (opened && x.status === "stored")
      x = {
        ...x,
        status: "claim",
        claim: {
          claimant: opened.claimant,
          booking: opened.booking || "no booking",
          matched: false,
          match: opened.booking
            ? `${opened.claimant} · ${opened.booking}. Check the room and dates of the stay against where the item was found.`
            : `${opened.claimant} · no booking reference given. Check identity with care before any release.`,
          statement: `Claimant: “${opened.statement}”`,
        },
        custody: advance(x.custody, ev(`Claim opened: ${opened.claimant}`, `${persona.name} · ${NOW}`, "current")),
      };
    const releasedHow = released[x.id];
    if (releasedHow && x.claim)
      return {
        ...x,
        status: "returned",
        custodian: "None",
        storage: `Returned ${TODAY}`,
        custody: advance(
          x.custody,
          ev("Description matched and ID checked", `${persona.name} · ${NOW}`),
          ev(
            `Returned to ${x.claim.claimant} ${METHODS.find((m) => m.id === releasedHow)?.phrase ?? "in person"}`,
            `${persona.name} · ${NOW} · signature captured`,
            "success",
          ),
        ),
        closedNote: `Returned to ${x.claim.claimant} (${x.claim.booking}) on ${TODAY} at ${NOW}. Description and ID verified by ${persona.name}; custody closed.`,
      };
    if (disposed.includes(x.id))
      return {
        ...x,
        status: "disposed",
        custodian: "None",
        storage: `Donated ${TODAY}`,
        custody: advance(x.custody, ev("Disposal approved by second person", `${persona.name} · ${NOW}`, "success")),
        closedNote: `Donated on ${TODAY}. Proposed by ${custodian}, approved by ${persona.name}.`,
      };
    return x;
  });
  const sel = items.find((i) => i.id === selectedId) ?? items[0];
  const open = items.filter((r) => r.status !== "returned" && r.status !== "disposed").length;
  const valuables = items.filter((r) => r.valuable && r.status !== "returned" && r.status !== "disposed").length;
  const canRelease = descOk && idOk;
  const claimant = sel?.claim?.claimant ?? "the guest";
  const idHint =
    method === "agent"
      ? `Authorised person’s ID plus ${claimant}’s signed letter`
      : method === "courier"
        ? "Copy of ID matches the booking name before dispatch"
        : "Passport or national ID matches the booking name";
  const methodNote =
    method === "person"
      ? `${claimant} collects at the front desk and signs on the tablet.`
      : method === "agent"
        ? `Needs a signed letter from ${claimant} and the authorised person’s own ID.`
        : "Sent at the guest’s cost to the address on the booking profile; tracking number recorded.";
  const nextId = `LF-26-0${42 + added.length}`;
  const spotShort = spot.split(",")[0].trim();
  const spotLower = spotShort.charAt(0).toLowerCase() + spotShort.slice(1);

  const select = (id: string) => {
    setSelectedId(id);
    setDescOk(false);
    setIdOk(false);
    setMethod("person");
  };
  const logItem = () => {
    const text = desc.trim();
    if (!text) return;
    const item: FoundItem = {
      id: nextId,
      item: text,
      category,
      valuable,
      where: `${area} · ${spotLower}`,
      when: `${TODAY} ${NOW}`,
      foundBy,
      custodian,
      storage: valuable ? "Safe A · bag pending" : "Store room L-2",
      status: "stored",
      custody: [
        ev(
          `Found in ${area}, ${spotLower}`,
          `${foundBy} · ${NOW}${photos.length ? ` · ${photos.length} photo${photos.length === 1 ? "" : "s"}` : ""}`,
        ),
        ev(`Logged by ${persona.name}, tag printed`, `Waiting for hand-over to ${custodian}`, "current"),
      ],
      retention: "Held 90 days from today, then handled under the disposal rule with two-person sign-off.",
    };
    setAdded((a) => [item, ...a]);
    setDesc("");
    setPhotos([]);
    select(item.id);
  };
  const openClaim = () => {
    setClaimName("");
    setClaimBooking("");
    setClaimStatement("");
    setClaimOpen(true);
  };
  const canOpenClaim = claimName.trim().length > 0 && claimStatement.trim().length > 0;
  const saveClaim = () => {
    if (!sel || !canOpenClaim) return;
    setClaims((c) => ({
      ...c,
      [sel.id]: { claimant: claimName.trim(), booking: claimBooking.trim(), statement: claimStatement.trim() },
    }));
    setClaimOpen(false);
    select(sel.id);
  };
  const addFiles = (files: File[]) =>
    setPhotos((p) => [
      ...p,
      ...files
        .filter((f) => /\.(jpe?g|png)$/i.test(f.name) || /^image\/(jpeg|png)$/.test(f.type))
        .map((f, i) => ({ id: `${Date.now()}-${i}-${f.name}`, name: f.name, size: f.size })),
    ]);
  const exportLog = () =>
    downloadCsv("lost-and-found-custody-log.csv", [
      ["Item ID", "Item", "Category", "Status", "Custody step", "Who and when"],
      ...items.flatMap((i) => i.custody.map((c) => [i.id, i.item, i.category, STATUS[i.status].label, c.what, c.who])),
    ]);

  return (
    <PageContent>
      <PageHeader
        eyebrow="Isangano Lakeside Hotel · Property"
        title="Lost & Found"
        description="Found items, custody and returns. Every hand-over is recorded, and items go back only to a verified claimant."
        actions={
          <Button variant="secondary" onPress={exportLog}>
            <ArrowDownToLine className="size-4" />
            Export custody log
          </Button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-[16px]">
          <section className="flex flex-col gap-2.5" aria-labelledby="items-h">
            <SectionHeader
              id="items-h"
              title="Found Items"
              action={
                <span className="text-[12px] text-muted">
                  {open} open · {valuables} valuables in Safe A
                </span>
              }
            />
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Found items"
                  selectionMode="single"
                  selectionBehavior="replace"
                  disallowEmptySelection
                  selectedKeys={new Set([sel?.id ?? ""])}
                  onSelectionChange={(keys) => {
                    const k = firstKey(keys);
                    if (k) select(k);
                  }}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Item</Table.Column>
                    <Table.Column>Where found</Table.Column>
                    <Table.Column>Found by</Table.Column>
                    <Table.Column>Custodian · storage</Table.Column>
                    <Table.Column>Status</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {items.map((r) => (
                      <Table.Row key={r.id} id={r.id} className="cursor-pointer">
                        <Table.Cell className="min-w-[180px] whitespace-normal">
                          <span className="flex flex-col">
                            <span className="text-[13px] leading-[18px] font-medium">{r.item}</span>
                            <span className="text-[12px] text-muted tabular">
                              {r.id} · {r.category}
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-[13px] leading-[18px]">
                          <span className="flex flex-col">
                            <span>{r.where}</span>
                            <span className="text-[12px] text-muted tabular">{r.when}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-[13px]">{r.foundBy}</Table.Cell>
                        <Table.Cell className="text-[13px] leading-[18px]">
                          <span className="flex flex-col">
                            <span>{r.custodian}</span>
                            <span className="text-[12px] text-muted">{r.storage}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color={toneColor(STATUS[r.status].tone)}>
                            {STATUS[r.status].label}
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </section>

          {sel ? (
            <Card aria-labelledby="det-h" className="gap-3.5 p-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] font-medium text-muted">
                    <span className="tabular">{sel.id}</span>
                    <span>{sel.category}</span>
                    {sel.valuable ? (
                      <Chip size="sm" variant="soft">
                        Valuable · safe custody
                      </Chip>
                    ) : null}
                  </p>
                  <h2 id="det-h" className="text-[17px] leading-6 font-semibold">
                    {sel.item}
                  </h2>
                </div>
                <Chip size="sm" variant="soft" color={toneColor(STATUS[sel.status].tone)}>
                  {STATUS[sel.status].label}
                </Chip>
              </div>

              <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
                <div className="flex flex-col gap-2">
                  <FieldLabel>Chain of custody</FieldLabel>
                  <HistoryTimeline events={sel.custody} label={`${sel.id} chain of custody`} />
                </div>

                <div className="flex flex-col gap-2.5">
                  {sel.status === "claim" && sel.claim ? (
                    <>
                      <FieldLabel>Claimant verification</FieldLabel>
                      <Card variant="secondary" className="gap-1 px-3 py-2.5">
                        <span className="flex items-center gap-2 text-[13px] font-medium">
                          {sel.claim.matched ? (
                            <CircleCheckFill className="size-4 text-success" aria-hidden="true" />
                          ) : (
                            <Clock className="size-4 text-warning" aria-hidden="true" />
                          )}
                          {sel.claim.matched ? "Booking match" : "Booking not matched yet"}
                        </span>
                        <span className="text-[12px] leading-4 text-muted">{sel.claim.match}</span>
                      </Card>
                      <Checkbox isSelected={descOk} onChange={setDescOk}>
                        <Checkbox.Content className="items-start">
                          <Checkbox.Control className="mt-0.5">
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <span className="flex flex-col">
                            <span className="text-[13px] font-medium">Description matches the intake record</span>
                            <span className="text-[12px] leading-4 font-normal text-muted">{sel.claim.statement}</span>
                          </span>
                        </Checkbox.Content>
                      </Checkbox>
                      <Checkbox isSelected={idOk} onChange={setIdOk}>
                        <Checkbox.Content className="items-start">
                          <Checkbox.Control className="mt-0.5">
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <span className="flex flex-col">
                            <span className="text-[13px] font-medium">ID checked at hand-over</span>
                            <span className="text-[12px] leading-4 font-normal text-muted">{idHint}</span>
                          </span>
                        </Checkbox.Content>
                      </Checkbox>
                      <div className="flex flex-col gap-1.5">
                        <FieldLabel id="rm-l">Return method</FieldLabel>
                        <Segment
                          size="sm"
                          aria-labelledby="rm-l"
                          selectedKey={method}
                          onSelectionChange={(k) => setMethod(k as Method)}
                          className="self-start"
                        >
                          {METHODS.map((m) => (
                            <Segment.Item key={m.id} id={m.id}>
                              {m.label}
                            </Segment.Item>
                          ))}
                        </Segment>
                        <span className="text-[12px] leading-4 text-muted">{methodNote}</span>
                      </div>
                      <Button isDisabled={!canRelease} onPress={() => setReleased((r) => ({ ...r, [sel.id]: method }))}>
                        Release item to claimant
                      </Button>
                      <span className="text-[12px] text-muted" role="status">
                        {canRelease
                          ? "The custodian, time and method are recorded. This cannot be undone."
                          : "Confirm the description and the ID check first."}
                      </span>
                    </>
                  ) : null}

                  {sel.status === "stored" ? (
                    <>
                      <FieldLabel>No claim yet</FieldLabel>
                      <p className="text-[13px] leading-[18px]">{sel.retention}</p>
                      <span className="self-start">
                        <GateChip icon={<ShieldExclamation className="size-3" />}>
                          Retention period configured · unverified
                        </GateChip>
                      </span>
                      <Button variant="secondary" className="self-start" onPress={openClaim}>
                        <PersonMagnifier className="size-4" />
                        Match a guest claim
                      </Button>
                    </>
                  ) : null}

                  {sel.status === "disposal" && sel.disposal ? (
                    <>
                      <FieldLabel>Disposal · second approver needed</FieldLabel>
                      <p className="text-[13px] leading-[18px]">{sel.disposal.note}</p>
                      <span className="self-start">
                        <GateChip icon={<ShieldExclamation className="size-3" />}>{sel.disposal.rule}</GateChip>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button onPress={() => setDisposed((d) => [...d, sel.id])}>Approve disposal</Button>
                        <Button variant="ghost" onPress={() => setKept((k) => [...k, sel.id])}>
                          Keep 30 more days
                        </Button>
                      </div>
                    </>
                  ) : null}

                  {sel.status === "returned" || sel.status === "disposed" ? (
                    <>
                      <FieldLabel>
                        {sel.status === "returned" ? "Returned · custody closed" : "Disposed · custody closed"}
                      </FieldLabel>
                      <p className="text-[13px] leading-[18px]">{sel.closedNote}</p>
                      <span className="text-[12px] text-muted">
                        The record is read-only now; corrections are added as new custody entries.
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-[16px]">
          <Card aria-labelledby="in-h" className="gap-3 p-[18px]">
            <Card.Header>
              <Card.Title id="in-h" className="text-[15px] font-semibold">
                Log a Found Item
              </Card.Title>
              <Card.Description>Housekeepers can also log items from the staff app</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <TextField fullWidth value={desc} onChange={setDesc} className="gap-1">
                <Label>What was found</Label>
                <Input placeholder="e.g. Silver watch with a black strap" />
                <Description>Describe it for matching, without personal data from inside the item</Description>
              </TextField>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <SelectField label="Category" value={category} options={CATEGORIES} onChange={setCategory} />
                <SelectField label="Found by" value={foundBy} options={finders} onChange={setFoundBy} />
                <SelectField label="Room or area" value={area} options={AREAS} onChange={setArea} />
                <TextField fullWidth value={foundAt} onChange={setFoundAt} className="gap-1">
                  <Label>Found at</Label>
                  <Input className="tabular" />
                </TextField>
              </div>
              <TextField fullWidth value={spot} onChange={setSpot} className="gap-1">
                <Label>Exact spot</Label>
                <Input />
              </TextField>
              <Switch isSelected={valuable} onChange={setValuable}>
                <Switch.Content className="text-[14px]">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Valuable, cash or identity document
                </Switch.Content>
              </Switch>
              <Card variant="secondary" className="gap-0.5 px-3 py-2.5">
                <span className="text-[13px] font-medium">
                  Storage: {valuable ? "Safe A, sealed numbered bag" : "Store room L-2"}
                </span>
                <span className="text-[12px] leading-4 text-muted">
                  {valuable
                    ? "Two people confirm the seal number. Cash is counted on camera by two people."
                    : "Tagged and binned. Held 90 days before donation, with sign-off."}
                </span>
              </Card>
              <DropZone>
                <DropZone.Area
                  className="p-3.5"
                  onDrop={async (e) => {
                    const files: File[] = [];
                    for (const it of e.items) if (it.kind === "file") files.push(await it.getFile());
                    addFiles(files);
                  }}
                >
                  <DropZone.Icon>
                    <Camera className="size-5" />
                  </DropZone.Icon>
                  <DropZone.Label>Add photos</DropZone.Label>
                  <DropZone.Description>Photograph the outside only · JPG or PNG</DropZone.Description>
                  <DropZone.Trigger>Choose photos</DropZone.Trigger>
                </DropZone.Area>
                <DropZone.Input accept="image/jpeg,image/png" multiple onSelect={(list) => addFiles([...list])} />
                {photos.length ? (
                  <DropZone.FileList>
                    {photos.map((f) => {
                      const ext = (f.name.split(".").pop() ?? "jpg").toUpperCase();
                      return (
                        <DropZone.FileItem key={f.id} status="complete">
                          <DropZone.FileFormatIcon format={ext} color={ext === "PNG" ? "green" : "blue"} />
                          <DropZone.FileInfo>
                            <DropZone.FileName>{f.name}</DropZone.FileName>
                            <DropZone.FileMeta>{fileSize(f.size)}</DropZone.FileMeta>
                          </DropZone.FileInfo>
                          <DropZone.FileRemoveTrigger
                            aria-label={`Remove ${f.name}`}
                            onPress={() => setPhotos((p) => p.filter((x) => x.id !== f.id))}
                          />
                        </DropZone.FileItem>
                      );
                    })}
                  </DropZone.FileList>
                ) : null}
              </DropZone>
              <Button isDisabled={!desc.trim()} onPress={logItem}>
                <Printer className="size-4" />
                Log item and print tag
              </Button>
              <span className="text-[12px] text-muted" role="status">
                {desc.trim() ? `Creates ${nextId} and prints a tag for the bag.` : "Describe the item to continue."}
              </span>
            </Card.Content>
          </Card>

          <Card variant="secondary" aria-labelledby="acc-h" className="gap-2.5 p-4">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted" aria-hidden="true" />
              <h2 id="acc-h" className="text-[14px] font-semibold">
                Who Can See This Register
              </h2>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] leading-[18px]">
              {access.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.name}</span> <span className="text-muted">· {a.role}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] leading-4 text-muted">
              Housekeepers can log an item but not browse the register. Every view, export and hand-over is in the audit
              log.
            </p>
          </Card>
        </div>
      </div>
      {sel ? (
        <FormDialog
          isOpen={claimOpen}
          onOpenChange={setClaimOpen}
          title={`Match a guest claim · ${sel.id}`}
          description={`${sel.item}, found ${sel.when} at ${sel.where}. Ask the guest to describe it before showing it.`}
          footer={
            <>
              <FooterHint>The item stays where it is until the description and an ID are checked.</FooterHint>
              <Button variant="secondary" onPress={() => setClaimOpen(false)}>
                Cancel
              </Button>
              <Button isDisabled={!canOpenClaim} onPress={saveClaim}>
                Open claim
              </Button>
            </>
          }
        >
          <TextField fullWidth value={claimName} onChange={setClaimName} isRequired className="gap-1">
            <Label>Claimant</Label>
            <Input placeholder="Name as on the booking or ID" />
          </TextField>
          <TextField fullWidth value={claimBooking} onChange={setClaimBooking} className="gap-1">
            <Label>Booking or stay</Label>
            <Input placeholder="e.g. BK-20437 or ST-8812" />
            <Description>Leave empty for visitors without a booking</Description>
          </TextField>
          <TextField fullWidth value={claimStatement} onChange={setClaimStatement} isRequired className="gap-1">
            <Label>How the guest describes it</Label>
            <TextArea rows={3} placeholder="In the guest’s words: colour, marks, contents" />
          </TextField>
        </FormDialog>
      ) : null}
    </PageContent>
  );
}
