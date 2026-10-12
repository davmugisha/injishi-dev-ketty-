/**
 * Sheet routes — how a sheet ROUTE is presented on each platform, and the sheet
 * Android draws for itself.
 *
 * `app/_layout.tsx` registers every sheet route with `sheetRouteOptions(size)`
 * and hands the Stack `sheetScreenLayout`. Those two are the whole contract;
 * a route never names a presentation of its own (`sheet-route.test.tsx` fails
 * the suite if one does).
 *
 * ## Why Android does not get the platform sheet
 *
 * On 2026-10-11 the owner tapped Appearance, then Sign out, in Expo Go on an
 * Android phone. Both times the sheet never arrived: the tab bar jumped up by
 * the height of the gesture bar, the page under it stopped taking touches, and
 * only killing the app brought it back. Both routes were
 * `presentation: 'formSheet'`.
 *
 * react-native-screens builds that sheet on Android from `BottomSheetBehavior`,
 * and two things it does on the way make it depend on the host app's window:
 *
 *   - **It postpones the sheet's entering transition** until the stack's
 *     container has received window insets (`BottomSheetTransitionCoordinator`).
 *     A host that never delivers them leaves the sheet's screen committed and
 *     never shown, over a page that can no longer be touched — the freeze.
 *   - **It replaces the activity's DECOR VIEW insets listener** with its own
 *     (`InsetsObserverProxy.registerOnView`), whatever the host had put there —
 *     the jump.
 *
 * Expo Go is a host whose window does not survive either, and it carries its
 * own compiled copy of the library, so nothing in this repository can patch
 * it. A sheet that only works in a binary we built ourselves is a sheet the
 * owner cannot test, and a test path that differs from the shipped one proves
 * nothing about it. So on Android a sheet route is a `transparentModal`, which
 * reaches none of that code, and the sheet is drawn here: a scrim, a panel that
 * rises from the bottom edge and fits its content, a grabber and header that
 * drag it away, Android's back that closes it, and the kit's own `Sheet`
 * inside, so a reader cannot tell which platform drew one.
 *
 * Fitting the content is the other half of the fix. The native sheet's quarter
 * detent was a fixed fraction of the screen, and on a 720 × 1600 phone it cut
 * Appearance's third choice, Dark, off below the gesture bar.
 *
 * iOS keeps `UISheetPresentationController` (decision D8), which has neither
 * problem, and so does the web export, where Expo Router draws the sheet. Both
 * get exactly the options the route table always gave them.
 *
 * ## The one rule this frame keeps above all
 *
 * **Nothing here may leave a scrim on screen with no way out.** That is the
 * failure it replaces. So the panel is shown on a clock if its first layout
 * never reports, a dismissal pops the route on a clock rather than waiting for
 * an animation to say it ended, and a pop that did not happen puts the panel
 * back rather than leaving the reader looking at a dimmed page.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationOptions, Stack } from 'expo-router';
import { easingCurves, motionMs } from '@injishi/design-tokens';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';

/* ─────────────────────────────────────────────────── the route options ── */

/**
 * The three sheet shapes the route table uses. Named for what the sheet is,
 * not for how tall it is, because on Android the height is the content's.
 */
export type SheetSize = 'confirm' | 'form' | 'tall';

/**
 * Where iOS and the web export open each size: a confirm is a quarter sheet, a
 * form opens at half and expands to full, a long form opens nearly full. These
 * are the detents the route table always used, moved here unchanged.
 */
export const SHEET_DETENTS: Readonly<Record<SheetSize, readonly number[]>> = {
  confirm: [0.34],
  form: [0.55, 0.95],
  tall: [0.92],
};

/**
 * The presentation Android gets for every sheet route.
 *
 * `transparentModal` keeps the page underneath drawn and mounted, so the scrim
 * dims a real page and the page is exactly where the reader left it. `fade` is
 * the scrim's own entrance and exit; the panel's rise is drawn by the frame.
 * The transparent `contentStyle` overrides the Stack's `bgApp` ground, which
 * would otherwise paint over the page the sheet is meant to sit on.
 */
const ANDROID_SHEET: NativeStackNavigationOptions = {
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
};

/**
 * The options a sheet route is registered with.
 *
 * `os` is a parameter so a test can ask for either platform from one runtime;
 * the app always takes the default.
 */
