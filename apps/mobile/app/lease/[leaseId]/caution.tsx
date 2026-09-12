/**
 * Caution deposit — frame R9. The Injishi word is **Caution**, never "security
 * deposit" (ui-glossary.md). It is held in escrow, it is not rent, and it
 * settles at the close of the lease.
 */
import { useLocalSearchParams } from 'expo-router';
import { LandlordCaution } from '@/screens/landlord/caution';

export default function LeaseCautionScreen() {
  const { leaseId } = useLocalSearchParams<{ leaseId: string }>();
  return <LandlordCaution leaseId={leaseId ?? ''} />;
}
