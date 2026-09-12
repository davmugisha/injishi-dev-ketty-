/**
 * StatCard — KPI tile with label, value, optional unit / delta / icon.
 * Port of the DS StatCard.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { useTheme } from '@/theme/theme';

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: IconName;
  delta?: string;
  deltaDirection?: 'up' | 'down';
  caption?: string;
}

export function StatCard({ label, value, unit, icon, delta, deltaDirection, caption }: StatCardProps) {
  const { c, radius, shadow } = useTheme();
  const up = deltaDirection ? deltaDirection === 'up' : !!delta?.trim().startsWith('+');

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        borderRadius: radius.lg,
        padding: 16,
        gap: 8,
        ...shadow.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text weight="medium" size="sm" color="textMuted" style={{ flexShrink: 1 }}>
          {label}
        </Text>
        {icon ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: c.brand100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={17} color={c.brand700} />
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {unit ? (
          <Text family="body" weight="medium" size="md" color="textMuted" style={{ marginRight: 4 }}>
            {unit}
          </Text>
        ) : null}
        <Text family="display" weight="medium" size="2xl" color="textStrong">
          {value}
        </Text>
      </View>

      {delta || caption ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {delta ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon
                name={up ? 'chevronUp' : 'chevronDown'}
                size={14}
                color={up ? c.success600 : c.danger600}
              />
              <Text weight="semibold" size="sm" color={up ? c.success600 : c.danger600}>
                {delta}
              </Text>
            </View>
          ) : null}
          {caption ? (
            <Text size="sm" color="textMuted">
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
