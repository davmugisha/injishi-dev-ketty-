/**
 * ExploreMap — the map half of Explore's list-and-map toggle.
 *
 * ## What this is, and what it is honest about
 *
 * F-B04 asks for list and map views whose markers update with the filters, and
 * its own open question is which provider draws the map (OSM or Google). That
 * question is not settled, `react-native-maps` is not installed, and this
 * session may not add a dependency — so the ground here is **drawn**, and the
 * screen says so in as many words rather than letting a reader believe they are
 * looking at cartography.
 *
 * What is real is the placement. Every pin sits at its own stay's coordinates,
 * normalised into Rwanda's bounding box, and the set of pins is the filtered
 * set — so filtering visibly moves the map, which is the behaviour F-B04
 * actually specifies. When the provider lands, the pins keep their coordinates
 * and the ground under them is replaced.
 *
 * ## Two things that would otherwise make it unusable
 *
 * **Pins that land on each other are fanned, not stacked.** Four of the twelve
 * stays are in Kigali and three of those are within a few hundred metres, so
 * plotted honestly they are one dot with three invisible dots under it. Pins
 * sharing a grid cell are spread on a small circle around the point they share:
 * the position is still theirs, and each one is separately tappable at the 44pt
 * floor.
 *
 * **A pin carries a score, never a price.** A real map app puts the nightly
 * rate in the marker, and this one may not: the design brief §8.6 fixes money
 * at `RWF 145,000` everywhere it appears, and twelve markers of that width
 * would cover the country. The score fits, means something on its own, and the
 * full rate is one tap away on the card below.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, MoneyAmount, PressableScale, ScoreChip, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { photo as photoAsset } from '@/data/photos';
import { DISTRICTS } from '@/data/search';
import type { Stay } from '@/data/stays';

/**
 * Rwanda's bounding box, a little wider than the country so a border pin does
 * not sit on the frame. Degrees, the same units the fixtures carry.
 */
const BOUNDS = { north: -1.02, south: -2.87, west: 28.84, east: 30.92 };

/** Where Lake Kivu sits inside that box, as a fraction of it. */
const LAKE = { left: 0.055, top: 0.29, width: 0.2, height: 0.47 };

const PIN = 34;
/** How far a fanned pin sits from the point it shares, in points. */
const FAN_RADIUS = 19;
/** Cells across the box. Two pins in one cell are treated as one place. */
const GRID = 11;

interface Placed {
  stay: Stay;
  /** 0 to 1 across the box. */
  x: number;
  y: number;
  /** The fan offset, in points. Zero unless the cell holds more than one. */
  dx: number;
  dy: number;
}

function project(stay: Stay): { x: number; y: number } {
  return {
    x: (stay.coords.lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west),
    y: (BOUNDS.north - stay.coords.lat) / (BOUNDS.north - BOUNDS.south),
  };
}

/**
 * Positions, with pins that share a cell spread around it. Pure and exported so
 * a test can assert that two Kigali stays do not come back on the same point.
 */
export function placePins(stays: readonly Stay[]): Placed[] {
  const cells = new Map<string, Stay[]>();
  for (const stay of stays) {
    const { x, y } = project(stay);
    const key = `${Math.round(x * GRID)}:${Math.round(y * GRID)}`;
    cells.set(key, [...(cells.get(key) ?? []), stay]);
  }

  const placed: Placed[] = [];
  for (const group of cells.values()) {
    group.forEach((stay, i) => {
      const { x, y } = project(stay);
      if (group.length === 1) {
        placed.push({ stay, x, y, dx: 0, dy: 0 });
        return;
      }
      const angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
      placed.push({
        stay,
        x,
        y,
        dx: Math.cos(angle) * FAN_RADIUS,
        dy: Math.sin(angle) * FAN_RADIUS,
      });
    });
  }
  // Back in catalogue order, so the reading order a screen reader walks matches
  // the list beside it rather than the order the cells happened to fill.
  return stays
    .map((stay) => placed.find((p) => p.stay.id === stay.id))
    .filter((p): p is Placed => p !== undefined);
}

export interface ExploreMapProps {
  /** The FILTERED set. Filtering the list has to move the map (F-B04 §6). */
  stays: Stay[];
  onOpen: (stay: Stay) => void;
}

