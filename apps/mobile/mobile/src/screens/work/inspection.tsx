/**
 * Inspection — frame W5. The supervisor's gate.
 *
 * **Where inspection is required, `done` is not sellable; only `inspected` is**
 * (F-P04 §9, and P-O3 makes it a per-property config). That single rule is what
 * this screen exists for: an attendant's tick releases nothing, and the front
 * desk stays blocked on every room here until somebody with this screen open
 * has looked at it.
 *
 * Two decisions worth reading, both recorded in the session report:
 *
 *   - **The screen is reachable only when the seat holds the supervisor flag**
 *     (`WORK_PROFILE.supervisor`). The Queue's callout is the only way in, and
 *     an attendant without the flag never sees a control they cannot use.
 *   - **A supervisor cannot sign off a room they cleaned themselves.** The rows
 *     here are other attendants' rooms; the viewer's own finished rooms are
 *     deliberately absent and the footnote says why. Decision D7 puts one
 *     person in every seat, so without that rule this screen would offer to let
 *     someone approve their own work — a segregation of duties nobody would
 *     ship, and the reason a reader does not find room 205 here after finishing
 *     it two minutes ago.
 *
 * Pass and Fail are drawn with equal weight and opposite tone. Fail is not a
 * destructive action to hide behind a menu — it is half of what the screen is
 * for — but it does open a sheet, because sending a room back without saying
 * what was wrong is a message the attendant cannot act on.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Icon,
  ModalSheet,
  PressableScale,
  Screen,
  SkeletonList,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import { WorkBackRow, WorkOfflineBar } from './work-chrome';
import { TASK_KIND_KEY } from './work-format';
import { ME } from '@/data/personas';
import type { FailReason, InspectionRow } from './work-fixtures';
import { useConnection, useWorkActions, useWorkInspections } from './work-store';

const REASONS: { value: FailReason; key: MessageKey }[] = [
  { value: 'bathroom', key: 'work.reason.bathroom' },
  { value: 'linen', key: 'work.reason.linen' },
  { value: 'dusting', key: 'work.reason.dusting' },
  { value: 'bin', key: 'work.reason.bin' },
];

export function Inspection() {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { c, space } = useTheme();

  const inspections = useWorkInspections();
  const actions = useWorkActions();
  const connection = useConnection();

  /** The row whose fail sheet is open, and what has been ticked on it. */
  const [failing, setFailing] = useState<InspectionRow | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);

  const rows = inspections.rows;

  const pass = useCallback(
    (row: InspectionRow) => {
      void actions.passInspection(row).then(() => {
        toast.show(t('work.inspection.passToast', { room: row.room }), 'success');
      });
    },
    [actions, t, toast],
  );

  const openFail = useCallback((row: InspectionRow) => {
    setFailing(row);
    setReasons([]);
  }, []);

  const confirmFail = useCallback(() => {
    if (!failing) return;
    if (reasons.length === 0) {
      toast.show(t('work.inspection.failNeedReason'), 'warning');
      return;
    }
    const row = failing;
    setFailing(null);
    void actions.failInspection(row).then(() => {
      toast.show(t('work.inspection.failToast', { room: row.room, name: row.by }), 'warning');
    });
  }, [actions, failing, reasons.length, t, toast]);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <WorkBackRow label={t('work.queue.title')} onPress={() => router.back()} />

        <View style={{ gap: space[2] }}>
          {/* Frame W5's eyebrow names the PERSON, not the property: this is the
              one Work screen where the question is who is signing, not where.
              Drawn in caps by `textTransform` rather than by upper-casing the
              string, which a screen reader would spell out letter by letter. */}
          <Text
            weight="bold"
            size="xs"
            color="textMuted"
            style={{ letterSpacing: 1.1, textTransform: 'uppercase' }}
          >
            {t('work.inspection.eyebrow', { name: ME.name })}
          </Text>
          <Text
            accessibilityRole="header"
            family="display"
            weight="semibold"
            size="2xl"
            color="textStrong"
            style={{ letterSpacing: -0.4 }}
          >
            {t('work.inspection.title')}
          </Text>
          <Text size="sm" color="textMuted">
            {rows.length === 1
              ? t('work.inspection.leadOne')
              : t('work.inspection.lead', { count: rows.length })}
          </Text>
        </View>

        {!connection.online ? (
          <>
            <WorkOfflineBar
              title={t('work.offline.bannerTitle')}
              detail={t('work.offline.realOffline')}
            />
            {/* A sign-off made without signal is still the supervisor's, and it
                replays like any other change — but the list they are deciding
                from may be behind the desk, and they have to be told. */}
            <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
              {t('state.offlineLastList')}
            </Text>
          </>
        ) : null}

        {inspections.status === 'loading' ? (
          <SkeletonList
            rows={3}
            label={t('state.loadingList', { label: t('work.inspection.listLabel') })}
          />
        ) : inspections.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('work.inspection.listLabel') })}
            detail={inspections.error?.message}
            onRetry={inspections.retry}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="checkCircle"
            title={t('work.inspection.emptyTitle')}
            body={t('work.inspection.emptyBody')}
            action={
              <Button variant="outline" onPress={() => router.back()}>
                {t('work.task.backToQueue')}
              </Button>
            }
          />
        ) : (
          rows.map((row) => (
            <Card key={row.room}>
              <View style={{ gap: space[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                  <Text family="mono" weight="semibold" size="2xl" color="textStrong">
                    {row.room}
                  </Text>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text weight="semibold" size="sm" color="textStrong">
                      {`${t(TASK_KIND_KEY[row.kind])} · ${row.by}`}
                    </Text>
                    <Text size="xs" color="textMuted">
                      {t('work.inspection.doneAt', { time: row.doneAt, minutes: row.minutes })}
                    </Text>
                  </View>
                  <Badge tone="warning" dot>
                    {t('status.task.done')}
                  </Badge>
                </View>

                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <PressableScale
                    accessibilityLabel={`${t('work.inspection.pass')} ${row.room}`}
                    haptic
                    disabled={actions.busy}
                    onPress={() => pass(row)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 50,
                      borderRadius: 10,
                      backgroundColor: c.success500,
                    }}
                  >
                    <Icon name="check" size={19} color={c.surface1} />
                    <Text weight="semibold" size="md" color={c.surface1}>
                      {t('work.inspection.pass')}
                    </Text>
                  </PressableScale>

                  <PressableScale
                    accessibilityLabel={`${t('work.inspection.fail')} ${row.room}`}
                    disabled={actions.busy}
                    onPress={() => openFail(row)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 50,
                      borderRadius: 10,
                      backgroundColor: c.surface1,
                      borderWidth: 1.5,
                      borderColor: c.danger500,
                    }}
                  >
                    <Icon name="x" size={19} color={c.danger600} />
                    <Text weight="semibold" size="md" color="danger600">
                      {t('work.inspection.fail')}
                    </Text>
                  </PressableScale>
                </View>

                <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
                  {t('work.inspection.blockNote', { room: row.room })}
                </Text>
              </View>
            </Card>
          ))
        )}

        <Text size="xs" color="textMuted" style={{ lineHeight: 19 }}>
          {t('work.inspection.footnote')}
        </Text>
      </Screen>

      <ModalSheet
        visible={failing !== null}
        title={t('work.inspection.failTitle', { room: failing?.room ?? '' })}
        subtitle={t('work.inspection.failBody', { name: failing?.by ?? '' })}
        onClose={() => setFailing(null)}
        footer={
          <>
            <Button
              variant="danger"
              size="lg"
              block
              onPress={confirmFail}
              // Disabled until a reason is ticked: the sheet's whole purpose is
              // that the attendant is told what to redo.
              disabled={reasons.length === 0 || actions.busy}
            >
              {t('work.inspection.failReturn', { name: failing?.by ?? '' })}
            </Button>
            <Text size="xs" color="textMuted" center style={{ lineHeight: 18 }}>
              {t('work.inspection.blockNote', { room: failing?.room ?? '' })}
            </Text>
          </>
        }
      >
        <ChipGroup
          mode="multi"
          wrap
          legend={t('work.inspection.failLegend')}
          value={reasons}
          onChange={setReasons}
          items={REASONS.map((reason) => ({ value: reason.value, label: t(reason.key) }))}
        />
      </ModalSheet>
    </View>
  );
}

