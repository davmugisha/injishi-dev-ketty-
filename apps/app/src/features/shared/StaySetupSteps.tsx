"use client";

import { Clock, Key, ListCheck, Persons } from "@gravity-ui/icons";
import { Button, Checkbox, Description, Input, Label, TextArea, TextField } from "@heroui/react";
import {
  BED_TYPE_LABEL,
  type BedType,
  bedsLine,
  bedsSleep,
  CHILDREN_POLICY_LABEL,
  type ChildrenPolicy,
  CRIB_POLICY_LABEL,
  type CribPolicy,
  FRONT_DESK_LABEL,
  type FrontDesk,
  INTERNET_LABEL,
  type InternetAccess,
  PARKING_LABEL,
  PARTIES_POLICY_LABEL,
  type ParkingOption,
  type PartiesPolicy,
  PETS_POLICY_LABEL,
  type PetsPolicy,
  ROOM_CATEGORY_LABEL,
  type RoomBed,
  type RoomCategory,
  type RoomTypeDetailEdit,
  SMOKING_POLICY_LABEL,
  type SmokingPolicy,
  STAFF_LANGUAGE_LABEL,
  type StaffLanguage,
} from "@injishi/contracts";
import { type FormEvent, useState } from "react";
import { type ApiAmenity, type ApiProperty, hasPhoto, type SetupRead } from "@/server/mutations/setup";
import {
  addPhotoAction,
  addRoomTypeAction,
  setAmenityAction,
  setStarGradeAction,
  updatePropertyAction,
  updateRoomTypeAction,
} from "./setup-actions";
import { hhmm, Outcome, rwf, SELECT, StepCard, useStep } from "./setup-ui";

/**
 * A stay's own setup steps (0117), the ones a hotel, lodge, guest house or tented camp owes its guests and a
 * venue does not: how to reach the desk, the check-in window and house rules as choices, and every room type's
 * beds, occupancy and prices. What they ask is what Booking.com, Expedia and Airbnb refuse to open a hotel
 * without, in a Rwandan host's words.
 */
type Open = Extract<SetupRead, { open: true }>;
type RoomTypeRow = ApiProperty["roomTypes"][number];

/** Every half hour of the day, which is how hotels state their times. */
const HALF_HOURS = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

