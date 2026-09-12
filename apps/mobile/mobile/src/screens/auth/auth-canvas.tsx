/**
 * The full-bleed canvas the three auth screens stand on.
 *
 * Frames X1, X2 and X3 all draw the same page: no tab bar, no navigation
 * header, no card — the app's own ground running edge to edge with the copy
 * laid directly on it. `Screen` is the wrong scaffold for that (it owns a large
 * serif title block and a tab-bar-sized bottom inset), so this is the auth
 * stack's own and lives here rather than in the barrel until a second surface
 * needs it.
 *
 * Three things it owns, each of which is the thing an auth screen gets wrong:
 *
 *   - **The keyboard.** Every one of these screens is a form and two of them
 *     open the keyboard on arrival. `KeyboardAvoidingView` plus a scroller
 *     with `flexGrow: 1` is what keeps the primary action reachable on a small
 *     phone without the layout jumping on a larger one.
 *   - **`keyboardShouldPersistTaps="handled"`.** Without it the first tap on
 *     Continue is spent dismissing the keyboard and the second one submits,
 *     which reads as a dead button.
 *   - **The safe area, once.** `insets.top` plus room for `BackHeader` where
 *     there is one, `insets.bottom` under the footnote. Design brief 8.2: the
 *     real status bar draws over this, so nothing here paints a fake one.
 *
 * `bgApp` is the ground in both schemes. In dark that is the ink canvas frame
 * X1 draws; in light it is the same role's light value, which is the "and the
 * equivalent light" half of the same instruction. No hex, either way (D1).
 */
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader, Text } from '@/components';
import { useTheme } from '@/theme/theme';

export interface AuthCanvasProps {
  /** Draw the floating back control and reserve the room it needs. */
  back?: boolean;
  children: ReactNode;
}

export function AuthCanvas({ back = false, children }: AuthCanvasProps) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <KeyboardAvoidingView
        // Android resizes the window itself; asking for padding on top of that
        // double-counts the keyboard and pushes the form off the screen.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + (back ? 60 : space[6]),
            paddingBottom: insets.bottom + space[5],
            paddingHorizontal: space[4],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>

      {back ? <BackHeader /> : null}
    </View>
  );
}

/**
 * The "or" rule between the phone route and the federated one (frame X1).
 * A hairline either side of a word, which is a divider a reader can also hear.
 */
export function OrDivider({ label }: { label: string }) {
  const { c, space } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        marginVertical: space[5],
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: c.borderSubtle }} />
      <Text size="xs" color="textMuted">
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: c.borderSubtle }} />
    </View>
  );
}