export function sheetRouteOptions(
  size: SheetSize,
  os: string = Platform.OS,
): NativeStackNavigationOptions {
  if (os === 'android') return { ...ANDROID_SHEET };
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: [...SHEET_DETENTS[size]],
    sheetGrabberVisible: true,
  };
}

/* ────────────────────────────────────────────────── the screen layout ── */

type ScreenLayout = NonNullable<ComponentProps<typeof Stack>['screenLayout']>;
type ScreenLayoutArgs = Parameters<ScreenLayout>[0];
type SheetNavigation = Pick<ScreenLayoutArgs['navigation'], 'addListener' | 'goBack' | 'isFocused'>;

/**
 * The Stack's `screenLayout`: wraps an Android sheet route in the frame and
 * hands every other route back untouched.
 *
 * It recognises a sheet by its presentation. `transparentModal` is reserved for
 * sheets — `sheetRouteOptions` is the only place that writes it, and the test
 * fails if another file does — so the check cannot catch a route that is not
 * one.
 */
export function makeSheetScreenLayout(os: string = Platform.OS): ScreenLayout {
  return function sheetLayout({ options, navigation, children }: ScreenLayoutArgs): ReactElement {
    if (os !== 'android' || options.presentation !== 'transparentModal') return children;
    return <SheetFrame navigation={navigation}>{children}</SheetFrame>;
  };
}

/** The layout `app/_layout.tsx` gives the Stack. */
export const sheetScreenLayout: ScreenLayout = makeSheetScreenLayout();

/* ──────────────────────────────────────────────────────── the frame ── */

/** What the frame lends the `Sheet` inside it. */
export interface SheetFrameControls {
  /** Slide the panel away, then run `after` — the `Sheet`'s own close. */
  dismiss: (after: () => void) => void;
  /** The pull-down, attached by `Sheet` to its grabber and header. */
  drag: PanGesture;
}

const SheetFrameContext = createContext<SheetFrameControls | null>(null);

/**
 * The frame around this sheet, or null when the platform draws it (iOS, the
 * web export, and a `ModalSheet`, which brings its own).
 */
export function useSheetFrame(): SheetFrameControls | null {
  return useContext(SheetFrameContext);
}

/**
 * Cuts a subtree off from the frame around it. Context passes through React
 * Native's `Modal`, so without this a `ModalSheet` opened from inside an
 * Android sheet route would fit itself to the route's panel, and its close and
 * its header would dismiss the route behind it instead of itself.
 */
export function OutsideSheetFrame({ children }: { children: ReactNode }) {
  return <SheetFrameContext.Provider value={null}>{children}</SheetFrameContext.Provider>;
}

const SETTLE = Easing.bezier(...easingCurves.settle);
const LEAVE = Easing.bezier(...easingCurves.leave);

/** How far a finger travels downwards before the pull counts as a drag. */
const DRAG_ACTIVATION = 8;

/** A pull this far dismisses — or a third of the panel, if that is less. */
const DISMISS_DISTANCE = 120;
const DISMISS_SHARE = 1 / 3;

/** A flick this fast dismisses however short it was, in points per second. */
const DISMISS_VELOCITY = 900;

/**
 * How long a pop may take to land before the frame decides it did not, and
 * puts the panel back. Generous: the route's own fade has to finish first.
 */
export const SHEET_POP_GRACE_MS = motionMs.arrive * 2;

