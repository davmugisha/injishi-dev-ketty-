/**
 * Report a fault - frame W6. Photo first, filed while walking. A tall sheet,
 * because the form is long and the room stays visible behind it.
 *
 * `room` presets the selector from wherever the sheet was opened: a task, a
 * tile, or a swipe-left on the queue.
 */
import { useLocalSearchParams } from 'expo-router';
import { ReportFault } from '@/screens/work';

export default function ReportFaultScreen() {
  const { room } = useLocalSearchParams<{ room?: string }>();
  return <ReportFault presetRoom={room} />;
}
