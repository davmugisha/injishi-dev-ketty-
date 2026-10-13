/**
 * ModalSheet — a sheet that belongs to the screen under it rather than to the
 * router.
 *
 * **Two surfaces built this separately and Session 11 merged them.** Session 7
 * wrote `screens/tenant/modal-sheet.tsx` for frames R17 and R19; Session 10
 * wrote `screens/work/inline-sheet.tsx` for frame W5. Sessions 3, 8 and 9 each
 * hand-rolled a third of it inside their own overlays. Every one of them wrote
 * the same paragraph about why React Native's `Modal` and not an absolutely
 * positioned view, which is what makes this one component rather than five.
 *
 * ## Why this exists beside decision D8's `formSheet` routes
 *
 * D8 makes every sheet a ROUTE — on iOS an Expo Router `formSheet`, on Android
 * the app's own frame since 2026-10-11 (`sheet-route.tsx` says why) — and that
 * is right for a sheet that is reached from more than one place and deserves a
 * URL. It is wrong for the other kind, and both sessions named the same two
 * conditions:
 *
 *   - **It is bound to one row of one screen.** A `/inspection/fail?room=201`
 *     that opened on a queue nobody had loaded is a route with no meaning.
 *   - **It is a confirm step inside an action already begun.** Pushing a route
 *     to ask "are you sure" means the question survives a back gesture and can
 *     be deep-linked to, and a confirmation reachable without the action behind
 *     it is worse than no confirmation.
 *
 * React Native's own `Modal` is the platform's overlay primitive and needs no
 * dependency. Only `Modal` puts the content in its own window: it lands above
 * the tab bar and any sticky bar, it takes the hardware back button on Android
 * (`onRequestClose`), and `accessibilityViewIsModal` is what stops a reader
 * swiping into the page underneath and reading a screen it cannot touch.
 *
 * The body is the kit's own `Sheet`, so this and a real `formSheet` route are
 * the same anatomy — grabber, title, close, body, footer — and a reader cannot
 * tell which mechanism drew one.
 *
 * Motion: `slide` is the platform's own sheet transition. Under reduced motion
 * it becomes `fade`, the same state change with the travel taken out (design
 * brief §7.6) — the substitution `app/_layout.tsx` makes for screen transitions.
 */
import { type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Sheet } from './sheet';
import { OutsideSheetFrame } from './sheet-route';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';

export interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** Hide the close control where the only way out should be an explicit choice. */
  closable?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

export function ModalSheet({
  visible,
  onClose,
  title,
  subtitle,
  eyebrow,
  closable = true,
  footer,
  children,
}: ModalSheetProps) {
  const { c, radius, scrim } = useTheme();
  const t = useT();
  const reduced = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      // Android's hardware back has to dismiss the sheet, or it dismisses the
      // screen behind it and the reader loses the row they were on.
      onRequestClose={onClose}
      animationType={reduced ? 'fade' : 'slide'}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* The dimmed page behind. `scrim.caption` is the darkest ink-at-alpha
            the tokens carry and is scheme-independent, which is what a scrim
            has to be: it is a FIXED ground over a screen that has already
            resolved its own scheme, and one that inverted would go pale over a
            dark sheet. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('sheet.close')}
          onPress={onClose}
          style={{ flex: 1, backgroundColor: scrim.caption[1] }}
        />
        <View
          style={{
            // Tall enough for a four-field form, short enough that a confirm
            // does not open with a dead zone under its button.
            maxHeight: '86%',
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            overflow: 'hidden',
            backgroundColor: c.surface1,
          }}
        >
          {/* Its own sheet, never the route's: see OutsideSheetFrame. */}
          <OutsideSheetFrame>
            <Sheet
              title={title}
              subtitle={subtitle}
              eyebrow={eyebrow}
              grabber
              closable={closable}
              onClose={onClose}
              footer={footer}
            >
              {children}
            </Sheet>
          </OutsideSheetFrame>
        </View>
      </View>
    </Modal>
  );
}
