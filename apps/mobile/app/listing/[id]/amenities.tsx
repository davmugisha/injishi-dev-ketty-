/**
 * `listing/[id]/amenities` — the full amenity list, as a sheet so the property
 * stays behind it. Registered as a `formSheet` in `app/_layout.tsx` (D8).
 */
import { useLocalSearchParams } from 'expo-router';
import { ListingAmenitiesSheet } from '@/screens/guest/listing-amenities-sheet';

export default function AmenitiesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListingAmenitiesSheet id={id} />;
}
