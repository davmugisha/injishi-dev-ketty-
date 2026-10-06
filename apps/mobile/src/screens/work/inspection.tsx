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
 *     an attendant without the flag never sees a control they cannot use. (The
 *     flag is true for every seat today: who may inspect is an owner decision,
 *     mobile audit 2026-10-05 WK-17.)
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
 *
 * **Neither used to check whether it worked.** Both toasted in the write's
 * `.then` whatever happened, and the screen had no failure state at all
 * (mobile audit 2026-10-05, WK-04 and WK-05). Both wait for the outcome now,
 * and a failure is said at the top with a Try again that sends it again.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ModalSheet,
  PressableScale,
  Screen,
  SkeletonList,
  Text,
  WriteError,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import { useMyIdentity } from '@/queries/profile';
import { WORK_TARGET, WorkBackRow, WorkButton, WorkChips, WorkOfflineBar } from './work-chrome';
import { TASK_KIND_KEY } from './work-format';
import type { FailReason, InspectionRow } from './work-fixtures';
import { useConnection, useWorkActions, useWorkInspections } from './work-store';

const REASONS: { value: FailReason; key: MessageKey }[] = [
  { value: 'bathroom', key: 'work.reason.bathroom' },
  { value: 'linen', key: 'work.reason.linen' },
  { value: 'dusting', key: 'work.reason.dusting' },
  { value: 'bin', key: 'work.reason.bin' },
];

/** A sign-off that did not land, kept so Try again can send the same one. */
interface FailedSignOff {
  kind: 'pass' | 'fail';
  row: InspectionRow;
}

export function Inspection() {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { c, space } = useTheme();

  const inspections = useWorkInspections();
  const actions = useWorkActions();
  const connection = useConnection();
  const me = useMyIdentity();

  /** The row whose fail sheet is open, and what has been ticked on it. */
  const [failing, setFailing] = useState<InspectionRow | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [failed, setFailed] = useState<FailedSignOff | null>(null);

  const rows = inspections.rows;

  // Frame W5's eyebrow names the PERSON signing. It used to print the personas
  // fixture, "Samuel Kayitare · Housekeeping supervisor", to every real seat
  // (mobile audit 2026-10-05, WK-02). It is the server's name for this person
  // or nothing, and no title: whether this seat is a supervisor at all is
  // WK-17's question, and the eyebrow will not answer it for them.
  const signer = me.fromServer ? me.name : me.pending ? '' : t('identity.unnamed');

  const pass = useCallback(
    (row: InspectionRow) => {
      setFailed(null);
      void actions.passInspection(row).then((outcome) => {
        if (outcome === 'error') {
          setFailed({ kind: 'pass', row });
          return;
        }
        if (outcome !== 'done') return;
        toast.show(t('work.inspection.passToast', { room: row.room }), 'success');
      });
    },
    [actions, t, toast],
  );

  const sendBack = useCallback(
    (row: InspectionRow) => {
      setFailed(null);
      void actions.failInspection(row).then((outcome) => {
        if (outcome === 'error') {
          setFailed({ kind: 'fail', row });
          return;
        }
        if (outcome !== 'done') return;
        toast.show(t('work.inspection.failToast', { room: row.room, name: row.by }), 'warning');
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
    sendBack(row);
  }, [failing, reasons.length, sendBack, t, toast]);

  const retry = () => {
    if (!failed) return;
    actions.clearFailure();
    if (failed.kind === 'pass') pass(failed.row);
    else sendBack(failed.row);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <WorkBackRow label={t('work.queue.title')} onPress={() => router.back()} />

        <View style={{ gap: space[2] }}>
          {/* Drawn in caps by `textTransform` rather than by upper-casing the
              string, which a screen reader would spell out letter by letter. */}
          {signer ? (
            <Text
              weight="bold"
              size="xs"
              color="textMuted"
              style={{ letterSpacing: 1.1, textTransform: 'uppercase' }}
            >
              {signer}
            </Text>
          ) : null}
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
          {/* The count waits for the read: before it lands there is no list to
              count, and the seed's three rows are not this property's (WK-24). */}
          {inspections.ready ? (
            <Text size="sm" color="textMuted">
              {rows.length === 1
                ? t('work.inspection.leadOne')
                : t('work.inspection.lead', { count: rows.length })}
            </Text>
          ) : null}
        </View>

        {failed ? (
          <WriteError title="work.writeFailedTitle" body="work.writeFailedBody" onRetry={retry} />
        ) : null}

        {/* The Work bar for the simulated outage only; a real one already has
            the app-wide banner (WK-25). The note is about the list, and holds
            for both. */}
        {connection.simulatedOnly ? (
          <WorkOfflineBar
            title={t('work.offline.bannerTitle')}
            detail={t('work.offline.simulatedDetail')}
          />
        ) : null}
        {!connection.online ? (
          // A sign-off made without signal is still the supervisor's, but the
          // list they are deciding from may be behind the desk, and they have
          // to be told.
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {t('state.offlineLastList')}
          </Text>
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
              <WorkButton
                variant="outline"
                label={t('work.task.backToQueue')}
                onPress={() => router.back()}
              />
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
                      minHeight: WORK_TARGET,
                      borderRadius: 10,
                      // The success fill carries its own designed ink,
                      // `textOnSuccess`, near-black. White on this green
                      // measured about 2.2:1 in light against a 4.5 floor
                      // (WK-16). The swipe Start panel paints the same pair,
                      // so the two greens on this surface agree.
                      backgroundColor: c.success500,
                    }}
                  >
                    <Icon name="check" size={19} color={c.textOnSuccess} />
                    <Text weight="semibold" size="md" color="textOnSuccess">
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
                      minHeight: WORK_TARGET,
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
            <WorkButton
              variant="danger"
              align="stretch"
              label={t('work.inspection.failReturn', { name: failing?.by ?? '' })}
              onPress={confirmFail}
              // Disabled until a reason is ticked: the sheet's whole purpose is
              // that the attendant is told what to redo.
              disabled={reasons.length === 0 || actions.busy}
            />
            <Text size="xs" color="textMuted" center style={{ lineHeight: 18 }}>
              {t('work.inspection.blockNote', { room: failing?.room ?? '' })}
            </Text>
          </>
        }
      >
        <WorkChips
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
