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
 * **The primary is disabled until a fault and a severity are chosen, and it
 * says so** — its label becomes "Pick a fault and severity", which is frame
 * W6's own behaviour. A disabled button with the finished label leaves the
 * reader hunting for what is missing.
 *
 * The consequence is printed under the button rather than discovered after it:
 * filing takes the room out of order and blocks its cleaning task, and someone
 * standing in that room should know that before they press, not from a toast.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChipGroup,
  PhotoPicker,
  PressableScale,
  Sheet,
  Text,
  TextArea,
  useToast,
  type PickedPhoto,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { useT } from '@/i18n/i18n';
import {
  FAULTS,
  FAULT_KEY,
  SEVERITIES,
  SEVERITY_KEY,
} from './work-format';
import { roomTypeOf, type FaultCategory, type Severity } from './work-fixtures';
import { useConnection, useWorkActions, useWorkRooms, useWorkTasks } from './work-store';

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
   * the board draws one). Sorted, deduplicated, and with the preset first so
   * the common case needs no scrolling.
   */
  const candidates = useMemo(() => {
    const ids = new Set<string>([
      ...(presetRoom ? [presetRoom] : []),
      ...rooms.rows.map((room) => room.id),
      ...tasks.rows.map((task) => task.id),
    ]);
    return [...ids].sort((a, b) => a.localeCompare(b));
  }, [presetRoom, rooms.rows, tasks.rows]);

  const [room, setRoom] = useState(() => presetRoom ?? candidates[0] ?? '');
  const [fault, setFault] = useState<FaultCategory | ''>('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [line, setLine] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  const ready = fault !== '' && severity !== '';
  const blocksTask = tasks.rows.some(
    (task) => task.id === room && task.status !== 'done' && task.status !== 'inspected',
  );

  const file = () => {
    if (!ready) {
      toast.show(t('work.report.needBoth'), 'warning');
      return;
    }
    void actions
      .fileFault({
        room,
        category: fault,
        severity,
        line: line.trim(),
        photos: photos.length,
      })
      .then((ref) => {
        if (actions.failed) return;
        toast.show(
          connection.online
            ? t('work.report.filedToast', { ref, room })
            : t('work.offline.savedToast'),
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
          {actions.failed ? (
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
            label={ready ? t('work.report.send') : t('work.report.needBoth')}
            ready={ready}
            busy={actions.busy}
            onPress={file}
          />
          <Text size="xs" color="textMuted" center style={{ lineHeight: 18 }}>
            {blocksTask
              ? t('work.report.consequence', { room })
              : t('work.report.consequenceNoTask', { room })}
          </Text>
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

      {/* 2. The room, already chosen. */}
      <ChipGroup
        legend={t('work.report.roomLegend')}
        value={room}
        onChange={setRoom}
        items={candidates.map((id) => ({
          value: id,
          label: t('work.report.roomOption', { room: id }),
        }))}
      />
      <Text size="xs" color="textMuted" style={{ marginTop: -space[2] }}>
        {`${roomTypeOf(room)} · ${t('work.report.roomHint')}`}
      </Text>

      {/* 3 and 4. What, and how bad. */}
      <ChipGroup
        wrap
        legend={t('work.report.faultLegend')}
        value={fault}
        onChange={(value) => setFault(value as FaultCategory)}
        items={FAULTS.map((value) => ({ value, label: t(FAULT_KEY[value]) }))}
      />

      <SeverityChips legend={t('work.report.severityLegend')} value={severity} onChange={setSeverity} />

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

      <PressableScale
        accessibilityLabel={t('work.report.cancel')}
        onPress={() => router.back()}
        style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}
      >
        <Text weight="medium" size="sm" color="textMuted">
          {t('work.report.cancel')}
        </Text>
      </PressableScale>
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

/**
 * Severity, with the tone the frame draws.
 *
 * `ChipGroup` is the right control everywhere else and is used for the fault
 * category above, but it paints every selection in one accent — and frame W6
 * draws High in warning fill for a reason a generic chip cannot express: a
 * severity IS a risk, and a supervisor scanning the board needs the hot ones to
 * look hot. The accessibility contract is the same as `ChipGroup`'s: a
 * `radiogroup` of `radio`s that report their selected state.
 */
function SeverityChips({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: Severity | '';
  onChange: (value: Severity) => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();

  const tone = (severity: Severity): { bg: keyof Palette; fg: keyof Palette; edge: keyof Palette } =>
    severity === 'urgent'
      ? { bg: 'danger100', fg: 'danger600', edge: 'danger500' }
      : severity === 'high'
        ? { bg: 'warning100', fg: 'warning600', edge: 'warning500' }
        : { bg: 'actionSubtle', fg: 'brand700', edge: 'brand300' };

  return (
    <View style={{ gap: space[2] }}>
      <Legend>{legend}</Legend>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={legend}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
      >
        {SEVERITIES.map((severity) => {
          const on = value === severity;
          const paint = tone(severity);
          return (
            <PressableScale
              key={severity}
              accessibilityRole="radio"
              accessibilityLabel={t(SEVERITY_KEY[severity])}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(severity)}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 16,
                borderRadius: radius.sm,
                backgroundColor: on ? c[paint.bg] : c.surface2,
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? c[paint.edge] : c.borderSubtle,
              }}
            >
              <Text weight={on ? 'semibold' : 'medium'} size="sm" color={on ? paint.fg : 'textBody'}>
                {t(SEVERITY_KEY[severity])}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
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
      haptic={ready}
      // Not `disabled`: the control stays reachable so a tap explains what is
      // missing rather than doing nothing, which is the same reasoning the
      // Queue's "Nothing pending" primary uses.
      onPress={onPress}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 54,
        paddingHorizontal: space[4],
        paddingVertical: 12,
        borderRadius: radius.md,
        backgroundColor: ready ? c.action : c.surface3,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <Text weight="semibold" size="md" center color={ready ? c.bgApp : 'textMuted'}>
        {label}
      </Text>
    </PressableScale>
  );
}
