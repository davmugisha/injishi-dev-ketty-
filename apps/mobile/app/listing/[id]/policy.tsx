/**
 * `listing/[id]/policy` — the cancellation policy, and the switch that takes
 * the non-refundable rate. Guest canvas artboard 6a.
 *
 * The rule that matters and that the sheet prints: a refund tier is locked at
 * booking time and never recomputed on a screen (design brief §8.6).
 */
import { useLocalSearchParams } from 'expo-router';
import { ListingPolicySheet } from '@/screens/guest/listing-policy-sheet';

export default function PolicyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListingPolicySheet id={id} />;
}
