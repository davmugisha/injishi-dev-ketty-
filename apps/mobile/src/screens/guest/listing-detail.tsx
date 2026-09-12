/**
 * The Property detail page — F-B15, FL06 step 4, Guest canvas artboard 4.
 *
 * The glossary calls this surface the **Property detail page**, never the
 * listing detail. The route keeps the `listing/[id]` path Session 0 registered,
 * because renaming a frozen route table is Session 11's job, not this one's.
 *
 * ## What the page is for
 *
 * One page a guest can decide from. The order of the sections is the order the
 * decision is made in, and it is the canvas's: see it, trust who is letting it,
 * understand the terms, pick a room, book. Nothing about cancellation is left
 * for the booking flow to reveal.
 *
 * ## The three things worth reading before changing it
 *
 * **The compact header is mounted, not conditional.** It fades in over the
 * gallery once the title has scrolled past, and it carries its own back control
 * because the gallery's has gone up with it. While it is transparent it is
 * hidden from assistive tech and takes no touches, so a screen reader never
 * meets two "Go back" controls at once and a finger never hits an invisible one.
 *
 * **Dates are the guest's search, not this page's state.** They live in
 * `SEARCH_KEY` with the rest of the search (Session 2), so a property opens on
 * the dates the guest already searched with, and dates set here are still set
 * when they go back to Explore. The room and the non-refundable switch live in
 * a per-property draft instead, because the policy sheet is a different route
 * and a route boundary is what component state does not cross.
 *
 * **The CTA follows the selected room's booking mode.** F-B03 and the glossary
 * both put booking mode on the Room type. `Stay.bookingMode` is Explore's facet
 * and stands in only while nothing is selected — at which point the button is
 * disabled anyway, so the guest never acts on the fallback.
 *
 * ## The states it owes
 *
 * Loading (a skeleton shaped like this page, not like a list), error with a
 * retry, not found with a way back to Explore, a property not taking bookings,
 * a property with every room gone, and a Room type with none left. Offline is
 * the shell's `OfflineBanner`, mounted once in `app/_layout.tsx`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  BackHeader,
  Badge,
  Button,
  Card,
  DomainBadge,
  ErrorState,
  Gallery,
  HeartButton,
  Icon,
  ListRow,
  ScoreChip,
  SectionLabel,
  StatusBadge,
  Text,
  nightsBetween,
  useToast,
  type DateRange,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion, MOTION_MS } from '@/motion';
import { useFixture } from '@/data/use-fixture';
import { readFixture, useFixtureValue, writeFixture } from '@/data/use-fixture-mutation';
import { useSavedStays } from '@/data/saved';
import { useBookingDraft } from '@/data/booking-draft';
import { DEFAULT_SEARCH, SEARCH_KEY, formatDates, type StaySearch } from '@/data/search';
import {
  fromRate,
  fullyBooked,
  getStayDetail,
  houseRuleLines,
  initialRoom,
  type StayDetail,
} from '@/data/property-detail';
import { ListingAmenities } from './listing-amenities';
import { ListingDatesSheet } from './listing-dates-sheet';
import { ListingMapTile } from './listing-map-tile';
import { ListingPhotoViewer } from './listing-photo-viewer';
import { ListingRoomCard } from './listing-room-card';
import { ListingSkeleton } from './listing-skeleton';
import { ListingStickyBar } from './listing-sticky-bar';
import { blockedReasonKey, tierBodyKey, tierKey } from './listing-format';

/** How many amenities the page shows before it offers "Show all". */
const AMENITY_PREVIEW = 5;

/** How far the page scrolls before the compact header takes over. */
const COLLAPSE_AT = 210;

export function ListingDetailScreen({ id }: { id: string }) {
  const t = useT();
  const read = useFixture<StayDetail | undefined>(`listing:${id}`, () => getStayDetail(id));

  if (read.status === 'loading') return <ListingSkeleton />;

  if (read.status === 'error') {
    return (
      <Framed>
        <ErrorState
          title={t('listing.errorTitle')}
          body={t('listing.errorBody')}
          detail={read.error?.message}
          onRetry={read.retry}
        />
      </Framed>
    );
  }

  if (!read.data) return <NotFound />;

  return <Loaded detail={read.data} />;
}

/**
 * The page with data.
 *
 * Split from the screen above so every hook it needs is declared
 * unconditionally: the loading, error and not-found branches return before
 * there is a room, a draft or a scroll position to hold.
 */
