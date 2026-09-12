/**
 * `/account` — the one tab in every one of the six tab sets.
 *
 * Renamed from Profile by Session 0 per decision D3: the prototype names the
 * fifth tab Account in every set (`frames.md` "Shell", and frames R5, R14 and
 * B25 all title the screen "Account"). The `account.*` message keys inside were
 * always called that, so the rename closed a gap rather than opening one.
 *
 * **Session 11 rebuilt what is behind it.** What shipped before the prototype
 * was a two-domain screen with five rows that toasted "not wired yet" — the
 * orphaned control the quality bar rules out, and the comment on those rows
 * said Session 11 would give them destinations. It has. The screen lives in
 * `src/screens/account/`, branches on the active surface, and every row opens
 * something real.
 */
import { Account } from '@/screens/account';

export default function AccountRoute() {
  return <Account />;
}
