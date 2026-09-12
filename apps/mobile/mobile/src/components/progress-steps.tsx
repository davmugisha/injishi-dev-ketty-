/**
 * ProgressSteps — the Pending → In progress → Done rail of frame W3.
 *
 * Distinct from `Stepper`, and the difference is load bearing. A `Stepper`
 * tracks where the USER is in a flow they are driving; this tracks what state
 * a RECORD is in, which the user advances one step at a time and which other
 * people can move without them. Same drawing, opposite subject — merging them
 * would mean one component whose "current" sometimes means "you are here" and
 * sometimes means "the room is here".
 *
 * Frame W3 draws three states, and the interactive twin adds a fourth the rail
 * has to survive: `blocked`, where the record has stopped rather than
 * advanced. A blocked record shows its rail stalled at the step it reached,
 * tinted danger, because "in progress" and "stuck in progress" are not the
 * same fact to an attendant standing in a corridor.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { Palette } from '@/theme/tokens';

export interface ProgressStep {
  key: string;
  label: string;
}

export interface ProgressStepsProps {
  steps: readonly ProgressStep[];
  /** The step the record has reached, by key. */
  current: string;
  /** The record stopped here rather than advancing through it. */
  blocked?: boolean;
}

export function ProgressSteps({ steps, current, blocked = false }: ProgressStepsProps) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const index = Math.max(0, steps.findIndex((s) => s.key === current));

  const reachedFill: keyof Palette = blocked ? 'danger500' : 'success500';
  const currentFill: keyof Palette = blocked ? 'danger500' : 'action';

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      // The step names ARE the states here — "Pending", "In progress", "Done"
      // — so naming the one the record has reached says everything a second
      // vocabulary of done/current/pending would, in the reader's language.
      accessibilityLabel={t('a11y.stepOf', {
        index: index + 1,
        total: steps.length,
        label: steps[index]?.label ?? '',
      })}
      accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}
    >
      {steps.map((step, i) => {
        const done = i < index;
        const active = i === index;
        const dotFill = done ? c[reachedFill] : active ? c[currentFill] : c.surface3;
        return (
          <View key={step.key} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              {/* The rail either side of the dot. Drawn as two halves so the
                  first and last steps have no line hanging off the edge. */}
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: i === 0 ? 'transparent' : done || active ? c[reachedFill] : c.borderDefault,
                }}
              />
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dotFill,
                  borderWidth: done || active ? 0 : 1,
                  borderColor: c.borderDefault,
                }}
              >
                {done ? (
                  <Icon name="check" size={12} color={c.surface1} />
                ) : active && blocked ? (
                  <Icon name="alertTriangle" size={11} color={c.surface1} />
                ) : active ? (
                  <View
                    style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.surface1 }}
                  />
                ) : null}
              </View>
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor:
                    i === steps.length - 1 ? 'transparent' : done ? c[reachedFill] : c.borderDefault,
                }}
              />
            </View>
            <Text
              weight={active ? 'semibold' : 'regular'}
              size="xs"
              color={active ? 'textStrong' : 'textMuted'}
              center
              style={{ paddingHorizontal: space[1] }}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
