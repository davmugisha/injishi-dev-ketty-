/**
 * Set housekeeping status - the sheet a tile on frame W4 opens.
 *
 * Registered by Session 10 rather than Session 0: the frozen route table in
 * `app/_layout.tsx` did not carry it, and the session prompt assigns this file
 * to Session 10. It is the one line this session adds to that file, and it is
 * named in the report.
 */
import { useLocalSearchParams } from 'expo-router';
import { RoomStatusSheet } from '@/screens/work';

export default function RoomStatusScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return <RoomStatusSheet roomId={roomId} />;
}
