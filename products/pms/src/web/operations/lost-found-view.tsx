"use client";

import {
  ArrowDownToLine,
  Camera,
  CircleCheckFill,
  Clock,
  Lock,
  PersonMagnifier,
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
  Toast,
  toast,
} from "@heroui/react";
import { DropZone, Segment } from "@heroui-pro/react";
import { GateChip, PageContent, PageHeader, SectionHeader, toneColor } from "@injishi/ui";
import { useEffect, useState, useTransition } from "react";
import type { FoundItem, FoundItemStatus, RegisterAccess } from "../../model/operations.ts";
import type { Persona, Tone } from "../../model/shared.ts";
import { usePmsActions } from "../mount.tsx";
import {
  downloadCsv,
  FieldLabel,
  FooterHint,
  FormDialog,
  firstKey,
  HistoryTimeline,
  kigaliClock,
  kigaliDayMonth,
  reported,
  SelectField,
  useKigaliNow,
} from "./shared.tsx";

/** "2026" in Kigali. */
const kigaliYear = (at: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", year: "numeric" }).format(at);
/** "15 Oct 2026, 07:12": how the intake form writes when an item was found. */
const foundAtText = (at: Date) => `${kigaliDayMonth(at)} ${kigaliYear(at)}, ${kigaliClock(at)}`;

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

/**
 * Photos are not kept: the register has no photo column, `POST /uploads` takes no found-item kind and the intake
 * names no key. So a photo is never "attached" here and no photo count is written to the custody log.
 */
const photosUnavailable = () =>
  toast.warning("Adding photos is not available yet: the register does not store them, so none were kept.");

export function LostFoundView({
  // The register acts as the signed-in person through the API, which records who did each step.
  persona,
  items: baseItems,
  access,
  placeName,
}: {
  persona: Persona;
  items: FoundItem[];
  /** Sample: the register's access list is not kept per person yet (operations.lostFoundAccess is deferred). */
  access: RegisterAccess[];
  /** The branch, else the business, as the API names it. */
  placeName: string;
}) {
  const {
    approveFoundItemDisposalAction,
    keepFoundItemAction,
    logFoundItemAction,
    openFoundItemClaimAction,
    releaseFoundItemAction,
  } = usePmsActions();
  // Who found it and who holds it start as the signed-in person; the other choices are people the register
  // already names (live), never a sample list.
  const you = persona.name;
  const people = (names: string[]) => [
    { id: you, label: `${you} (you)` },
    ...[...new Set(names)].filter((n) => n && n !== you && n !== "None").map((n) => ({ id: n, label: n })),
  ];
  const finders = people(baseItems.map((i) => i.foundBy));
  const custodians = people(baseItems.map((i) => i.custodian));

  const [selectedId, setSelectedId] = useState(baseItems[0]?.id ?? "");
  const [descOk, setDescOk] = useState(false);
  const [idOk, setIdOk] = useState(false);
  const [method, setMethod] = useState<Method>("person");
  const [claimOpen, setClaimOpen] = useState(false);
  // Keep 30 more days: the reason is the person's, typed before the press that records it.
  const [keepOpen, setKeepOpen] = useState(false);
  const [keepWhy, setKeepWhy] = useState("");
  const [claimName, setClaimName] = useState("");
  const [claimBooking, setClaimBooking] = useState("");
  const [claimStatement, setClaimStatement] = useState("");
  const [pending, startTransition] = useTransition();
  // Intake form
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [foundBy, setFoundBy] = useState(you);
  const [custodian, setCustodian] = useState(you);
  const [area, setArea] = useState("");
  // "Found at" starts at the real time in Kigali once the page is mounted.
  const [foundAt, setFoundAt] = useState("");
  const [spot, setSpot] = useState("");
  const [valuable, setValuable] = useState(true);
  const now = useKigaliNow();
  useEffect(() => {
    if (now && !foundAt) setFoundAt(foundAtText(now));
  }, [now, foundAt]);

  // The register is the business's record (GET /ops/found-items): intake, claims, release, disposal
  // and keeping an item longer are commands to the API, and the screen re-reads after each.
  const items = baseItems;
  const sel = items.find((i) => i.id === selectedId) ?? items[0];
  const open = items.filter((r) => r.status !== "returned" && r.status !== "disposed").length;
  const valuables = items.filter((r) => r.valuable && r.status !== "returned" && r.status !== "disposed").length;
  const canRelease = descOk && idOk && !pending;
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
  // The tag the next intake will most likely get (the API assigns it, so two desks never share one).
  const yearTag = (now ? kigaliYear(now) : "").slice(2);
  const nextNumber =
    Math.max(0, ...items.filter((i) => i.id.startsWith(`LF-${yearTag}-`)).map((i) => Number(i.id.split("-")[2]) || 0)) +
    1;
  const nextId = `LF-${yearTag}-${String(nextNumber).padStart(3, "0")}`;
  const spotShort = spot.split(",")[0].trim();

  const act = (run: () => Promise<{ ok: true } | { ok: false; error: string }>, then?: () => void) =>
    startTransition(async () => {
      if (reported(await run())) then?.();
    });

  const select = (id: string) => {
    setSelectedId(id);
    setDescOk(false);
    setIdOk(false);
    setMethod("person");
    setKeepOpen(false);
    setKeepWhy("");
  };
  const logItem = () => {
    const text = desc.trim();
    if (!text || !area.trim() || pending) return;
    startTransition(async () => {
      const result = await logFoundItemAction({
        description: text,
        category,
        valuable,
        area: area.trim(),
        spot: spotShort,
        foundAt,
        foundBy,
        custodian,
        storage: valuable ? "Safe · sealed bag" : "Store room",
      });
      if (!reported(result)) return;
      setDesc("");
      setArea("");
      setSpot("");
      if (result.ok) {
        select(result.value);
        // The reference the register gave the item: staff write it on the tag and the bag.
        toast.success(`Logged as ${result.value}. Write this reference on the tag and the bag.`);
      }
    });
  };
  const openClaim = () => {
    setClaimName("");
    setClaimBooking("");
    setClaimStatement("");
    setClaimOpen(true);
  };
  const canOpenClaim = claimName.trim().length > 0 && claimStatement.trim().length > 0 && !pending;
  const saveClaim = () => {
    if (!sel || !canOpenClaim) return;
    const id = sel.id;
    act(
      () =>
        openFoundItemClaimAction(id, {
          claimant: claimName.trim(),
          booking: claimBooking.trim() || undefined,
          statement: claimStatement.trim(),
        }),
      () => {
        setClaimOpen(false);
        select(id);
      },
    );
  };
  const exportLog = () =>
    downloadCsv("lost-and-found-custody-log.csv", [
      ["Item ID", "Item", "Category", "Status", "Custody step", "Who and when"],
      ...items.flatMap((i) => i.custody.map((c) => [i.id, i.item, i.category, STATUS[i.status].label, c.what, c.who])),
    ]);

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${placeName} · Property`}
        title="Lost & Found"
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
                  {open} open · {valuables} {valuables === 1 ? "valuable" : "valuables"} in the safe
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
                      <Button
                        isDisabled={!canRelease}
                        onPress={() => act(() => releaseFoundItemAction(sel.id, method))}
                      >
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
                      {/* Keeping it longer records the person's own reason: asked here, never a fixed one. */}
                      {keepOpen ? (
                        <TextField value={keepWhy} onChange={setKeepWhy} className="flex flex-col gap-1">
                          <Label>Why keep it 30 more days?</Label>
                          <TextArea rows={2} maxLength={300} placeholder="Recorded on the item's custody trail" />
                        </TextField>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button isDisabled={pending} onPress={() => act(() => approveFoundItemDisposalAction(sel.id))}>
                          Approve disposal
                        </Button>
                        <Button
                          variant="ghost"
                          isDisabled={pending || (keepOpen && !keepWhy.trim())}
                          onPress={() => {
                            if (!keepOpen) {
                              setKeepOpen(true);
                              return;
                            }
                            const why = keepWhy.trim();
                            if (!why) return;
                            act(
                              () => keepFoundItemAction(sel.id, 30, why),
                              () => {
                                setKeepOpen(false);
                                setKeepWhy("");
                              },
                            );
                          }}
                        >
                          {keepOpen ? "Keep 30 more days" : "Keep longer…"}
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
                <TextField fullWidth value={area} onChange={setArea} isRequired className="gap-1">
                  <Label>Room or area</Label>
                  <Input placeholder="e.g. Room 204 or Lobby" />
                </TextField>
                <TextField fullWidth value={foundAt} onChange={setFoundAt} className="gap-1">
                  <Label>Found at</Label>
                  <Input className="tabular" />
                </TextField>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <SelectField label="Custodian" value={custodian} options={custodians} onChange={setCustodian} />
                <TextField fullWidth value={spot} onChange={setSpot} className="gap-1">
                  <Label>Exact spot</Label>
                  <Input placeholder="e.g. Under the bed, window side" />
                </TextField>
              </div>
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
                  Storage: {valuable ? "the safe, in a sealed numbered bag" : "the store room"}
                </span>
                <span className="text-[12px] leading-4 text-muted">
                  {valuable
                    ? "Two people confirm the seal number. Cash is counted on camera by two people."
                    : "Tagged and binned. Held 90 days before donation, with sign-off."}
                </span>
              </Card>
              <DropZone>
                <DropZone.Area className="p-3.5" onDrop={photosUnavailable}>
                  <DropZone.Icon>
                    <Camera className="size-5" />
                  </DropZone.Icon>
                  <DropZone.Label>Add photos</DropZone.Label>
                  <DropZone.Description>Not available yet: the register does not store photos</DropZone.Description>
                  <DropZone.Trigger>Choose photos</DropZone.Trigger>
                </DropZone.Area>
                <DropZone.Input accept="image/jpeg,image/png" multiple onSelect={photosUnavailable} />
              </DropZone>
              <Button isDisabled={!desc.trim() || !area.trim() || !foundAt || pending} onPress={logItem}>
                Log item
              </Button>
              <span className="text-[12px] text-muted" role="status">
                {!desc.trim()
                  ? "Describe the item to continue."
                  : !area.trim()
                    ? "Say where it was found to continue."
                    : `Likely ${nextId}; the register gives the reference. Write it on the tag: tags are not printed here.`}
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
              Sample list: who may see the register is not kept per person yet, so these names are not your team.
              Housekeepers can log an item but not browse the register.
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
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