function SheetFrame({
  navigation,
  children,
}: {
  navigation: SheetNavigation;
  children: ReactNode;
}) {
  const { c, space, radius, scrim } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const reduced = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  /**
   * How far below its resting place the panel is drawn. It starts past the
   * bottom edge, so nothing shows before the first layout reports how tall
   * the panel is and the rise can start from exactly that far down.
   */
  const offset = useSharedValue(windowHeight);
  const panelHeight = useRef(0);
  const shown = useRef(false);
  const leaving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((ms: number, run: () => void) => {
    timers.current.push(setTimeout(run, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const show = useCallback(() => {
    if (shown.current) return;
    shown.current = true;
    if (reduced) {
      offset.set(0);
      return;
    }
    offset.set(panelHeight.current || windowHeight);
    offset.set(withTiming(0, { duration: motionMs.travel, easing: SETTLE }));
  }, [offset, reduced, windowHeight]);

  // The safety net for the rule in this file's header: a first layout that
  // never reports must not leave the panel parked below the screen.
  useEffect(() => {
    const id = setTimeout(show, motionMs.arrive);
    return () => clearTimeout(id);
  }, [show]);

  const onPanelLayout = useCallback(
    (event: LayoutChangeEvent) => {
      panelHeight.current = event.nativeEvent.layout.height;
      if (!leaving.current) show();
    },
    [show],
  );

  const settleBack = useCallback(() => {
    offset.set(withTiming(0, { duration: motionMs.settle, easing: SETTLE }));
  }, [offset]);

  /** Undo a dismissal that did not end in a pop: the panel comes back up. */
  const restore = useCallback(() => {
    if (!leaving.current) return;
    leaving.current = false;
    settleBack();
  }, [settleBack]);

  // A route opened over this sheet while it was sliding away leaves the
  // dismissal unfinished; coming back to the sheet must find it usable.
  useEffect(() => navigation.addListener('focus', restore), [navigation, restore]);

  const dismiss = useCallback(
    (after: () => void) => {
      if (leaving.current) return;
      leaving.current = true;
      const duration = reduced ? 0 : motionMs.settle;
      if (!reduced) {
        offset.set(
          withTiming(panelHeight.current || windowHeight, { duration, easing: LEAVE }),
        );
      }
      // On a clock, not on the animation's end: an animation that never
      // reports its end (the app sent to the background mid-flight) must not
      // be able to strand a scrim over a page nobody can touch.
      later(duration, () => {
        if (navigation.isFocused()) after();
        // Still here a beat later means the pop did not happen. The reader
        // gets the sheet back, never an empty dimmed page.
        later(SHEET_POP_GRACE_MS, () => {
          if (navigation.isFocused()) restore();
        });
      });
    },
    [later, navigation, offset, reduced, restore, windowHeight],
  );

  const pop = useCallback(() => navigation.goBack(), [navigation]);

  // Android's back closes the sheet rather than the page under it, and only
  // when this sheet is the top of the stack: a sheet with another route over
  // it lets that route answer.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      dismiss(pop);
      return true;
    });
    return () => sub.remove();
  }, [dismiss, navigation, pop]);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        // On the JS thread: the release decides a navigation, and the drag
        // itself is one number following one finger.
        .runOnJS(true)
        .activeOffsetY(DRAG_ACTIVATION)
        .failOffsetX([-DRAG_ACTIVATION, DRAG_ACTIVATION])
        .onUpdate((event) => {
          if (!leaving.current) offset.set(Math.max(0, event.translationY));
        })
        .onEnd((event, success) => {
          if (leaving.current) return;
          // Before the first layout the panel's height is unknown, not zero.
          const far =
            panelHeight.current > 0
              ? Math.min(DISMISS_DISTANCE, panelHeight.current * DISMISS_SHARE)
              : DISMISS_DISTANCE;
          if (success && (event.translationY > far || event.velocityY > DISMISS_VELOCITY)) {
            dismiss(pop);
          } else {
            settleBack();
          }
        })
        .withTestId('sheet-drag'),
    [dismiss, offset, pop, settleBack],
  );

  const controls = useMemo<SheetFrameControls>(() => ({ dismiss, drag }), [dismiss, drag]);
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  return (
    <SheetFrameContext.Provider value={controls}>
      {/* Padding, not a resize: under edge to edge the window does not shrink
          for the keyboard, so this is what keeps a sheet's field above it. */}
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + space[2] }}
      >
        {/* The dimmed page. `scrim.backdrop` is fixed in both schemes, which
            is what a wash over a page that has already chosen its own scheme
            has to be (ADR-064). */}
        <Pressable
          testID="sheet-scrim"
          accessibilityRole="button"
          accessibilityLabel={t('sheet.close')}
          onPress={() => dismiss(pop)}
          style={[StyleSheet.absoluteFill, { backgroundColor: scrim.backdrop }]}
        />
        <Animated.View
          testID="sheet-panel"
          onLayout={onPanelLayout}
          style={[
            {
              // Never taller than the space under the status bar; shorter
              // whenever the content is.
              maxHeight: '100%',
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              overflow: 'hidden',
              backgroundColor: c.surface1,
            },
            rise,
          ]}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </SheetFrameContext.Provider>
  );
}
