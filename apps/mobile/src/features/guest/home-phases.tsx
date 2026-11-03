// The three Homes the Home tab shows as the trip goes on (prototype G1): before the stay it leads with
// check-in, during it with the key, after it with the receipt and the review.

import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  IconTile,
  ListGroup,
  ListItem,
  LiveDot,
  metrics,
  Photo,
  PhotoHero,
  PressArea,
  ScreenHeader,
  Section,
  StepBar,
  Text,
  Tile,
  TileGrid,
  Timeline,
  useToast,
} from "@/components/ui";
import { OnGround } from "@/components/ui/ground";
import { softGround } from "@/components/ui/tone";
import { href } from "@/proto/screens";
import type { HomeAfter, HomeBefore, HomeCard, HomeStay } from "./types";
import { PhotoCard, SideScroll } from "./ui";

function toInbox() {
  router.navigate(href("guest-inbox"));
}

/** Where a Home card leads; a card with no link is only read. */
function cardPress(card: HomeCard): (() => void) | undefined {
  switch (card.link) {
    case "extras":
      return () => router.push(href("guest-extras"));
    case "order":
      return () => router.push(href("guest-order"));
    case "property":
      return () => router.push(href("guest-property", { slug: card.slug ?? "" }));
    default:
      return undefined;
  }
}

/** The place pill and the bell over the photo (`.gx-tb`). */
function HeroTop({ place, dot }: { place: string; dot: boolean }) {
  return (
    <>
      <Chip variant="glass" size="lg" icon="MapPin" label={place} />
      <IconButton icon="Bell" label="Inbox" variant="glass" dot={dot} onPress={toInbox} />
    </>
  );
}

// ---------- Before the stay (Mon 12 Oct)

export function BeforeHome({ home }: { home: HomeBefore }) {
  return (
    <>
      <PhotoHero
        source={home.trip.photo}
        height={metrics.photo.bleed}
        scrim="bleed"
        top={<HeroTop place={home.trip.place} dot={false} />}
      >
        <Chip variant="glass" icon="Calendar" label={home.countdown} />
        <Text role="title1" className="mt-2">
          {home.title}
        </Text>
        <Text role="callout">{home.line}</Text>
      </PhotoHero>

      <View className="-mt-5 gap-3 px-4">
        <Card raised>
          <View className="flex-row items-center justify-between gap-3">
            <Text role="headline" className="shrink">
              Check in before you arrive
            </Text>
            <Chip label={`${home.checkIn.done} of ${home.checkIn.total} done`} />
          </View>
          <StepBar total={home.checkIn.total} step={home.checkIn.done} className="mt-3" />
          <Timeline steps={home.checkIn.steps} className="mt-4" />
          <View className="mt-4">
            <Button onPress={() => router.push(href("guest-prearrival"))}>Finish check-in</Button>
          </View>
        </Card>

        <TileGrid>
          <Tile
            icon="LocationArrow"
            label="Directions"
            caption={home.shortcuts.drive}
            onPress={() => router.push(href("guest-explore-map"), { withAnchor: true })}
          />
          <Tile
            icon="Comments"
            label="Message"
            caption={home.shortcuts.replies}
            onPress={() => router.push(href("guest-chat"))}
          />
          <Tile
            icon="Gift"
            label="Extras"
            caption={home.shortcuts.extra}
            onPress={() => router.push(href("guest-extras"))}
          />
          <Tile
            icon="FileText"
            label="Booking"
            caption="change, cancel"
            onPress={() => router.push(href("guest-refund"))}
          />
        </TileGrid>

        <Card padding="sm">
          <View className="flex-row items-center gap-3.5">
            <IconTile icon="Clock" />
            <View className="flex-1 gap-0.5">
              <Text role="callout" strong>
                {home.arrival.title}
              </Text>
              <Text role="caption" tone="muted">
                {home.arrival.body}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {home.extras.length > 0 ? (
        <>
          <Section title="Make it special" action={{ label: "See all", onPress: () => router.push(href("guest-extras")) }} />
          <SideScroll>
            {home.extras.map((card) => (
              <PhotoCard key={card.key} title={card.title} detail={card.detail} photo={card.photo} onPress={cardPress(card)} />
            ))}
          </SideScroll>
        </>
      ) : null}
    </>
  );
}

