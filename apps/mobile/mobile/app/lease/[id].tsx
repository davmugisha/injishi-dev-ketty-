/**
 * `/lease/[id]` — one lease, two seats.
 *
 * The tenant reads this as their own tenancy (frame R15, FL25 step 2); the
 * landlord reads the same aggregate as a record about someone else (frame R7).
 * Which one you get is a question about the seat you are in, not about the
 * address — exactly the question `useDomain().surface` exists to answer, and
 * the same branch `app/(tabs)/leases.tsx` already makes.
 *
 * The two bodies are separate components rather than one with an early return,
 * because they call different hooks and a conditional return between them would
 * be a hook-order violation the day either side grows one more.
 */
import { useDomain } from '@/domain';
import { useLocalSearchParams } from 'expo-router';
import { LeaseDetail } from '@/screens/tenant/lease-detail';
import { LandlordLeaseDetail } from '@/screens/landlord/lease-detail';

export default function LeaseDetailScreen() {
  const { surface } = useDomain();
  const { id } = useLocalSearchParams<{ id?: string }>();

  return surface === 'landlord' ? <LandlordLeaseDetail id={id ?? ''} /> : <LeaseDetail id={id} />;
}
