/**
 * The amenity list, in the two shapes the page needs: a short preview on the
 * property page and the full list in the `formSheet` behind "Show all".
 *
 * One component for both, because a preview that renders differently from the
 * full list is a preview that teaches the reader the wrong shape. The only
 * difference is how many rows it draws.
 *
 * The canvas draws amenities as chips. Rows read better here: a chip row wraps
 * unpredictably once Kinyarwanda lengthens the labels, and ui-rules is explicit
 * that nothing may truncate to fit. Two columns of rows hold their alignment in
 * both catalogues.
 */
import { View } from 'react-native';
import { Icon, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { amenity as amenityFor, type AmenityId } from '@/data/property-detail';

export interface ListingAmenitiesProps {
  ids: readonly AmenityId[];
  /** Draw only the first N. Omit for the whole list. */
  limit?: number;
}

export function ListingAmenities({ ids, limit }: ListingAmenitiesProps) {
  const { c, space } = useTheme();
  const t = useT();
  const shown = limit ? ids.slice(0, limit) : ids;

  return (
    <View style={{ gap: space[3] }}>
      {shown.map((id) => {
        const amenity = amenityFor(id);
        return (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 24 }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 20, alignItems: 'center' }}
            >
              {/* Feather has no glyph for most amenities, so the honest default
                  is a tick rather than a metaphor that means something else. */}
              <Icon name={amenity.icon ?? 'check'} size={16} color={c.textMuted} />
            </View>
            <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 21 }}>
              {t(amenity.label)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