// ---------- During the stay (Thu 15 Oct, 19:42)

/** `Fri 16` on a small calendar leaf: the checkout day. */
function DayLeaf({ weekday, day }: { weekday: string; day: string }) {
  return (
    <View
      className="items-center justify-center rounded-xl bg-surface-tertiary"
      style={{ width: metrics.iconTileLarge, height: metrics.iconTileLarge }}
    >
      <Text role="micro" caps tone="danger">
        {weekday}
      </Text>
      <Text role="headline" strong tabular>
        {day}
      </Text>
    </View>
  );
}

export function StayHome({ home }: { home: HomeStay }) {
  const toast = useToast();
  const openKey = () => router.push(href("guest-key"));
  const openRequests = () => router.push(href("guest-requests"));
  return (
    <>
      <PhotoHero
        source={home.photo}
        height={metrics.photo.bleed}
        scrim="bleed"
        focus={HERO_FOCUS}
        top={<HeroTop place={home.trip.place} dot={home.newInInbox} />}
      >
        <Text role="title1">{home.title}</Text>
        <Text role="callout">{home.line}</Text>
      </PhotoHero>

      <View className="-mt-5 gap-3 px-4">
        <Card raised padding="sm" onPress={openKey} accessibilityLabel={`${home.key.room}. ${home.key.status}. Unlock`}>
          <View className="flex-row items-center gap-3.5">
            <View
              className="items-center justify-center rounded-2xl bg-accent-soft"
              style={{ width: metrics.avatarSize.l, height: metrics.avatarSize.l }}
            >
              <OnGround ground={softGround("accent")}>
                <Icon name="Key" size={24} />
              </OnGround>
            </View>
            <View className="flex-1 gap-1">
              <Text role="title3">{home.key.room}</Text>
              <View className="flex-row items-center gap-1.5">
                <LiveDot />
                <Text role="caption" tone="muted" className="shrink">
                  {home.key.status}
                </Text>
              </View>
            </View>
            <Button size="sm" onPress={openKey}>
              Unlock
            </Button>
          </View>
        </Card>

        <TileGrid>
          <Tile icon="Cup" label="Order" caption="to room" onPress={() => router.push(href("guest-order"))} />
          <Tile
            icon="BroadcastSignal"
            label="Wi-Fi"
            caption="tap to see"
            onPress={() =>
              toast.show({
                icon: "BroadcastSignal",
                message: `${home.wifi.network} · password ${home.wifi.password}`,
                duration: WIFI_TOAST_MS,
              })
            }
          />
          <Tile icon="Comments" label="Ask" caption={home.desk} onPress={openRequests} />
          <Tile
            icon="Receipt"
            label="Bill"
            caption={home.bill.due}
            badge={home.bill.unseen ? true : undefined}
            onPress={() => router.push(href("guest-bill"))}
          />
        </TileGrid>

        {home.request ? (
          <Card padding="sm" onPress={openRequests} accessibilityLabel={`${home.request.title}, ${home.request.detail}, ${home.request.status}`}>
            <View className="flex-row items-center gap-3.5">
              <IconTile icon="BroomMotion" tone="info" />
              <View className="flex-1 gap-0.5">
                <Text role="callout" strong>
                  {home.request.title}
                </Text>
                <Text role="caption" tone="muted">
                  {home.request.detail}
                </Text>
              </View>
              <Chip tone="info" label={home.request.status} />
            </View>
          </Card>
        ) : null}

        <Card
          padding="sm"
          onPress={() => router.push(href("guest-extras"))}
          accessibilityLabel={`${home.checkout.title}. ${home.checkout.detail}`}
        >
          <View className="flex-row items-center gap-3.5">
            <DayLeaf weekday={home.checkout.weekday} day={home.checkout.day} />
            <View className="flex-1 gap-0.5">
              <Text role="callout" strong>
                {home.checkout.title}
              </Text>
              <Text role="caption" tone="muted">
                {home.checkout.detail}
              </Text>
            </View>
            <Icon name="ChevronRight" size={16} tone="muted" />
          </View>
        </Card>
      </View>

      <Section title={home.tonightTitle} action={{ label: "Hotel guide", onPress: openRequests }} />
      <SideScroll>
        {home.tonight.map((card) => (
          <PhotoCard
            key={card.key}
            title={card.title}
            detail={card.detail}
            photo={card.photo}
            wide={false}
            onPress={cardPress(card)}
          />
        ))}
      </SideScroll>
    </>
  );
}

