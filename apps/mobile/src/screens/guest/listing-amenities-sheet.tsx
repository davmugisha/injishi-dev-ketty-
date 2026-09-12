/**
 * "Show all amenities" — the `formSheet` behind the preview on the Property
 * detail page.
 *
 * A sheet rather than a push, so the property stays behind it and the guest
 * does not lose their place in a long page (decision D8: Expo Router's own
 * `presentation: 'formSheet'`, registered in `app/_layout.tsx`, no library).
 *
 * It renders the same `ListingAmenities` the page previews, at full length. A
 * sheet that formatted the list differently from the preview it expands would
 * teach the reader the wrong shape on the way in.
 *
 * ## gaps.md B7 — the cheapest blocker, and the most embarrassing
 *
 * This route scored **zero on all five** production properties: no loading
 * state, no error state, no empty state, and not one accessibility label. It
 * was the only route in the v1.0 cut to do so, and the reason it happened is
 * legible in the old code: `getStayDetail(id)` is synchronous, so there was
 * nothing to wait for and no branch to write. That is exactly the failure
 * `use-fixture.ts` exists to prevent — *"a screen written directly against
 * [fixtures] can never show a loading or an error state, and a branch that
 * never renders is a branch that rots."*
 *
 * Reading through `useFixture` is therefore not ceremony. It is the thing that
 * makes the three states real now rather than on the day the API lands, and it
 * is why the fix is a read change rather than three new branches bolted onto a
 * synchronous call.
 *
 * The not-found branch was already real and stays: a sheet is deep-linkable, so
 * an id that resolves to nothing has to say so rather than opening empty. What
 * it did not have was a way back — a person who deep-links a dead id now gets
 * one, because a dead end inside a sheet with no navigation is a dead end.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, ErrorState, Sheet, SkeletonList, Text } from '@/components';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { getStayDetail } from '@/data/property-detail';
import { ListingAmenities } from './listing-amenities';

export function ListingAmenitiesSheet({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();

  // Keyed on the id, so opening a second property's sheet does not show the
  // first one's list while it resolves.
  const read = useFixture(`listing.amenities:${id}`, () => getStayDetail(id));
  const detail = read.data;

  const close = (
    <Button variant="primary" size="lg" block onPress={() => router.back()}>
      {t('listing.amenitiesDone')}
    </Button>
  );

  if (read.status === 'loading') {
    return (
      <Sheet title={t('listing.amenities')} grabber>
        <SkeletonList rows={6} label={t('listing.amenitiesLoading')} />
      </Sheet>
    );
  }

  if (read.status === 'error') {
    return (
      <Sheet title={t('listing.amenities')} grabber footer={close}>
        <ErrorState
          title={t('listing.amenitiesErrorTitle')}
          body={t('listing.amenitiesErrorBody')}
          onRetry={read.retry}
        />
      </Sheet>
    );
  }

  if (!detail) {
    return (
      <Sheet title={t('listing.notFoundTitle')} grabber footer={close}>
        <Text
          accessibilityRole="alert"
          size="sm"
          color="textMuted"
        >
          {t('listing.notFoundBody')}
        </Text>
      </Sheet>
    );
  }

  // An empty list is not a failure, and it is not a zero to hide. mvp-fe.md §7:
  // never a misleading zero. A stay with no amenities listed is a stay whose
  // host has not filled that in, and saying so gives the guest something to do
  // about it.
  if (detail.amenities.length === 0) {
    return (
      <Sheet title={t('listing.amenities')} grabber footer={close}>
        <EmptyState
          icon="list"
          title={t('listing.amenitiesEmptyTitle')}
          body={t('listing.amenitiesEmptyBody')}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={t('listing.amenities')}
      subtitle={t('listing.amenitiesSheetSubtitle', { property: detail.property.name })}
      grabber
      footer={close}
    >
      {/* The list announces its own length and what it belongs to. A screen
          reader arriving here through a deep link has no page behind it to take
          the property's name from. */}
      <View
        accessible
        accessibilityRole="list"
        accessibilityLabel={t('listing.amenitiesA11y', {
          count: String(detail.amenities.length),
          property: detail.property.name,
        })}
        style={{ paddingTop: 4 }}
      >
        <ListingAmenities ids={detail.amenities} />
      </View>
    </Sheet>
  );
}
