import { screenHref } from "@injishi/data";
import type { GuestReviewRecord, GuestRewards, ReviewPhoto } from "@injishi/data/fixtures/guest";
import { useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, Description, Label, Switch, TextArea, TextField } from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import {
  BackLink,
  formatNumber,
  formatRwf,
  GuestTop,
  KeyValue,
  MeterBar,
  PhotoFrame,
  param,
  ratingWord,
  Stars,
  useGuestLang,
} from "./ui";

export type HotelSide = "not yet" | "submitted";

const TITLES = {
  en: "How was your stay, Sarah?",
  rw: "Murakoze, Sarah!",
  fr: "Comment s’est passé votre séjour ?",
} as const;

/** Guest · review and points. `?hotelSide=submitted` marks the hotel’s review as in. */
export default function GuestReviewScreen() {
  const { persona } = useSession();
  const hotelSide: HotelSide =
    param(useLocalSearchParams<{ hotelSide?: string }>().hotelSide) === "submitted" ? "submitted" : "not yet";
  const reviews = getCollection<GuestReviewRecord>("guest.reviews");
  const roll = getCollection<ReviewPhoto>("guest.reviewPhotoRoll");
  const rewardsList = getCollection<GuestRewards>("guest.rewards");
  const review = reviews[0];
  const rewards = rewardsList[0];

  const [lang, setLang] = useGuestLang();
  const [submitted, setSubmitted] = useState(false);
  const [overall, setOverall] = useState(review?.overall ?? 0);
  const [cats, setCats] = useState<Record<string, number>>(() =>
    Object.fromEntries((review?.ratings ?? []).map((item) => [item.id, item.value])),
  );
  const [text, setText] = useState(review?.text ?? "");
  const [photos, setPhotos] = useState(review?.photos ?? []);
  const [nextRoll, setNextRoll] = useState(0);
  const [contact, setContact] = useState(review?.contact ?? false);
  const [offers, setOffers] = useState(review?.offers ?? false);

  if (!persona || !review || !rewards) return null;

  const hotelIn = hotelSide === "submitted";
  const title = TITLES[lang].replace("Sarah", persona.firstName);
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
    setPhotos((current) => [...current, { id: `add-${nextRoll}`, caption: rollItem.caption, photo: rollItem.photo }]);
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
        <View className="gap-[14px]">
          <View className="flex-row items-center gap-3">
            <PhotoFrame image={review.photo} className="size-16 rounded-2xl" />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text accessibilityRole="header" className="text-[20px] leading-[26px] font-semibold text-foreground">
                {title}
              </Text>
              <Text className="text-xs leading-4 text-muted">{review.stayLine}</Text>
            </View>
          </View>

          <Card variant="secondary" className="gap-2.5 px-4 py-3.5">
            <View className="flex-row items-start gap-2.5">
              <Icon name="EyeSlash" tone="muted" />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text accessibilityRole="header" className="text-sm leading-5 font-semibold text-foreground">
                  Double-blind reviews
                </Text>
                <Text className="text-xs leading-[17px] text-muted">
                  Isangano also reviews you as a guest. Neither side sees the other’s review until both are in, or the
                  window closes on {review.windowCloses}. Then both publish together.
                </Text>
              </View>
            </View>
            <View className="gap-1.5 ps-[26px]">
              {sides.map((side) => (
                <View key={side.id} className="flex-row items-center justify-between gap-2">
                  <Text className="text-[13px] leading-[18px] text-foreground">{side.who}</Text>
                  <Chip size="sm" variant="soft" color={toneColor(side.tone)}>
                    <Chip.Label>{side.status}</Chip.Label>
                  </Chip>
                </View>
              ))}
            </View>
          </Card>

          {!submitted ? (
            <>
              <Card className="gap-4 p-4">
                <View className="items-center gap-1.5">
                  <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                    Overall
                  </Text>
                  <Stars value={overall} onChange={setOverall} label="Overall rating" size={28} />
                  <Text className="text-[13px] leading-[18px] font-medium text-foreground">{ratingWord(overall)}</Text>
                </View>
                <View className="gap-1 border-t border-separator pt-3">
                  {review.ratings.map((category) => {
                    const value = cats[category.id] ?? 0;
                    return (
                      <View key={category.id} className="min-h-10 flex-row items-center justify-between gap-2">
                        <View className="min-w-0 flex-1">
                          <Text className="text-sm leading-5 font-medium text-foreground">{category.label}</Text>
                          <Text className="text-[11px] leading-[14px] text-muted">{ratingWord(value)}</Text>
                        </View>
                        <Stars
                          value={value}
                          onChange={(next) => setCats((current) => ({ ...current, [category.id]: next }))}
                          label={category.label}
                          size={18}
                        />
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card className="gap-3 p-4">
                <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                  Tell Other Guests
                </Text>
                <TextField>
                  <Label>Your review</Label>
                  <TextArea value={text} onChangeText={(value) => setText(value.slice(0, 1000))} numberOfLines={4} />
                  <Description className="text-right">{text.length} / 1,000</Description>
                </TextField>
                <View className="gap-1.5">
                  <Label>Photos ({photos.length} of 6)</Label>
                  <View className="flex-row flex-wrap gap-2">
                    {photos.map((photo) => (
                      <View key={photo.id} className="relative h-[92px] w-[31%] overflow-hidden rounded-[14px]">
                        <PhotoFrame image={photo.photo} caption={photo.caption} className="h-full w-full" />
                        <Button
                          variant="secondary"
                          size="sm"
                          isIconOnly
                          accessibilityLabel={`Remove photo: ${photo.caption}`}
                          onPress={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}
                          className="absolute top-1 right-1 size-7"
                        >
                          <Icon name="Xmark" size={14} />
                        </Button>
                      </View>
                    ))}
                    {photos.length < 6 ? (
                      <Button
                        variant="ghost"
                        onPress={addPhoto}
                        className="h-[92px] w-[31%] flex-col gap-1 rounded-[14px] border border-dashed border-separator"
                      >
                        <Icon name="Camera" tone="muted" />
                        <Button.Label>Add photo</Button.Label>
                      </Button>
                    ) : null}
                  </View>
                  <Text className="text-xs leading-4 text-muted">
                    Photos of people other than you are removed before publishing.
                  </Text>
                </View>
              </Card>

              <Card className="gap-3 p-4">
                <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                  Contact Preferences
                </Text>
                <View className="gap-1">
                  <View className="min-h-[52px] flex-row items-center gap-3">
                    <Text className="flex-1 text-sm font-medium text-foreground">
                      Isangano may contact me about this review
                    </Text>
                    <Switch
                      isSelected={contact}
                      onSelectedChange={setContact}
                      accessibilityLabel="Isangano may contact me about this review"
                    />
                  </View>
                  <Text className="text-xs leading-[17px] text-muted">
                    By email, only about this review, for example to follow up on the breakfast queue. Off unless you
                    turn it on.
                  </Text>
                </View>
                <View className="gap-1">
                  <View className="min-h-[52px] flex-row items-center gap-3">
                    <Text className="flex-1 text-sm font-medium text-foreground">
                      Send me offers from Amahoro hotels
                    </Text>
                    <Switch
                      isSelected={offers}
                      onSelectedChange={setOffers}
                      accessibilityLabel="Send me offers from Amahoro hotels"
                    />
                  </View>
                  <Text className="text-xs leading-[17px] text-muted">
                    Occasional offers from Isangano and Ishyamba. Separate from this review; unsubscribe in any email or
                    in your account.
                  </Text>
                </View>
              </Card>

              <View className="gap-1.5">
                <Button size="lg" isDisabled={overall === 0} onPress={() => setSubmitted(true)}>
                  <Icon name="PaperPlane" tone="accent-foreground" />
                  <Button.Label>Submit review</Button.Label>
                </Button>
                <Text className="text-center text-xs leading-4 text-muted">
                  {overall === 0
                    ? "Choose an overall rating to submit."
                    : "Category ratings and photos are optional. You can edit until it publishes."}
                </Text>
              </View>
            </>
          ) : (
            <Card className="gap-3 px-4 py-[18px]">
              <View className="flex-row items-start gap-2.5">
                <View className="size-9 items-center justify-center rounded-full bg-success-soft">
                  <Icon name="Check" tone="success" />
                </View>
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text accessibilityRole="header" className="text-base leading-[22px] font-semibold text-foreground">
                    Review submitted
                  </Text>
                  <Text className="text-[13px] leading-[18px] text-muted">{afterText}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <Stars value={overall} label={`Your overall rating: ${overall} of 5`} size={16} readOnly />
                <Text className="text-xs text-muted">
                  {ratingWord(overall)} · {photos.length} photos
                </Text>
              </View>
              <Button variant="secondary" className="self-start" onPress={() => setSubmitted(false)}>
                <Icon name="Pencil" />
                <Button.Label>Edit until it publishes</Button.Label>
              </Button>
            </Card>
          )}

          <Card className="gap-3 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Icon name="Medal" tone="muted" />
                  <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                    {rewards.program}
                  </Text>
                </View>
                <Text className="text-[22px] leading-7 font-semibold text-foreground">
                  +{formatNumber(rewards.stayPoints)} points
                </Text>
              </View>
              <Chip variant="soft" color={toneColor(rewards.tone)}>
                <Chip.Label>{rewards.status}</Chip.Label>
              </Chip>
            </View>
            <Text className="text-xs leading-[17px] text-muted">{rewards.note}</Text>
            <KeyValue
              items={rewards.lines.map((line) => ({
                label: `${line.label} · ${formatRwf(line.amount)}`,
                value: line.points == null ? "Doesn’t earn" : `${formatNumber(line.points)} points`,
              }))}
            />
            <MeterBar
              label={`${formatNumber(rewards.confirmed)} confirmed`}
              valueLabel={`${formatNumber(rewards.goal)} ${rewards.goalLabel}`}
              pct={(rewards.confirmed / rewards.goal) * 100}
              accessibilityLabel="Points toward free late checkout"
            />
            <Text className="text-[11px] leading-[15px] text-muted">{rewards.rule}</Text>
          </Card>
        </View>
      </PhoneBody>
    </>
  );
}
