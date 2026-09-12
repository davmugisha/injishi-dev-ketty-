/**
 * Staff & invites — frame R5's "Staff & invites ›".
 *
 * A list, so it owes the four states the prompt pack asks every list for:
 * loading, empty with a reason and an action, error with a retry, and offline
 * with the note that says the rows are the last that loaded.
 *
 * ## Two things this screen is careful about
 *
 * **A revoked seat stays on the list.** ADR-012 puts authorization on the
 * server and resolves it per workspace, so revoking is a state change on a
 * membership rather than a deletion of a person — and the audit question a
 * landlord actually asks is "who USED to have access", which a list that
 * removed the row cannot answer. So `suspended` is a row with a tone and a
 * restore, not a gap.
 *
 * **Resending an invitation does not move the row**, and the toast is what says
 * the message went. See `applyStaffChange`: the state is still `invited` and the
 * person still has not accepted, so a row that changed would be reporting
 * something that happened at the other end.
 *
 * The role is printed on every row because it is the permission. ADR-012's
 * AC-4 has the client render from a server-resolved list and never compute
 * authorization — this screen reads a role for DISPLAY, which is the one thing
 * a client may do with one.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import {
  BackHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  InputField,
  ListRow,
  ModalSheet,
  OfflineNote,
  Screen,
  SkeletonList,
  Text,
  useOffline,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';
import type { StaffMember } from './account-fixtures';
import { formatLongDay, staffStateKey, staffStateTone } from './account-format';
import { useStaff, useStaffMutation } from './account-store';

export function StaffScreen() {
  const { space } = useTheme();
  const t = useT();
  const toast = useToast();
  const offline = useOffline();
  const reduced = useReducedMotion();
  const { workspace } = useDomain();
  const staff = useStaff();
  const change = useStaffMutation();
  const [inviting, setInviting] = useState(false);

  const rows = staff.data ?? [];
  const active = rows.filter((m) => m.state === 'active').length;

  const run = async (input: Parameters<typeof change.mutate>[0], toastKey: string, values?: Record<string, string>) => {
    await change.mutate(input);
    toast.show(t(toastKey as Parameters<typeof t>[0], values), 'success');
  };

  return (
    <>
      <BackHeader />
      <Screen title={t('staff.title')} greeting={workspace.name}>
        {offline ? <OfflineNote /> : null}

        {staff.status === 'loading' ? (
          <SkeletonList rows={4} label={t('state.loadingList', { label: t('staff.label') })} />
        ) : staff.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('staff.label') })}
            detail={staff.error?.message}
            onRetry={staff.retry}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="users"
            title={t('staff.emptyTitle')}
            body={t('staff.emptyBody')}
            action={
              <Button leadingIcon="plus" onPress={() => setInviting(true)}>
                {t('staff.invite')}
              </Button>
            }
          />
        ) : (
          <>
            <Card
              title={t('staff.cardTitle')}
              subtitle={t('staff.cardBody', { count: active })}
              bodyStyle={{ paddingVertical: 2 }}
            >
              <Animated.View layout={reduced ? undefined : LinearTransition}>
                {rows.map((member, i) => (
                  <StaffRow
                    key={member.id}
                    member={member}
                    divider={i < rows.length - 1}
                    busy={change.status === 'saving'}
                    onResend={() => void run({ kind: 'resend', id: member.id }, 'staff.resentToast', { name: member.name })}
                    onRevoke={() => void run({ kind: 'revoke', id: member.id }, 'staff.revokedToast', { name: member.name })}
                    onRestore={() => void run({ kind: 'restore', id: member.id }, 'staff.restoredToast', { name: member.name })}
                  />
                ))}
              </Animated.View>
            </Card>

            <View style={{ gap: space[2] }}>
              <Button block size="lg" leadingIcon="plus" onPress={() => setInviting(true)}>
                {t('staff.invite')}
              </Button>
              <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                {t('staff.inviteNote')}
              </Text>
            </View>
          </>
        )}
      </Screen>

      <InviteSheet
        visible={inviting}
        saving={change.status === 'saving'}
        onClose={() => setInviting(false)}
        onInvite={(name, phone) => {
          setInviting(false);
          void run({ kind: 'invite', name, phone }, 'staff.invitedToast', { name });
        }}
      />
    </>
  );
}

/**
 * One row, and what may be done to it.
 *
 * The action differs by state and there is only ever one, which is the canvas
 * rule: one primary per state, escapes stay secondary. An active seat can be
 * revoked; an invited one can be resent; a suspended one can be restored. The
 * current-workspace owner is not in this list at all, because a seat that could
 * revoke itself is a workspace that can be locked out of.
 */
