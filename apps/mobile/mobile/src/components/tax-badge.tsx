/**
 * TaxBadge — RRA (Rwanda Revenue Authority) compliance indicator. Port of the
 * DS TaxBadge; bordered tint chip with a shield glyph and canonical label.
 */
import { View } from 'react-native';
import { Icon } from './icon';
import { Text } from './text';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';

type Status = 'compliant' | 'due' | 'overdue' | 'exempt';

const LABELS: Record<Status, MessageKey> = {
  compliant: 'tax.compliant',
  due: 'tax.due',
  overdue: 'tax.overdue',
  exempt: 'tax.exempt',
};

export function TaxBadge({
  status = 'compliant',
  label,
  reference,
}: {
  status?: Status;
  label?: string;
  reference?: string;
}) {
  const { c, radius } = useTheme();
  const t = useT();
  const style: Record<Status, { bg: string; border: string; ink: string }> = {
    compliant: { bg: c.success100, border: c.borderDefault, ink: c.success600 },
    due: { bg: c.warning100, border: c.borderDefault, ink: c.warning600 },
    overdue: { bg: c.danger100, border: c.borderDefault, ink: c.danger600 },
    exempt: { bg: c.neutral100, border: c.borderSubtle, ink: c.neutral600 },
  };
  const s = style[status];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        alignSelf: 'flex-start',
        height: 26,
        paddingLeft: 8,
        paddingRight: 10,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: s.border,
        backgroundColor: s.bg,
      }}
    >
      <Icon name="shield" size={14} color={s.ink} />
      <Text weight="semibold" size="xs" color={s.ink}>
        {label ?? t(LABELS[status])}
      </Text>
      {reference ? (
        <Text family="mono" size="xs" color={s.ink} style={{ opacity: 0.85 }}>
          {reference}
        </Text>
      ) : null}
    </View>
  );
}
