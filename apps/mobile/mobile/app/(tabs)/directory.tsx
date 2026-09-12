/**
 * `/directory` — the Broker Directory (frame B21). Unlinked in the tab bar
 * because `index` already renders it for the broker surface; this file keeps
 * the path itself resolving, so a deep link or a `router.push` written against
 * `/directory` lands on the right screen rather than a 404.
 *
 * The screen is `src/screens/broker/directory.tsx`.
 */
import { Directory } from '@/screens/broker/directory';

export default function DirectoryScreen() {
  return <Directory />;
}
