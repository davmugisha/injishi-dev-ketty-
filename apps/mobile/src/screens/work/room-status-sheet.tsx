/**
 * "Set housekeeping status" — the sheet a tile on frame W4 opens.
 *
 * Four options and an escape to the fault form, which is F-P04 §6's state set
 * minus the one an attendant may not set themselves: `out_of_order` is
 * Maintenance's call and arrives through a ticket (F-P05), never through this
 * sheet. That omission is the screen's most important detail — offering it here
 * would let a housekeeper take a room off sale with no work order behind it,
 * which is exactly the silent state frame W4's info card promises cannot happen.
 *
 * The options are rows rather than chips: they are 56pt tall, full width, and
 * aimed at one-handed with a glove on.
 *
 * **gaps.md calls this "the most-used write of the surface"**, and its failure
 * path was the weakest: it read `actions.failed` after the write, from the
 * render before it, so a status that did not save still toasted and closed the
 * sheet; its Try again only cleared the error; and a room it could not READ
 * still offered four options (mobile audit 2026-10-05, WK-04, WK-05, WK-06).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  ErrorState,
  Icon,
  PressableScale,
  Sheet,
  SkeletonList,
  Text,
  WriteError,
  useToast,
} from '@/components';
import { statusTone } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { HK_OPTIONS } from './work-format';
import { STATUS_KEY } from './rooms-board';
import { WORK_TARGET, WorkButton } from './work-chrome';
import { floorOf, type HkStatus } from './work-fixtures';
import { useConnection, useWorkActions, useWorkRooms } from './work-store';

export function RoomStatusSheet({ roomId }: { roomId: string }) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { c, space, radius } = useTheme();

  const rooms = useWorkRooms();
  const actions = useWorkActions();
  const connection = useConnection();

  /** The status that did not save, so Try again sends that one (WK-05). */
  const [failed, setFailed] = useState<HkStatus | null>(null);

  const room = rooms.rows.find((row) => row.id === roomId);
  const current = room?.status;

  const set = (status: HkStatus) => {
    setFailed(null);
    // Decided before the write, from the same connection the write is
    // buffered on, so the toast and the buffer can never disagree.
    const buffered = !connection.online;
    void actions.setRoomStatus(roomId, status).then((outcome) => {
      // An attendant who marks a room clean and is told it worked walks away;
      // the desk sees dirty and sends someone back. So only a write that
      // landed is said, and only then does the sheet close.
      if (outcome === 'error') {
        setFailed(status);
        return;
      }
      if (outcome !== 'done') return;
      toast.show(
        buffered
          ? t('work.offline.savedToast')
          : t('work.rooms.setToast', { room: roomId, status: t(STATUS_KEY[status]) }),
        buffered ? 'warning' : 'success',
      );
      router.back();
    });
  };

  const retry = () => {
    if (!failed) return;
    actions.clearFailure();
    set(failed);
  };

  if (rooms.status === 'loading') {
    return (
      <Sheet title={t('work.rooms.sheetTitle')} grabber>
        <SkeletonList
          rows={2}
          label={t('state.loadingList', { label: t('work.rooms.sheetListLabel') })}
        />
      </Sheet>
    );
  }

  if (rooms.status === 'error') {
    return (
      <Sheet title={t('work.rooms.sheetTitle')} grabber>
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('work.rooms.sheetListLabel') })}
          detail={rooms.error?.message}
          onRetry={rooms.retry}
        />
      </Sheet>
    );
  }

  if (!room) {
    return (
      <Sheet title={t('work.rooms.notFoundTitle')} grabber>
        <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
          {t('work.rooms.notFoundBody')}
        </Text>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={t('work.rooms.sheetTitle')}
      subtitle={t('work.rooms.sheetSubtitle', {
        room: roomId,
        type: room.type,
        floor: floorOf(roomId),
      })}
      grabber
      footer={
        // The escape hatch frame W4 draws under the four options. It is a real
        // route rather than a fifth status, because a fault is a ticket.
        <WorkButton
          variant="outline"
          align="stretch"
          leadingIcon="wrench"
          label={t('work.rooms.reportIssue')}
          onPress={() => {
            router.back();
            router.push({ pathname: '/report-fault', params: { room: roomId } });
          }}
        />
      }
    >
      {/* A status that did not save, above the options rather than below
          them: the attendant is about to press another one, and a failure they
          scroll past is a failure they press through. */}
      {failed ? (
        <WriteError title="work.writeFailedTitle" body="work.writeFailedBody" onRetry={retry} />
      ) : null}

      <View style={{ gap: space[2] }}>
        {HK_OPTIONS.map((option) => {
          const active = current === option;
          const tone = statusTone('housekeeping', option);
          const label = t(STATUS_KEY[option]);
          return (
            <PressableScale
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: actions.busy }}
              accessibilityLabel={label}
              disabled={actions.busy}
              haptic
              onPress={() => set(option)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                minHeight: WORK_TARGET,
                paddingHorizontal: space[4],
                borderRadius: radius.md,
                backgroundColor: active ? c.actionSubtle : c.surface2,
                borderWidth: active ? 1.5 : 1,
                borderColor: active ? c.borderBrand : c.borderSubtle,
              }}
            >
              <Text weight="semibold" size="md" color="textStrong" style={{ flex: 1 }}>
                {label}
              </Text>
              {active ? (
                <>
                  <Badge tone={tone}>{t('work.rooms.now')}</Badge>
                  <Icon name="check" size={19} color={c.textLink} />
                </>
              ) : null}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}