function TimeSelect({
  label,
  value,
  onChange,
  emptyLabel,
  description,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** When set, the time may be left unsaid, under these words ("Any time", "Not set"). */
  emptyLabel?: string;
  description?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select className={SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {HALF_HOURS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {description ? <span className="text-xs font-normal text-muted">{description}</span> : null}
    </label>
  );
}

function ChoiceSelect<T extends string>({
  label,
  value,
  onChange,
  labels,
  placeholder = "Choose…",
}: {
  label: string;
  value: T | "";
  onChange: (next: T | "") => void;
  labels: Readonly<Record<T, string>>;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select className={SELECT} value={value} onChange={(e) => onChange(e.target.value as T | "")}>
        <option value="">{placeholder}</option>
        {(Object.keys(labels) as T[]).map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

const GRID = "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]";
const orNull = <T extends string>(v: T | "") => (v === "" ? null : v);

// ── 2. Front desk and contact ─────────────────────────────────────────────────────────────────────

export function DeskStep({ data, index }: { data: Open; index: number }) {
  const p = data.property;
  const step = useStep();
  const [phone, setPhone] = useState(p?.contactPhone ?? "");
  const [whatsapp, setWhatsapp] = useState(p?.whatsapp ?? "");
  const [email, setEmail] = useState(p?.contactEmail ?? "");
  const [desk, setDesk] = useState<FrontDesk | "">(p?.frontDesk ?? "");
  const [opens, setOpens] = useState(hhmm(p?.frontDeskOpens) || "07:00");
  const [closes, setCloses] = useState(hhmm(p?.frontDeskCloses) || "22:00");
  // Most Rwandan hotels speak at least these two; the owner unticks what is not true.
  const [languages, setLanguages] = useState<StaffLanguage[]>(p?.languages?.length ? p.languages : ["rw", "en"]);
  if (!p) return null;
  const done = !!p.frontDesk && !!p.languages?.length && !!p.contactPhone;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void step.run(() =>
      updatePropertyAction(data.workspaceId, p.id, {
        description: p.description ?? "",
        street: typeof p.address.street === "string" ? p.address.street : "",
        contactPhone: phone,
        contactEmail: email,
        policies: {
          whatsapp: whatsapp.trim() || null,
          frontDesk: orNull(desk),
          frontDeskOpens: desk === "limited" ? opens : null,
          frontDeskCloses: desk === "limited" ? closes : null,
          languages,
        },
      }),
    );
  };
  const toggle = (code: StaffLanguage, on: boolean) =>
    setLanguages((now) => (on ? [...new Set([...now, code])] : now.filter((c) => c !== code)));
  return (
    <StepCard
      id="desk"
      index={index}
      title="Front desk and contact"
      done={done}
      icon={<Persons />}
      lead="How guests and officers reach you, when the desk is open, and the languages your staff speak."
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className={GRID}>
          <TextField value={phone} onChange={setPhone} isRequired fullWidth>
            <Label>Reservations phone</Label>
            <Input type="tel" placeholder="078 123 4567" />
          </TextField>
          <TextField value={whatsapp} onChange={setWhatsapp} fullWidth>
            <Label>WhatsApp</Label>
            <Input type="tel" placeholder="078 123 4567" />
            <Description>Optional. Many guests write here first.</Description>
          </TextField>
          <TextField value={email} onChange={setEmail} fullWidth>
            <Label>Email</Label>
            <Input type="email" placeholder="reservations@example.com" />
          </TextField>
        </div>
        <div className={GRID}>
          <ChoiceSelect label="Front desk" value={desk} onChange={setDesk} labels={FRONT_DESK_LABEL} />
          {desk === "limited" ? (
            <>
              <TimeSelect label="Opens" value={opens} onChange={setOpens} />
              <TimeSelect label="Closes" value={closes} onChange={setCloses} />
            </>
          ) : null}
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-sm font-medium">Languages your staff speak</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.keys(STAFF_LANGUAGE_LABEL) as StaffLanguage[]).map((code) => (
              <Checkbox key={code} isSelected={languages.includes(code)} onChange={(on) => toggle(code, on)}>
                <Checkbox.Content className="flex items-center gap-2">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="text-sm">{STAFF_LANGUAGE_LABEL[code]}</span>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
        </fieldset>
        <Button
          type="submit"
          variant={done ? "secondary" : "primary"}
          className="self-start"
          isDisabled={step.busy || !phone.trim() || !desk || languages.length === 0}
        >
          {step.busy ? "Saving…" : "Save"}
        </Button>
        <Outcome result={step.result} okText="Saved." />
      </form>
    </StepCard>
  );
}

// ── 3. Check-in and house rules ───────────────────────────────────────────────────────────────────

const AGES = [16, 18, 21, 25] as const;

export function RulesStep({ data, index }: { data: Open; index: number }) {
  const p = data.property;
  const step = useStep();
  const [checkIn, setCheckIn] = useState(hhmm(p?.checkInTime) || "14:00");
  const [checkInUntil, setCheckInUntil] = useState(hhmm(p?.checkInUntil));
  const [checkOut, setCheckOut] = useState(hhmm(p?.checkOutTime) || "11:00");
  const [age, setAge] = useState(String(p?.minCheckInAge ?? 18));
  const [children, setChildren] = useState<ChildrenPolicy | "">(p?.childrenPolicy ?? "welcome");
  const [pets, setPets] = useState<PetsPolicy | "">(p?.petsPolicy ?? "no");
  const [smoking, setSmoking] = useState<SmokingPolicy | "">(p?.smokingPolicy ?? "no");
  const [parties, setParties] = useState<PartiesPolicy | "">(p?.partiesPolicy ?? "no");
  const [quietFrom, setQuietFrom] = useState(hhmm(p?.quietFrom));
  const [quietUntil, setQuietUntil] = useState(hhmm(p?.quietUntil));
  const [internet, setInternet] = useState<InternetAccess | "">(p?.internet ?? "");
  const [parking, setParking] = useState<ParkingOption | "">(p?.parking ?? "");
  const [other, setOther] = useState(p?.houseRules ?? "");
  const [cribs, setCribs] = useState<CribPolicy | "">(p?.cribs ?? "");
  const [cribPrice, setCribPrice] = useState(p?.cribPriceRwf != null ? String(p.cribPriceRwf) : "");
  if (!p) return null;
  const done = !!p.checkInTime && !!p.checkOutTime;
  const quietHalf = (quietFrom === "") !== (quietUntil === "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void step.run(() =>
      updatePropertyAction(data.workspaceId, p.id, {
        description: p.description ?? "",
        street: typeof p.address.street === "string" ? p.address.street : "",
        checkInTime: checkIn,
        checkOutTime: checkOut,
        houseRules: other,
        policies: {
          checkInUntil: checkInUntil || null,
          minCheckInAge: Number(age),
          childrenPolicy: orNull(children),
          petsPolicy: orNull(pets),
          smokingPolicy: orNull(smoking),
          partiesPolicy: orNull(parties),
          quietFrom: quietFrom || null,
          quietUntil: quietUntil || null,
          internet: orNull(internet),
          parking: orNull(parking),
          cribs: orNull(cribs),
          cribPriceRwf: cribs === "charged" ? Number(cribPrice.replace(/\D/g, "")) || null : null,
        },
      }),
    );
  };
  return (
    <StepCard
      id="rules"
      index={index}
      title="Check-in and house rules"
      done={done}
      icon={<Clock />}
      lead="What guests agree to when they book. Each is a choice, so the guest page and the front desk read the same thing."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className={GRID}>
          <TimeSelect label="Check-in from" value={checkIn} onChange={setCheckIn} />
          <TimeSelect
            label="Check-in until"
            value={checkInUntil}
            onChange={setCheckInUntil}
            emptyLabel="Any time"
            description="The latest a guest can arrive and still check in."
          />
          <TimeSelect label="Check-out by" value={checkOut} onChange={setCheckOut} />
          <label className="flex flex-col gap-1 text-sm font-medium">
            Minimum age to check in
            <select className={SELECT} value={age} onChange={(e) => setAge(e.target.value)}>
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {a} years
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={GRID}>
          <ChoiceSelect label="Children" value={children} onChange={setChildren} labels={CHILDREN_POLICY_LABEL} />
          <ChoiceSelect label="Pets" value={pets} onChange={setPets} labels={PETS_POLICY_LABEL} />
          <ChoiceSelect label="Smoking" value={smoking} onChange={setSmoking} labels={SMOKING_POLICY_LABEL} />
          <ChoiceSelect
            label="Parties and events"
            value={parties}
            onChange={setParties}
            labels={PARTIES_POLICY_LABEL}
          />
        </div>
        <div className={GRID}>
          <TimeSelect label="Quiet hours from" value={quietFrom} onChange={setQuietFrom} emptyLabel="No quiet hours" />
          <TimeSelect
            label="Quiet hours until"
            value={quietUntil}
            onChange={setQuietUntil}
            emptyLabel="No quiet hours"
          />
          <ChoiceSelect label="Internet" value={internet} onChange={setInternet} labels={INTERNET_LABEL} />
          <ChoiceSelect label="Parking" value={parking} onChange={setParking} labels={PARKING_LABEL} />
        </div>
        <div className={GRID}>
          <ChoiceSelect label="Cribs for babies" value={cribs} onChange={setCribs} labels={CRIB_POLICY_LABEL} />
          {cribs === "charged" ? (
            <TextField value={cribPrice} onChange={setCribPrice} isRequired fullWidth>
              <Label>Crib price a night (RWF)</Label>
              <Input inputMode="numeric" placeholder="5000" className="tabular" />
            </TextField>
          ) : null}
        </div>
        <TextField value={other} onChange={setOther} fullWidth>
          <Label>Anything else guests should know</Label>
          <TextArea rows={2} placeholder="Visitors leave by 22:00. The gate closes at midnight." />
          <Description>
            Every guest shows an ID or passport at check-in; the law asks it, so it is said for you.
          </Description>
        </TextField>
        {quietHalf ? (
          <p className="m-0 text-[13px] text-danger">Give quiet hours both a start and an end, or neither.</p>
        ) : null}
        <Button
          type="submit"
          variant={done ? "secondary" : "primary"}
          className="self-start"
          isDisabled={step.busy || quietHalf}
        >
          {step.busy ? "Saving…" : "Save"}
        </Button>
        <Outcome result={step.result} okText="Saved." />
      </form>
    </StepCard>
  );
}

// ── 4. Rooms and prices ───────────────────────────────────────────────────────────────────────────

const BED_TYPES = Object.keys(BED_TYPE_LABEL) as BedType[];

/** What a room usually holds, so choosing "Twin room" starts the form with two single beds. */
const STARTING_BEDS: Readonly<Record<RoomCategory, RoomBed[]>> = {
  single: [{ type: "single", count: 1 }],
  double: [{ type: "queen", count: 1 }],
  twin: [{ type: "single", count: 2 }],
  triple: [
    { type: "queen", count: 1 },
    { type: "single", count: 1 },
  ],
  family: [
    { type: "queen", count: 1 },
    { type: "single", count: 2 },
  ],
  suite: [{ type: "king", count: 1 }],
  studio: [{ type: "queen", count: 1 }],
  tent: [{ type: "double", count: 1 }],
  dorm_bed: [{ type: "bunk", count: 1 }],
};

function BedsEditor({ beds, onChange }: { beds: RoomBed[]; onChange: (next: RoomBed[]) => void }) {
  const unused = BED_TYPES.filter((t) => !beds.some((b) => b.type === t));
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium">Beds in each room</legend>
      {beds.map((bed, i) => (
        <div key={bed.type} className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`How many ${BED_TYPE_LABEL[bed.type]}`}
            className={`${SELECT} w-20 tabular`}
            inputMode="numeric"
            value={String(bed.count)}
            onChange={(e) => {
              const count = Number(e.target.value.replace(/\D/g, "")) || 0;
              onChange(beds.map((b, j) => (j === i ? { ...b, count } : b)));
            }}
          />
          <select
            aria-label="Bed type"
            className={`${SELECT} w-auto flex-1`}
            value={bed.type}
            onChange={(e) => onChange(beds.map((b, j) => (j === i ? { ...b, type: e.target.value as BedType } : b)))}
          >
            {[bed.type, ...unused].map((t) => (
              <option key={t} value={t}>
                {BED_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onPress={() => onChange(beds.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </div>
      ))}
      {unused.length ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onPress={() => onChange([...beds, { type: unused[0] as BedType, count: 1 }])}
        >
          Add a bed type
        </Button>
      ) : null}
    </fieldset>
  );
}

/** The form behind both "Add a room type" and editing one: the same questions, the same checks. */
function RoomForm({
  data,
  row,
  onSaved,
}: {
  data: Open;
  /** The room type being edited; absent when adding one. */
  row?: RoomTypeRow;
  onSaved?: () => void;
}) {
  const p = data.property;
  const words = data.words;
  const step = useStep();
  const [category, setCategory] = useState<RoomCategory | "">((row?.roomCategory as RoomCategory | null) ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [count, setCount] = useState("1");
  const [beds, setBeds] = useState<RoomBed[]>(row?.beds ?? []);
  const [adults, setAdults] = useState(String(row?.maxAdults ?? row?.maxGuests ?? 2));
  const [kids, setKids] = useState(String(row?.maxChildren ?? 0));
  const [size, setSize] = useState(row?.sizeM2 ? String(row.sizeM2) : "");
  const [bathroom, setBathroom] = useState<"private" | "shared">(row?.bathroom ?? "private");
  const [price, setPrice] = useState(row?.basePriceRwf != null ? String(row.basePriceRwf) : "");
  const [single, setSingle] = useState(row?.singleGuestPriceRwf != null ? String(row.singleGuestPriceRwf) : "");
  const [extraBeds, setExtraBeds] = useState(String(row?.extraBedsMax ?? 0));
  const [extraBedPrice, setExtraBedPrice] = useState(row?.extraBedPriceRwf != null ? String(row.extraBedPriceRwf) : "");
  if (!p) return null;

  const perRoom = words.priceBasis === "per_unit";
  const sleeps = bedsSleep(beds.filter((b) => b.count > 0));
  const adultsN = Number(adults) || 0;
  const kidsN = Number(kids) || 0;
  const problem =
    beds.filter((b) => b.count > 0).length === 0
      ? "Add the beds in the room."
      : adultsN < 1
        ? "A room takes at least one adult."
        : adultsN > sleeps
          ? `Those beds sleep ${sleeps}, fewer than ${adultsN} adults.`
          : single && price && Number(single.replace(/\D/g, "")) >= Number(price.replace(/\D/g, ""))
            ? "The price for one guest should be less than the room price."
            : null;

  const pick = (next: RoomCategory | "") => {
    setCategory(next);
    if (!next) return;
    if (!name.trim() || Object.values(ROOM_CATEGORY_LABEL).includes(name)) setName(ROOM_CATEGORY_LABEL[next]);
    if (beds.length === 0) setBeds(STARTING_BEDS[next]);
  };

  const details = (): RoomTypeDetailEdit => ({
    roomCategory: category || null,
    beds: beds.filter((b) => b.count > 0),
    maxAdults: adultsN,
    maxChildren: kidsN,
    sizeM2: size.trim() ? Number(size.replace(/\D/g, "")) : null,
    bathroom,
    singleGuestPriceRwf: perRoom && single.trim() ? Number(single.replace(/\D/g, "")) : null,
    extraBedsMax: Number(extraBeds),
    extraBedPriceRwf: Number(extraBeds) > 0 && extraBedPrice.trim() ? Number(extraBedPrice.replace(/\D/g, "")) : null,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await step.run(() =>
      row
        ? updateRoomTypeAction(data.workspaceId, row.id, {
            name,
            maxGuests: String(adultsN + kidsN),
            basePriceRwf: price,
            details: details(),
          })
        : addRoomTypeAction(data.workspaceId, p.id, {
            name,
            maxGuests: String(adultsN + kidsN),
            basePriceRwf: price,
            roomCount: count,
            priceBasis: words.priceBasis,
            details: details(),
          }),
    );
    if (ok && !row) {
      setCategory("");
      setName("");
      setBeds([]);
      setPrice("");
      setSingle("");
      setSize("");
    }
    if (ok) onSaved?.();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className={GRID}>
        <ChoiceSelect label="Kind of room" value={category} onChange={pick} labels={ROOM_CATEGORY_LABEL} />
        <TextField value={name} onChange={setName} isRequired fullWidth>
          <Label>Name guests see</Label>
          <Input placeholder="Deluxe double room with lake view" />
        </TextField>
        {row ? null : (
          <TextField value={count} onChange={setCount} isRequired fullWidth>
            <Label>{`How many ${words.unitPlural} like this`}</Label>
            <Input inputMode="numeric" className="tabular" />
          </TextField>
        )}
      </div>
      <BedsEditor beds={beds} onChange={setBeds} />
      <div className={GRID}>
        <TextField value={adults} onChange={setAdults} isRequired fullWidth>
          <Label>Adults, at most</Label>
          <Input inputMode="numeric" className="tabular" />
        </TextField>
        <TextField value={kids} onChange={setKids} fullWidth>
          <Label>Children, at most</Label>
          <Input inputMode="numeric" className="tabular" />
          <Description>Under 18, on top of the adults.</Description>
        </TextField>
        <TextField value={size} onChange={setSize} fullWidth>
          <Label>Size (m²)</Label>
          <Input inputMode="numeric" placeholder="20" className="tabular" />
        </TextField>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Bathroom
          <select
            className={SELECT}
            value={bathroom}
            onChange={(e) => setBathroom(e.target.value as "private" | "shared")}
          >
            <option value="private">Private bathroom</option>
            <option value="shared">Shared bathroom</option>
          </select>
        </label>
      </div>
      <div className={GRID}>
        <TextField value={price} onChange={setPrice} isRequired fullWidth>
          <Label>{perRoom ? "Price per night (RWF)" : `Price ${words.pricePeriod} (RWF)`}</Label>
          <Input inputMode="numeric" placeholder="60000" className="tabular" />
          <Description>
            {perRoom ? `For the whole ${words.unitSingular}, however many sleep in it.` : undefined}
          </Description>
        </TextField>
        {perRoom ? (
          <TextField value={single} onChange={setSingle} fullWidth>
            <Label>Price for one guest (RWF)</Label>
            <Input inputMode="numeric" placeholder="45000" className="tabular" />
            <Description>Optional. Left empty, one guest pays the room price.</Description>
          </TextField>
        ) : null}
      </div>
      <div className={GRID}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Extra beds it can take
          <select className={SELECT} value={extraBeds} onChange={(e) => setExtraBeds(e.target.value)}>
            <option value="0">None</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {Number(extraBeds) > 0 ? (
          <TextField value={extraBedPrice} onChange={setExtraBedPrice} fullWidth>
            <Label>Extra bed a night (RWF)</Label>
            <Input inputMode="numeric" placeholder="10000" className="tabular" />
            <Description>Arranged with the desk and paid at the property. Empty is free.</Description>
          </TextField>
        ) : null}
      </div>
      {problem && beds.length > 0 ? <p className="m-0 text-[13px] text-danger">{problem}</p> : null}
      <Button
        type="submit"
        variant={row ? "secondary" : "primary"}
        className="self-start"
        isDisabled={step.busy || name.trim().length < 2 || !price.trim() || problem !== null}
      >
        {step.busy ? "Saving…" : row ? "Save" : `Add ${words.unitSingular} type`}
      </Button>
      <Outcome result={step.result} okText={row ? "Saved." : "Added."} />
    </form>
  );
}

/** A room type's own photograph (0118): the first one filed under it, and a way to add one. */
function RoomPhoto({ data, row }: { data: Open; row: RoomTypeRow }) {
  const p = data.property;
  const step = useStep();
  const [key, setKey] = useState(0);
  const photo = p?.photos.find((ph) => ph.roomTypeId === row.id) ?? null;
  if (!p) return null;
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("caption", row.name);
    form.set("roomTypeId", row.id);
    await step.run(() => addPhotoAction(data.workspaceId, p.id, form));
    setKey((k) => k + 1);
  };
  return (
    <div className="flex items-center gap-3">
      {photo ? (
        // biome-ignore lint/performance/noImgElement: a short-lived signed URL, not a static asset
        <img src={photo.url} alt={row.name} className="size-14 shrink-0 rounded-lg bg-default object-cover" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-default text-[11px] text-muted">
          No photo
        </span>
      )}
      <label className="text-[13px] font-medium text-accent">
        {step.busy ? "Uploading…" : photo ? "Add another photo" : "Add a photo of this room"}
        <input
          key={key}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={step.busy}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {step.result && !step.result.ok ? <span className="text-[13px] text-danger">{step.result.error}</span> : null}
    </div>
  );
}

function RoomLine({ data, row }: { data: Open; row: RoomTypeRow }) {
  const [open, setOpen] = useState(false);
  const words = data.words;
  const missing = !(row.beds?.length && row.maxAdults != null);
  const facts = [
    row.beds?.length ? bedsLine(row.beds) : null,
    row.maxAdults != null
      ? `${row.maxAdults} ${row.maxAdults === 1 ? "adult" : "adults"}${row.maxChildren ? ` + ${row.maxChildren} ${row.maxChildren === 1 ? "child" : "children"}` : ""}`
      : null,
    row.sizeM2 ? `${row.sizeM2} m²` : null,
    `${row.sellableRoomCount} ${row.sellableRoomCount === 1 ? words.unitSingular : words.unitPlural}`,
  ].filter(Boolean);
  return (
    <li className="flex flex-col gap-2 border-t border-separator py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-[13px] text-muted">{facts.join(" · ")}</span>
          {missing ? (
            <span className="text-[13px] text-danger">Add its beds and the adults it takes before you publish.</span>
          ) : null}
          {!hasPhoto(data.property, row.id) ? (
            <span className="text-[13px] text-danger">Add a photograph of this room before you publish.</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted tabular">
            {row.basePriceRwf === null ? "No price yet" : `${rwf(row.basePriceRwf)} ${words.pricePeriod}`}
            {row.singleGuestPriceRwf != null ? ` · ${rwf(row.singleGuestPriceRwf)} for one` : ""}
          </span>
          <Button variant={missing ? "primary" : "ghost"} size="sm" onPress={() => setOpen((o) => !o)}>
            {open ? "Close" : "Edit"}
          </Button>
        </div>
      </div>
      <RoomPhoto data={data} row={row} />
      {open ? <RoomForm data={data} row={row} onSaved={() => setOpen(false)} /> : null}
    </li>
  );
}

export function StayRoomsStep({ data, index }: { data: Open; index: number }) {
  const p = data.property;
  const words = data.words;
  const types = p?.roomTypes.filter((t) => t.status === "active") ?? [];
  const done = data.steps.find((s) => s.key === "room_type")?.done ?? false;
  const [adding, setAdding] = useState(types.length === 0);
  return (
    <StepCard
      id="room_type"
      index={index}
      title={`${words.typePlural} and prices`}
      done={done}
      icon={<Key />}
      lead={`Each kind of ${words.unitSingular} you sell: its beds, who may sleep in it, and its price ${words.pricePeriod}, in Rwandan francs.`}
    >
      {types.length ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {types.map((t) => (
            <RoomLine key={t.id} data={data} row={t} />
          ))}
        </ul>
      ) : null}
      {!p ? (
        <p className="text-[13px] text-muted">Add the property first.</p>
      ) : adding ? (
        <RoomForm data={data} onSaved={() => setAdding(types.length === 0)} />
      ) : (
        <Button variant="secondary" className="self-start" onPress={() => setAdding(true)}>
          {`Add another ${words.unitSingular} type`}
        </Button>
      )}
    </StepCard>
  );
}

// ── 4. Facilities ─────────────────────────────────────────────────────────────────────────────────

/** The shared catalogue, grouped as it is stored, each ticked or not; a tick is saved as it is pressed. */
export function FacilitiesStep({ data, index }: { data: Open; index: number }) {
  const p = data.property;
  const [offered, setOffered] = useState<Set<string>>(
    () => new Set(data.amenities.filter((a) => a.offered).map((a) => a.code)),
  );
  const [error, setError] = useState<string | null>(null);
  if (!p) return null;
  const groups = new Map<string, ApiAmenity[]>();
  for (const a of data.amenities) {
    const key = a.category ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const toggle = async (code: string, on: boolean) => {
    setError(null);
    setOffered((now) => {
      const next = new Set(now);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
    const res = await setAmenityAction(data.workspaceId, p.id, code, on);
    if (!res.ok) {
      setError(res.error);
      setOffered((now) => {
        const next = new Set(now);
        if (on) next.delete(code);
        else next.add(code);
        return next;
      });
    }
  };
  return (
    <StepCard
      id="facilities"
      index={index}
      title="Facilities"
      done={offered.size > 0}
      icon={<ListCheck />}
      lead="What a stay includes, from Wi-Fi to a pool. Guests filter by these, so tick only what is there every day."
    >
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {[...groups.entries()].map(([category, items]) => (
          <fieldset key={category} className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">{category}</legend>
            {items.map((a) => (
              <Checkbox key={a.code} isSelected={offered.has(a.code)} onChange={(on) => void toggle(a.code, on)}>
                <Checkbox.Content className="flex items-center gap-2">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="text-sm">{a.label}</span>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </fieldset>
        ))}
      </div>
      {error ? <p className="m-0 text-[13px] text-danger">{error}</p> : null}
    </StepCard>
  );
}

// ── The star grade, on the property step ─────────────────────────────────────────────────────────

/**
 * The grade RDB gave under the EAC criteria (0118). The owner's word until an Injishi officer checks it
 * against the grading certificate; guests see stars only once it is confirmed.
 */
export function StarGradeField({ data }: { data: Open }) {
  const step = useStep();
  const [grade, setGrade] = useState(data.starGrade.grade ? String(data.starGrade.grade) : "");
  const said = data.starGrade.grade;
  const changed = grade !== (said ? String(said) : "");
  return (
    <div className="flex flex-col gap-2 border-t border-separator pt-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Official star grade
          <select className={`${SELECT} w-56`} value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Not graded</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {`${n} star${n === 1 ? "" : "s"}`}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          isDisabled={step.busy || !changed}
          onPress={() => void step.run(() => setStarGradeAction(data.workspaceId, grade))}
        >
          {step.busy ? "Saving…" : "Save grade"}
        </Button>
      </div>
      <p className="m-0 text-[13px] text-muted">
        {said === null
          ? "Graded by RDB? Say so here; an officer checks it against your grading certificate before guests see stars."
          : data.starGrade.verifiedAt
            ? `${said} stars, confirmed by Injishi. Guests see it on your page.`
            : `${said} stars, waiting for an officer to check it against your RDB grading certificate. Guests see no stars until then.`}
      </p>
      <Outcome result={step.result} okText="Saved. An officer checks it before guests see it." />
    </div>
  );
}
