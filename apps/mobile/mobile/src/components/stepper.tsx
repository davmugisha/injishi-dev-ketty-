/**
 * Stepper — the numbered progress header on a multi-step flow.
 *
 * Motivated by the Guest canvas booking artboards (BookDates, BookSummary,
 * BookPay) and by self check-in. Both are flows where the reader has to know
 * three things at once: where they are, how far it goes, and whether the step
 * behind them is done. A bare "2 of 3" answers only the first.
 *
 * Steps behind the current one are `done` and take a check rather than their
 * number — the shape change is what makes progress readable in greyscale and
 * to a colour-blind reader (design brief §7.5, never colour alone).
 *
 * Not pressable. The canvas never draws a step you can jump to, and a stepper
 * that lets you skip forward into a step whose input has not been collected is
 * a flow that has to validate backwards.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export interface StepperProps {
  steps: readonly string[];
  /** Zero-based. */
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  const { c, space, radius } = useTheme();
  const t = useT();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('a11y.stepOf', {
        index: current + 1,
        total: steps.length,
        label: steps[current] ?? '',
      })}
      accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}
    >
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={step} style={{ flex: 1, gap: 6 }}>
            <View
              style={{
                height: 3,
                borderRadius: radius.pill,
                backgroundColor: done || active ? c.action : c.borderDefault,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {done ? (
                <Icon name="check" size={12} color={c.success600} />
              ) : (
                <Text
                  family="mono"
                  weight="semibold"
                  size="2xs"
                  color={active ? 'textStrong' : 'textMuted'}
                >
                  {String(i + 1)}
                </Text>
              )}
              <Text
                weight={active ? 'semibold' : 'regular'}
                size="xs"
                color={active ? 'textStrong' : 'textMuted'}
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {step}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
