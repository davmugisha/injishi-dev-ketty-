"use client";

import {
  ArrowShapeTurnUpRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flag,
  Flame,
  Gift,
  Heart,
  HeartFill,
  LayoutCells,
  MapPin,
  SealCheck,
  ShieldCheck,
  StarFill,
  TriangleExclamation,
  Vault,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  Chip,
  Label,
  ProgressBar,
  Radio,
  RadioGroup,
  Switch,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { RadioButtonGroup, Timeline } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { screenHref } from "@injishi/data";
import type { MarketProperty, MarketReview, MarketRoom, ReportReason } from "@injishi/data/fixtures/market";
import { stock } from "@injishi/data/media";
import { GateChip, Icon, KeyValueList, LinkButton, Photo, StatusDot } from "@injishi/ui";
import { useState, useTransition } from "react";
import { reportListingAction, setSavedBySlugAction } from "./actions";
import { dayNumber, fmtDay, isoDay, plural, propertyHref, rwf, shortRange, weekday } from "./format";
import { MarketFooter, MarketHeader, MarketMain, type MarketVisitor } from "./MarketChrome";
import { LISTING_REPORT_REASONS } from "./report-reasons";
import { Stars } from "./stars";

export type PropertyPanel = "none" | "dates" | "guests";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const HEADS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const GALLERY_RADIUS = ["rounded-[6px]", "rounded-[6px_20px_6px_6px]", "rounded-[6px]", "rounded-[6px_6px_20px_6px]"];

type PlanId = "flex" | "saver";

/** Property page (artifact: MarketProperty.dc.html). `?panel=` opens dates or guests. */
export function MarketPropertyView({
  visitor,
  property,
  rooms,
  reviews,
  initialPanel,
}: {
  visitor: MarketVisitor | null;
  property: MarketProperty;
  rooms: MarketRoom[];
  reviews: MarketReview[];
  /** Why a review is reported. Unused while reporting a review is not available (reviews are not on the API). */
  reasons: ReportReason[];
  initialPanel: PropertyPanel;
}) {
  const today = dayNumber(property.bookable.from);
  const origin = ymIndex(property.bookable.from);
  const maxOff = ymIndex(property.bookable.to) - origin;
  const [roomId, setRoomId] = useState(property.stay.room);
  const [plan, setPlan] = useState<PlanId>("flex");
  const [pkg, setPkg] = useState(false);
  const [inD, setInD] = useState<number | null>(dayNumber(property.stay.checkIn));
  const [outD, setOutD] = useState<number | null>(dayNumber(property.stay.checkOut));
  const [monthOff, setMonthOff] = useState(0);
  const [adults, setAdults] = useState(property.stay.adults);
  const [kids, setKids] = useState(property.stay.children);
  const [panel, setPanel] = useState<"dates" | "guests" | null>(initialPanel === "none" ? null : initialPanel);
  const [saved, setSaved] = useState(Boolean(property.savedTo));
  const [saving, startSaving] = useTransition();
  /** The heart saves to (or removes from) the signed-in person's lists; a refusal is shown. */
  /** Saving and reporting need an account: sign in and come back to this property, not a default one. */
  const signInHere = () =>
    window.location.assign(`${screenHref("SignIn")}?next=${encodeURIComponent(propertyHref(property.id))}`);
  const toggleSaved = () =>
    visitor
      ? startSaving(async () => {
          const result = await setSavedBySlugAction(property.id, !saved);
          if (result.ok) setSaved((v) => !v);
          else toast.danger(result.error);
        })
      : signInHere();
  /** "Report this listing": the open form, the reason picked, and the support ticket it became. */
  const [listingForm, setListingForm] = useState(false);
  const [listingReason, setListingReason] = useState<string>(LISTING_REPORT_REASONS[0].id);
  const [listingDetail, setListingDetail] = useState("");
  const [listingTicket, setListingTicket] = useState<string | null>(null);
  const [reporting, startReporting] = useTransition();
  const sendListingReport = () => {
    if (!visitor) return signInHere();
    startReporting(async () => {
      const result = await reportListingAction(property.id, listingReason, listingDetail);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setListingTicket(result.value);
      setListingForm(false);
      setListingDetail("");
    });
  };

  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const guests = adults + kids;
  const guestStr = plural(adults, "adult", "adults") + (kids ? `, ${plural(kids, "child", "children")}` : "");
  const hasNights = inD !== null && outD !== null && outD > inD;
  const nights = hasNights && inD !== null && outD !== null ? outD - inD : 0;
  const nightsStr = plural(nights, "night", "nights");
  const blockedOf = (r: MarketRoom) => r.soldOut.map(dayNumber);
  const soldOn = (r: MarketRoom) =>
    hasNights && inD !== null && outD !== null ? blockedOf(r).find((b) => b >= inD && b < outD) : undefined;

  const sold = room ? soldOn(room) : undefined;
  const fits = room ? guests <= room.sleeps : true;
  const alertOn = Boolean(hasNights && room && (sold !== undefined || !fits));
  const request = room?.booking === "request";
  const effIn = inD ?? dayNumber(property.stay.checkIn);
  // A policy with no full-refund step (fullRefundDays -1) offers no free cancellation, whatever the dates.
  const hasFullRefund = property.cancellation.fullRefundDays >= 0;
  const deadline = effIn - Math.max(0, property.cancellation.fullRefundDays);
  const freeOk = hasFullRefund && deadline >= today;
  // A room's rate is per guest per night (the booking service prices a stay per person), so the party multiplies it.
  const partyRate = (r: MarketRoom) => r.price * Math.max(1, guests);
  const base = (room ? partyRate(room) : 0) * (nights || 1);
  /** The Non-refundable plan exists only where the API offers a discount for it (an eligible room). */
  const saverOffered = property.saverDiscount > 0;
  const saverPct = Math.round(property.saverDiscount * 100);
  const saver = Math.round(base * (1 - property.saverDiscount));
  const isFri = inD !== null && weekday(inD) === property.package.weekday;
  const pkgAvail = Boolean(
    room && room.id === property.package.room && plan === "flex" && isFri && nights === property.package.nights,
  );
  const pkgOn = pkg && pkgAvail;
  let total = plan === "saver" ? saver : base;
  if (pkgOn) total += property.package.price;

  const inBlocked = inD !== null && room ? blockedOf(room).includes(inD) : false;
  const choosingOut = inD !== null && outD === null && !inBlocked;
  const maxOut = (() => {
    if (!choosingOut || inD === null || !room) return null;
    const next = blockedOf(room)
      .filter((b) => b > inD)
      .sort((a, b) => a - b)[0];
    return next ?? inD + 30;
  })();

  // The checkout books exactly what is chosen here: the room, the nights, the party and the plan.
  const checkoutHref =
    room && inD !== null && outD !== null
      ? `${screenHref("MarketCheckout")}?${new URLSearchParams({
          room: room.id,
          in: isoDay(inD),
          out: isoDay(outD),
          adults: String(adults),
          children: String(kids),
          plan: plan === "saver" && saverOffered ? "saver" : "flex",
        }).toString()}`
      : screenHref("MarketCheckout");
  const ctaLink = Boolean(hasNights && !alertOn && room);
  const ctaText = request ? "Request to book" : "Reserve";
  const ctaNote = !hasNights
    ? "Prices shown per night"
    : request
      ? "Held until the hotel replies, refunded if declined"
      : "You won’t be charged yet";
  const family = rooms.find((r) => r.sleeps === Math.max(...rooms.map((r) => r.sleeps)));
  const capNote = room
    ? `${room.name} sleeps ${room.sleeps}${fits || !family ? "" : ` · ${family.name} sleeps ${family.sleeps}`}`
    : "";

  const lines: { label: string; value: string; tone?: "success" }[] = [
    { label: `${rwf(room?.price ?? 0)} × ${plural(guests, "guest", "guests")} × ${nightsStr}`, value: rwf(base) },
  ];
  if (plan === "saver")
    lines.push({ label: "Non-refundable discount", value: `− ${rwf(base - saver)}`, tone: "success" });
  if (pkgOn) lines.push({ label: "Boat trip + dinner for 2", value: rwf(property.package.price) });

  const tiers = [
    ...(hasFullRefund
      ? [
          {
            title: `Before ${fmtDay(deadline)}, ${property.cancellation.cutoff}`,
            detail: "Full refund",
            status: "success" as const,
          },
        ]
      : []),
    {
      title: `Before ${fmtDay(effIn)}, ${property.cancellation.cutoff}`,
      detail: property.cancellation.partialRefund,
      status: "warning" as const,
    },
    { title: "Later, or no-show", detail: "No refund", status: "danger" as const },
  ];

  const pickDay = (n: number, asOut: boolean) => {
    if (asOut) setOutD(n);
    else {
      setInD(n);
      setOutD(null);
    }
  };

  // A listed property with no room or unit on the marketplace yet gets a plain line, never a blank page.
  if (!room)
    return (
      <>
        <MarketHeader width="regular" visitor={visitor} returnTo={propertyHref(property.id)} current="stays" />
        <MarketMain width="regular" className="gap-[22px] pt-5">
          <h1 className="text-[30px] leading-[38px] font-semibold tracking-[-0.02em]">{property.name}</h1>
          <p className="text-sm text-muted">No room or unit is listed for booking here yet.</p>
        </MarketMain>
      </>
    );

  return (
    <>
      <MarketHeader
        width="regular"
        visitor={visitor}
        returnTo={propertyHref(property.id)}
        current="stays"
        actions={
          <LinkButton href={screenHref("PublicHost")} variant="ghost" size="sm" className="hidden sm:inline-flex">
            List your property
          </LinkButton>
        }
      />
      <MarketMain width="regular" className="gap-[22px] pt-5">
        <nav aria-label="Breadcrumb">
          <Breadcrumbs separator="›" className="text-[13px]">
            <Breadcrumbs.Item href={screenHref("MarketExplore")} className="text-muted">
              Stays
            </Breadcrumbs.Item>
            <Breadcrumbs.Item href={screenHref("MarketExplore")} className="text-muted">
              {property.area}
            </Breadcrumbs.Item>
            <Breadcrumbs.Item>{property.name}</Breadcrumbs.Item>
          </Breadcrumbs>
        </nav>

        <section className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex min-w-[520px] flex-[1_1_520px] flex-col gap-2">
            <h1 className="text-[30px] leading-[38px] font-semibold tracking-[-0.02em]">{property.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <StarFill className="size-4 text-warning" aria-hidden="true" />
                <span className="font-semibold tabular">{property.rating.toFixed(1)}</span>
                <span className="text-muted">· {property.reviewCount} verified reviews</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted">
                <MapPin className="size-4" aria-hidden="true" />
                {property.location}
              </span>
              {/* Only when the API records the business as verified (business.verified is "" otherwise). */}
              {property.business.verified ? (
                <Chip size="sm" variant="soft" color="success">
                  <SealCheck className="size-3" />
                  <Chip.Label>Verified business</Chip.Label>
                </Chip>
              ) : null}
              <Chip size="sm" variant="soft">
                <Chip.Label>{property.kind}</Chip.Label>
              </Chip>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" aria-pressed={saved} isDisabled={saving} onPress={toggleSaved}>
              {saved ? <HeartFill className="size-4 text-danger" /> : <Heart className="size-4" />}
              {saved ? (property.savedTo ? `Saved to ${property.savedTo}` : "Saved") : "Save"}
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onPress={() =>
                navigator.clipboard.writeText(window.location.href).then(
                  () => toast.success("Link copied"),
                  () => toast.warning("The link could not be copied. Copy it from the address bar."),
                )
              }
            >
              <ArrowShapeTurnUpRight className="size-4" />
              Share
            </Button>
          </div>
        </section>

        <section aria-label="Photos" className="relative grid grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-2">
          <PhotoTile
            image={property.cover.photo}
            caption={property.cover.caption}
            className="row-span-2 h-[288px] rounded-[20px_6px_6px_20px]"
          />
          {property.gallery.map((g, i) => (
            <PhotoTile
              key={g.caption}
              image={g.photo}
              caption={g.caption}
              className={`h-[140px] ${GALLERY_RADIUS[i] ?? "rounded-[6px]"}`}
            />
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="absolute right-3 bottom-3"
            onPress={() => toast.warning("A full-size photo viewer is not available yet.")}
          >
            <LayoutCells className="size-4" />
            All {property.photoCount} photos
          </Button>
        </section>

        <div className="mt-2 flex flex-wrap items-start gap-x-12 gap-y-8">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-9">
            <section className="flex flex-col gap-3.5" aria-labelledby="about-h">
              <h2 id="about-h" className="text-[17px] font-semibold">
                About this stay
              </h2>
              <p className="max-w-[680px] text-sm leading-[22px]">{property.about}</p>
              <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
                {property.highlights.map((h) => (
                  <Card key={h.id} variant="secondary" className="flex-row items-center p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent-soft-foreground">
                      <Icon name={h.icon} className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold">{h.title}</span>
                      <span className="text-[13px] text-muted">{h.desc}</span>
                    </span>
                  </Card>
                ))}
              </div>
              <div role="group" aria-label="Amenities" className="flex flex-wrap gap-2">
                {property.amenities.map((a) => (
                  <Chip key={a.id} size="sm" variant="soft">
                    <Icon name={a.icon} className="size-3" />
                    <Chip.Label>{a.label}</Chip.Label>
                  </Chip>
                ))}
              </div>
            </section>

            <section id="rooms" className="flex scroll-mt-6 flex-col gap-3.5" aria-labelledby="rooms-h">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="flex min-w-[300px] flex-[1_1_300px] flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 id="rooms-h" className="text-[17px] font-semibold">
                      Choose your room
                    </h2>
                    <Chip size="sm" variant="soft" color="success">
                      <StatusDot tone="success" />
                      <Chip.Label>Live availability</Chip.Label>
                    </Chip>
                  </div>
                  <span className="text-[13px] text-muted">
                    {hasNights && inD !== null && outD !== null
                      ? `${fmtDay(inD)} – ${fmtDay(outD)} · ${nightsStr} · ${guestStr}`
                      : "Add dates for exact prices"}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onPress={() => setPanel("dates")}>
                  <Calendar className="size-4" />
                  {hasNights ? "Edit dates" : "Add dates"}
                </Button>
              </div>
              <RadioButtonGroup
                aria-label="Room"
                value={room.id}
                onChange={(v) => {
                  if (!v) return;
                  const next = rooms.find((r) => r.id === v);
                  if (!next) return;
                  const off = soldOn(next) !== undefined || guests > next.sleeps;
                  if (off) return;
                  setRoomId(next.id);
                  if (next.id !== property.package.room) setPkg(false);
                }}
                className="flex flex-col gap-2.5"
              >
                {rooms.map((r) => {
                  const isSold = soldOn(r);
                  const roomFits = guests <= r.sleeps;
                  const off = isSold !== undefined || !roomFits;
                  const req = r.booking === "request";
                  return (
                    <RadioButtonGroup.Item
                      key={r.id}
                      value={r.id}
                      isDisabled={off}
                      className="flex-row flex-wrap items-center gap-x-4 gap-y-3 rounded-[20px] py-3 pr-4 pl-3 text-left"
                    >
                      <span className="relative h-[90px] w-[120px] shrink-0 overflow-hidden rounded-[14px] bg-surface-secondary">
                        <Photo image={stock[r.photo]} alt="" fill sizes="120px" />
                      </span>
                      <span className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold">{r.name}</span>
                          {!off && r.left === 1 ? (
                            <Chip size="sm" variant="soft" color="warning">
                              <Chip.Label>Only 1 left</Chip.Label>
                            </Chip>
                          ) : null}
                        </span>
                        <span className="text-[13px] text-muted">
                          {r.bed} · {r.size} · Sleeps {r.sleeps} · {r.feature}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            roomFits
                              ? req
                                ? "text-muted"
                                : "text-accent-soft-foreground"
                              : "text-warning-soft-foreground"
                          }`}
                        >
                          <Icon name={roomFits ? (req ? "Clock" : "Thunderbolt") : "Persons"} className="size-3.5" />
                          {roomFits
                            ? req
                              ? `Request to book · reply in ${r.reply}`
                              : "Instant confirmation"
                            : `Too small for ${plural(guests, "guest", "guests")}`}
                        </span>
                      </span>
                      <span className="ml-auto flex items-center gap-4">
                        <span className="flex flex-col items-end gap-0.5">
                          <span
                            className={`text-base font-semibold tabular ${isSold !== undefined ? "text-muted" : ""}`}
                          >
                            {isSold !== undefined ? "Sold out" : rwf(partyRate(r) * (nights || 1))}
                          </span>
                          <span className="text-xs text-muted tabular">
                            {isSold !== undefined
                              ? `on ${fmtDay(isSold)}`
                              : hasNights
                                ? `${rwf(r.price)} × ${plural(guests, "guest", "guests")} × ${nightsStr}`
                                : `per night · ${rwf(r.price)} a guest`}
                          </span>
                        </span>
                        <RadioButtonGroup.Indicator />
                      </span>
                    </RadioButtonGroup.Item>
                  );
                })}
              </RadioButtonGroup>
            </section>

            <section className="flex flex-col gap-3.5" aria-labelledby="pol-h">
              <h2 id="pol-h" className="text-[17px] font-semibold">
                Things to know
              </h2>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
                <Card variant="secondary" className="gap-3 p-[18px]">
                  <h3 className="text-sm font-semibold">Cancellation</h3>
                  <Timeline size="sm" density="compact">
                    {tiers.map((t) => (
                      <Timeline.Item key={t.title} status={t.status}>
                        <Timeline.Rail>
                          <Timeline.Marker />
                          <Timeline.Connector />
                        </Timeline.Rail>
                        <Timeline.Content className="flex flex-col pb-1">
                          <span className="font-medium">{t.title}</span>
                          <span className="text-xs leading-4 text-muted">{t.detail}</span>
                        </Timeline.Content>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                  <span className="text-xs text-muted">{property.cancellation.nonRefundableNote}</span>
                </Card>
                <Card variant="secondary" className="gap-3 p-[18px]">
                  <h3 className="text-sm font-semibold">House rules</h3>
                  <KeyValueList items={property.houseRules.map((h) => ({ label: h.label, value: h.value }))} />
                </Card>
              </div>
            </section>

            <section className="flex flex-col gap-3.5" aria-labelledby="rev-h">
              <h2 id="rev-h" className="text-[17px] font-semibold">
                Guest reviews
              </h2>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex min-w-[170px] flex-col gap-1.5">
                  <span className="text-[36px] leading-10 font-semibold tabular">{property.rating.toFixed(1)}</span>
                  <Stars value={property.rating} size="md" label={`Average ${property.rating.toFixed(1)} out of 5`} />
                  <span className="text-xs text-muted">{property.reviewCount} reviews from completed stays</span>
                </div>
                <div className="grid min-w-[300px] flex-[1_1_300px] grid-cols-2 gap-x-5 gap-y-2.5">
                  {property.scores.map((sc) => (
                    <div key={sc.label} className="flex flex-col gap-1.5">
                      <span className="flex items-center justify-between text-[13px]">
                        <span>{sc.label}</span>
                        <span className="font-semibold tabular">{sc.value.toFixed(1)}</span>
                      </span>
                      <ProgressBar value={Math.round(sc.value * 20)} size="sm" aria-label={sc.label}>
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                    </div>
                  ))}
                </div>
              </div>
              <p className="flex gap-1.5 text-xs leading-[17px] text-muted">
                <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {property.reviewNote}
              </p>
              {reviews.length ? (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Chip size="sm" variant="soft" color="warning">
                    <Chip.Label>Sample reviews</Chip.Label>
                  </Chip>
                  Guest reviews are not served yet. The reviews below are sample data, not reviews from guests of{" "}
                  {property.name}.
                </p>
              ) : null}
              <div className="grid items-start gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
                {reviews.map((rv) => {
                  return (
                    <Card
                      key={rv.id}
                      render={(p) => <article {...p} />}
                      aria-label={`Sample review by ${rv.name}`}
                      className="gap-2.5 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" variant="soft">
                          <Avatar.Fallback>{rv.initials}</Avatar.Fallback>
                        </Avatar>
                        <div className="flex flex-1 flex-col">
                          <span className="font-semibold">
                            {rv.name} <span className="font-normal text-muted">· {rv.from}</span>
                          </span>
                          <span className="text-xs text-muted">{rv.stay}</span>
                        </div>
                        <Stars value={rv.score} label={`Rated ${rv.score} out of 5`} />
                      </div>
                      <p className="text-sm leading-[21px]">{rv.text}</p>
                      <Card variant="secondary" className="gap-1 px-3.5 py-3">
                        <span className="text-xs font-semibold">Response from the hotel</span>
                        <p className="text-[13px] leading-[19px]">{rv.reply}</p>
                        <span className="text-xs text-muted">{rv.replyBy}</span>
                      </Card>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs text-muted">
                          {rv.published} · {rv.helpful} found this helpful
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() =>
                            toast.warning("Reporting a review is not available yet. Nothing was sent to a moderator.")
                          }
                        >
                          <Flag className="size-4" />
                          Report
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <Button
                variant="secondary"
                className="self-start"
                onPress={() => toast.warning("Reading every review is not available yet.")}
              >
                Show all {property.reviewCount} reviews
              </Button>
            </section>

            <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
              <Card className="gap-3 p-[18px]" aria-labelledby="loc-h">
                <h2 id="loc-h" className="text-[15px] font-semibold">
                  Where you’ll be
                </h2>
                <svg
                  viewBox="0 0 340 140"
                  width="100%"
                  height="140"
                  role="img"
                  aria-label={property.map.label}
                  className="block rounded-[14px] bg-surface-tertiary"
                >
                  <path d="M0 0 L120 0 C 140 50, 110 90, 130 140 L0 140 Z" fill="var(--accent-soft)" />
                  <path d="M150 0 C 160 60, 190 100, 340 115" fill="none" stroke="var(--separator)" strokeWidth="5" />
                  <circle cx="148" cy="70" r="9" fill="var(--accent)" />
                  <circle cx="148" cy="70" r="3.5" fill="var(--accent-foreground)" />
                </svg>
                <ul className="flex flex-col gap-1.5 text-[13px]">
                  {property.map.distances.map((d) => (
                    <li key={d.place} className="flex items-center justify-between gap-3">
                      <span>{d.place}</span>
                      <span className={`text-muted ${/^\d/.test(d.distance) ? "tabular" : ""}`}>{d.distance}</span>
                    </li>
                  ))}
                </ul>
                <span className="text-xs text-muted">{property.map.note}</span>
              </Card>
              <Card className="gap-3 p-[18px]" aria-labelledby="biz-h">
                <div className="flex items-center gap-2.5">
                  <Avatar size="sm" variant="soft" color="accent">
                    <Avatar.Fallback>{property.business.initials}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <h2 id="biz-h" className="text-[15px] font-semibold">
                      {property.business.name}
                    </h2>
                    <span className="text-xs text-muted">{property.business.runs}</span>
                  </div>
                </div>
                <KeyValueList
                  items={[
                    {
                      label: "Business",
                      value: property.business.verified ? (
                        <Chip size="sm" variant="soft" color="success">
                          <SealCheck className="size-3" />
                          <Chip.Label>{property.business.verified}</Chip.Label>
                        </Chip>
                      ) : (
                        <span className="text-muted">No verification on file</span>
                      ),
                    },
                    {
                      label: "Tourism licence",
                      // A success chip only for a licence on file and in date; expired or missing reads plainly.
                      value: property.business.licence.startsWith("Active") ? (
                        <Chip size="sm" variant="soft" color="success">
                          <Chip.Label>{property.business.licence}</Chip.Label>
                        </Chip>
                      ) : (
                        <span className="text-muted">{property.business.licence || "No dated licence on file"}</span>
                      ),
                    },
                    { label: "TIN", value: <span className="tabular">{property.business.tin}</span> },
                  ]}
                />
                <GateChip icon={<Icon name="ShieldExclamation" className="size-3" />}>
                  {property.business.evidence}
                </GateChip>
                {listingTicket ? (
                  <Chip size="sm" variant="soft" className="self-start">
                    <Icon name="Check" className="size-3" />
                    <Chip.Label>Sent to Injishi support · ticket {listingTicket.slice(0, 8).toUpperCase()}</Chip.Label>
                  </Chip>
                ) : listingForm ? (
                  <Card variant="secondary" className="gap-2.5 p-3.5" role="group" aria-label="Report this listing">
                    <span className="text-[13px] font-semibold">Why are you reporting this listing?</span>
                    <RadioGroup
                      aria-label="Reason"
                      value={listingReason}
                      onChange={setListingReason}
                      className="gap-1.5"
                    >
                      {LISTING_REPORT_REASONS.map((re) => (
                        <Radio key={re.id} value={re.id}>
                          <Radio.Content>
                            <Radio.Control>
                              <Radio.Indicator />
                            </Radio.Control>
                            <Label>{re.label}</Label>
                          </Radio.Content>
                        </Radio>
                      ))}
                    </RadioGroup>
                    <TextField value={listingDetail} onChange={setListingDetail} className="gap-1">
                      <Label>What did you notice? (optional)</Label>
                      <TextArea rows={2} />
                    </TextField>
                    <span className="text-xs text-muted">
                      It goes to Injishi support as a ticket, from your account&apos;s email.
                    </span>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onPress={() => setListingForm(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" isDisabled={reporting} onPress={sendListingReport}>
                        Send report
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Button variant="ghost" size="sm" className="self-start" onPress={() => setListingForm(true)}>
                    <Flag className="size-4" />
                    Report this listing
                  </Button>
                )}
              </Card>
            </div>
          </div>

          <aside
            id="book"
            aria-label="Book your stay"
            className="min-w-[min(300px,100%)] flex-[0_1_380px] self-stretch scroll-mt-4"
          >
            <Card aria-labelledby="sum-h" className="sticky top-5 z-10 gap-4 rounded-3xl p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 id="sum-h" className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-normal">
                  {hasNights && plan === "saver" ? (
                    <s className="text-[15px] text-muted tabular">{rwf(base + (pkgOn ? property.package.price : 0))}</s>
                  ) : null}
                  <span className="text-2xl leading-[30px] font-semibold tracking-[-0.01em] tabular">
                    {hasNights ? rwf(total) : rwf(partyRate(room))}
                  </span>
                  <span className="text-sm text-muted">
                    {hasNights ? `for ${nightsStr}` : `per night · ${plural(guests, "guest", "guests")}`}
                  </span>
                </h2>
                {hasNights && !alertOn && room.left === 1 ? (
                  <Chip size="sm" variant="soft" color="warning" className="mt-1 shrink-0">
                    <Flame className="size-3" />
                    <Chip.Label>Only 1 left</Chip.Label>
                  </Chip>
                ) : null}
              </div>

              <div className="relative">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border p-px">
                  <FieldButton
                    label="Check-in"
                    value={inD !== null ? fmtDay(inD) : "Add date"}
                    muted={inD === null}
                    hot={panel === "dates" && !choosingOut}
                    expanded={panel === "dates"}
                    radius="rounded-tl-[15px]"
                    onPress={() => setPanel(panel === "dates" ? null : "dates")}
                  />
                  <FieldButton
                    label="Check-out"
                    value={outD !== null ? fmtDay(outD) : "Add date"}
                    muted={outD === null}
                    hot={panel === "dates" && choosingOut}
                    expanded={panel === "dates"}
                    radius="rounded-tr-[15px]"
                    onPress={() => setPanel(panel === "dates" ? null : "dates")}
                  />
                  <Button
                    variant="ghost"
                    aria-haspopup="dialog"
                    aria-expanded={panel === "guests"}
                    onPress={() => setPanel(panel === "guests" ? null : "guests")}
                    className={`col-span-2 h-auto justify-between rounded-none px-3.5 py-2.5 text-left font-normal ${
                      panel === "guests" ? "bg-surface-secondary" : "bg-surface"
                    }`}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[10px] leading-[14px] font-bold tracking-[0.06em] uppercase">Guests</span>
                      <span className="text-sm leading-5">{guestStr}</span>
                    </span>
                    {panel === "guests" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                  <a
                    href="#rooms"
                    aria-label={`Room: ${room.name}. Change room`}
                    className="col-span-2 flex items-center justify-between gap-2 rounded-b-[15px] bg-surface px-3.5 py-2.5 text-inherit no-underline"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[10px] leading-[14px] font-bold tracking-[0.06em] uppercase">Room</span>
                      <span className="truncate text-sm leading-5">{room.name}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold underline">Change</span>
                  </a>
                </div>

                {panel === "dates" ? (
                  <div
                    role="dialog"
                    aria-label="Choose dates"
                    className="absolute top-[calc(100%+8px)] right-0 z-20 flex w-[640px] max-w-[calc(100vw-32px)] flex-col gap-[18px] rounded-3xl border border-separator bg-surface p-6 shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xl leading-[26px] font-semibold">
                          {hasNights ? nightsStr : choosingOut ? "Select check-out" : "Select check-in"}
                        </span>
                        <span className="text-[13px] text-muted">
                          {hasNights && inD !== null && outD !== null
                            ? `${fmtDay(inD)} – ${fmtDay(outD)}`
                            : choosingOut && inD !== null
                              ? `Check-in ${fmtDay(inD)}`
                              : "Add dates for exact prices"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          aria-label="Previous month"
                          isDisabled={monthOff <= 0}
                          onPress={() => setMonthOff((m) => Math.max(0, m - 1))}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          aria-label="Next month"
                          isDisabled={monthOff >= maxOff}
                          onPress={() => setMonthOff((m) => Math.min(maxOff, m + 1))}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-8 gap-y-5">
                      {[0, 1].map((k) => {
                        const idx = origin + monthOff + k;
                        const y = Math.floor(idx / 12);
                        const m = idx % 12;
                        return (
                          <MonthGrid
                            key={idx}
                            year={y}
                            month={m}
                            inD={inD}
                            outD={outD}
                            hasNights={hasNights}
                            choosingOut={choosingOut}
                            maxOut={maxOut}
                            blocked={blockedOf(room)}
                            today={today}
                            onPick={pickDay}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          setInD(null);
                          setOutD(null);
                          setPkg(false);
                        }}
                      >
                        Clear dates
                      </Button>
                      <Button size="sm" onPress={() => setPanel(null)}>
                        Done
                      </Button>
                    </div>
                  </div>
                ) : null}

                {panel === "guests" ? (
                  <div
                    role="dialog"
                    aria-label="Guests"
                    className="absolute top-[calc(100%+8px)] right-0 left-0 z-20 flex flex-col gap-4 rounded-[20px] border border-separator bg-surface p-5 shadow-lg"
                  >
                    <GuestRow
                      label="Adults"
                      sub={property.guests.adults.sub}
                      value={adults}
                      min={property.guests.adults.min}
                      max={property.guests.adults.max}
                      onChange={setAdults}
                    />
                    <GuestRow
                      label="Children"
                      sub={property.guests.children.sub}
                      value={kids}
                      min={property.guests.children.min}
                      max={property.guests.children.max}
                      onChange={setKids}
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-separator pt-3">
                      <span className="text-xs text-muted">{capNote}</span>
                      <Button size="sm" onPress={() => setPanel(null)}>
                        Done
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              {alertOn ? (
                <Alert status="warning">
                  <Alert.Indicator>
                    <TriangleExclamation />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>
                      {sold !== undefined
                        ? `${room.name} is sold out on ${fmtDay(sold)}`
                        : `${room.name} sleeps ${room.sleeps}`}
                    </Alert.Title>
                    <Alert.Description>
                      <a href="#rooms">See other rooms</a>
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}

              <RadioButtonGroup
                aria-label="Cancellation"
                value={plan}
                onChange={(v) => {
                  if (v !== "flex" && v !== "saver") return;
                  setPlan(v);
                  if (v !== "flex") setPkg(false);
                }}
                className="grid grid-cols-2 gap-2"
              >
                <RadioButtonGroup.Item value="flex" className="gap-0.5 rounded-[14px] px-3.5 py-3 text-left">
                  <span className="text-[13px] font-semibold">{freeOk ? "Free cancellation" : "Flexible"}</span>
                  <span className="text-[13px] tabular">
                    {rwf(base)}
                    {hasNights ? "" : " / night"}
                  </span>
                  <span className="text-xs text-muted">
                    {freeOk ? `Until ${fmtDay(deadline)}` : property.cancellation.partialRefund}
                  </span>
                </RadioButtonGroup.Item>
                <RadioButtonGroup.Item
                  value="saver"
                  isDisabled={!saverOffered}
                  className="gap-0.5 rounded-[14px] px-3.5 py-3 text-left"
                >
                  <span className="text-[13px] font-semibold">Non-refundable</span>
                  <span className="text-[13px] tabular">
                    {saverOffered ? rwf(saver) : "Not offered"}
                    {saverOffered && !hasNights ? " / night" : ""}
                  </span>
                  <span className="text-xs text-muted">
                    {saverOffered ? `Save ${saverPct}%` : "This place has no non-refundable rate"}
                  </span>
                </RadioButtonGroup.Item>
              </RadioButtonGroup>

              {pkgAvail ? (
                <Switch isSelected={pkgOn} onChange={() => setPkg((v) => !v)} className="w-full">
                  <Switch.Content className="w-full gap-3 text-left">
                    <Gift className="size-4 text-accent-soft-foreground" />
                    <span className="flex flex-1 flex-col">
                      <span className="text-[13px] font-semibold">{property.package.label}</span>
                      <span className="text-xs text-muted tabular">
                        {property.package.name} · {rwf(property.package.price)}
                      </span>
                    </span>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              ) : null}

              <div className="flex flex-col gap-2">
                {ctaLink ? (
                  <LinkButton
                    href={checkoutHref}
                    size="lg"
                    className="h-[52px] w-full rounded-[14px] text-base font-semibold"
                  >
                    {ctaText}
                  </LinkButton>
                ) : !hasNights ? (
                  <Button
                    size="lg"
                    className="h-[52px] w-full rounded-[14px] text-base font-semibold"
                    onPress={() => setPanel("dates")}
                  >
                    Add dates
                  </Button>
                ) : (
                  <Button size="lg" isDisabled className="h-[52px] w-full rounded-[14px] text-base font-semibold">
                    {ctaText}
                  </Button>
                )}
                <span className="text-center text-[13px] text-muted">{ctaNote}</span>
              </div>

              {hasNights ? (
                <dl className="flex flex-col gap-2.5 text-sm">
                  {lines.map((l) => (
                    <div key={l.label} className="flex items-center justify-between gap-3">
                      <dt className="text-muted">{l.label}</dt>
                      <dd className={`tabular ${l.tone === "success" ? "text-success-soft-foreground" : ""}`}>
                        {l.value}
                      </dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 border-t border-separator pt-3 text-[15px] font-semibold">
                    <dt>Total before the service fee</dt>
                    <dd className="tabular">{rwf(total)}</dd>
                  </div>
                </dl>
              ) : null}
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Vault className="size-3.5" aria-hidden="true" />
                VAT included · paid to {property.business.name}
              </span>
            </Card>
          </aside>
        </div>
      </MarketMain>
      <MarketFooter width="regular" links={4} />
      <Toast.Provider placement="bottom" />
      <div className="sticky bottom-0 z-20 hidden items-center gap-3 border-t border-separator bg-surface px-4 py-3 max-[760px]:flex">
        <a href="#book" className="flex min-w-0 flex-1 flex-col text-inherit no-underline">
          <span className="text-base font-semibold tabular">
            {hasNights ? rwf(total) : rwf(partyRate(room))}{" "}
            <span className="text-[13px] font-normal text-muted">
              {hasNights ? `for ${nightsStr}` : `per night · ${plural(guests, "guest", "guests")}`}
            </span>
          </span>
          <span className="text-[13px] underline">
            {hasNights && inD !== null && outD !== null ? shortRange(inD, outD) : "Add dates"}
          </span>
        </a>
        {ctaLink ? (
          <LinkButton href={checkoutHref} size="lg" className="rounded-[14px] font-semibold">
            {ctaText}
          </LinkButton>
        ) : (
          <Button
            size="lg"
            className="rounded-[14px] font-semibold"
            onPress={() => setPanel(hasNights ? null : "dates")}
          >
            {hasNights ? "Review" : "Add dates"}
          </Button>
        )}
      </div>
    </>
  );
}

function ymIndex(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + (m - 1);
}

function PhotoTile({
  image,
  caption,
  className,
}: {
  image: MarketProperty["cover"]["photo"];
  caption: string;
  className: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-surface-secondary ${className}`}>
      <Photo image={stock[image]} alt="" fill sizes="(min-width: 1024px) 400px, 100vw" />
      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-3 pt-6 pb-2.5 text-xs text-white">
        {caption}
      </span>
    </div>
  );
}

function FieldButton({
  label,
  value,
  muted,
  hot,
  expanded,
  radius,
  onPress,
}: {
  label: string;
  value: string;
  muted: boolean;
  hot: boolean;
  expanded: boolean;
  radius: string;
  onPress: () => void;
}) {
  return (
    <Button
      variant="ghost"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onPress={onPress}
      className={`h-auto flex-col items-start gap-0.5 rounded-none px-3.5 py-2.5 text-left font-normal ${radius} ${
        hot ? "bg-surface-secondary" : "bg-surface"
      }`}
    >
      <span className="text-[10px] leading-[14px] font-bold tracking-[0.06em] uppercase">{label}</span>
      <span className={`text-sm leading-5 ${muted ? "text-muted" : ""}`}>{value}</span>
    </Button>
  );
}

function GuestRow({
  label,
  sub,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const word = label.toLowerCase();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted">{sub}</span>
      </span>
      <NumberStepper
        size="md"
        aria-label={label}
        value={value}
        minValue={min}
        maxValue={max}
        onChange={(v: number) => onChange(Number.isNaN(v) ? min : v)}
      >
        <NumberStepper.Group>
          <NumberStepper.DecrementButton aria-label={`Fewer ${word}`} />
          <NumberStepper.Value className="min-w-7" />
          <NumberStepper.IncrementButton aria-label={`More ${word}`} />
        </NumberStepper.Group>
      </NumberStepper>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  inD,
  outD,
  hasNights,
  choosingOut,
  maxOut,
  blocked,
  today,
  onPick,
}: {
  year: number;
  month: number;
  inD: number | null;
  outD: number | null;
  hasNights: boolean;
  choosingOut: boolean;
  maxOut: number | null;
  blocked: number[];
  today: number;
  onPick: (n: number, asOut: boolean) => void;
}) {
  const first = dayNumber(`${year}-${String(month + 1).padStart(2, "0")}-01`);
  const dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (weekday(first) + 6) % 7;
  const cells: ({ day: false } | { day: true; n: number; d: number; col: number })[] = [];
  for (let i = 0; i < lead; i++) cells.push({ day: false });
  for (let d = 1; d <= dim; d++) cells.push({ day: true, n: first + d - 1, d, col: (lead + d - 1) % 7 });
  return (
    <div className="flex min-w-0 flex-[1_1_250px] flex-col gap-2">
      <span className="text-center text-sm font-semibold">
        {MONTHS[month]} {year}
      </span>
      <div className="grid grid-cols-7 gap-y-0.5">
        {HEADS.map((h) => (
          <span key={h} className="flex h-6 items-center justify-center text-[11px] font-semibold text-muted">
            {h}
          </span>
        ))}
        {cells.map((c, i) => {
          if (!c.day) return <span key={`e-${i}`} />;
          const past = c.n < today;
          const isBlocked = blocked.includes(c.n);
          const asOut = choosingOut && inD !== null && c.n > inD;
          const disabled = past || (asOut ? maxOut !== null && c.n > maxOut : isBlocked);
          const isIn = c.n === inD;
          const isOut = c.n === outD;
          const ends = isIn || isOut;
          const mid = hasNights && inD !== null && outD !== null && c.n > inD && c.n < outD;
          const rowStart = c.col === 0 || c.d === 1;
          const rowEnd = c.col === 6 || c.d === dim;
          let band = "transparent";
          let bandR = "0";
          if (mid) {
            band = "var(--accent-soft)";
            bandR = [rowStart, rowEnd, rowEnd, rowStart].map((on) => (on ? "999px" : "0")).join(" ");
          } else if (hasNights && isIn && !rowEnd) {
            band = "linear-gradient(90deg, transparent 50%, var(--accent-soft) 50%)";
          } else if (hasNights && isOut && !rowStart) {
            band = "linear-gradient(270deg, transparent 50%, var(--accent-soft) 50%)";
          }
          const aria =
            fmtDay(c.n) + (isBlocked ? ", sold out" : "") + (isIn ? ", check-in" : "") + (isOut ? ", check-out" : "");
          return (
            <span key={c.n} className="flex justify-center" style={{ background: band, borderRadius: bandR }}>
              <Button
                variant="ghost"
                size="sm"
                isDisabled={disabled}
                aria-label={aria}
                aria-pressed={ends}
                onPress={() => onPick(c.n, asOut)}
                className={`aspect-square h-auto w-full max-w-10 min-w-0 rounded-full p-0 text-[13px] ${
                  ends ? "bg-accent font-bold text-accent-foreground" : "bg-transparent"
                } ${!ends && disabled ? "text-muted" : ""} ${past ? "opacity-40" : ""} ${
                  isBlocked && !past && !ends ? "line-through" : ""
                } ${!ends && c.n === today ? "font-bold" : ""}`}
              >
                {c.d}
              </Button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
