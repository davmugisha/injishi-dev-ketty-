/**
 * Avatar — user / property initials, with optional status dot. Port of the DS.
 */
import { View } from 'react-native';
import { Text } from './text';
import { useTheme } from '@/theme/theme';

const SIZES = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 } as const;
type Status = 'online' | 'away' | 'offline';

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function Avatar({
  name = '',
  size = 'md',
  square = false,
  status,
}: {
  name?: string;
  size?: keyof typeof SIZES | number;
  square?: boolean;
  status?: Status;
}) {
  const { c, radius } = useTheme();
  const px = typeof size === 'number' ? size : SIZES[size];
  const dot = Math.max(8, Math.round(px * 0.28));
  const statusColor: Record<Status, string> = {
    online: c.success500,
    away: c.warning500,
    offline: c.neutral400,
  };

  return (
    <View
      style={{
        width: px,
        height: px,
        borderRadius: square ? radius.md : radius.pill,
        backgroundColor: c.brand200,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* The initials are 38% of the avatar's diameter — a size DERIVED from a
          measurement, which is what `sizePx` exists for. No step on the type
          scale could serve an avatar that is drawn at five different sizes. */}
      <Text weight="semibold" sizePx={Math.round(px * 0.38)} lineHeightPx={px} color="brand900">
        {initials(name)}
      </Text>
      {status ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            borderWidth: 2,
            borderColor: c.surface1,
            backgroundColor: statusColor[status],
          }}
        />
      ) : null}
    </View>
  );
}
