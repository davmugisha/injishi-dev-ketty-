import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Dock,
  Field,
  Icon,
  LoadingBone,
  LoadingView,
  NavBar,
  PressArea,
  ProgressBar,
  Screen,
  Text,
  TextArea,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { haptic } from "@/lib/haptics";
import { href } from "@/proto/screens";
import { useReview, useSubmitReview } from "./data";
import type { Review } from "./types";
import { backOr, CardBone } from "./ui";

/** What each overall rating says, under the stars. */
const RATING_WORDS = ["Tap a star to rate", "Poor", "Fair", "Good", "Very good", "Excellent"] as const;
const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Review your stay: the overall stars first, details optional, the words editable until it publishes.
 * The rewards card is design copy from the sample data and hides when there is none (no points service
 * exists yet).
 */
export function ReviewScreen() {
  const review = useReview();
  const submit = useSubmitReview();
  const toast = useToast();
  const [overall, setOverall] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [text, setText] = useState<string | null>(null);
  const data = review.data;
  const stars = overall ?? data?.overall ?? 0;
  const words = text ?? data?.text ?? "";

  const send = () =>
    submit.mutate(
      { overall: stars, categories: ratings, text: words.trim() },
      {
        onSuccess: () => {
          toast.show({ icon: "CircleCheck", message: "Thank you. It publishes after a quick check.", haptic: "success" });
          router.navigate(href("guest-home-after"));
        },
        onError: () => toast.show({ icon: "CloudSlash", message: "Not sent. Try again in a moment.", haptic: "error" }),
      },
    );

  return (
    <Screen
      header={
        <NavBar
          title="Review your stay"
          subtitle={data ? `${data.place} · ${data.dates}` : undefined}
          onBack={() => backOr(href("guest-home-after"))}
        />
      }
      dock={
        data ? (
          <Dock note={data.note}>
            <Button size="lg" onPress={send} isDisabled={stars === 0 || submit.isPending}>
              {data.submitted ? "Update review" : "Submit review"}
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView offlineNote={null} query={review} data={data} loading={<ReviewBones />}>
        {(r) => (
          <ReviewForm
            review={r}
            stars={stars}
            onStars={setOverall}
            ratings={ratings}
            onRate={(id, value) => setRatings((now) => ({ ...now, [id]: value }))}
            text={words}
            onText={setText}
          />
        )}
      </QueryView>
    </Screen>
  );
}

function ReviewForm({
  review,
  stars,
  onStars,
  ratings,
  onRate,
  text,
  onText,
}: {
  review: Review;
  stars: number;
  onStars: (value: number) => void;
  ratings: Record<string, number>;
  onRate: (id: string, value: number) => void;
  text: string;
  onText: (value: string) => void;
}) {
  return (
    <View className="gap-4 px-4 pt-1">
      {review.submitted ? (
        <Banner tone="success" title="Review sent" body="You can still change it until it publishes." />
      ) : null}
      <View className="items-center gap-2">
        <Text role="title2" className="text-center">
          {`How was it, ${review.guest}?`}
        </Text>
        <StarRow value={stars} onChange={onStars} size="lg" label="Overall rating" />
        <Text role="callout" strong>
          {RATING_WORDS[stars] ?? ""}
        </Text>
      </View>
      <Card>
        {review.categories.map((category) => (
          <CategoryRow
            key={category.id}
            label={category.label}
            value={ratings[category.id] ?? category.rating}
            onChange={(value) => onRate(category.id, value)}
          />
        ))}
      </Card>
      <Field label="Your review" hint={review.hint}>
        <TextArea value={text} onChangeText={onText} placeholder="What stood out about your stay?" />
      </Field>
      {review.rewards ? (
        <Card tone="accentSoft">
          <View className="flex-row items-center justify-between gap-2">
            <Text role="body" strong>
              {review.rewards.program}
            </Text>
            <Chip tone="warning" label={review.rewards.pending} />
          </View>
          <View className="mt-3">
            <ProgressBar value={review.rewards.progress} label={review.rewards.line} />
          </View>
          <Text role="caption" tone="muted" className="mt-2">
            {review.rewards.line}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

/** One category: its stars, or "Tap to rate" until the guest chooses to. */
function CategoryRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [rating, setRating] = useState(value > 0);
  return (
    <View className="flex-row items-center justify-between gap-3 py-0.5">
      <Text role="callout" className="shrink">
        {label}
      </Text>
      {rating ? (
        <StarRow value={value} onChange={onChange} size="sm" label={label} />
      ) : (
        <PressArea
          onPress={() => setRating(true)}
          accessibilityRole="link"
          accessibilityLabel={`Rate ${label.toLowerCase()}`}
          className="-my-1.5 justify-center"
        >
          <Text role="caption" strong tone="accent">
            Tap to rate
          </Text>
        </PressArea>
      )}
    </View>
  );
}

/**
 * `.gx-stars` / `.gx-mini-stars`: filled stars to the rating, outlined after it, so the value never
 * rests on colour alone. Each star is its own 48 target; the small ones overlap their neighbours'
 * margins (and the rows above and below) so a row of five stays as compact as the prototype draws it.
 */
function StarRow({
  value,
  onChange,
  size,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  size: "sm" | "lg";
  label: string;
}) {
  const small = size === "sm";
  return (
    <View className={`flex-row ${small ? "-my-1.5 -mr-3" : ""}`}>
      {STARS.map((n) => (
        <PressArea
          key={n}
          feedback="none"
          onPress={() => {
            haptic.selection();
            onChange(n);
          }}
          accessibilityRole="radio"
          accessibilityLabel={`${label}: ${n} of 5`}
          accessibilityState={{ checked: n === value }}
          className={`items-center justify-center ${small ? "-mx-3" : ""}`}
        >
          <Icon name={n <= value ? "StarFill" : "Star"} size={small ? 16 : 40} tone={n <= value ? "warning" : "muted"} />
        </PressArea>
      ))}
    </View>
  );
}

function ReviewBones() {
  return (
    <LoadingView label="Loading your review" className="items-center px-4 pt-1">
      <LoadingBone className="h-6 w-1/2" />
      <LoadingBone className="h-10 w-3/5 rounded-full" />
      <CardBone className="h-36" />
      <CardBone className="h-28" />
      <CardBone className="h-24" />
    </LoadingView>
  );
}