export function ExploreMap({ stays, onOpen }: ExploreMapProps) {
  const { c, space, radius, shadow } = useTheme();
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pins = useMemo(() => placePins(stays), [stays]);
  const selected = stays.find((s) => s.id === selectedId) ?? null;

  /** One label per district that has a pin, at the mean of its own pins. */
  const labels = useMemo(
    () =>
      DISTRICTS.map((facet) => {
        const mine = pins.filter((p) => p.stay.district === facet.slug);
        if (mine.length === 0) return null;
        return {
          slug: facet.slug,
          label: facet.label,
          x: mine.reduce((sum, p) => sum + p.x, 0) / mine.length,
          y: mine.reduce((sum, p) => sum + p.y, 0) / mine.length,
        };
      }).filter((l): l is NonNullable<typeof l> => l !== null),
    [pins],
  );

  return (
    <View style={{ gap: space[4] }}>
      <View
        accessibilityRole="image"
        accessibilityLabel={t('explore.mapLabel', { count: stays.length })}
        style={{
          aspectRatio: 0.95,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surfaceSunken,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[c.bgTint, c.surfaceSunken]}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />

        {/* A graticule, so the drawn ground reads as a diagram rather than as a
            photograph of somewhere. */}
        {[0.25, 0.5, 0.75].map((at) => (
          <View
            key={`v-${at}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${at * 100}%`,
              width: 1,
              backgroundColor: c.borderSubtle,
            }}
          />
        ))}
        {[0.25, 0.5, 0.75].map((at) => (
          <View
            key={`h-${at}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${at * 100}%`,
              height: 1,
              backgroundColor: c.borderSubtle,
            }}
          />
        ))}

        {/* Lake Kivu, the one landmark that makes the west edge legible. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${LAKE.left * 100}%`,
            top: `${LAKE.top * 100}%`,
            width: `${LAKE.width * 100}%`,
            height: `${LAKE.height * 100}%`,
            borderRadius: radius.xl,
            backgroundColor: c.actionSubtle,
            borderWidth: 1,
            borderColor: c.borderBrand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            weight="medium"
            size="2xs"
            color="brand700"
            center
            style={{ letterSpacing: 0.4, paddingHorizontal: 2 }}
          >
            {t('explore.mapLake')}
          </Text>
        </View>

        {/* Labels under the pins, so a marker is never hidden behind a word. */}
        {labels.map((label) => (
          <View
            key={label.slug}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${label.x * 100}%`,
              top: `${label.y * 100}%`,
              marginLeft: -50,
              marginTop: 22,
              width: 100,
            }}
          >
            <Text
              weight="bold"
              size="2xs"
              color="textSubtle"
              center
              style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
            >
              {t(label.label)}
            </Text>
          </View>
        ))}

        {pins.map((pin) => {
          const active = pin.stay.id === selectedId;
          return (
            <View
              key={pin.stay.id}
              style={{
                position: 'absolute',
                left: `${pin.x * 100}%`,
                top: `${pin.y * 100}%`,
                marginLeft: -PIN / 2 + pin.dx,
                marginTop: -PIN / 2 + pin.dy,
              }}
            >
              <PressableScale
                accessibilityLabel={t('explore.mapPin', {
                  title: pin.stay.title,
                  location: pin.stay.place,
                })}
                accessibilityState={{ selected: active }}
                // Drawn at 34; hitSlop carries it past the 44pt floor.
                hitSlop={6}
                onPress={() => setSelectedId(active ? null : pin.stay.id)}
                style={{
                  width: PIN,
                  height: PIN,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? c.actionActive : c.action,
                  // Selection differs by ring AND by size, not by colour alone.
                  borderWidth: active ? 3 : 1.5,
                  borderColor: active ? c.textStrong : c.surface1,
                  ...shadow.sm,
                }}
              >
                <Text family="mono" weight="semibold" size="xs" color="bgApp">
                  {pin.stay.score.toFixed(1)}
                </Text>
              </PressableScale>
            </View>
          );
        })}
      </View>

      {selected ? (
        <SelectedStay stay={selected} onOpen={() => onOpen(selected)} />
      ) : (
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`${t('explore.mapPick')}. ${t('explore.mapPickBody')}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[4],
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.borderSubtle,
            backgroundColor: c.surface1,
          }}
        >
          <Icon name="mapPin" size={18} color={c.textMuted} />
          <View style={{ flex: 1 }}>
            <Text weight="semibold" size="sm" color="textStrong">
              {t('explore.mapPick')}
            </Text>
            <Text size="xs" color="textMuted" style={{ lineHeight: 18, marginTop: 1 }}>
              {t('explore.mapPickBody')}
            </Text>
          </View>
        </View>
      )}

      {/* The consequence printed where it happens, not discovered later. */}
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${t('explore.mapNoteTitle')}. ${t('explore.mapNoteBody')}`}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[3],
          padding: space[4],
          borderRadius: radius.lg,
          backgroundColor: c.bgTint,
          borderWidth: 1,
          borderColor: c.borderSubtle,
        }}
      >
        <Icon name="info" size={17} color={c.textMuted} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text weight="semibold" size="sm" color="textStrong">
            {t('explore.mapNoteTitle')}
          </Text>
          <Text size="xs" color="textMuted" style={{ lineHeight: 19 }}>
            {t('explore.mapNoteBody')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SelectedStay({ stay, onOpen }: { stay: Stay; onOpen: () => void }) {
  const { c, space, radius, shadow } = useTheme();
  const t = useT();
  const asset = photoAsset(stay.photos.thumbnail);

  return (
    <PressableScale
      accessibilityLabel={t('explore.openStay', { title: stay.title })}
      accessibilityHint={t('explore.mapSelectedHint')}
      onPress={onOpen}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: space[3],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.borderBrand,
        backgroundColor: c.surface1,
        ...shadow.sm,
      }}
    >
      <Image
        source={asset?.source}
        placeholder={asset?.placeholder}
        contentFit="cover"
        transition={140}
        style={{ width: 60, height: 60, borderRadius: radius.md, backgroundColor: c.surface2 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Text family="display" weight="semibold" size="md" color="textStrong" numberOfLines={1}>
          {stay.title}
        </Text>
        <Text size="xs" color="textMuted" numberOfLines={1}>
          {stay.place}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <MoneyAmount value={stay.price} strong tone="brand" size="sm" />
            <Text size="xs" color="textMuted">
              {`/ ${t('explore.perNight')}`}
            </Text>
          </View>
          <ScoreChip score={stay.score} size="sm" />
        </View>
      </View>
      <Icon name="chevronRight" size={18} color={c.textMuted} />
    </PressableScale>
  );
}
