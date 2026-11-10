"use client";

import { ArrowUpRightFromSquare, CircleCheck, Clock, House, Picture, Tag } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Description, Input, Label, TextArea, TextField } from "@heroui/react";
import { tidyPlaceName } from "@injishi/contracts";
import { LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { hasPhoto, type Place, type SetupRead } from "@/server/mutations/setup";
import { MapPinPicker } from "./MapPinPicker";
import { DeskStep, FacilitiesStep, RulesStep, StarGradeField, StayRoomsStep } from "./StaySetupSteps";
import {
  addPhotoAction,
  addRoomTypeAction,
  createPropertyAction,
  placesAction,
  publishAction,
  unpublishAction,
  updatePropertyAction,
} from "./setup-actions";
import { Outcome, rwf, SELECT, StepCard, useSetupWords, useStep } from "./setup-ui";

type Open = Extract<SetupRead, { open: true }>;

/** Where an unapproved registration stands, in the owner's words (RegistrationSummary statuses). */
const WAITING: Record<string, { chipKey: string; tone: "accent" | "warning" | "danger" | "default"; textKey: string }> = {
  pending_payment: {
    chipKey: "waitingPayment",
    tone: "warning",
    textKey: "feeNotPaid",
  },
  submitted: {
    chipKey: "reviewTin",
    tone: "accent",
    textKey: "paidTinCheck",
  },
  tin_verified: {
    chipKey: "reviewDocuments",
    tone: "accent",
    textKey: "officerReviewing",
  },
  field_verified: {
    chipKey: "reviewApproval",
    tone: "accent",
    textKey: "secondOfficer",
  },
  approved: {
    chipKey: "approvedOwner",
    tone: "accent",
    textKey: "approvedClaim",
  },
  rejected: {
    chipKey: "sentBack",
    tone: "danger",
    textKey: "fixAndResubmit",
  },
  suspended: { chipKey: "suspended", tone: "danger", textKey: "suspendedSupport" },
};

function PlacePicker({ provinces, onSector }: { provinces: Place[]; onSector: (id: string) => void }) {
  const t = useTranslations("setup");
  const [districts, setDistricts] = useState<Place[]>([]);
  const [sectors, setSectors] = useState<Place[]>([]);
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("province")}
        <select
          className={SELECT}
          defaultValue=""
          onChange={async (e) => {
            setSectors([]);
            onSector("");
            setDistricts(e.target.value ? await placesAction("districts", Number(e.target.value)) : []);
          }}
        >
          <option value="">{t("choose")}</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("district")}
        <select
          className={SELECT}
          defaultValue=""
          disabled={!districts.length}
          onChange={async (e) => {
            onSector("");
            setSectors(e.target.value ? await placesAction("sectors", Number(e.target.value)) : []);
          }}
        >
          <option value="">{t("choose")}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("sector")}
        <select
          className={SELECT}
          defaultValue=""
          disabled={!sectors.length}
          onChange={(e) => onSector(e.target.value)}
        >
          <option value="">{t("choose")}</option>
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
  const t = useTranslations("setup");
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
        {t("cell")}
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
          <option value="">{cells === null ? t("loading") : t("choose")}</option>
          {(cells ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("village")}
        <select
          className={SELECT}
          value={villageId}
          disabled={!villages.length}
          onChange={(e) => onVillage(e.target.value)}
        >
          <option value="">{t("choose")}</option>
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
  const t = useTranslations("setup");
  const p = data.property;
  const venue = data.foodVenue;
  const step = useStep();
  const [description, setDescription] = useState(p?.description ?? "");
  const [street, setStreet] = useState(typeof p?.address.street === "string" ? p.address.street : "");
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [villageId, setVillageId] = useState(p?.address.villageId ? String(p.address.villageId) : "");
  const [phone, setPhone] = useState(p?.contactPhone ?? "");
  const [email, setEmail] = useState(p?.contactEmail ?? "");
  const [directions, setDirections] = useState(p?.directions ?? "");
  const [mapPoint, setMapPoint] = useState(
    p?.latitude != null && p?.longitude != null ? `${p.latitude}, ${p.longitude}` : "",
  );

  if (!p) {
    const submit = (e: FormEvent) => {
      e.preventDefault();
      void step.run(() => createPropertyAction(data.workspaceId, { name, sectorId, street, description }));
    };
    return (
      <StepCard
        id="property"
        index={1}
        title={venue ? t("venueDetails") : t("propertyDetails")}
        done={false}
        icon={<House />}
        lead={
          venue
            ? t("venueWhere")
            : t("propertyWhere")
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextField value={name} onChange={setName} isRequired fullWidth>
            <Label>{venue ? t("venueName") : t("propertyName")}</Label>
            <Input placeholder={venue ? t("seenByCustomers") : t("seenByGuests")} />
          </TextField>
          <PlacePicker provinces={provinces} onSector={setSectorId} />
          <TextField value={street} onChange={setStreet} fullWidth>
            <Label>{t("street")}</Label>
            <Input placeholder="KG 11 Ave" />
          </TextField>
          <Button type="submit" className="self-start" isDisabled={step.busy || name.trim().length < 2 || !sectorId}>
            {step.busy ? t("add") : venue ? t("addVenue") : t("addProperty")}
          </Button>
          <Outcome result={step.result} okText={venue ? t("venueAdded") : t("propertyAdded")} />
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
        mapPoint,
        // A stay says these on their own steps (front desk and contact, check-in and house rules).
        ...(venue
          ? { contactPhone: phone, contactEmail: email }
          : { policies: { directions: directions.trim() || null } }),
      }),
    );
  };
  return (
    <StepCard
      id="property"
      index={1}
      title={venue ? t("venueDetails") : t("propertyLocation")}
      done
      icon={<House />}
      lead={
        venue
          ? t("createdVenue")
          : t("createdProperty")
      }
    >
      <dl className="m-0 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
        <div className="flex flex-col">
          <dt className="text-xs text-muted">{t("name")}</dt>
          <dd className="m-0 font-medium">{p.name}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted">{t("where")}</dt>
          <dd className="m-0 font-medium">{place || t("sectorOnRecord")}</dd>
        </div>
      </dl>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField value={description} onChange={setDescription} fullWidth>
          <Label>{t("description")}</Label>
          <TextArea rows={3} placeholder={t("descriptionPlaceholder")} />
          <Description>{venue ? t("venuePage") : t("propertyPage")}</Description>
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
            ? t("villageVenue")
            : t("villageProperty")}
        </p>
        {venue ? null : (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("pinMap")}</span>
            <MapPinPicker value={mapPoint} onChange={setMapPoint} />
            <span className="text-xs text-muted">
              {t("pinHint")}
            </span>
          </div>
        )}
        <TextField value={mapPoint} onChange={setMapPoint} fullWidth>
          <Label>{venue ? t("mapLocation") : t("pastePoint")}</Label>
          <Input placeholder="-1.9441, 30.0880" inputMode="decimal" className="tabular" />
          <Description>
            {venue
              ? t("venueMapHint")
              : t("propertyMapHint")}
          </Description>
        </TextField>
        {venue ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            <TextField value={phone} onChange={setPhone} fullWidth>
              <Label>{t("phone")}</Label>
              <Input type="tel" placeholder="078 123 4567" />
            </TextField>
            <TextField value={email} onChange={setEmail} fullWidth>
              <Label>{t("email")}</Label>
              <Input type="email" placeholder="frontdesk@example.com" />
            </TextField>
          </div>
        ) : null}
        <TextField value={street} onChange={setStreet} fullWidth>
          <Label>{venue ? t("street") : t("streetLandmark")}</Label>
          <Input placeholder={venue ? t("venueStreetPlaceholder") : t("propertyStreetPlaceholder")} />
        </TextField>
        {venue ? null : (
          <TextField value={directions} onChange={setDirections} fullWidth>
            <Label>{t("directions")}</Label>
            <TextArea
              rows={2}
              placeholder={t("directionsPlaceholder")}
            />
            <Description>{t("optionalGuest")}</Description>
          </TextField>
        )}
        <Button type="submit" variant="secondary" className="self-start" isDisabled={step.busy}>
          {step.busy ? t("saving") : t("save")}
        </Button>
      <Outcome result={step.result} okText={t("saved")} />
      </form>
      {venue ? null : <StarGradeField data={data} />}
    </StepCard>
  );
}

