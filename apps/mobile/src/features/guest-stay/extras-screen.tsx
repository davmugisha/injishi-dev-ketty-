import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Choice,
  Dock,
  IconTile,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  Photo,
  Screen,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useAddExperience, useExtras, useRedeemOffer, useRequestLateCheckout } from "./data";
import type { Experience, Extras } from "./types";
import { backOr, CardBone, Eyebrow } from "./ui";

/**
 * Extras and offers (G5): late checkout, an offer and experiences, all booked to the room. Late checkout
 * is clearly a request until the desk approves it, and the key is extended only then.
 */
export function ExtrasScreen() {
  const extras = useExtras();
  const ask = useRequestLateCheckout();
  const toast = useToast();
  const [time, setTime] = useState<string | null>(null);
  const data = extras.data;
  const chosen = time ?? data?.late.chosen ?? "";
  const option = data?.late.options.find((o) => o.time === chosen);

  const request = () => {
    if (!option) return;
    ask.mutate(option.time, {
      onSuccess: () => {
        toast.show({ icon: "Clock", message: `Asked for ${option.time} checkout. The desk confirms here.`, haptic: "success" });
        router.navigate(href("guest-home-stay"));
      },
      onError: () => toast.show({ icon: "CloudSlash", message: "Not sent. Try again in a moment.", haptic: "error" }),
    });
  };

  return (
    <Screen
      header={<NavBar title="Extras" subtitle={data?.room} onBack={() => backOr(href("guest-home-stay"))} />}
      dock={
        data && option ? (
          <Dock note={data.note}>
            <Button size="lg" onPress={request} isDisabled={ask.isPending}>
              {`Ask for ${option.time} checkout · ${rwf(option.price)}`}
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView offlineNote={null} query={extras} data={data} loading={<ExtrasBones />}>
        {(e) => <ExtrasBody extras={e} chosen={chosen} onChoose={setTime} />}
      </QueryView>
    </Screen>
  );
}

function ExtrasBody({ extras, chosen, onChoose }: { extras: Extras; chosen: string; onChoose: (time: string) => void }) {
  const redeem = useRedeemOffer();
  const toast = useToast();
  return (
    <View className="gap-3 px-4 pt-1">
      <Card tone="accentSoft">
        <View className="flex-row items-center gap-3">
          <IconTile icon="Gift" size="lg" />
          <View className="flex-1 gap-0.5">
            <Text role="body" strong>
              {extras.offer.title}
            </Text>
            <Text role="caption" tone="muted">
              {extras.offer.detail}
            </Text>
          </View>
          {extras.offer.used ? (
            <Chip tone="success" icon="Check" label="Added" />
          ) : (
            <Button
              size="sm"
              accessibilityLabel={`Use ${extras.offer.title}`}
              onPress={() =>
                redeem.mutate(undefined, {
                  onSuccess: () => toast.show({ icon: "Gift", message: "Added to tonight's dinner bill." }),
                })
              }
            >
              Use
            </Button>
          )}
        </View>
      </Card>
      <Eyebrow className="mt-2">{extras.late.label}</Eyebrow>
      {extras.late.requested ? (
        <Banner
          tone="info"
          icon="Hourglass"
          title={`Asked for ${extras.late.requested} · waiting for the desk`}
          body="Your key stays as it is until they approve."
        />
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={extras.late.label} className="gap-2">
        {extras.late.options.map((o) => (
          <Choice
            key={o.time}
            title={o.time}
            subtitle={o.note}
            selected={chosen === o.time}
            onPress={() => onChoose(o.time)}
            trailing={
              <Text role="callout" strong tabular>
                {rwf(o.price)}
              </Text>
            }
          />
        ))}
      </View>
      <Eyebrow className="mt-2">Experiences</Eyebrow>
      {extras.experiences.map((experience) => (
        <ExperienceCard key={experience.id} experience={experience} />
      ))}
    </View>
  );
}

/** An experience booked to the room: its photo, when, the price, and an add that becomes a tick. */
function ExperienceCard({ experience }: { experience: Experience }) {
  const add = useAddExperience();
  const toast = useToast();
  return (
    <Card padding="sm">
      <View className="flex-row gap-3">
        <Photo source={experience.photo} width={metrics.photo.thumb} height={metrics.photo.thumb} radius="md" />
        <View className="flex-1 justify-between gap-1">
          <View className="gap-1">
            <Text role="body" strong>
              {experience.title}
            </Text>
            <Text role="caption" tone="muted">
              {experience.detail}
            </Text>
          </View>
          <View className="flex-row items-center justify-between gap-2">
            <Text role="callout" strong>
              {experience.price}
            </Text>
            {experience.added ? (
              <Chip tone="success" icon="Check" label={experience.cta === "Book" ? "Booked" : "Added"} />
            ) : (
              <Button
                size="sm"
                variant="secondary"
                accessibilityLabel={`${experience.cta} ${experience.title}`}
                onPress={() =>
                  add.mutate(experience.id, {
                    onSuccess: () =>
                      toast.show({ icon: "CircleCheck", message: `${experience.title}: the desk confirms the time.` }),
                  })
                }
              >
                {experience.cta}
              </Button>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

function ExtrasBones() {
  return (
    <LoadingView label="Loading extras" className="px-4 pt-1">
      <CardBone className="h-20" />
      <LoadingBone className="h-3 w-2/5" />
      <LoadingBone className="h-14 w-full rounded-2xl" />
      <LoadingBone className="h-14 w-full rounded-2xl" />
      <LoadingBone className="h-14 w-full rounded-2xl" />
      <CardBone className="h-28" />
    </LoadingView>
  );
}
