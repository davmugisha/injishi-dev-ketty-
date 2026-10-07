/**
 * Report a fault — frame W6. Photo first, filed while walking.
 *
 * F-P05's success criterion is "a housekeeper files a photo ticket from the
 * room in under 20 seconds", and every decision here is that number:
 *
 *   - **The photo is the first control on the sheet**, above the room and above
 *     the words. A picture of a fault is faster and more accurate than a
 *     sentence typed one-handed in a corridor, and it is what the Engineering
 *     board leads with.
 *   - **The room is pre-chosen** from wherever the sheet was opened — a task, a
 *     tile, a swipe — so the common case is three taps: photo, fault, severity.
 *   - **The line is optional.** A ticket with a photograph and a category is
 *     already actionable; blocking on prose would be the thing that stops it
 *     being filed at all.
 *
 * **Opened with no room — from the Tickets tab — no room is chosen.** It used
 * to quietly select the first room in the list and call it "the room you are
 * standing in", and filing then took THAT room out of order and blocked its
 * task (mobile audit 2026-10-05, WK-07). The person picks one now, and the hint
 * appears only when the room really did come from where they are standing.
 *
 * **The primary is inert until everything a ticket needs is chosen, and it
 * says what is missing** — its label becomes "Pick the room" or "Pick a fault
 * and severity", which is frame W6's own behaviour. A disabled button with the
 * finished label leaves the reader hunting for what is missing.
 *
 * **It files once.** The primary stayed pressable while saving and the filing
 * ignored the busy flag, so two taps filed two tickets with the same reference
 * (WK-08). A second tap now does nothing, and the primary says so by greying.
 *
 * The consequence is printed under the button rather than discovered after it:
 * filing takes the room out of order and blocks its cleaning task, and someone
 * standing in that room should know that before they press, not from a toast.
 */
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ErrorState,
  PhotoPicker,
  PressableScale,
  Sheet,
  SkeletonList,
  Text,
  TextArea,
  useToast,
  type PickedPhoto,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import {
  FAULTS,
  FAULT_KEY,
  SEVERITIES,
  SEVERITY_KEY,
} from './work-format';
import { WORK_TARGET, WorkButton, WorkChips, type WorkChipItem } from './work-chrome';
import { roomTypeOf, type FaultCategory, type Severity } from './work-fixtures';
import { useConnection, useWorkActions, useWorkRooms, useWorkTasks } from './work-store';

/** Frame W6 draws High in warning fill and Urgent in danger: a severity IS a risk. */
const SEVERITY_TONE: Record<Severity, WorkChipItem['tone']> = {
  low: 'brand',
  normal: 'brand',
  high: 'warning',
  urgent: 'danger',
};

