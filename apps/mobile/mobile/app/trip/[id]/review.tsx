/**
 * Leave a review — a `formSheet` over the trip (F-B14, FL15). The presentation
 * and its detents are the route's, registered in `app/_layout.tsx`; `Sheet`
 * draws what goes inside it.
 */
import { useLocalSearchParams } from 'expo-router';
import { TripReviewSheet } from '@/screens/guest/trip-review-sheet';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TripReviewSheet id={id} />;
}