function RoomTypeStep({ data }: { data: Open }) {
  const t = useTranslations("setup");
  const p = data.property;
  const venue = data.foodVenue;
  const words = useSetupWords(data.words);
  const wholeUnit = words.priceBasis === "per_unit";
  const typeLabel = t("unitType", { unit: words.unitSingular });
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
      title={venue ? t("itemTitle") : t("roomTypeTitle", { unit: words.unitSingular })}
      done={done}
      icon={<Tag />}
      lead={
        venue
          ? t("venueItemsLead")
          : wholeUnit
            ? t("wholeUnitLead", { unit: words.unitSingular, period: words.pricePeriod })
            : t("roomPriceLead", { period: words.pricePeriod })
      }
    >
      {types.length ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {types.map((roomType) => (
            <li
              key={roomType.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-separator py-2 first:border-t-0"
            >
              <span className="font-medium">{roomType.name}</span>
              <span className="text-[13px] text-muted tabular">
                {roomType.basePriceRwf === null ? t("noPrice") : `${rwf(roomType.basePriceRwf)} ${words.pricePeriod}`}
                {venue
                  ? null
                  : ` · ${t("unitCount", {
                      count: roomType.sellableRoomCount,
                      unit: words.unitSingular,
                      units: words.unitPlural,
                    })}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {p ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
            <TextField value={name} onChange={setName} isRequired fullWidth>
              <Label>{venue ? t("item") : typeLabel}</Label>
              <Input
                placeholder={
                  venue
                    ? t("espressoPlaceholder")
                    : wholeUnit
                      ? t("wholeUnitPlaceholder", { unit: words.unitSingular })
                      : t("doubleRoom")
                }
              />
            </TextField>
            {venue ? null : (
              <TextField value={sleeps} onChange={setSleeps} isRequired fullWidth>
                <Label>{t("sleeps")}</Label>
                <Input inputMode="numeric" />
              </TextField>
            )}
            <TextField value={price} onChange={setPrice} isRequired fullWidth>
              <Label>
                {venue ? t("priceEach") : wholeUnit ? t("priceNight") : t("pricePerson")}
              </Label>
              <Input inputMode="numeric" placeholder={venue ? "2500" : "45000"} className="tabular" />
            </TextField>
            {venue ? null : (
              <TextField value={rooms} onChange={setRooms} isRequired fullWidth>
              <Label>{t("countUnits", { units: words.unitPlural })}</Label>
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
              ? t("add")
              : types.length
                ? venue
                  ? t("addAnotherItem")
                  : t("addAnotherType", { unit: words.unitSingular })
                : venue
                  ? t("addItem")
                  : t("addType", { unit: words.unitSingular })}
          </Button>
          <Outcome result={step.result} okText={venue ? t("itemAdded") : t("typeAdded", { type: typeLabel })} />
        </form>
      ) : (
        <p className="text-[13px] text-muted">{venue ? t("addVenueFirst") : t("addPropertyFirst")}</p>
      )}
    </StepCard>
  );
}

function PhotoStep({ data, index = 3 }: { data: Open; index?: number }) {
  const t = useTranslations("setup");
  const p = data.property;
  const venue = data.foodVenue;
  const step = useStep();
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const photos = p?.photos ?? [];
  // A stay shows every room type in a photograph of its own before it publishes (0118), so the photo
  // says which room it shows, starting with a room that still has none.
  const rooms = venue ? [] : (p?.roomTypes ?? []).filter((t) => t.status === "active");
  const bare = rooms.filter((t) => !hasPhoto(p ?? null, t.id));
  const [room, setRoom] = useState<string | null>(null);
  const shows = room ?? bare[0]?.id ?? "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!p || !file) return;
    const form = new FormData();
    form.set("file", file);
    const named = rooms.find((t) => t.id === shows);
    form.set("caption", caption || named?.name || "");
    if (named) form.set("roomTypeId", named.id);
    const ok = await step.run(() => addPhotoAction(data.workspaceId, p.id, form));
    if (ok) {
      setCaption("");
      setFile(null);
      setRoom(null);
      setInputKey((k) => k + 1);
    }
  };
  return (
    <StepCard
      id="photo"
      index={index}
      title={rooms.length ? t("photos") : t("photo")}
      done={data.counts.photos > 0 && bare.length === 0}
      icon={<Picture />}
      lead={
        venue
          ? t("photoVenueLead")
          : rooms.length
            ? t("photoRoomsLead")
            : t("photoPropertyLead")
      }
    >
      {rooms.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t("photoOfEveryRoom")}>
          {rooms.map((room) => {
            const ok = hasPhoto(p ?? null, room.id);
            return (
              <li key={room.id}>
                <Chip size="sm" variant="soft" color={ok ? "success" : "warning"}>
                  {ok ? <CircleCheck className="size-3" aria-hidden="true" /> : null}
                  <Chip.Label>
                    {room.name} · {ok ? t("hasPhoto") : t("needsPhoto")}
                  </Chip.Label>
                </Chip>
              </li>
            );
          })}
        </ul>
      ) : null}
      {photos.length ? (
        <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
          {photos.map((ph) => (
            <li key={ph.id} className="flex flex-col gap-1">
              {/* biome-ignore lint/performance/noImgElement: a short-lived signed URL, not a static asset */}
              <img
                src={ph.url}
                alt={ph.caption ?? (venue ? t("venuePhoto") : t("propertyPhoto"))}
                className="aspect-[4/3] w-full rounded-[10px] bg-default object-cover"
              />
              <span className="truncate text-[12px] text-muted">
                {ph.isCover ? `${t("cover")} · ` : ""}
                {ph.caption ?? t("noCaption")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {p ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("photograph")}
            <input
              key={inputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-default file:px-3 file:py-2 file:text-foreground"
            />
            <span className="text-xs font-normal text-muted">{t("imageLimit")}</span>
          </label>
          {rooms.length ? (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("whatItShows")}
              <select className={SELECT} value={shows} onChange={(e) => setRoom(e.target.value)}>
                <option value="">{t("placeItself")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                    {hasPhoto(p ?? null, room.id) ? "" : ` · ${t("needsPhoto")}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <TextField value={caption} onChange={setCaption} fullWidth>
            <Label>{t("caption")}</Label>
            <Input
              placeholder={
                venue ? t("venueCaption") : (rooms.find((t) => t.id === shows)?.name ?? t("propertyCaption"))
              }
            />
          </TextField>
          <Button
            type="submit"
            variant={photos.length ? "secondary" : "primary"}
            className="self-start"
            isDisabled={step.busy || !file}
          >
            {step.busy ? t("uploading") : t("addPhoto")}
          </Button>
          <Outcome result={step.result} okText={t("photoAdded")} />
        </form>
      ) : (
        <p className="text-[13px] text-muted">{venue ? t("addVenueFirst") : t("addPropertyFirst")}</p>
      )}
    </StepCard>
  );
}

function PublishStep({ data, webUrl, index = 4 }: { data: Open; webUrl: string; index?: number }) {
  const t = useTranslations("setup");
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
      index={index}
      title={t("publish")}
      done={live}
      icon={<ArrowUpRightFromSquare />}
      lead={
        venue
          ? t("venuePublishLead")
          : t("propertyPublishLead")
      }
    >
      {live ? (
        <Alert status="success" role="status">
          <Alert.Content>
            <Alert.Title>{t("live")}</Alert.Title>
            <Alert.Description>
              {venue ? t("customersFind", { name: p?.name ?? "" }) : t("guestsCanBook", { name: p?.name ?? "" })}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : data.blockers.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("beforePublish")}</span>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] text-muted">
            {data.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-muted">{t("allReady")}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {live ? null : (
          <Button onPress={() => void publish()} isDisabled={step.busy || !p || data.blockers.length > 0}>
            {step.busy ? t("publishing") : t("publish")}
          </Button>
        )}
        {live && slug ? (
          <LinkButton href={`${webUrl}/property/${slug}`} variant="secondary">
            {venue ? t("seeAsCustomers") : t("seeAsGuests")}
            <ArrowUpRightFromSquare className="size-4" />
          </LinkButton>
        ) : null}
        {live ? (
          // Closing for a season, or a listing that is wrong: the owner withdraws it here, keeping its address.
          <Button variant="ghost" onPress={() => void unpublish()} isDisabled={step.busy || !p}>
            {step.busy ? t("takingOff") : t("unpublish")}
          </Button>
        ) : null}
      </div>
      <Outcome
        result={step.result}
        okText={
          last === "unpublish" ? t("unpublished") : t("published")
        }
      />
    </StepCard>
  );
}

/** Where each checklist step is done: on this page, or a screen of its own. */
const STEP_HOME: Partial<Record<string, { href: string; labelKey: "above" | "roomRack" | "team" }>> = {
  property: { href: "#property", labelKey: "above" },
  contact: { href: "#property", labelKey: "above" },
  room_types: { href: "#room_type", labelKey: "above" },
  photos: { href: "#photo", labelKey: "above" },
  listing: { href: "#publish", labelKey: "above" },
  rooms: { href: "/room-rack", labelKey: "roomRack" },
  staff: { href: "/settings/team", labelKey: "team" },
};

/**
 * The whole checklist for this kind of business (`setupStepsFor`): a hotel runs departments, a villa does not,
 * a coffee shop numbers no rooms. Publishing needs only the four cards above; the rest is what running the
 * place well needs, done here or on its own screen.
 */
function KindChecklist({ data }: { data: Open }) {
  const t = useTranslations("setup");
  const left = data.checklist.filter((s) => !s.done).length;
  return (
    <Card render={(p) => <section {...p} />} aria-labelledby="checklist-h" className="gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="checklist-h" className="text-[15px] leading-[22px] font-semibold">
          {t("checklist", { kind: data.kindLabel })}
        </h2>
        <span className="text-[13px] text-muted tabular">
          {left === 0 ? t("allDone") : t("doneCount", { done: data.checklist.length - left, total: data.checklist.length })}
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
                  {s.done ? <CircleCheck className="size-4 text-success" aria-label={t("done")} /> : null}
                  {s.title}
                  <Chip size="sm" variant="soft" color={s.required ? "accent" : "default"}>
                    {s.required ? t("required") : t("recommended")}
                  </Chip>
                </span>
                <span className="text-[13px] text-muted">{s.description}</span>
              </div>
              {home && !s.done ? (
                <a href={home.href} className="text-[13px] font-medium text-accent underline-offset-2 hover:underline">
                  {t(home.labelKey)}
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Where the booking money goes: the host's payout account, on its own page (0116). */
function GettingPaidCard({ data }: { data: Open }) {
  const t = useTranslations("setup");
  return (
    <Card render={(p) => <section {...p} />} aria-labelledby="paid-h" className="gap-2 p-5">
      <h2 id="paid-h" className="text-[15px] leading-[22px] font-semibold">
        {t("gettingPaid")}
      </h2>
      <p className="m-0 text-sm text-muted">
        {data.approved
          ? t("paidApproved")
          : t("paidPending")}
      </p>
      {data.approved ? (
        <LinkButton href={`/w/${data.workspaceId}/getting-paid`} variant="secondary" className="self-start">
          {t("setUpGettingPaid")}
        </LinkButton>
      ) : null}
    </Card>
  );
}

/** One business, several branches: pick which one this page sets up. */
function PropertySwitcher({ data }: { data: Open }) {
  const t = useTranslations("setup");
  if (data.properties.length < 2) return null;
  return (
    <label className="flex max-w-[420px] flex-col gap-1 text-sm font-medium">
      {t("settingUp")}
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
  const t = useTranslations("setup");
  const where = WAITING[status ?? ""];
  return (
    <Alert status="accent" role="status">
      <Alert.Content>
        <Alert.Title className="flex flex-wrap items-center gap-2">
          {t("registrationInReview")}
          {where ? (
            <Chip size="sm" variant="soft" color={where.tone}>
              {t(where.chipKey)}
            </Chip>
          ) : null}
        </Alert.Title>
        <Alert.Description>
          {where ? `${t(where.textKey)} ` : ""}{t("reviewLead")}
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
  const t = useTranslations("setup");
  if (!data.open) {
    const where = WAITING[data.status ?? ""] ?? {
      chipKey: "notOpen",
      tone: "default" as const,
      textKey: "notApproved",
    };
    return (
      <PageContent>
        <PageHeader eyebrow={`${data.businessName} · ${t("setupSuffix")}`} title={t("title")} />
        <Card render={(p) => <section {...p} />} aria-labelledby="closed-h" className="gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="size-5 text-muted" aria-hidden="true" />
            <h2 id="closed-h" className="text-[15px] leading-[22px] font-semibold">
              {t("closedTitle")}
            </h2>
            <Chip size="sm" variant="soft" color={where.tone}>
              {t(where.chipKey)}
            </Chip>
          </div>
          <p className="text-sm text-muted">{t(where.textKey)}</p>
          <p className="text-sm text-muted">
            {t("closedLead")}
          </p>
          <LinkButton href={`${webUrl}/register`} variant="secondary" className="self-start">
            {t("seeRegistration")}
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
        eyebrow={`${data.businessName} · ${t("setupSuffix")}`}
        title={venue ? t("titleVenue") : t("titleProperty")}
        description={
          data.published
            ? venue
              ? t("venueLive")
              : t("propertyLive")
            : venue
              ? t("venueSteps")
              : t("propertySteps")
        }
      />
      {!data.approved ? <ReviewNotice status={data.status} /> : null}
      <PropertySwitcher data={data} />
      <section aria-label={t("progress")} className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium tabular">
          {t("doneCount", { done, total: data.steps.length })}
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
        {venue ? (
          <>
            <RoomTypeStep data={data} />
            <PhotoStep data={data} />
            <PublishStep data={data} webUrl={webUrl} />
          </>
        ) : (
          <>
            <DeskStep data={data} index={2} />
            <RulesStep data={data} index={3} />
            <FacilitiesStep data={data} index={4} />
            <StayRoomsStep data={data} index={5} />
            <PhotoStep data={data} index={6} />
            <PublishStep data={data} webUrl={webUrl} index={7} />
          </>
        )}
        <KindChecklist data={data} />
        <GettingPaidCard data={data} />
      </div>
    </PageContent>
  );
}