export function ReportFault({ presetRoom }: { presetRoom?: string }) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { space } = useTheme();

  const rooms = useWorkRooms();
  const tasks = useWorkTasks();
  const actions = useWorkActions();
  const connection = useConnection();

  /**
   * Every room this phone could be standing in: the board's own, plus any room
   * on the queue that the board does not draw (the queue spans three floors,
   * the board draws one). Sorted, deduplicated, and with the preset kept even
   * when neither list carries it.
   */
  const candidates = useMemo(() => {
    const ids = new Set<string>([
      ...(presetRoom ? [presetRoom] : []),
      ...rooms.rows.map((room) => room.id),
      ...tasks.rows.map((task) => task.id),
    ]);
    return [...ids].sort((a, b) => a.localeCompare(b));
  }, [presetRoom, rooms.rows, tasks.rows]);

  const [room, setRoom] = useState(presetRoom ?? '');
  const [fault, setFault] = useState<FaultCategory | ''>('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [line, setLine] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  /** In flight. The ref answers a second tap in the same frame; the state draws it. */
  const filing = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const roomsLoading = rooms.status === 'loading' || tasks.status === 'loading';
  const roomsFailed = rooms.status === 'error' || tasks.status === 'error';

  /** What is still missing, as the sentence the primary says; none when ready. */
  const missing: MessageKey | null =
    room === '' ? 'work.report.needRoom' : fault === '' || severity === '' ? 'work.report.needBoth' : null;
  const ready = missing === null;

  const blocksTask = tasks.rows.some(
    (task) => task.id === room && task.status !== 'done' && task.status !== 'inspected',
  );

  const file = () => {
    if (filing.current) return;
    if (missing !== null || fault === '' || severity === '') {
      toast.show(t(missing ?? 'work.report.needBoth'), 'warning');
      return;
    }
    filing.current = true;
    setSaving(true);
    setFailed(false);
    // Decided before the write, from the connection it is buffered on.
    const buffered = !connection.online;
    void actions
      .fileFault({
        room,
        category: fault,
        severity,
        line: line.trim(),
        photos: photos.length,
      })
      .then(({ outcome, ref }) => {
        filing.current = false;
        setSaving(false);
        if (outcome === 'error') {
          setFailed(true);
          return;
        }
        if (outcome !== 'done') return;
        toast.show(
          buffered ? t('work.offline.savedToast') : t('work.report.filedToast', { ref, room }),
          'warning',
        );
        // Back out of the sheet first, then land on the board the ticket went
        // to. Frame W6 ends on Tickets, and it should: the reader's next
        // question is "did it actually go anywhere".
        router.back();
        router.navigate('/tickets');
      });
  };

  return (
    <Sheet
      title={t('work.report.title')}
      eyebrow={t('work.report.eyebrow')}
      grabber
      footer={
        <>
          {failed ? (
            <WriteError
              title="work.faultFailedTitle"
              body="work.faultFailedBody"
              onRetry={() => {
                actions.clearFailure();
                file();
              }}
            />
          ) : null}
          <PrimaryAction
            label={missing === null ? t('work.report.send') : t(missing)}
            ready={ready}
            busy={saving}
            onPress={file}
          />
          {room !== '' ? (
            <Text size="xs" color="textMuted" center style={{ lineHeight: 18 }}>
              {blocksTask
                ? t('work.report.consequence', { room })
                : t('work.report.consequenceNoTask', { room })}
            </Text>
          ) : null}
        </>
      }
    >
      {/* 1. The photograph. It leads the ticket, so it leads the form. */}
      <View style={{ gap: space[2] }}>
        <Legend>{t('work.report.photoLegend')}</Legend>
        <PhotoPicker
          value={photos}
          onChange={setPhotos}
          max={3}
          hint={t('picker.leadHint')}
        />
      </View>

      {/* 2. The room: chosen already when the sheet knows where it was opened. */}
      {roomsLoading ? (
        <SkeletonList
          rows={1}
          label={t('state.loadingList', { label: t('work.report.roomListLabel') })}
        />
      ) : roomsFailed ? (
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('work.report.roomListLabel') })}
          onRetry={() => {
            rooms.retry();
            tasks.retry();
          }}
        />
      ) : (
        <WorkChips
          legend={t('work.report.roomLegend')}
          value={room}
          onChange={setRoom}
          items={candidates.map((id) => ({
            value: id,
            label: t('work.report.roomOption', { room: id }),
          }))}
        />
      )}
      {room !== '' ? (
        <Text size="xs" color="textMuted" style={{ marginTop: -space[2] }}>
          {room === presetRoom
            ? `${roomTypeOf(room)} · ${t('work.report.roomHint')}`
            : roomTypeOf(room)}
        </Text>
      ) : null}

      {/* 3 and 4. What, and how bad. */}
      <WorkChips
        wrap
        legend={t('work.report.faultLegend')}
        value={fault}
        onChange={(value) => setFault(value as FaultCategory)}
        items={FAULTS.map((value) => ({ value, label: t(FAULT_KEY[value]) }))}
      />

      <WorkChips
        wrap
        legend={t('work.report.severityLegend')}
        value={severity}
        onChange={(value) => setSeverity(value as Severity)}
        items={SEVERITIES.map((value) => ({
          value,
          label: t(SEVERITY_KEY[value]),
          tone: SEVERITY_TONE[value],
        }))}
      />

      {/* 5. One line, and it is optional. */}
      <TextArea
        label={t('work.report.lineLegend')}
        value={line}
        onChangeText={setLine}
        placeholder={t('work.report.linePlaceholder')}
        helper={t('work.report.lineHint')}
        rows={2}
        maxLength={140}
      />

      <WorkButton
        variant="ghost"
        align="center"
        label={t('work.report.cancel')}
        onPress={() => router.back()}
      />
    </Sheet>
  );
}

function Legend({ children }: { children: string }) {
  return (
    <Text
      weight="bold"
      size="xs"
      color="textMuted"
      style={{ letterSpacing: 1, textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  );
}

/** The tall primary the sheet footer pins. Its label IS the validation state. */
function PrimaryAction({
  label,
  ready,
  busy,
  onPress,
}: {
  label: string;
  ready: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { c, space, radius } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled: !ready || busy }}
      haptic={ready && !busy}
      // Pressable while not ready, so a tap explains what is missing rather
      // than doing nothing — the same reasoning the Queue's "Nothing pending"
      // primary uses. NOT pressable while saving: that tap would file twice.
      disabled={busy}
      onPress={onPress}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: WORK_TARGET,
        paddingHorizontal: space[4],
        paddingVertical: 12,
        borderRadius: radius.md,
        backgroundColor: ready ? c.action : c.surface3,
      }}
    >
      <Text weight="semibold" size="md" center color={ready ? c.bgApp : 'textMuted'}>
        {label}
      </Text>
    </PressableScale>
  );
}
