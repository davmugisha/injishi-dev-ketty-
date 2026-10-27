"use client";

import { ArrowUpRightFromSquare, CircleCheck, Clock, House, Picture, Tag } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Description, Input, Label, TextArea, TextField } from "@heroui/react";
import { tidyPlaceName } from "@injishi/contracts";
import { LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { type FormEvent, type ReactNode, useState } from "react";
import type { Place, SetupRead, StepKey } from "@/server/mutations/setup";
import {
  addPhotoAction,
  addRoomTypeAction,
  createPropertyAction,
  placesAction,
  publishAction,
  unpublishAction,
  updatePropertyAction,
} from "./setup-actions";

type Open = Extract<SetupRead, { open: true }>;
type Result = { ok: true } | { ok: false; error: string };

/** Where an unapproved registration stands, in the owner's words (RegistrationSummary statuses). */
const WAITING: Record<string, { chip: string; tone: "accent" | "warning" | "danger" | "default"; text: string }> = {
  pending_payment: {
    chip: "Waiting for payment",
    tone: "warning",
    text: "The registration fee has not been paid yet.",
  },
  submitted: {
    chip: "In review · TIN check",
    tone: "accent",
    text: "Paid. RRA is confirming your TIN, which usually takes seconds.",
  },
  tin_verified: {
    chip: "In review · field visit",
    tone: "accent",
    text: "A verifier from your district visits to confirm the place, the address and your documents.",
  },
  field_verified: {
    chip: "In review · approval",
    tone: "accent",
    text: "The district verifier has been. A second officer now approves.",
  },
  approved: {
    chip: "Approved · waiting for the owner",
    tone: "accent",
    text: "Approved. It opens once the owner it was registered for accepts the invitation.",
  },
  rejected: {
    chip: "Sent back",
    tone: "danger",
    text: "The officers sent it back with a reason. Fix it on your registration and resubmit; there is no new fee.",
  },
  suspended: { chip: "Suspended", tone: "danger", text: "This business is suspended. Contact Injishi support." },
};

const rwf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

function StepCard({
  id,
  index,
  title,
  done,
  icon,
  lead,
  children,
}: {
  id: StepKey;
  index: number;
  title: string;
  done: boolean;
  icon: ReactNode;
  lead: string;
  children: ReactNode;
}) {
  return (
    <Card render={(p) => <section {...p} />} aria-labelledby={`step-${id}`} className="gap-4 p-5">
      <Card.Header className="flex flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-default text-muted">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`step-${id}`} className="text-[15px] leading-[22px] font-semibold">
            {index}. {title}
          </h2>
          <Card.Description>{lead}</Card.Description>
        </div>
        <Chip size="sm" variant="soft" color={done ? "success" : "default"}>
          {done ? "Done" : "To do"}
        </Chip>
      </Card.Header>
      {children}
    </Card>
  );
}

function Outcome({ result, okText }: { result: Result | null; okText: string }) {
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="flex items-center gap-1.5 text-[13px] text-success">
      <CircleCheck className="size-4" aria-hidden="true" />
      {okText}
    </p>
  ) : (
    <Alert status="danger" role="alert">
      <Alert.Content>
        <Alert.Title>Not saved</Alert.Title>
        <Alert.Description>{result.error}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/** Run a server action and keep its outcome for the step it was pressed on. */
function useStep() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const run = async (call: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setResult(null);
    const res = await call();
    setBusy(false);
    setResult(res.ok ? { ok: true } : { ok: false, error: res.error });
    return res.ok;
  };
  return { busy, result, run };
}

const SELECT =
  "h-10 w-full rounded-xl border border-separator bg-field px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus";