function Loaded({ detail }: { detail: StayDetail }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const reduced = useReducedMotion();

  const { stay, property } = detail;
  const stems = property.photos;

  /* ---------------------------------------------------------- the choices */

  const search = useFixtureValue<StaySearch>(SEARCH_KEY, () => DEFAULT_SEARCH);
  const dates = search.dates;
  const hasDates = !!dates.start && !!dates.end;
  const nights = hasDates ? nightsBetween(dates.start as string, dates.end as string) : 0;
  const datesLabel = formatDates(dates, t);

  const { draft, selectRoom, setNonRefundable } = useBookingDraft(stay.id);
  const opening = useMemo(() => initialRoom(detail), [detail]);
  const selectedId = draft.roomTypeId ?? opening?.summary.id ?? null;
  const room = detail.rooms.find((r) => r.summary.id === selectedId);

  /**
   * A room that does not sell a non-refundable rate cannot carry the switch.
   * `selectRoom` clears it on a change of room; this catches the other order —
   * switch on in the sheet, then a different room chosen — so the bar can never
   * advertise a rate the selected room refuses.
   */
  const eligible = room?.summary.nonrefundableEligible ?? false;
  useEffect(() => {
    if (draft.nonRefundable && !eligible) setNonRefundable(false);
  }, [draft.nonRefundable, eligible, setNonRefundable]);

  const soldOut = fullyBooked(detail);
  const blockedKey = blockedReasonKey({
    active: stay.active,
    soldOut,
    hasDates,
    hasRoom: !!room,
  });

  /* ------------------------------------------------------------- the save */

  const saved = useSavedStays();
  const isSaved = saved.isSaved(stay.id);
  const onToggleSave = useCallback(() => {
    const next = saved.toggle(stay.id);
    toast.show(
      next ? t('listing.savedToast') : t('listing.unsavedToast'),
      next ? 'success' : 'neutral',
    );
  }, [saved, stay.id, t, toast]);

  /* -------------------------------------------------- the overlays it owns */

  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [datesOpen, setDatesOpen] = useState(false);

  const commitDates = useCallback((range: DateRange) => {
    // Read the search back rather than closing over it: the search sheet is
    // another writer, and committing a range on top of a stale copy would drop
    // whatever it changed while this page was open.
    const current = readFixture<StaySearch>(SEARCH_KEY, DEFAULT_SEARCH);
    writeFixture<StaySearch>(SEARCH_KEY, { ...current, dates: range });
    setDatesOpen(false);
  }, []);

  /* --------------------------------------------------- the compact header */

  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);
  const headerOpacity = useSharedValue(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = e.nativeEvent.contentOffset.y > COLLAPSE_AT;
      if (next === collapsedRef.current) return;
      collapsedRef.current = next;
      setCollapsed(next);
      headerOpacity.set(withTiming(next ? 1 : 0, { duration: reduced ? 1 : MOTION_MS / 2 }));
    },
    [headerOpacity, reduced],
  );

  const headerStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.get() }));

  /* ------------------------------------------------------------ the route */

  const onBook = useCallback(() => {
    if (!room || !dates.start || !dates.end) return;
    router.push({
      pathname: '/book/[roomTypeId]',
      params: {
        roomTypeId: room.summary.id,
        checkIn: dates.start,
        checkOut: dates.end,
        nonRefundable: draft.nonRefundable ? '1' : '0',
      },
    });
  }, [dates.end, dates.start, draft.nonRefundable, room, router]);

  const rules = houseRuleLines(property);
  const tier = room?.summary.cancellationTier ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
        showsVerticalScrollIndicator={false}
      >
        <Gallery
          stems={stems}
          onOpen={setViewerAt}
          right={
            <>
              <DomainBadge domain="hospitality" solid />
              <HeartButton saved={isSaved} onToggle={onToggleSave} />
            </>
          }
        />

        <View style={{ padding: space[4], gap: space[5] }}>
          {/* ------------------------------------------------ name and place */}
          <View style={{ gap: 8 }}>
            {stay.active ? null : (
              <Badge tone="warning" dot>
                {t('listing.inactiveTitle')}
              </Badge>
            )}
            <Text
              accessibilityRole="header"
              family="display"
              weight="semibold"
              size="2xl"
              color="textStrong"
              style={{ letterSpacing: -0.4, lineHeight: 31 }}
            >
              {property.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="mapPin" size={15} color={c.textMuted} />
              <Text size="sm" color="textMuted" style={{ flex: 1 }}>
                {property.districtName}
              </Text>
            </View>

            {/* The score band. `ScoreChip` derives the word from the number
                (ADR-022), so the two can never disagree. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
              <ScoreChip score={stay.score} />
              <Text size="sm" color="textMuted">
                {stay.reviews > 0
                  ? t('listing.reviews', { count: stay.reviews })
                  : t('listing.noReviews')}
              </Text>
            </View>
          </View>

          {stay.active ? null : (
            <Card variant="tint">
              <Text size="sm" color="textBody" style={{ lineHeight: 20 }}>
                {t('listing.inactiveBody')}
              </Text>
            </Card>
          )}

          {/* ------------------------------------------------------ the host */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: c.borderSubtle,
            }}
          >
            <Avatar name={stay.agent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" size="sm" color="textStrong">
                {t('listing.hostedBy', { name: stay.agent })}
              </Text>
              <Text size="xs" color="textMuted">
                {t('listing.hostMeta')}
              </Text>
            </View>
            {/* Colour is never the only signal (design brief §7.5): the badge
                carries the word as well as the success tone. */}
            <StatusBadge domain="identity" state="verified" />
          </View>

          {/* ------------------------------------------------ what it is like */}
          <View style={{ gap: 8 }}>
            <SectionLabel>{t('listing.about')}</SectionLabel>
            <Text size="sm" color="textBody" style={{ lineHeight: 22 }}>
              {property.description}
            </Text>
          </View>

          {/* ------------------------------------------------------ amenities */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('listing.amenities')}</SectionLabel>
            <ListingAmenities ids={detail.amenities} limit={AMENITY_PREVIEW} />
            {detail.amenities.length > AMENITY_PREVIEW ? (
              <Button
                variant="outline"
                onPress={() => router.push(`/listing/${stay.id}/amenities`)}
              >
                {t('listing.amenitiesShowAll', { count: detail.amenities.length })}
              </Button>
            ) : null}
          </View>

          {/* ----------------------------------------------------- room types */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('listing.rooms')}</SectionLabel>
            {detail.rooms.length > 1 ? (
              <Text size="sm" color="textMuted" style={{ lineHeight: 19, marginTop: -4 }}>
                {t('listing.roomsSubtitle')}
              </Text>
            ) : null}
            <View accessibilityRole="radiogroup" style={{ gap: space[3] }}>
              {detail.rooms.map((r) => (
                <ListingRoomCard
                  key={r.summary.id}
                  room={r}
                  selected={r.summary.id === selectedId}
                  onSelect={() => selectRoom(r.summary.id)}
                />
              ))}
            </View>
          </View>

          {/* --------------------------------------------- cancellation terms */}
          <Card variant="flat" bodyStyle={{ paddingVertical: 0, paddingHorizontal: 18 }}>
            <ListRow
              icon="shield"
              title={`${t('listing.policy')} · ${t(tierKey(tier))}`}
              subtitle={t(tierBodyKey(tier))}
              onPress={() => router.push(`/listing/${stay.id}/policy`)}
              accessibilityLabel={`${t('listing.policy')}, ${t(tierKey(tier))}. ${t(tierBodyKey(tier))}`}
              accessibilityHint={t('listing.policyOpen')}
            />
          </Card>

          {/* ---------------------------------------------------- house rules */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('listing.houseRules')}</SectionLabel>
            <Card>
              <View style={{ gap: 9 }}>
                {rules.map((rule) => (
                  <View key={rule} style={{ flexDirection: 'row', gap: 10 }}>
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        marginTop: 8,
                        backgroundColor: c.neutral400,
                      }}
                    />
                    <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 21 }}>
                      {rule}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          {/* ------------------------------------------------------- check-in */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('listing.checkIn')}</SectionLabel>
            <Card>
              <View style={{ gap: 11 }}>
                <TimeRow label={t('listing.checkInFrom')} value={property.checkInTime ?? '—'} />
                <TimeRow label={t('listing.checkOutBy')} value={property.checkOutTime ?? '—'} />
                <View style={{ height: 1, backgroundColor: c.borderSubtle }} />
                <View style={{ flexDirection: 'row', gap: 9 }}>
                  <Icon name="key" size={15} color={c.textMuted} />
                  <Text size="sm" color="textMuted" style={{ flex: 1, lineHeight: 19 }}>
                    {detail.selfCheckIn
                      ? t('listing.checkInNoteSelf')
                      : t('listing.checkInNoteStaffed')}
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          {/* ---------------------------------------------------------- trust */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('listing.trust')}</SectionLabel>
            <Card variant="tint" bodyStyle={{ paddingVertical: 6, paddingHorizontal: 18 }}>
              <ListRow
                icon="shield"
                title={t('listing.trustEscrow')}
                subtitle={t('listing.trustEscrowBody')}
                divider
              />
              <ListRow
                icon="receipt"
                title={t('listing.trustRra')}
                subtitle={t('listing.trustRraBody')}
                divider
              />
              <ListRow
                icon="key"
                title={
                  detail.selfCheckIn
                    ? t('listing.trustSelfCheckIn')
                    : t('listing.trustStaffedCheckIn')
                }
                subtitle={
                  detail.selfCheckIn
                    ? t('listing.trustSelfCheckInBody')
                    : t('listing.trustStaffedCheckInBody')
                }
              />
            </Card>
          </View>

          {/* ------------------------------------------------------- location */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('listing.where')}</SectionLabel>
            <ListingMapTile
              latitude={property.latitude}
              longitude={property.longitude}
              district={stay.place}
            />
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <Icon
                name={property.locationPrivacy ? 'lock' : 'mapPin'}
                size={15}
                color={c.textMuted}
              />
              <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
                {property.locationPrivacy ? t('listing.mapPrivacy') : detail.address}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ------------------------------------------------- the compact header */}
      <Animated.View
        pointerEvents={collapsed ? 'auto' : 'none'}
        accessibilityElementsHidden={!collapsed}
        importantForAccessibility={collapsed ? 'yes' : 'no-hide-descendants'}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
            paddingBottom: 10,
            backgroundColor: c.surface1,
            borderBottomWidth: 1,
            borderBottomColor: c.borderSubtle,
          },
          headerStyle,
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            paddingRight: space[4],
            minHeight: 44,
          }}
        >
          {/* `BackHeader` positions itself against the safe area, so the row
              reserves its width rather than nesting it. */}
          <View style={{ width: 60 }} />
          <Text
            weight="semibold"
            size="md"
            color="textStrong"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {property.name}
          </Text>
          <HeartButton saved={isSaved} onToggle={onToggleSave} variant="bare" size={18} />
        </View>
        <BackHeader />
      </Animated.View>

      <ListingStickyBar
        room={room}
        fromRate={fromRate(detail)}
        dates={datesLabel}
        nights={nights}
        nonRefundable={draft.nonRefundable}
        fallbackMode={stay.bookingMode}
        blockedKey={blockedKey}
        onPressDates={() => setDatesOpen(true)}
        onPressCta={onBook}
      />

      <ListingPhotoViewer stems={stems} openAt={viewerAt} onClose={() => setViewerAt(null)} />
      <ListingDatesSheet
        open={datesOpen}
        value={dates}
        onClose={() => setDatesOpen(false)}
        onCommit={commitDates}
      />
    </View>
  );
}