/**
 * The row's own entrance and exit.
 *
 * **Where a list item layout animation belongs, and where it does not.** The
 * prompt pack asks for one on add and remove. On a FlashList — which is what
 * `Screen.List` draws and what every tab list in this app uses — an `entering`
 * on a row animates recycled cells rather than new ones, which is why the
 * expo-animation gate rules it out. These two screens are the ones that
 * genuinely add and remove: `.map()` over a small list inside a `Card`, no
 * virtualization, and a row that appears or disappears because the reader just
 * pressed something.
 *
 * `LinearTransition` on the container is what closes the gap the removed row
 * left; without it the rows below jump. `FadeIn`/`FadeOut` rather than a slide,
 * because a settings list is not a place for travel, and reduced motion drops
 * even that to an instant swap while keeping the change visible.
 */
function StaffRow({
  member,
  divider,
  busy,
  onResend,
  onRevoke,
  onRestore,
}: {
  member: StaffMember;
  divider: boolean;
  busy: boolean;
  onResend: () => void;
  onRevoke: () => void;
  onRestore: () => void;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const tone = staffStateTone(member.state);
  const stateWord = t(staffStateKey(member.state));

  const action =
    member.state === 'invited'
      ? { label: t('staff.resend'), run: onResend, variant: 'secondary' as const }
      : member.state === 'suspended'
        ? { label: t('staff.restore'), run: onRestore, variant: 'secondary' as const }
        : { label: t('staff.revoke'), run: onRevoke, variant: 'ghost' as const };

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(180)}
      exiting={reduced ? undefined : FadeOut.duration(120)}
    >
    <ListRow
      avatar={member.name}
      title={member.name}
      subtitle={`${t(member.roleKey)} · ${t(
        member.state === 'invited' ? 'staff.invitedOn' : 'staff.since',
        { day: formatLongDay(member.since, t) },
      )}`}
      divider={divider}
      chevron={false}
      accessibilityLabel={`${member.name}, ${t(member.roleKey)}, ${stateWord}`}
      trailing={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            // The Kinyarwanda for "Resend" is "Ongera wohereze" — two and a
            // half times the English — and it sits beside a badge that also
            // grows. Frame W8's rule: the row grows and the pair wraps rather
            // than either one clipping.
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {/* The state carries a word as well as a tone: never colour alone
              (design brief §7.5). */}
          <Badge tone={tone} dot>
            {stateWord}
          </Badge>
          <Button
            size="sm"
            variant={action.variant}
            disabled={busy}
            onPress={action.run}
            accessibilityLabel={`${action.label}, ${member.name}`}
          >
            {action.label}
          </Button>
        </View>
      }
    />
    </Animated.View>
  );
}

/**
 * The invite form.
 *
 * A `ModalSheet` rather than a route: it belongs to this one screen, it cannot
 * be linked to meaningfully, and it is a step inside an action the reader has
 * already begun — the two conditions `components/modal-sheet.tsx` names.
 *
 * The consequence is printed under the button rather than discovered after it:
 * an invitation grants access to a whole workspace's data, and the canvas rule
 * is that a reader is told before they press.
 */
function InviteSheet({
  visible,
  saving,
  onClose,
  onInvite,
}: {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onInvite: (name: string, phone: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const ready = name.trim().length > 1 && phone.replace(/\D/g, '').length >= 9;

  const close = () => {
    setName('');
    setPhone('');
    onClose();
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title={t('staff.inviteTitle')}
      subtitle={t('staff.inviteSubtitle')}
      footer={
        <>
          <Button
            block
            size="lg"
            leadingIcon="send"
            disabled={!ready || saving}
            onPress={() => onInvite(name.trim(), phone.trim())}
          >
            {saving ? t('staff.inviting') : t('staff.inviteSend')}
          </Button>
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {t('staff.inviteConsequence')}
          </Text>
        </>
      }
    >
      <InputField
        label={t('staff.fieldName')}
        value={name}
        onChangeText={setName}
        placeholder={t('staff.fieldNamePlaceholder')}
        autoCapitalize="words"
      />
      <InputField
        label={t('staff.fieldPhone')}
        value={phone}
        onChangeText={setPhone}
        prefix="RW +250"
        placeholder="788 000 000"
        helper={t('staff.fieldPhoneHelper')}
        keyboardType="phone-pad"
        maxLength={12}
      />
    </ModalSheet>
  );
}