function PlacePicker({ provinces, onSector }: { provinces: Place[]; onSector: (id: string) => void }) {
  const [districts, setDistricts] = useState<Place[]>([]);
  const [sectors, setSectors] = useState<Place[]>([]);
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Province
        <select
          className={SELECT}
          defaultValue=""
          onChange={async (e) => {
            setSectors([]);
            onSector("");
            setDistricts(e.target.value ? await placesAction("districts", Number(e.target.value)) : []);
          }}
        >
          <option value="">Choose…</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        District
        <select
          className={SELECT}
          defaultValue=""
          disabled={!districts.length}
          onChange={async (e) => {
            onSector("");
            setSectors(e.target.value ? await placesAction("sectors", Number(e.target.value)) : []);
          }}
        >
          <option value="">Choose…</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Sector
        <select
          className={SELECT}
          defaultValue=""
          disabled={!sectors.length}
          onChange={(e) => onSector(e.target.value)}
        >
          <option value="">Choose…</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function PropertyStep({ data, provinces }: { data: Open; provinces: Place[] }) {
  const p = data.property;
  const step = useStep();
  const [description, setDescription] = useState(p?.description ?? "");
  const [street, setStreet] = useState(typeof p?.address.street === "string" ? p.address.street : "");
  const [checkIn, setCheckIn] = useState(hhmm(p?.checkInTime));
  const [checkOut, setCheckOut] = useState(hhmm(p?.checkOutTime));
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState("");

  if (!p) {
    const submit = (e: FormEvent) => {
      e.preventDefault();
      void step.run(() => createPropertyAction(data.workspaceId, { name, sectorId, street, description }));
    };
    return (
      <StepCard
        id="property"
        index={1}
        title="Property details"
        done={false}
        icon={<House />}
        lead="Where guests stay: its name and the sector it is in."
      >
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextField value={name} onChange={setName} isRequired fullWidth>
            <Label>Property name</Label>
            <Input placeholder="As guests will see it" />
          </TextField>
          <PlacePicker provinces={provinces} onSector={setSectorId} />
          <TextField value={street} onChange={setStreet} fullWidth>
            <Label>Street</Label>
            <Input placeholder="KG 11 Ave" />
          </TextField>
          <Button type="submit" className="self-start" isDisabled={step.busy || name.trim().length < 2 || !sectorId}>
            {step.busy ? "Adding…" : "Add the property"}
          </Button>
          <Outcome result={step.result} okText="Property added." />
        </form>
      </StepCard>
    );
  }

  const place = [
    p.address.sectorName ? `${tidyPlaceName(p.address.sectorName)} sector` : null,
    p.address.districtName ? tidyPlaceName(p.address.districtName) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void step.run(() =>
      updatePropertyAction(data.workspaceId, p.id, {
        description,
        street,
        checkInTime: checkIn,
        checkOutTime: checkOut,
      }),
    );
  };
  return (
    <StepCard
      id="property"
      index={1}
      title="Property details"
      done
      icon={<House />}
      lead="Created from your registration when it was approved. Add what guests read before they book."
    >
      <dl className="m-0 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
        <div className="flex flex-col">
          <dt className="text-xs text-muted">Name</dt>
          <dd className="m-0 font-medium">{p.name}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted">Where</dt>
          <dd className="m-0 font-medium">{place || "Sector on record"}</dd>
        </div>
      </dl>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField value={description} onChange={setDescription} fullWidth>
          <Label>Description</Label>
          <TextArea rows={3} placeholder="What makes the place, in a few sentences." />
          <Description>Shown on your property page.</Description>
        </TextField>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
          <TextField value={street} onChange={setStreet} fullWidth>
            <Label>Street</Label>
            <Input placeholder="KG 11 Ave" />
          </TextField>
          <TextField value={checkIn} onChange={setCheckIn} fullWidth>
            <Label>Check-in from</Label>
            <Input placeholder="14:00" inputMode="numeric" />
          </TextField>
          <TextField value={checkOut} onChange={setCheckOut} fullWidth>
            <Label>Check-out by</Label>
            <Input placeholder="11:00" inputMode="numeric" />
          </TextField>
        </div>
        <Button type="submit" variant="secondary" className="self-start" isDisabled={step.busy}>
          {step.busy ? "Saving…" : "Save details"}
        </Button>
        <Outcome result={step.result} okText="Saved." />
      </form>
    </StepCard>
  );
}

function RoomTypeStep({ data }: { data: Open }) {
  const p = data.property;
  const step = useStep();
  const [name, setName] = useState("");
  const [sleeps, setSleeps] = useState("2");
  const [price, setPrice] = useState("");
  const [rooms, setRooms] = useState("1");
  const done = data.counts.pricedRoomTypes > 0;
  const types = p?.roomTypes.filter((t) => t.status === "active") ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!p) return;
    const ok = await step.run(() =>
      addRoomTypeAction(data.workspaceId, p.id, { name, maxGuests: sleeps, basePriceRwf: price, roomCount: rooms }),
    );
    if (ok) {
      setName("");
      setPrice("");
    }
  };
  return (
    <StepCard
      id="room_type"
      index={2}
      title="A priced room type"
      done={done}
      icon={<Tag />}
      lead="What you sell and at what price, per person, per night, in Rwandan francs."
    >
      {types.length ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {types.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-separator py-2 first:border-t-0"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-[13px] text-muted tabular">
                {t.basePriceRwf === null ? "No price yet" : `${rwf(t.basePriceRwf)} per person, per night`} ·{" "}
                {t.sellableRoomCount} {t.sellableRoomCount === 1 ? "room" : "rooms"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {p ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
            <TextField value={name} onChange={setName} isRequired fullWidth>
              <Label>Room type</Label>
              <Input placeholder="Double room" />
            </TextField>
            <TextField value={sleeps} onChange={setSleeps} isRequired fullWidth>
              <Label>Sleeps</Label>
              <Input inputMode="numeric" />
            </TextField>
            <TextField value={price} onChange={setPrice} isRequired fullWidth>
              <Label>Price (RWF)</Label>
              <Input inputMode="numeric" placeholder="45000" className="tabular" />
            </TextField>
            <TextField value={rooms} onChange={setRooms} isRequired fullWidth>
              <Label>How many rooms</Label>
              <Input inputMode="numeric" />
            </TextField>
          </div>
          <Button
            type="submit"
            variant={done ? "secondary" : "primary"}
            className="self-start"
            isDisabled={step.busy || name.trim().length < 2 || !price.trim()}
          >
            {step.busy ? "Adding…" : types.length ? "Add another room type" : "Add room type"}
          </Button>
          <Outcome result={step.result} okText="Room type added." />
        </form>
      ) : (
        <p className="text-[13px] text-muted">Add the property first.</p>
      )}
    </StepCard>
  );
}

function PhotoStep({ data }: { data: Open }) {
  const p = data.property;
  const step = useStep();
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const photos = p?.photos ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!p || !file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("caption", caption);
    const ok = await step.run(() => addPhotoAction(data.workspaceId, p.id, form));
    if (ok) {
      setCaption("");
      setFile(null);
      setInputKey((k) => k + 1);
    }
  };
  return (
    <StepCard
      id="photo"
      index={3}
      title="A photograph"
      done={data.counts.photos > 0}
      icon={<Picture />}
      lead="At least one, so guests can see the place. The first one is the cover."
    >
      {photos.length ? (
        <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
          {photos.map((ph) => (
            <li key={ph.id} className="flex flex-col gap-1">
              {/* biome-ignore lint/performance/noImgElement: a short-lived signed URL, not a static asset */}
              <img
                src={ph.url}
                alt={ph.caption ?? "Property photograph"}
                className="aspect-[4/3] w-full rounded-[10px] bg-default object-cover"
              />
              <span className="truncate text-[12px] text-muted">
                {ph.isCover ? "Cover · " : ""}
                {ph.caption ?? "No caption"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {p ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Photograph
            <input
              key={inputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-default file:px-3 file:py-2 file:text-foreground"
            />
            <span className="text-xs font-normal text-muted">JPEG, PNG or WebP, up to 8 MB.</span>
          </label>
          <TextField value={caption} onChange={setCaption} fullWidth>
            <Label>Caption</Label>
            <Input placeholder="Front of the house" />
          </TextField>
          <Button
            type="submit"
            variant={photos.length ? "secondary" : "primary"}
            className="self-start"
            isDisabled={step.busy || !file}
          >
            {step.busy ? "Uploading…" : "Add photo"}
          </Button>
          <Outcome result={step.result} okText="Photo added." />
        </form>
      ) : (
        <p className="text-[13px] text-muted">Add the property first.</p>
      )}
    </StepCard>
  );
}

function PublishStep({ data, webUrl }: { data: Open; webUrl: string }) {
  const p = data.property;
  const step = useStep();
  const [slug, setSlug] = useState<string | null>(p?.slug ?? null);
  const live = data.published;
  // The page re-reads after either press, so `live` already says where it stands; this only words the outcome.
  const [last, setLast] = useState<"publish" | "unpublish">("publish");
  const publish = async () => {
    if (!p) return;
    setLast("publish");
    let address: string | null = null;
    const ok = await step.run(async () => {
      const res = await publishAction(data.workspaceId, p.id);
      if (res.ok) address = res.value;
      return res;
    });
    if (ok) setSlug(address);
  };
  const unpublish = async () => {
    if (!p) return;
    setLast("unpublish");
    await step.run(() => unpublishAction(data.workspaceId, p.id));
  };
  return (
    <StepCard
      id="publish"
      index={4}
      title="Publish"
      done={live}
      icon={<ArrowUpRightFromSquare />}
      lead="Puts the property on the Injishi marketplace. Until you press it, guests see nothing."
    >
      {live ? (
        <Alert status="success" role="status">
          <Alert.Content>
            <Alert.Title>Live on the marketplace</Alert.Title>
            <Alert.Description>Guests can find {p?.name} and book it.</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : data.blockers.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Before it can be published</span>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] text-muted">
            {data.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-muted">Everything the marketplace needs is in place.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {live ? null : (
          <Button onPress={() => void publish()} isDisabled={step.busy || !p || data.blockers.length > 0}>
            {step.busy ? "Publishing…" : "Publish"}
          </Button>
        )}
        {live && slug ? (
          <LinkButton href={`${webUrl}/property/${slug}`} variant="secondary">
            See it as guests do
            <ArrowUpRightFromSquare className="size-4" />
          </LinkButton>
        ) : null}
        {live ? (
          // Closing for a season, or a listing that is wrong: the owner withdraws it here, keeping its address.
          <Button variant="ghost" onPress={() => void unpublish()} isDisabled={step.busy || !p}>
            {step.busy ? "Taking it off…" : "Take it off the marketplace"}
          </Button>
        ) : null}
      </div>
      <Outcome
        result={step.result}
        okText={
          last === "unpublish" ? "Taken off the marketplace. Publish again whenever you are ready." : "Published."
        }
      />
    </StepCard>
  );
}

/**
 * "Set up your property" (`/w/<workspaceId>/setup`): the four things the marketplace needs from an approved
 * business, each on the real inventory API, in the order a person does them. Before approval it is closed and
 * says where the registration stands, because the registry refuses every one of these writes until then.
 */
export function PropertySetupView({
  data,
  provinces,
  webUrl,
}: {
  data: SetupRead;
  provinces: Place[];
  webUrl: string;
}) {
  if (!data.open) {
    const where = WAITING[data.status ?? ""] ?? {
      chip: "Not open yet",
      tone: "default" as const,
      text: "This business is not approved yet.",
    };
    return (
      <PageContent>
        <PageHeader eyebrow={`${data.businessName} · Setup`} title="Set up your property" />
        <Card render={(p) => <section {...p} />} aria-labelledby="closed-h" className="gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="size-5 text-muted" aria-hidden="true" />
            <h2 id="closed-h" className="text-[15px] leading-[22px] font-semibold">
              Setup opens once your registration is approved
            </h2>
            <Chip size="sm" variant="soft" color={where.tone}>
              {where.chip}
            </Chip>
          </div>
          <p className="text-sm text-muted">{where.text}</p>
          <p className="text-sm text-muted">
            Until then the registry does not let anyone add rooms, prices or photographs for this business, so there is
            nothing to prepare here yet. We email you when it is approved.
          </p>
          <LinkButton href={`${webUrl}/register`} variant="secondary" className="self-start">
            See your registration
          </LinkButton>
        </Card>
      </PageContent>
    );
  }

  const done = data.steps.filter((s) => s.done).length;
  return (
    <PageContent>
      <PageHeader
        eyebrow={`${data.businessName} · Setup`}
        title="Set up your property"
        description={
          data.published
            ? "Your property is on the marketplace. Keep its details, prices and photographs up to date here."
            : "Four steps, then publish. Guests see nothing until you press Publish."
        }
      />
      <section aria-label="Setup progress" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium tabular">
          {done} of {data.steps.length} done
        </span>
        {data.steps.map((s) => (
          <Chip key={s.key} size="sm" variant="soft" color={s.done ? "success" : "default"}>
            {s.done ? "✓ " : ""}
            {s.title}
          </Chip>
        ))}
      </section>
      <div className="flex max-w-[860px] flex-col gap-4">
        <PropertyStep data={data} provinces={provinces} />
        <RoomTypeStep data={data} />
        <PhotoStep data={data} />
        <PublishStep data={data} webUrl={webUrl} />
      </div>
    </PageContent>
  );
}
