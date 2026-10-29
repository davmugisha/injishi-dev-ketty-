"use client";

import { ArrowUpRightFromSquare, CircleCheck, Clock, House, Picture, Tag } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Description, Input, Label, TextArea, TextField } from "@heroui/react";
import { tidyPlaceName } from "@injishi/contracts";
import { LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
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
    chip: "In review · documents",
    tone: "accent",
    text: "An officer is reviewing your documents online.",
  },
  field_verified: {
    chip: "In review · approval",
    tone: "accent",
    text: "Your documents are checked. A second officer now approves.",
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

/**
 * Cell, then village, inside the sector the property is in. The village is what files a check-in with that
 * village's leader and its cell's executive; with only a sector, the village never hears of its guests.
 */
function VillagePicker({
  sectorId,
  initialCellId,
  villageId,
  onVillage,
}: {
  sectorId: number;
  initialCellId: number | null;
  villageId: string;
  onVillage: (id: string) => void;
}) {
  const [cells, setCells] = useState<Place[] | null>(null);
  const [cellId, setCellId] = useState(initialCellId ? String(initialCellId) : "");
  const [villages, setVillages] = useState<Place[]>([]);
  useEffect(() => {
    let live = true;
    void placesAction("cells", sectorId).then((rows) => live && setCells(rows));
    if (initialCellId) void placesAction("villages", initialCellId).then((rows) => live && setVillages(rows));
    return () => {
      live = false;
    };
  }, [sectorId, initialCellId]);
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Cell
        <select
          className={SELECT}
          value={cellId}
          disabled={!cells?.length}
          onChange={async (e) => {
            setCellId(e.target.value);
            onVillage("");
            setVillages(e.target.value ? await placesAction("villages", Number(e.target.value)) : []);
          }}
        >
          <option value="">{cells === null ? "Loading…" : "Choose…"}</option>
          {(cells ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Village
        <select
          className={SELECT}
          value={villageId}
          disabled={!villages.length}
          onChange={(e) => onVillage(e.target.value)}
        >
          <option value="">Choose…</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function PropertyStep({ data, provinces }: { data: Open; provinces: Place[] }) {
  const p = data.property;
  const venue = data.foodVenue;
  const step = useStep();
  const [description, setDescription] = useState(p?.description ?? "");
  const [street, setStreet] = useState(typeof p?.address.street === "string" ? p.address.street : "");
  const [checkIn, setCheckIn] = useState(hhmm(p?.checkInTime));
  const [checkOut, setCheckOut] = useState(hhmm(p?.checkOutTime));
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [villageId, setVillageId] = useState(p?.address.villageId ? String(p.address.villageId) : "");
  const [phone, setPhone] = useState(p?.contactPhone ?? "");
  const [email, setEmail] = useState(p?.contactEmail ?? "");
  const [rules, setRules] = useState(p?.houseRules ?? "");

  if (!p) {
    const submit = (e: FormEvent) => {
      e.preventDefault();
      void step.run(() => createPropertyAction(data.workspaceId, { name, sectorId, street, description }));
    };
    return (
      <StepCard
        id="property"
        index={1}
        title={venue ? "Venue details" : "Property details"}
        done={false}
        icon={<House />}
        lead={
          venue
            ? "Where customers visit: its name and the sector it is in."
            : "Where guests stay: its name and the sector it is in."
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextField value={name} onChange={setName} isRequired fullWidth>
            <Label>{venue ? "Venue name" : "Property name"}</Label>
            <Input placeholder={venue ? "As customers will see it" : "As guests will see it"} />
          </TextField>
          <PlacePicker provinces={provinces} onSector={setSectorId} />
          <TextField value={street} onChange={setStreet} fullWidth>
            <Label>Street</Label>
            <Input placeholder="KG 11 Ave" />
          </TextField>
          <Button type="submit" className="self-start" isDisabled={step.busy || name.trim().length < 2 || !sectorId}>
            {step.busy ? "Adding…" : venue ? "Add the venue" : "Add the property"}
          </Button>
          <Outcome result={step.result} okText={venue ? "Venue added." : "Property added."} />
        </form>
      </StepCard>
    );
  }

  const place = [
    p.address.villageName ? `${tidyPlaceName(p.address.villageName)} village` : null,
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
        villageId,
        contactPhone: phone,
        contactEmail: email,
        ...(venue ? {} : { checkInTime: checkIn, checkOutTime: checkOut, houseRules: rules }),
      }),
    );
  };
  return (
    <StepCard
      id="property"
      index={1}
      title={venue ? "Venue details" : "Property details"}
      done
      icon={<House />}
      lead={
        venue
          ? "Created from your registration. Add what customers read, the village it is in and how to reach you."
          : "Created from your registration. Add what guests read, the village it is in and how to reach the desk."
      }
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
          <Description>{venue ? "Shown on your venue page." : "Shown on your property page."}</Description>
        </TextField>
        {p.address.sectorId ? (
          <VillagePicker
            sectorId={p.address.sectorId}
            initialCellId={p.address.cellId ?? null}
            villageId={villageId}
            onVillage={setVillageId}
          />
        ) : null}
        <p className="m-0 text-[13px] text-muted">
          {venue
            ? "The village decides which local leader your premises are filed with."
            : "The village decides which local leader your guests are reported to when they check in."}
        </p>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
          <TextField value={phone} onChange={setPhone} fullWidth>
            <Label>{venue ? "Phone" : "Front desk phone"}</Label>
            <Input type="tel" placeholder="078 123 4567" />
          </TextField>
          <TextField value={email} onChange={setEmail} fullWidth>
            <Label>{venue ? "Email" : "Front desk email"}</Label>
            <Input type="email" placeholder="frontdesk@example.com" />
          </TextField>
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
          <TextField value={street} onChange={setStreet} fullWidth>
            <Label>Street</Label>
            <Input placeholder="KG 11 Ave" />
          </TextField>
          {venue ? null : (
            <>
              <TextField value={checkIn} onChange={setCheckIn} fullWidth>
                <Label>Check-in from</Label>
                <Input placeholder="14:00" inputMode="numeric" />
              </TextField>
              <TextField value={checkOut} onChange={setCheckOut} fullWidth>
                <Label>Check-out by</Label>
                <Input placeholder="11:00" inputMode="numeric" />
              </TextField>
            </>
          )}
        </div>
        {venue ? null : (
          <TextField value={rules} onChange={setRules} fullWidth>
            <Label>House rules</Label>
            <TextArea rows={2} placeholder="Quiet hours, smoking, pets, visitors." />
          </TextField>
        )}
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
  const venue = data.foodVenue;
  const words = data.words;
  const wholeUnit = words.priceBasis === "per_unit";
  const typeLabel = `${words.unitSingular.charAt(0).toUpperCase()}${words.unitSingular.slice(1)} type`;
  const step = useStep();
  const [name, setName] = useState("");
  const [sleeps, setSleeps] = useState(venue ? "1" : "2");
  const [price, setPrice] = useState("");
  const [rooms, setRooms] = useState("1");
  const done = data.counts.pricedRoomTypes > 0;
  const types = p?.roomTypes.filter((t) => t.status === "active") ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!p) return;
    const ok = await step.run(() =>
      addRoomTypeAction(data.workspaceId, p.id, {
        name,
        maxGuests: venue ? "1" : sleeps,
        basePriceRwf: price,
        roomCount: venue ? "1" : rooms,
        priceBasis: words.priceBasis,
      }),
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
      title={venue ? "What you sell" : `A priced ${words.unitSingular} type`}
      done={done}
      icon={<Tag />}
      lead={
        venue
          ? "Menu items or packages, each with a price in Rwandan francs. Customers see them on your page; nothing is booked."
          : wholeUnit
            ? `Each ${words.unitSingular} is let whole to one party, so the price is ${words.pricePeriod}, in Rwandan francs, however many people stay.`
            : `What you sell and at what price, ${words.pricePeriod}, in Rwandan francs.`
      }
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
                {t.basePriceRwf === null
                  ? "No price yet"
                  : `${rwf(t.basePriceRwf)} ${words.pricePeriod}`}
                {venue
                  ? null
                  : ` · ${t.sellableRoomCount} ${t.sellableRoomCount === 1 ? words.unitSingular : words.unitPlural}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {p ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
            <TextField value={name} onChange={setName} isRequired fullWidth>
              <Label>{venue ? "Item" : typeLabel}</Label>
              <Input
                placeholder={venue ? "Espresso, lunch set…" : wholeUnit ? `Two-bedroom ${words.unitSingular}` : "Double room"}
              />
            </TextField>
            {venue ? null : (
              <TextField value={sleeps} onChange={setSleeps} isRequired fullWidth>
                <Label>Sleeps</Label>
                <Input inputMode="numeric" />
              </TextField>
            )}
            <TextField value={price} onChange={setPrice} isRequired fullWidth>
              <Label>{venue ? "Price each (RWF)" : wholeUnit ? "Price per night (RWF)" : "Price per person (RWF)"}</Label>
              <Input inputMode="numeric" placeholder={venue ? "2500" : "45000"} className="tabular" />
            </TextField>
            {venue ? null : (
              <TextField value={rooms} onChange={setRooms} isRequired fullWidth>
                <Label>{`How many ${words.unitPlural}`}</Label>
                <Input inputMode="numeric" />
              </TextField>
            )}
          </div>
          <Button
            type="submit"
            variant={done ? "secondary" : "primary"}
            className="self-start"
            isDisabled={step.busy || name.trim().length < 2 || !price.trim()}
          >
            {step.busy
              ? "Adding…"
              : types.length
                ? venue
                  ? "Add another item"
                  : `Add another ${words.unitSingular} type`
                : venue
                  ? "Add item"
                  : `Add ${words.unitSingular} type`}
          </Button>
          <Outcome result={step.result} okText={venue ? "Item added." : `${typeLabel} added.`} />
        </form>
      ) : (
        <p className="text-[13px] text-muted">{venue ? "Add the venue first." : "Add the property first."}</p>
      )}
    </StepCard>
  );
}

function PhotoStep({ data }: { data: Open }) {
  const p = data.property;
  const venue = data.foodVenue;
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
      lead={
        venue
          ? "At least one, so customers can see the venue. The first one is the cover."
          : "At least one, so guests can see the place. The first one is the cover."
      }
    >
      {photos.length ? (
        <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
          {photos.map((ph) => (
            <li key={ph.id} className="flex flex-col gap-1">
              {/* biome-ignore lint/performance/noImgElement: a short-lived signed URL, not a static asset */}
              <img
                src={ph.url}
                alt={ph.caption ?? (venue ? "Venue photograph" : "Property photograph")}
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
            <Input placeholder={venue ? "Counter, terrace…" : "Front of the house"} />
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
        <p className="text-[13px] text-muted">{venue ? "Add the venue first." : "Add the property first."}</p>
      )}
    </StepCard>
  );
}

function PublishStep({ data, webUrl }: { data: Open; webUrl: string }) {
  const p = data.property;
  const venue = data.foodVenue;
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
      lead={
        venue
          ? "Puts the venue on the Injishi marketplace. Until you press it, customers see nothing."
          : "Puts the property on the Injishi marketplace. Until you press it, guests see nothing."
      }
    >
      {live ? (
        <Alert status="success" role="status">
          <Alert.Content>
            <Alert.Title>Live on the marketplace</Alert.Title>
            <Alert.Description>
              {venue
                ? `Customers can find ${p?.name}.`
                : `Guests can find ${p?.name} and book it.`}
            </Alert.Description>
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
            {venue ? "See it as customers do" : "See it as guests do"}
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

/** Where each checklist step is done: on this page, or a screen of its own. */
const STEP_HOME: Partial<Record<string, { href: string; label: string }>> = {
  property: { href: "#property", label: "Above" },
  contact: { href: "#property", label: "Above" },
  room_types: { href: "#room_type", label: "Above" },
  photos: { href: "#photo", label: "Above" },
  listing: { href: "#publish", label: "Above" },
  rooms: { href: "/room-rack", label: "Room rack" },
  outlets: { href: "/outlets", label: "Outlets" },
  staff: { href: "/settings/team", label: "Team" },
};

/**
 * The whole checklist for this kind of business (`setupStepsFor`): a hotel runs departments, a villa does not,
 * a coffee shop numbers no rooms. Publishing needs only the four cards above; the rest is what running the
 * place well needs, done here or on its own screen.
 */
function KindChecklist({ data }: { data: Open }) {
  const left = data.checklist.filter((s) => !s.done).length;
  return (
    <Card render={(p) => <section {...p} />} aria-labelledby="checklist-h" className="gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="checklist-h" className="text-[15px] leading-[22px] font-semibold">
          {`Your ${data.kindLabel} checklist`}
        </h2>
        <span className="text-[13px] text-muted tabular">
          {left === 0 ? "All done" : `${data.checklist.length - left} of ${data.checklist.length} done`}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {data.checklist.map((s) => {
          const home = STEP_HOME[s.key];
          return (
            <li
              key={s.key}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-t border-separator py-2.5 first:border-t-0"
            >
              <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.done ? <CircleCheck className="size-4 text-success" aria-label="Done" /> : null}
                  {s.title}
                  <Chip size="sm" variant="soft" color={s.required ? "accent" : "default"}>
                    {s.required ? "Required" : "Recommended"}
                  </Chip>
                </span>
                <span className="text-[13px] text-muted">{s.description}</span>
              </div>
              {home && !s.done ? (
                <a href={home.href} className="text-[13px] font-medium text-accent underline-offset-2 hover:underline">
                  {home.label}
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** One business, several branches: pick which one this page sets up. */
function PropertySwitcher({ data }: { data: Open }) {
  if (data.properties.length < 2) return null;
  return (
    <label className="flex max-w-[420px] flex-col gap-1 text-sm font-medium">
      Setting up
      <select
        className={SELECT}
        value={data.property?.id ?? ""}
        onChange={(e) => {
          window.location.search = `?property=${encodeURIComponent(e.target.value)}`;
        }}
      >
        {data.properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Shown above the steps while the registration is reviewed: build now, publish after approval. */
function ReviewNotice({ status }: { status: string | null }) {
  const where = WAITING[status ?? ""];
  return (
    <Alert status="accent" role="status">
      <Alert.Content>
        <Alert.Title className="flex flex-wrap items-center gap-2">
          Your registration is in review
          {where ? (
            <Chip size="sm" variant="soft" color={where.tone}>
              {where.chip}
            </Chip>
          ) : null}
        </Alert.Title>
        <Alert.Description>
          {where ? `${where.text} ` : ""}Set everything up now: you can publish as soon as it is approved, and we email
          you when it is.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/**
 * "Set up your property" (`/w/<workspaceId>/setup`): the four things the marketplace needs, each on the real
 * inventory API, in the order a person does them. It opens once the fee is paid, so the owner builds the listing
 * while the registration is reviewed; only Publish waits for approval. Before payment, or once sent back or
 * suspended, it is closed and says where the registration stands.
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
        <PageHeader eyebrow={`${data.businessName} · Setup`} title="Set up your business" />
        <Card render={(p) => <section {...p} />} aria-labelledby="closed-h" className="gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="size-5 text-muted" aria-hidden="true" />
            <h2 id="closed-h" className="text-[15px] leading-[22px] font-semibold">
              Setup opens once your registration fee is paid
            </h2>
            <Chip size="sm" variant="soft" color={where.tone}>
              {where.chip}
            </Chip>
          </div>
          <p className="text-sm text-muted">{where.text}</p>
          <p className="text-sm text-muted">
            Until then the registry does not let anyone add prices or photographs for this business, so there is nothing
            to prepare here yet.
          </p>
          <LinkButton href={`${webUrl}/register`} variant="secondary" className="self-start">
            See your registration
          </LinkButton>
        </Card>
      </PageContent>
    );
  }

  const venue = data.foodVenue;
  const done = data.steps.filter((s) => s.done).length;
  return (
    <PageContent>
      <PageHeader
        eyebrow={`${data.businessName} · Setup`}
        title={venue ? "Set up your venue" : "Set up your property"}
        description={
          data.published
            ? venue
              ? "Your venue is on the marketplace. Keep its details, prices and photographs up to date here."
              : "Your property is on the marketplace. Keep its details, prices and photographs up to date here."
            : venue
              ? "Four steps, then publish. Customers see nothing until you press Publish."
              : "Four steps, then publish. Guests see nothing until you press Publish."
        }
      />
      {!data.approved ? <ReviewNotice status={data.status} /> : null}
      <PropertySwitcher data={data} />
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
        <KindChecklist data={data} />
      </div>
    </PageContent>
  );
}
