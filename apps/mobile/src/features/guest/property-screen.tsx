import type { ExplorePage, ExploreRoom, ExploreUnit } from "@injishi/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useState } from "react";
import { Platform, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, EmptyView, Icon, type IconName, LoadingBone, LoadingView, PressArea, Text } from "@/components/ui";
import { ApiError } from "@/data/fetch";
import { QueryView } from "@/data/query-view";
import { Photo } from "./photo";
import { PhotoPager } from "./photo-pager";
import { useExplorePage } from "./queries";
import { PhotoPill, Rating } from "./ui";
import { basisWords, bookingWords, dayWords, rwf, tierRefundWords } from "./words";

/** Each lead amenity's glyph; any other draws a tick. */
const FACT_ICON: Record<string, IconName> = {
  view: "Sun",
  breakfast: "Cup",
  pool: "Droplet",
  momo: "Smartphone",
  shuttle: "Car",
  restaurant: "Cup",
  parking: "Car",
  front24: "Clock",
  wifi: "AntennaSignal",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Aug 2026", for "Verified since". */
function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * A property's page (mobile spec 0005, AC-7, prototype `guest-06-property`), from real data only: its
 * photographs, the facts that decide a booking, its rooms or a home's units, the rules and the business
 * behind it. Dates, the quote and Reserve join in milestone 2; reviews and the heart in milestone 4.
 */
export function PropertyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useExplorePage(slug ?? "");
  const gone = query.error instanceof ApiError && query.error.httpStatus === 404;
  return (
    <View className="flex-1 bg-background">
      {gone && !query.data ? (
        <NotAvailable />
      ) : (
        <QueryView query={query} data={query.data} offlineNote={null} loading={<PageBones />}>
          {(page) => <PageBody page={page} />}
        </QueryView>
      )}
    </View>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/guest/explore");
}

/** A page whose property is hidden, unpublished or gone: one answer for all of them (AC-3). */
function NotAvailable() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <EmptyView
        icon="House"
        title="This stay isn't available"
        body="It may have been taken off Injishi for now. Look for another place to stay."
        action={{ label: "Back to Explore", icon: "ArrowLeft", onPress: () => router.replace("/guest/explore") }}
      />
    </View>
  );
}

function PageBones() {
  const insets = useSafeAreaInsets();
  return (
    <LoadingView label="Loading this stay">
      <LoadingBone className="rounded-none" style={{ height: 330 + insets.top }} />
      <View className="gap-3 px-4">
        <LoadingBone className="h-4 w-1/2" />
        <LoadingBone className="h-8 w-4/5" />
        <LoadingBone className="h-4 w-2/3" />
        <View className="flex-row gap-3">
          <LoadingBone className="h-20" style={{ flex: 1 }} />
          <LoadingBone className="h-20" style={{ flex: 1 }} />
        </View>
        <LoadingBone className="h-28" />
      </View>
    </LoadingView>
  );
}

/** A round button over the photograph, on the theme's overlay surface so it reads on any picture. */
function OverPhotoButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressArea onPress={onPress} accessibilityLabel={label} className="items-center justify-center">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-overlay">
        <Icon name={icon} size={20} />
      </View>
    </PressArea>
  );
}

function share(page: ExplorePage) {
  // Android shares only the message, so the link rides in it there (AC-28).
  const message = Platform.OS === "ios" ? page.card.name : `${page.card.name}\n${page.shareUrl}`;
  void Share.share({ url: page.shareUrl, message, title: page.card.name }).catch(() => {});
}

/** The photograph header's height under the status bar. */
const HEADER_HEIGHT = 330;
/** How far the sheet rises over the photograph (`-mt-6`). */
const SHEET_OVERLAP = 24;

