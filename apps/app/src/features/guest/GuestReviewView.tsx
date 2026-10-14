"use client";

import { Camera, Check, EyeSlash, Medal, PaperPlane, Pencil, Xmark } from "@gravity-ui/icons";
import { Button, Card, Chip, Description, Label, ProgressBar, TextArea, TextField } from "@heroui/react";
import { Rating } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { GuestReviewRecord, GuestRewards, ReviewPhoto } from "@injishi/data/fixtures/guest";
import { stock } from "@injishi/data/media";
import { formatNumber, formatRwf, KeyValueList, PhoneBody, Photo, toneColor } from "@injishi/ui";
import { useState } from "react";
import { BackLink, CardHeading, GuestTop, useGuestLang, WideSwitch } from "./parts";

export type HotelSide = "not yet" | "submitted";

const TITLES = {
  en: "How was your stay, Sarah?",
  rw: "Murakoze, Sarah!",
  fr: "Comment s’est passé votre séjour ?",
} as const;

const WORDS = ["Not rated yet", "Poor", "Fair", "Good", "Very good", "Excellent"];

export interface GuestReviewData {
  review: GuestReviewRecord;
  roll: ReviewPhoto[];
  rewards: GuestRewards;
}

/** Guest · review and points: a double-blind review, then Amahoro Rewards for the stay. */
export function GuestReviewView({
  data,
  hotelSide,
  firstName,
}: {
  data: GuestReviewData;
  hotelSide: HotelSide;
  firstName: string;
}) {
  const { review, roll, rewards } = data;
  const [lang, setLang] = useGuestLang();
  const [submitted, setSubmitted] = useState(false);
  const [overall, setOverall] = useState(review.overall);
  const [cats, setCats] = useState<Record<string, number>>(
    Object.fromEntries(review.ratings.map((r) => [r.id, r.value])),
  );
  const [text, setText] = useState(review.text);
  const [photos, setPhotos] = useState(review.photos);
  const [nextRoll, setNextRoll] = useState(0);
  const [contact, setContact] = useState(review.contact);
  const [offers, setOffers] = useState(review.offers);

  const hotelIn = hotelSide === "submitted";
  const title = TITLES[lang].replace("Sarah", firstName);
  const sides = [
    {
      id: "you",
      who: "You",
      status: submitted ? "Submitted · hidden" : "Draft",
      tone: submitted ? ("success" as const) : ("default" as const),
    },
    {
      id: "hotel",
      who: review.property,
      status: hotelIn ? "Submitted · hidden" : "Not yet",
      tone: hotelIn ? ("success" as const) : ("default" as const),
    },
    {
      id: "publish",
      who: "Publishes",
      status: submitted && hotelIn ? "After moderation" : `When both are in, or ${review.windowClosesShort}`,
      tone: "info" as const,
    },
  ];
  const afterText = hotelIn
    ? "Both reviews are in. They publish together after a moderation check, usually within 24 hours. Then you can read what Isangano wrote about your stay."
    : `Waiting for Isangano’s review. Both publish together when the hotel submits, or on ${review.windowCloses}, whichever comes first.`;

  const addPhoto = () => {
    if (photos.length >= 6) return;
    const rollItem = roll[nextRoll % roll.length];
    if (!rollItem) return;
    setPhotos((cur) => [...cur, { id: `add-${nextRoll}`, caption: rollItem.caption, photo: rollItem.photo }]);
    setNextRoll((n) => n + 1);
  };

  return (
    <>
      <GuestTop
        lead={<BackLink href={screenHref("GuestTrip")} label="Back to trips" />}
        title="Review your stay"
        sub={`${review.shortName} · ${review.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <div className="flex shrink-0 items-center gap-3">
          <Photo image={stock[review.photo]} className="size-16 shrink-0 rounded-2xl" sizes="64px" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="text-[20px] leading-[26px] font-semibold tracking-[-0.01em]">{title}</h1>
            <span className="text-[12px] leading-4 text-muted">{review.stayLine}</span>
          </div>
        </div>

        <Card variant="secondary" aria-labelledby="blind-h" className="shrink-0 gap-2.5 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <EyeSlash className="mt-0.5 size-4 shrink-0 text-muted" />
            <div className="flex flex-col gap-0.5">
              <h2 id="blind-h" className="text-[14px] leading-5 font-semibold">
                Double-blind reviews
              </h2>
              <p className="text-[12px] leading-[17px] text-muted">
                Isangano also reviews you as a guest. Neither side sees the other’s review until both are in, or the
                window closes on {review.windowCloses}. Then both publish together.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 ps-[26px]">
            {sides.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <span className="text-[13px] leading-[18px]">{s.who}</span>
                <Chip size="sm" variant="soft" color={toneColor(s.tone)}>
                  {s.status}
                </Chip>
              </div>
            ))}
          </div>
        </Card>

        {!submitted ? (
          <>
            <Card aria-labelledby="rate-h" className="shrink-0 gap-4 p-4">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <CardHeading id="rate-h">Overall</CardHeading>
                <Rating size="lg" value={overall} onValueChange={setOverall} aria-label="Overall rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Rating.Item key={n} value={n} aria-label={`Overall: ${n} of 5, ${WORDS[n].toLowerCase()}`} />
                  ))}
                </Rating>
                <span className="text-[13px] leading-[18px] font-medium">{WORDS[overall] ?? WORDS[0]}</span>
              </div>
              <div className="flex flex-col gap-1 border-t border-separator pt-3">
                {review.ratings.map((c) => {
                  const value = cats[c.id] ?? 0;
                  return (
                    <div key={c.id} className="flex min-h-10 items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span id={`cat-${c.id}`} className="text-[14px] leading-5 font-medium">
                          {c.label}
                        </span>
                        <span className="text-[11px] leading-[14px] text-muted">{WORDS[value] ?? WORDS[0]}</span>
                      </div>
                      <Rating
                        size="md"
                        value={value}
                        onValueChange={(n) => setCats((cur) => ({ ...cur, [c.id]: n }))}
                        aria-labelledby={`cat-${c.id}`}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Rating.Item
                            key={n}
                            value={n}
                            aria-label={`${c.label}: ${n} of 5, ${WORDS[n].toLowerCase()}`}
                          />
                        ))}
                      </Rating>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card aria-labelledby="say-h" className="shrink-0 gap-3 p-4">
              <CardHeading id="say-h">Tell Other Guests</CardHeading>
              <TextField fullWidth value={text} onChange={setText} className="gap-1">
                <Label>Your review</Label>
                <TextArea rows={4} maxLength={1000} />
                <Description className="text-right tabular">{text.length} / 1,000</Description>
              </TextField>
              <div className="flex flex-col gap-1.5">
                <Label>Photos ({photos.length} of 6)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((ph) => (
                    <div key={ph.id} className="relative h-[92px] overflow-hidden rounded-[14px]">
                      <Photo image={stock[ph.photo]} fill sizes="120px" />
                      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-center text-[11px] leading-[13px] text-white">
                        {ph.caption}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        isIconOnly
                        aria-label={`Remove photo: ${ph.caption}`}
                        onPress={() => setPhotos((cur) => cur.filter((x) => x.id !== ph.id))}
                        className="absolute top-1 right-1 size-7 min-w-7"
                      >
                        <Xmark className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                  {photos.length < 6 ? (
                    <Button
                      variant="ghost"
                      onPress={addPhoto}
                      className="h-[92px] flex-col gap-1 rounded-[14px] border border-dashed border-separator"
                    >
                      <Camera className="size-4 text-muted" />
                      Add photo
                    </Button>
                  ) : null}
                </div>
                <Description>Photos of people other than you are removed before publishing.</Description>
              </div>
            </Card>

            <Card aria-labelledby="ok-h" className="shrink-0 gap-3 p-4">
              <CardHeading id="ok-h">Contact Preferences</CardHeading>
              <div className="flex flex-col gap-1">
                <WideSwitch isSelected={contact} onChange={setContact}>
                  Isangano may contact me about this review
                </WideSwitch>
                <span className="text-[12px] leading-[17px] text-muted">
                  By email, only about this review, for example to follow up on the breakfast queue. Off unless you turn
                  it on.
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <WideSwitch isSelected={offers} onChange={setOffers}>
                  Send me offers from Amahoro hotels
                </WideSwitch>
                <span className="text-[12px] leading-[17px] text-muted">
                  Occasional offers from Isangano and Ishyamba. Separate from this review; unsubscribe in any email or
                  in your account.
                </span>
              </div>
            </Card>

            <div className="flex shrink-0 flex-col gap-1.5">
              <Button size="lg" isDisabled={overall === 0} onPress={() => setSubmitted(true)}>
                <PaperPlane className="size-4" />
                Submit review
              </Button>
              <span className="text-center text-[12px] leading-4 text-muted">
                {overall === 0
                  ? "Choose an overall rating to submit."
                  : "Category ratings and photos are optional. You can edit until it publishes."}
              </span>
            </div>
          </>
        ) : (
          <Card aria-labelledby="sent-h" className="shrink-0 gap-3 px-4 py-[18px]">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-4" />
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 id="sent-h" className="text-[16px] leading-[22px] font-semibold">
                  Review submitted
                </h2>
                <p className="text-[13px] leading-[18px] text-muted">{afterText}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Rating size="sm" value={overall} isReadOnly aria-label={`Your overall rating: ${overall} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Rating.Item key={n} value={n} />
                ))}
              </Rating>
              <span className="text-[12px] text-muted">
                {WORDS[overall]} · {photos.length} photos
              </span>
            </div>
            <Button variant="secondary" className="self-start" onPress={() => setSubmitted(false)}>
              <Pencil className="size-4" />
              Edit until it publishes
            </Button>
          </Card>
        )}

        <Card aria-labelledby="pts-h" className="shrink-0 gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="pts-h" className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold">
                <Medal className="size-4 text-muted" />
                {rewards.program}
              </h2>
              <span className="text-[22px] leading-7 font-semibold tabular">
                +{formatNumber(rewards.stayPoints)} points
              </span>
            </div>
            <Chip variant="soft" color={toneColor(rewards.tone)}>
              {rewards.status}
            </Chip>
          </div>
          <p className="text-[12px] leading-[17px] text-muted">{rewards.note}</p>
          <KeyValueList
            className="grid-cols-[minmax(0,1fr)_auto]! gap-x-3 gap-y-1 text-[12px]"
            items={rewards.lines.map((l) => ({
              label: <span className="tabular">{`${l.label} · ${formatRwf(l.amount)}`}</span>,
              value:
                l.points == null ? (
                  <span className="text-right text-muted">Doesn’t earn</span>
                ) : (
                  <span className="text-right tabular">{formatNumber(l.points)} points</span>
                ),
            }))}
          />
          <ProgressBar
            value={(rewards.confirmed / rewards.goal) * 100}
            aria-label="Points toward free late checkout"
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between gap-3">
              <Label>{formatNumber(rewards.confirmed)} confirmed</Label>
              <span className="text-[13px] tabular">
                {formatNumber(rewards.goal)} {rewards.goalLabel}
              </span>
            </div>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <p className="text-[11px] leading-[15px] text-muted">{rewards.rule}</p>
        </Card>
      </PhoneBody>
    </>
  );
}
