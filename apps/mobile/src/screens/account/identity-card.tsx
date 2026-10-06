/**
 * The block at the top of Account: who you are, and which seat you are in.
 *
 * Frames R5, R14, B25 and the Guest artboard all open with the same three
 * elements in the same arrangement: avatar, name over a role line, a chip on
 * the right.
 *
 * ## Who you are: the server's answer, or nobody
 *
 * The name is `GET /api/v1/me/profile` through `useMyIdentity()`, and the card
 * draws exactly one of three things: the name the server holds, a skeleton
 * while that read is in flight, or "Name not added yet". It used to fall back
 * to the fixture persona, which put Samuel Kayitare's name and initials on
 * every account the server had no name for (mobile audit 2026-10-05, SA-01).
 * `PersonAvatar` and `PersonName` below are that rule in one place, and the
 * switcher and the sign out confirm draw the person through the same hook, so
 * no screen can quietly go back to a stand-in.
 *
 * ## Which seat you are in: facts from the seat, never a check
 *
 * The role line is the role the seat is held in (`seatRoleLabel`), plus the
 * property on a staff seat. The chip says which workspace this is. Neither
 * claims a verification nobody ran: `seatChipLabel` records the claims that
 * used to be drawn here and what each one waits on (SA-02).
 *
 * No presence dot. The avatar wore a green "online" dot, which said something
 * about nobody: this app has no presence (SA-35).
 *
 * **One node to a screen reader.** A reader should hear "Aline Uwase, Owner,
 * Kayitare Court" as one sentence rather than tab through three fragments, so
 * the whole card is `accessible` with a composed label, built from the parts
 * that are there. It has no `onPress`: the row under it is the control, and a
 * card that looked pressable and was not is the orphaned control the quality
 * bar rules out.
 */
import { View } from 'react-native';
import { Avatar, Badge, Icon, Skeleton, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { fontSize, type TextSize } from '@/theme/tokens';
import { useT, type Translate } from '@/i18n/i18n';
import { useMyIdentity, type MyIdentity } from '@/queries/profile';
import type { Surface, WorkspaceEntry } from '@/data/rentals';
import { joinParts, seatChipLabel, seatRoleLabel } from './account-format';

export function IdentityCard({
  surface,
  workspace,
}: {
  surface: Surface;
  workspace: WorkspaceEntry;
}) {
  const { space } = useTheme();
  const t = useT();
  const me = useMyIdentity();

  // The role a seat is held in, and on a staff seat the property it works,
  // because "Housekeeper" alone does not say where. A business seat's org name
  // is on the chip instead, so the line does not say it twice.
  const role = joinParts([
    seatRoleLabel(workspace, surface, t),
    workspace.kind === 'staff' ? (workspace.property ?? workspace.org ?? workspace.name) : null,
  ]);
  const chip = seatChipLabel(workspace, t);

  return (
    <View
      accessible
      accessibilityLabel={joinParts([spokenName(me, t), role, chip], ', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: 2,
      }}
    >
      <PersonAvatar me={me} size={64} />
      <View style={{ flex: 1, gap: 3 }}>
        <PersonName me={me} size="xl" display />
        {/* No `numberOfLines`: the Kinyarwanda role lines run longer than the
            English and frame W8's contract is that rows grow rather than clip. */}
        {role ? (
          <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
            {role}
          </Text>
        ) : null}
      </View>
      {/* `accessible` on the container above already collapses this into the
          one sentence a reader hears. It is NOT additionally hidden with
          `importantForAccessibility`, which takes a node out of the render
          tree's query surface as well as out of the reader's — a distinction
          the two props do not make, and one this file's own test caught.

          Neutral and dotless: a dot read as a status, and this is not one. */}
      {chip ? <Badge tone="neutral">{chip}</Badge> : null}
    </View>
  );
}

/**
 * What a screen reader says for the person: the name, "Loading" while the read
 * is in flight, or "Name not added yet". Never a stand-in.
 */
export function spokenName(me: MyIdentity, t: Translate): string {
  if (me.fromServer) return me.name;
  return me.pending ? t('state.loading') : t('identity.unnamed');
}

/**
 * The person's avatar: initials from a name the server holds, a skeleton while
 * that read is in flight, and a plain person glyph when there is no name.
 * Never somebody else's initials (SA-01).
 */
export function PersonAvatar({ me, size }: { me: MyIdentity; size: number }) {
  const { c, radius } = useTheme();

  if (me.fromServer) return <Avatar name={me.name} size={size} />;
  if (me.pending) return <Skeleton width={size} height={size} radius={size / 2} />;
  return (
    <View
      testID="person-avatar-unnamed"
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface2,
      }}
    >
      <Icon name="user" size={Math.round(size * 0.45)} color={c.textMuted} />
    </View>
  );
}

/**
 * The person's name on one line: the server's, a skeleton the height of the
 * line while it loads, or "Name not added yet" in the muted ink, so it reads as
 * a missing fact rather than as somebody called that.
 */
export function PersonName({
  me,
  size,
  display = false,
}: {
  me: MyIdentity;
  size: TextSize;
  /** The card's display face. The switcher's header uses the body face. */
  display?: boolean;
}) {
  const t = useT();

  if (me.fromServer) {
    return (
      <Text family={display ? 'display' : 'body'} weight="semibold" size={size} color="textStrong">
        {me.name}
      </Text>
    );
  }
  if (me.pending) {
    return <Skeleton width={display ? 168 : 136} height={fontSize[size]} />;
  }
  return (
    <Text weight="medium" size={size} color="textMuted">
      {t('identity.unnamed')}
    </Text>
  );
}
