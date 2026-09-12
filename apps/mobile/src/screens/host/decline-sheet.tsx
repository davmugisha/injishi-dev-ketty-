/**
 * Declining a request — the reason, and the sentence the guest is told.
 *
 * ## Why a decline gets a sheet when an approve does not
 *
 * Not to confirm it. Both decisions are reversible for as long as the undo bar
 * is up, so a confirm on either would be noise. A decline gets a sheet because
 * it needs a REASON, and a reason asked for afterwards is a reason asked after
 * the guest has already been told no.
 *
 * ## The reason, and what actually reaches the wire
 *
 * `DeclineReason` on the contract has exactly two values, `host_declined` and
 * `expired`, and F-B11 makes both a 100% refund. So none of the four choices
 * below changes the record: every host decline is `host_declined`, whichever
 * chip is picked. What they change is what the GUEST reads, and that is worth
 * collecting — "those dates are not free" and "too many guests for the room"
 * lead a guest to two different next actions, and a bare "declined" leads them
 * to neither.
 *
 * The sheet says that out loud rather than implying the chips are a taxonomy
 * the server keeps. Inventing four wire values here would be forging an enum
 * the API does not have, which is exactly what decision D9 rules out.
 *
 * ## Why "another reason" demands a note
 *
 * The three named chips carry their own sentence. `Other` carries nothing, so a
 * decline sent under it with no note would reach the guest as silence. The
 * primary stays disabled until there is a line, and says why.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, ChipGroup, Icon, ModalSheet, Text, TextArea } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import type { HostBooking } from './host-fixtures';

/**
 * The four choices, and the message key each one sends. `other` has none,
 * which is what makes the note required rather than optional for it alone.
 */
const REASONS = [
  { value: 'dates', label: 'host.reasonDates' as MessageKey },
  { value: 'room', label: 'host.reasonRoom' as MessageKey },
  { value: 'party', label: 'host.reasonParty' as MessageKey },
  { value: 'other', label: 'host.reasonOther' as MessageKey },
] as const;

type Reason = (typeof REASONS)[number]['value'];

export function DeclineSheet({
  booking,
  onClose,
  onDeclined,
}: {
  booking: HostBooking | null;
  onClose: () => void;
  /** `note` is what the guest is told. It is stored, not collected and dropped. */
  onDeclined: (booking: HostBooking, note: string) => void;
}) {
  const { c, space } = useTheme();
  const t = useT();

  const [reason, setReason] = useState<Reason>('dates');
  const [note, setNote] = useState('');

  // A fresh sheet for a fresh booking: a reason left over from the last row is
  // a reason nobody chose for this one.
  useEffect(() => {
    if (booking) {
      setReason('dates');
      setNote('');
    }
  }, [booking]);

  const needsNote = reason === 'other' && note.trim().length === 0;

  return (
    <ModalSheet
      visible={booking !== null}
      title={t('host.declineTitle')}
      subtitle={booking ? t('host.declineSubtitle', { guest: booking.guest.name }) : undefined}
      onClose={onClose}
      footer={
        <View style={{ gap: space[2] }}>
          {needsNote ? (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLabel={t('host.declineNoteRequired')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Icon name="alertCircle" size={15} color={c.warning600} />
              <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
                {t('host.declineNoteRequired')}
              </Text>
            </View>
          ) : null}

          <Button
            variant="danger"
            size="lg"
            block
            disabled={needsNote}
            onPress={() => {
              if (!booking || needsNote) return;
              // A named chip carries its own sentence, so a host who typed
              // nothing still sends something the guest can act on.
              const written = note.trim();
              const chosen = REASONS.find((r) => r.value === reason)!;
              onDeclined(booking, written || t(chosen.label));
            }}
          >
            {t('host.declineConfirm')}
          </Button>
          <Button variant="ghost" size="lg" block onPress={onClose}>
            {t('host.declineCancel')}
          </Button>
        </View>
      }
    >
      <ChipGroup
        legend={t('host.declineReason')}
        wrap
        items={REASONS.map((r) => ({ value: r.value, label: t(r.label) }))}
        value={reason}
        onChange={(value) => setReason(value as Reason)}
      />

      <TextArea
        label={t('host.declineNote')}
        value={note}
        onChangeText={setNote}
        placeholder={t('host.declineNotePlaceholder')}
        helper={reason === 'other' ? undefined : t(REASONS.find((r) => r.value === reason)!.label)}
        testID="host-decline-note"
      />

      {/* The consequence, printed under the control rather than discovered
          after the tap. The canvas states this rule on nearly every frame. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Icon name="rotateCcw" size={15} color={c.textMuted} />
        <Text size="sm" color="textMuted" style={{ flex: 1, lineHeight: 19 }}>
          {t('host.declineWireNote')}
        </Text>
      </View>
    </ModalSheet>
  );
}