function PageBody({ page }: { page: ExplorePage }) {
  const insets = useSafeAreaInsets();
  // Once the sheet reaches the status bar, a band of the page's own ground keeps the clock readable.
  const [covered, setCovered] = useState(false);
  const { card } = page;
  const stays = card.mode === "stays";
  const units = page.units ?? [];
  const eyebrow = [
    page.business.verified ? "Verified business" : null,
    card.typeLabel,
    stays
      ? page.roomCount > 0
        ? `${page.roomCount} ${page.roomCount === 1 ? "room" : "rooms"}`
        : null
      : `${units.length} ${units.length === 1 ? "home" : "homes"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        scrollEventThrottle={32}
        onScroll={(e) => setCovered(e.nativeEvent.contentOffset.y >= HEADER_HEIGHT - SHEET_OVERLAP)}
      >
        <View style={{ height: HEADER_HEIGHT + insets.top }}>
          <PhotoPager
            photos={page.photos}
            name={card.name}
            size="medium"
            overlay={(index) => (
              <>
                <View
                  className="absolute right-3 left-3 flex-row justify-between"
                  style={{ top: insets.top + 4, pointerEvents: "box-none" }}
                >
                  <OverPhotoButton icon="ChevronLeft" label="Back" onPress={goBack} />
                  <OverPhotoButton icon="ArrowShapeTurnUpRight" label="Share" onPress={() => share(page)} />
                </View>
                {page.photos.length > 0 ? (
                  <View
                    className="absolute right-4 bottom-10 left-4 flex-row items-end justify-between gap-2"
                    style={{ pointerEvents: "none" }}
                  >
                    {page.photos[index]?.caption ? <PhotoPill label={page.photos[index]?.caption ?? ""} /> : <View />}
                    <PhotoPill icon="Picture" label={`${index + 1} / ${page.photos.length}`} />
                  </View>
                ) : null}
              </>
            )}
          />
        </View>

        <View className="-mt-6 gap-5 rounded-t-[26px] bg-background px-4 pt-5">
          <View className="gap-1.5">
            <View className="flex-row items-center gap-1.5">
              {page.business.verified ? <Icon name="ShieldCheck" size={16} tone="success" /> : null}
              <Text role="micro" caps tone="muted" className="flex-1">
                {eyebrow}
              </Text>
            </View>
            <Text role="title1">{card.name}</Text>
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <Rating rating={card.rating} reviewCount={card.reviewCount} />
              {card.where ? (
                <Text role="callout" tone="muted">
                  · {card.where}
                </Text>
              ) : null}
            </View>
            {card.locationApproximate ? (
              <Text role="caption" tone="muted">
                Approximate location: the exact address comes with your booking.
              </Text>
            ) : null}
          </View>

          {page.facts.length > 0 ? (
            <View className="flex-row flex-wrap gap-3">
              {page.facts.map((f) => (
                <View
                  key={f.code}
                  className="min-h-20 grow basis-[45%] gap-2 rounded-2xl border border-border bg-surface p-3"
                >
                  <Icon name={FACT_ICON[f.code] ?? "CircleCheck"} size={20} tone="accent" />
                  <Text role="headline">{f.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {page.description ? <Text role="body">{page.description}</Text> : null}

          {stays ? <Rooms rooms={page.rooms ?? []} /> : <Units units={units} />}

          <Section title="Good to know">
            {page.checkInTime || page.checkOutTime ? (
              <View className="flex-row items-center gap-2">
                <Icon name="Clock" size={20} tone="muted" />
                <Text role="body" className="flex-1">
                  {[
                    page.checkInTime ? `Check in from ${page.checkInTime}` : null,
                    page.checkOutTime ? `check out by ${page.checkOutTime}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            ) : null}
            {page.houseRules ? <Text role="body">{page.houseRules}</Text> : null}
            {!page.checkInTime && !page.checkOutTime && !page.houseRules ? (
              <Text role="body" tone="muted">
                The host has not written house rules yet.
              </Text>
            ) : null}
          </Section>

          {page.facilities.length > 0 ? (
            <Section title="What it offers">
              <View className="flex-row flex-wrap gap-2">
                {page.facilities.map((f) => (
                  <Chip key={f.code} label={f.label} />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title={stays ? "The business" : "Who lets it"}>
            <Text role="headline">{page.business.legalName}</Text>
            {page.business.tin ? (
              <Text role="callout" tone="muted">
                TIN {page.business.tin}
              </Text>
            ) : null}
            {page.business.verifiedAt ? (
              <Text role="callout" tone="muted">
                Verified by Injishi since {monthYear(page.business.verifiedAt)}
              </Text>
            ) : null}
          </Section>
        </View>
      </ScrollView>
      {covered ? (
        <View
          className="absolute top-0 right-0 left-0 bg-background"
          style={{ height: insets.top, pointerEvents: "none" }}
        />
      ) : null}
      <Dock page={page} />
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text role="title3">{title}</Text>
      {children}
    </View>
  );
}

/** A stay's rooms, cheapest first, each priced on its own basis with its booking mode and refund rule. */
function Rooms({ rooms }: { rooms: ExploreRoom[] }) {
  if (rooms.length === 0) return null;
  return (
    <Section title="Rooms">
      <View className="gap-3">
        {rooms.map((r) => {
          const mode = bookingWords(r.bookingMode, r.approvalWindowHours);
          const facts = [
            r.sleeps ? `Sleeps ${r.sleeps}` : null,
            `${r.roomCount} ${r.roomCount === 1 ? "room" : "rooms"}`,
            r.minStay && r.minStay > 1 ? `${r.minStay} nights minimum` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <View key={r.id} className="gap-1.5 rounded-2xl border border-border bg-surface p-4">
              <Text role="headline">{r.name}</Text>
              <Text role="callout" tone="muted">
                {facts}
              </Text>
              <Text role="callout" tone="muted">
                {r.priceRwf === null || r.priceBasis === null ? (
                  "Price on request"
                ) : (
                  <>
                    <Text role="headline">{rwf(r.priceRwf)}</Text> {basisWords(r.priceBasis)}
                  </>
                )}
              </Text>
              <View className="flex-row flex-wrap gap-2 pt-1">
                {mode ? (
                  <Chip
                    label={r.bookingMode === "request_to_book" ? `Request to book · ${mode.toLowerCase()}` : mode}
                    tone={r.bookingMode === "instant_book" ? "accent" : "info"}
                    icon={r.bookingMode === "instant_book" ? "Thunderbolt" : "Clock"}
                  />
                ) : null}
                {r.nonrefundableEligible ? <Chip label="Saver rate offered" /> : null}
              </View>
              <Text role="caption" tone="muted">
                {tierRefundWords(r.cancellationTier)}
              </Text>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

/** A home's listed units, each with its rent a month and when it is free. */
function Units({ units }: { units: ExploreUnit[] }) {
  if (units.length === 0) return null;
  return (
    <Section title="Homes to rent">
      <View className="gap-3">
        {units.map((u) => {
          const facts = [
            u.bedrooms !== null ? `${u.bedrooms} ${u.bedrooms === 1 ? "bedroom" : "bedrooms"}` : null,
            u.bathrooms !== null ? `${u.bathrooms} ${u.bathrooms === 1 ? "bathroom" : "bathrooms"}` : null,
            u.sizeSqm ? `${u.sizeSqm} m²` : null,
            u.furnished ? "Furnished" : "Unfurnished",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <View key={u.id} className="gap-2 rounded-2xl border border-border bg-surface p-4">
              {u.photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                  {u.photos.map((p) => (
                    <View key={p.id} className="h-20 w-28 overflow-hidden rounded-xl bg-surface-secondary">
                      <Photo photo={p} size="thumb" />
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              <Text role="headline">{u.label}</Text>
              <Text role="callout" tone="muted">
                {facts}
              </Text>
              <Text role="callout" tone="muted">
                <Text role="headline">{rwf(u.rentRwf)}</Text> a month
              </Text>
              <Text role="caption" tone="muted">
                {u.availableFrom ? `Available from ${dayWords(u.availableFrom)}` : "Available now"}
              </Text>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

/**
 * The dock (the property page child). A stay shows its cheapest price; dates, the quoted total and
 * Reserve arrive with the booking thread (milestone 2). A home is view only: "Enquiries open soon".
 */
function Dock({ page }: { page: ExplorePage }) {
  const insets = useSafeAreaInsets();
  const { card } = page;
  return (
    <View
      className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-3 border-t border-separator bg-surface px-4 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 12) + 4 }}
    >
      <View className="flex-1">
        {card.priceRwf === null ? (
          <Text role="headline">Price on request</Text>
        ) : (
          <>
            <Text role="title3">{rwf(card.priceRwf)}</Text>
            <Text role="caption" tone="muted">
              {card.mode === "stays" ? `From, ${basisWords(card.priceBasis)}` : basisWords(card.priceBasis)}
            </Text>
          </>
        )}
      </View>
      {card.mode === "homes" ? (
        <Chip label="Enquiries open soon" tone="info" />
      ) : (
        <Text role="caption" tone="muted" className="max-w-[45%] text-right">
          Booking on the phone opens soon
        </Text>
      )}
    </View>
  );
}
