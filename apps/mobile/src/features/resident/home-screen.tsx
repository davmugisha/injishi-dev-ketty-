import { router } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  IconTile,
  ListGroup,
  ListItem,
  LoadingBone,
  metrics,
  Photo,
  ProgressBar,
  Screen,
  Section,
  Text,
  Tile,
  TileGrid,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useResidentHome } from "./data";
import type { HomeView, RentCard as RentCardView } from "./types";
import { Amount, CardBone, Eyebrow, ListBone, Skeleton, TextLink, TitleBone } from "./ui";

/**
 * `res-home`: rent first, then a renewal that needs an answer, then the four things residents do
 * most, and what management says below (R1, R3). The bell and "All notices" open Building.
 */
export function HomeScreen() {
  const home = useResidentHome();
  return (
    <Screen>
      <QueryView query={home} data={home.data} loading={<HomeSkeleton />}>
        {(view) => <Home view={view} />}
      </QueryView>
    </Screen>
  );
}

function Home({ view }: { view: HomeView }) {
  const repairId = view.openRepair?.id;
  return (
    <>
      <View className="flex-row items-center gap-2.5 px-4 pb-1 pt-2" style={{ minHeight: metrics.header }}>
        <View className="flex-1 flex-row items-center gap-2.5">
          <Photo source={view.place.photo} width={metrics.iconTile} height={metrics.iconTile} radius="sm" />
          <View className="flex-1">
            <Text role="headline" strong>
              {view.place.name}
            </Text>
            <Text role="caption" tone="muted">
              {view.place.unit}
            </Text>
          </View>
        </View>
        <IconButton
          icon="Bell"
          label="Notices from management"
          variant="surface"
          dot={view.hasNews}
          onPress={() => router.navigate(href("res-building"))}
        />
      </View>

      <View className="px-4 pb-3.5 pt-2">
        <Text role="title1">{`${view.greeting}\n${view.firstName}`}</Text>
      </View>

      <RentCard rent={view.rent} />

      {view.renewal ? (
        <Card
          tone="accentSoft"
          padding="sm"
          className="mx-4 mt-3"
          onPress={() => router.push(href("res-lease"))}
          accessibilityLabel={`${view.renewal.title}. ${view.renewal.detail}`}
        >
          <View className="flex-row items-center gap-3.5">
            <IconTile icon="ArrowsRotateRight" />
            <View className="flex-1 gap-1">
              <Text role="headline">{view.renewal.title}</Text>
              <Text role="caption" tone="muted">
                {view.renewal.detail}
              </Text>
            </View>
            <Icon name="ChevronRight" size={16} tone="muted" />
          </View>
        </Card>
      ) : null}

      <TileGrid className="mt-4 px-4">
        <Tile icon="Wrench" label="Repair" onPress={() => router.push(href("res-repair-new"))} />
        <Tile icon="QrCode" label="Visitor code" onPress={() => router.push(href("res-visitor"))} />
        <Tile
          icon="Comments"
          label="Message"
          badge={view.unread > 0 ? true : undefined}
          onPress={() => router.push(href("res-repair", { id: repairId }))}
        />
        <Tile
          icon="FileText"
          label="Statement"
          onPress={() => router.push(href("res-payments"), { withAnchor: true })}
        />
      </TileGrid>

      <Section
        title="From management"
        action={{ label: "All notices", onPress: () => router.navigate(href("res-building")) }}
      />
      <View className="gap-2 px-4">
        {view.notice ? (
          <Banner tone="warning" icon={view.notice.icon} title={view.notice.title} body={view.notice.body} />
        ) : null}
        {view.openRepair ? (
          <ListGroup>
            <ListItem
              icon="Wrench"
              tone="info"
              title={view.openRepair.title}
              subtitle={view.openRepair.subtitle}
              trailing={
                <Chip
                  label={view.openRepair.status.label}
                  tone={view.openRepair.status.tone}
                  icon={view.openRepair.status.icon}
                />
              }
              onPress={() => router.push(href("res-repair", { id: repairId }))}
            />
          </ListGroup>
        ) : null}
      </View>
    </>
  );
}

/** `.rx-rent`: the month's rent, how long until it is due, and the way to pay it. */
function RentCard({ rent }: { rent: RentCardView }) {
  const paid = rent.state === "paid";
  const last = rent.last;
  return (
    <Card raised padding="lg" className="mx-4">
      <View className="flex-row items-center justify-between gap-3">
        <Eyebrow>{rent.eyebrow}</Eyebrow>
        <Chip label={rent.chip.label} tone={rent.chip.tone} icon={rent.chip.icon} />
      </View>
      <View className="mt-2">
        <Amount value={rent.amount} />
      </View>
      <View className="mt-3 flex-row justify-between gap-3">
        <Text role="callout" tone="muted" className="shrink">
          {rent.left}
        </Text>
        <Text role="callout" tone="muted" className="shrink text-right">
          {rent.right}
        </Text>
      </View>
      <ProgressBar
        className="mt-2"
        value={rent.meter.value}
        tone={rent.meter.tone}
        size="thin"
        label={rent.meter.label}
      />
      {paid ? null : (
        <View className="mt-4 flex-row gap-2">
          <Button icon="Wallet" className="flex-1" onPress={() => router.navigate(href("res-pay"))}>
            Pay with MoMo
          </Button>
          <Button
            variant="secondary"
            accessibilityLabel="Pay part of the rent"
            onPress={() => router.navigate(href("res-pay", { amount: "part" }))}
          >
            Part
          </Button>
        </View>
      )}
      {last ? (
        <View className="mt-3 flex-row items-center gap-1.5">
          <Icon name="CircleCheck" size={16} tone="success" />
          <Text role="caption" tone="muted" className="flex-1">
            {last.line}
          </Text>
          <TextLink
            label="Receipt"
            size="caption"
            className="-my-3"
            onPress={() => router.push(href("res-receipt", { id: last.receiptId }))}
          />
        </View>
      ) : null}
    </Card>
  );
}

const TILE_BONES = ["repair", "visitor", "message", "statement"] as const;

function HomeSkeleton() {
  return (
    <Skeleton label="Loading your home">
      <View className="flex-row items-center gap-2.5">
        <LoadingBone className="size-10 rounded-xl" />
        <View className="flex-1 gap-1.5">
          <LoadingBone className="h-4 w-2/5" />
          <LoadingBone className="h-3 w-1/3" />
        </View>
      </View>
      <TitleBone />
      <CardBone size="lg" />
      <CardBone size="sm" />
      <View className="flex-row gap-2.5">
        {TILE_BONES.map((key) => (
          <LoadingBone key={key} className="h-16 flex-1 rounded-3xl" />
        ))}
      </View>
      <ListBone rows={2} />
    </Skeleton>
  );
}
