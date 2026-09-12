/**
 * `/lease/[leaseId]/contract` — one contract, two seats.
 *
 * The **landlord** signs it (frame R8, FL21): the agreement summary, the clause
 * list, their own signature pad, and the tenant shown as awaiting. The
 * **tenant** reads it (frames R15 and R16 both open it): the same clauses in
 * both languages, the locked term facts, and a download.
 */
import { useLocalSearchParams } from 'expo-router';
import { useDomain } from '@/domain';
import { LandlordContract } from '@/screens/landlord/contract';
import { LeaseContract } from '@/screens/tenant/lease-contract';

export default function LeaseContractScreen() {
  const { surface } = useDomain();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();
  return surface === 'landlord' ? (
    <LandlordContract leaseId={leaseId ?? ''} />
  ) : (
    <LeaseContract />
  );
}