/**
 * A property id that resolves to nothing.
 *
 * It is a surface rather than a sentence: F-B15 makes a `residence`-only
 * property a 404 for guests and an old shared link is the other way to land
 * here, so both need a way onward rather than a dead end with a back gesture.
 */
function NotFound() {
  const { c, radius } = useTheme();
  const t = useT();
  const router = useRouter();

  return (
    <Framed>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${t('listing.notFoundTitle')}. ${t('listing.notFoundBody')}`}
        style={{
          alignItems: 'center',
          gap: 10,
          paddingVertical: 30,
          paddingHorizontal: 24,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surface1,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surface2,
          }}
        >
          <Icon name="mapPin" size={20} color={c.textMuted} />
        </View>
        <Text family="display" weight="semibold" size="lg" color="textStrong" center>
          {t('listing.notFoundTitle')}
        </Text>
        <Text size="sm" color="textMuted" center style={{ lineHeight: 20, maxWidth: 280 }}>
          {t('listing.notFoundBody')}
        </Text>
        <View style={{ marginTop: 4 }}>
          <Button variant="outline" leadingIcon="compass" onPress={() => router.replace('/')}>
            {t('listing.notFoundAction')}
          </Button>
        </View>
      </View>
    </Framed>
  );
}

function TimeRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Text size="sm" color="textMuted">
        {label}
      </Text>
      <Text family="mono" weight="medium" size="sm" color="textStrong">
        {value}
      </Text>
    </View>
  );
}

/**
 * The frame the two non-content states sit in: the app canvas, the safe area,
 * and the way back. Without it a not-found page is a lone sentence floating on
 * an empty screen, which the quality bar names explicitly.
 */
function Framed({ children }: { children: React.ReactNode }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: space[4],
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + space[6],
        }}
      >
        {children}
      </View>
      <BackHeader />
    </View>
  );
}