/** The balcony photo is cropped a little above its middle, to keep the lake in the frame. */
const HERO_FOCUS = { top: "38%" } as const;
/** The Wi-Fi password stays long enough to type it into another phone. */
const WIFI_TOAST_MS = 8000;

// ---------- After the stay (Sat 17 Oct)

export function AfterHome({ home }: { home: HomeAfter }) {
  const review = (stars?: number) => router.push(href("guest-review", stars ? { stars } : undefined));
  return (
    <>
      <ScreenHeader
        eyebrow={home.date}
        title={home.title}
        right={<IconButton icon="Bell" label="Inbox" variant="surface" onPress={toInbox} />}
      />
      <View className="gap-3 px-4">
        <Photo
          source={home.trip.photo}
          height={metrics.photo.banner}
          scrim="bottom"
          bottom={
            <View className="items-start gap-1">
              {/* Solid, so it reads on any photo: a soft tint all but vanishes there. */}
              <Chip tone="success" variant="solid" icon="CircleCheck" label="Checked out" />
              <Text role="title3" className="mt-1">
                {home.trip.hotel}
              </Text>
              <Text role="callout">{home.stayLine}</Text>
            </View>
          }
        />

        <Card>
          <View className="flex-row items-center justify-between gap-3">
            <Text role="headline" className="shrink">
              How was your stay?
            </Text>
            <Text role="caption" tone="muted">
              {home.review.until}
            </Text>
          </View>
          <View className="-mx-2 mt-2 flex-row">
            {[1, 2, 3, 4, 5].map((n) => (
              <PressArea
                key={n}
                onPress={() => review(n)}
                accessibilityLabel={`Rate your stay ${n} of 5 stars`}
                className="items-center justify-center"
              >
                <View className="opacity-30">
                  <Icon name="StarFill" size={32} tone="muted" />
                </View>
              </PressArea>
            ))}
          </View>
          <Text role="callout" tone="muted" className="mt-1">
            {home.review.note}
          </Text>
        </Card>

        <ListGroup>
          <ListItem
            icon="Receipt"
            tone="success"
            title="Fiscal receipt (EBM)"
            subtitle={home.receipt.detail}
            trailing={<Chip tone="success" label="Ready" />}
            onPress={() => router.push(href("guest-bill"))}
          />
          <ListItem
            icon="Gift"
            tone="warning"
            title={home.points.title}
            subtitle={home.points.detail}
            onPress={() => review()}
          />
          <ListItem
            icon="Magnifier"
            tone="default"
            title="Left something behind?"
            subtitle={home.lostFound.detail}
            onPress={() => router.push(href("guest-chat"))}
          />
        </ListGroup>
      </View>

      <Section title="Book again" action={{ label: "Explore", onPress: () => router.navigate(href("guest-explore")) }} />
      <SideScroll>
        {home.bookAgain.map((card) => (
          <PhotoCard key={card.key} title={card.title} detail={card.detail} photo={card.photo} onPress={cardPress(card)} />
        ))}
      </SideScroll>
    </>
  );
}
