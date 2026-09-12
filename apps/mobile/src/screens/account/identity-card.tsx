/**
 * The block at the top of Account: who you are, which hat you are wearing, and
 * what this seat has proved.
 *
 * Frames R5, R14, B25 and the Guest artboard all open with the same three
 * elements in the same arrangement — avatar, name over a role line, a badge on
 * the right — and they disagree only about what the badge says. That
 * disagreement is the interesting part and it is kept: see the note on
 * `SEAT_IDENTITY` in `account-fixtures.ts`. A landlord's TIN and a broker's
 * licence are checks the platform ran; "Personal workspace" is a statement of
 * where you are standing, and the two must not read alike.
 *
 * **One node to a screen reader.** A reader should hear "Samuel Kayitare,
 * Landlord · Kayitare Court, TIN verified" as one sentence rather than tab
 * through three fragments, so the whole card is `accessible` with a composed
 * label. It has no `onPress`: the row under it is the control, and a card that
 * looked pressable and was not is the orphaned control the quality bar rules
 * out.
 */
import { View } from 'react-native';
import { Avatar, Badge, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useMyIdentity } from '@/queries/profile';
import type { Surface, WorkspaceEntry } from '@/data/rentals';
import { BROKER_LICENCE, SEAT_IDENTITY } from './account-fixtures';

export function IdentityCard({
  surface,
  workspace,
}: {
  surface: Surface;
  workspace: WorkspaceEntry;
}) {
  const { space } = useTheme();
  const t = useT();
  const seat = SEAT_IDENTITY[surface];

  // The name is `GET /api/v1/me/profile` now rather than the `ME` constant, so
  // this card names whoever is actually signed in on this phone. It falls back
  // to the placeholder while the call is in flight — a card that paints a blank
  // line where a name goes is worse than one that is briefly generic.
  const me = useMyIdentity();

  // The role line names the seat you are in, which is why it reads the active
  // workspace rather than a constant: an attendant moved to a second property,
  // or a landlord who renames their building, gets the right line for free.
  const role = t(seat.roleKey, {
    org: workspace.org ?? workspace.name,
    place: workspace.property ?? workspace.town ?? workspace.name,
  });
  const badge = t(seat.badgeKey, { licence: BROKER_LICENCE });

  return (
    <View
      accessible
      accessibilityLabel={`${me.name}, ${role}, ${badge}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: 2,
      }}
    >
      <Avatar name={me.name} size="xl" status="online" />
      <View style={{ flex: 1, gap: 3 }}>
        <Text family="display" weight="semibold" size="xl" color="textStrong">
          {me.name}
        </Text>
        {/* No `numberOfLines`: the Kinyarwanda role lines run longer than the
            English and frame W8's contract is that rows grow rather than clip. */}
        <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
          {role}
        </Text>
      </View>
      {/* `accessible` on the container above already collapses this into the
          one sentence a reader hears. It is NOT additionally hidden with
          `importantForAccessibility`, which takes a node out of the render
          tree's query surface as well as out of the reader's — a distinction
          the two props do not make, and one this file's own test caught. */}
      <Badge tone={seat.badgeTone === 'success' ? 'success' : 'neutral'} dot>
        {badge}
      </Badge>
    </View>
  );
}
