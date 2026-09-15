/**
 * Record a payment — frame R1's sheet, the landlord recording rent received.
 * It moves no money and the sheet says so on the screen.
 *
 * `periodMonth` names the month of the row that opened it, because a lease can
 * owe more than one month and the server records against a named one.
 *
 * Registered as `CONFIRM_SHEET` in `app/_layout.tsx` — one detent, no scroll,
 * no dead zone under the button.
 */
import { useLocalSearchParams } from 'expo-router';
import { RecordPayment } from '@/screens/landlord/record-payment';

export default function RecordPaymentScreen() {
  const { leaseId, periodMonth } = useLocalSearchParams<{
    leaseId: string;
    periodMonth?: string;
  }>();
  return <RecordPayment leaseId={leaseId ?? ''} periodMonth={periodMonth || undefined} />;
}
