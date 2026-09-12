/**
 * Record a payment — frame R1's sheet, the landlord marking a month collected.
 * It moves no money and the frame says so on the screen: a mocked success must
 * never look like a real one.
 *
 * Registered as `CONFIRM_SHEET` in `app/_layout.tsx` — one detent, no scroll,
 * no dead zone under the button.
 */
import { useLocalSearchParams } from 'expo-router';
import { RecordPayment } from '@/screens/landlord/record-payment';

export default function RecordPaymentScreen() {
  const { leaseId } = useLocalSearchParams<{ leaseId: string }>();
  return <RecordPayment leaseId={leaseId ?? ''} />;
}
