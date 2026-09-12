/**
 * RRA filing — frame R10. The 15-day clock, the acknowledgement number, and
 * the adapter's mock badge beside them.
 */
import { useLocalSearchParams } from 'expo-router';
import { LandlordFiling } from '@/screens/landlord/filing';

export default function LeaseFilingScreen() {
  const { leaseId } = useLocalSearchParams<{ leaseId: string }>();
  return <LandlordFiling leaseId={leaseId ?? ''} />;
}
