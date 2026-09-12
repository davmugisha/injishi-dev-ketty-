/**
 * `/photo-credits` — every photograph and its licence.
 *
 * Session 0 builds the screen and this route because the licence chain is
 * Session 0's to close; **Session 11 mounts the Account row that opens it**
 * (`account.photoCredits` is already in the catalogue). Until then the page is
 * reachable by deep link, which is enough for a reviewer to check it.
 */
import { PhotoCreditsScreen } from '@/screens/photo-credits';

export default function PhotoCreditsRoute() {
  return <PhotoCreditsScreen />;
}
