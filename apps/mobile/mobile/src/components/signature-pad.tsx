/**
 * SignaturePad — the e-signature capture FL21 step 3 asks for, drawn with
 * nothing but `PanResponder` and plain views.
 *
 * The obvious libraries all pull a native module in behind them:
 * `react-native-signature-canvas` is a WebView, Skia is a whole renderer, and
 * `react-native-svg` is a third. None of them are worth a new native dependency
 * for one screen — a signature is a polyline, and a polyline is a rounded view
 * per segment rotated to its own angle, plus a dot at each vertex so the joins
 * stay round. A few hundred views is nothing next to a WebView.
 *
 * The pad reports only whether it holds ink. The stroke itself never leaves
 * this component, because nothing downstream is wired to a signature service
 * yet (FL21 stores `tenantSignedAt` and an audit row server-side).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

interface Point {
  x: number;
  y: number;
}

/** Below this the sample adds a view and no visible ink. */
const MIN_STEP = 1.6;
const STROKE = 2.6;

export function SignaturePad({
  height = 190,
  onChange,
}: {
  height?: number;
  onChange?: (hasInk: boolean) => void;
}) {
  const { c, radius } = useTheme();
  const t = useT();
  const [strokes, setStrokes] = useState<Point[][]>([]);

  // PanResponder is created once, so its callbacks close over the first render.
  // Keep the writes on a ref and mirror to state for the paint.
  const ref = useRef<Point[][]>([]);
  const commit = (next: Point[][]) => {
    ref.current = next;
    setStrokes(next);
  };

  const hasInk = strokes.some((s) => s.length > 0);
  useEffect(() => {
    onChange?.(hasInk);
  }, [hasInk, onChange]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Capture on the way down as well: this pad sits inside a page
        // ScrollView, and without the capture pair a vertical stroke is read as
        // a scroll and the signature comes out as a series of dots.
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          commit([...ref.current, [{ x, y }]]);
        },
        onPanResponderMove: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          const all = ref.current;
          const stroke = all[all.length - 1];
          if (!stroke) return;
          const last = stroke[stroke.length - 1];
          if (last && Math.hypot(x - last.x, y - last.y) < MIN_STEP) return;
          commit([...all.slice(0, -1), [...stroke, { x, y }]]);
        },
      }),
    [],
  );

  return (
    <View style={{ gap: 8 }}>
      <View
        {...responder.panHandlers}
        accessibilityRole="none"
        accessibilityLabel={t('sign.padLabel')}
        accessibilityHint={t('sign.padHint')}
        style={{
          height,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.borderDefault,
          backgroundColor: c.surface2,
          overflow: 'hidden',
        }}
      >
        {/* Signature rule, so the pad reads as a line to sign on rather than a box. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: 44,
            height: 1,
            backgroundColor: c.borderStrong,
          }}
        />
        <View pointerEvents="none" style={{ position: 'absolute', left: 20, bottom: 24 }}>
          <Text size="xs" color="textSubtle">
            {hasInk ? t('sign.padCaptured') : t('sign.padPrompt')}
          </Text>
        </View>

        {strokes.map((stroke, si) => (
          <View
            key={si}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            {stroke.map((p, i) => {
              const prev = i > 0 ? stroke[i - 1] : undefined;
              const len = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0;
              return (
                <View key={i}>
                  {/* Round join at every vertex — also the whole mark for a tap. */}
                  <View
                    style={{
                      position: 'absolute',
                      left: p.x - STROKE / 2,
                      top: p.y - STROKE / 2,
                      width: STROKE,
                      height: STROKE,
                      borderRadius: STROKE / 2,
                      backgroundColor: c.textStrong,
                    }}
                  />
                  {prev && len > 0 ? (
                    <View
                      style={{
                        position: 'absolute',
                        left: (p.x + prev.x) / 2 - len / 2,
                        top: (p.y + prev.y) / 2 - STROKE / 2,
                        width: len,
                        height: STROKE,
                        borderRadius: STROKE / 2,
                        backgroundColor: c.textStrong,
                        transform: [{ rotate: `${Math.atan2(p.y - prev.y, p.x - prev.x)}rad` }],
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text size="xs" color="textSubtle" style={{ flex: 1, lineHeight: 17 }}>
          {t('sign.padHint')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('sign.padClear')}
          accessibilityState={{ disabled: !hasInk }}
          onPress={() => commit([])}
          disabled={!hasInk}
          hitSlop={12}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 32,
            paddingHorizontal: 10,
            opacity: hasInk ? 1 : 0.4,
          }}
        >
          <Icon name="rotateCcw" size={14} color={c.textMuted} />
          <Text weight="semibold" size="sm" color="textMuted">
            {t('sign.padClear')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
