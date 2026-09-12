/**
 * The location block's map tile.
 *
 * **It is a drawn diagram, not a map, and it says so.** F-B15 asks for a map
 * pin, district-level when location privacy is on. The app ships no map library
 * and no tile key — adding either is a dependency this session is not allowed
 * to name — and a photograph dressed up as a map would be the same lie the
 * photo-credit rule exists to prevent. So this draws a schematic ground with
 * the pin placed on it and labels itself "Approximate location". A reader can
 * see at a glance that it is a diagram; nobody navigates by it.
 *
 * Session 2's Explore map view took the same decision for the same reason and
 * says so in `explore.mapNoteBody`. When the search endpoint lands and a
 * provider is chosen on F-B04, both tiles become the same real map.
 *
 * The pin is not placed at random: the property's own latitude and longitude
 * are projected into the tile against a bounding box that covers Rwanda, so two
 * properties in different districts sit in visibly different places and a
 * lakeside one sits west. The lines under it are decoration and carry no
 * geography, which is why they are hidden from assistive tech and the tile
 * carries a text label instead.
 */
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

/** Rwanda's rough bounding box, which is all this projection needs. */
const BOUNDS = { north: -1.04, south: -2.84, west: 28.86, east: 30.9 };

const TILE_HEIGHT = 168;

export interface ListingMapTileProps {
  latitude: number | null;
  longitude: number | null;
  /** The place name printed on the tile. */
  district: string;
}

export function ListingMapTile({ latitude, longitude, district }: ListingMapTileProps) {
  const { c, radius, space, scrim, onPhoto } = useTheme();
  const t = useT();

  // Clamped, so a coordinate outside the box still lands inside the tile
  // rather than being drawn off the edge where nobody sees it is wrong.
  const clamp = (value: number) => Math.min(0.92, Math.max(0.08, value));
  const left =
    longitude === null ? 0.5 : clamp((longitude - BOUNDS.west) / (BOUNDS.east - BOUNDS.west));
  const top =
    latitude === null ? 0.5 : clamp((BOUNDS.north - latitude) / (BOUNDS.north - BOUNDS.south));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('listing.mapLabel', { district })}
      style={{
        height: TILE_HEIGHT,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: c.borderSubtle,
        backgroundColor: c.surfaceSunken,
      }}
    >
      {/* The ground. Two washes of the tint role rather than a green-and-blue
          map palette: this is a diagram in the app's own colours, and pretending
          otherwise would be the point at which it starts to look real. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.bgTint }}
      />
      <Decoration />

      {/* The pin. A ring under a solid dot, so it reads at a glance and does
          not depend on the glyph alone. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: `${left * 100}%`,
          top: `${top * 100}%`,
          marginLeft: -17,
          marginTop: -34,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.action,
            borderWidth: 2,
            borderColor: c.surface1,
          }}
        >
          <Icon name="mapPin" size={17} color={c.bgApp} />
        </View>
        <View style={{ width: 2, height: 8, backgroundColor: c.action }} />
      </View>

      {/* The caption plate, on the same scrim the photographic headers use, so
          the words hold their contrast over whatever the tile draws. */}
      <LinearGradient
        colors={scrim.caption}
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 46 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 46,
          paddingHorizontal: space[3],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[2],
        }}
      >
        <Text size="xs" weight="medium" color={onPhoto} numberOfLines={1} style={{ flex: 1 }}>
          {district}
        </Text>
        <Text
          weight="bold"
          size="2xs"
          color={onPhoto}
          style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}
        >
          {t('listing.mapApprox')}
        </Text>
      </View>
    </View>
  );
}

/**
 * The lines under the pin. Decoration with no geography in it, so it is hidden
 * from assistive tech and never labelled as a road.
 */
function Decoration() {
  const { c } = useTheme();
  const line = { position: 'absolute' as const, backgroundColor: c.borderSubtle };

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
    >
      <View style={[line, { left: 0, right: 0, top: '32%', height: 1 }]} />
      <View style={[line, { left: 0, right: 0, top: '68%', height: 1 }]} />
      <View style={[line, { top: 0, bottom: 0, left: '26%', width: 1 }]} />
      <View style={[line, { top: 0, bottom: 0, left: '61%', width: 1 }]} />
      <View
        style={{
          position: 'absolute',
          left: '-14%',
          top: '46%',
          width: '54%',
          height: 74,
          borderRadius: 40,
          backgroundColor: c.brand100,
          opacity: 0.7,
        }}
      />
    </View>
  );
}
