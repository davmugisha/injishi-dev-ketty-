/**
 * The chrome every Work screen shares — the eyebrow, the sync line, the floor
 * tabs, the offline banner, the sticky primary, and the Work-sized button and
 * chips.
 *
 * **This surface is not the rest of the app, and the difference is physical.**
 * Frame W1's note is the brief: used one-handed, gloved, standing, in corridors
 * with no signal. So the targets here are larger than the design brief's 44pt
 * floor rather than merely at it, the primary is one and full-width, and the
 * status of the connection is on the screen at all times rather than surfaced
 * when something fails.
 *
 * **Work's floor is 56pt** (`WORK_TARGET`). The audit measured the surface's
 * own controls at 30 to 54 and every one of them is at 56 now (mobile audit
 * 2026-10-05, WK-15). What still falls short is the shared kit's, which this
 * folder may not edit: the `WriteError` retry, the `Sheet` close and the
 * `PhotoPicker` remove.
 *
 * Six pieces the shared kit could not supply as they are, each built here and
 * listed in the session report for Session 11 to lift if a second surface wants
 * one:
 *
 *   - `WorkFilterTabs`, because `SegmentedTabs` neither scrolls nor shrinks its
 *     label, and frame W8's contract is that Kinyarwanda labels drop to 11px
 *     rather than truncate.
 *   - `WorkStickyAction`, because `StickyBar` pads for the home indicator and
 *     inside a TAB screen the tab bar already owns that inset — and because a
 *     56pt primary whose label may wrap onto two lines is not `Button`'s
 *     fixed-height shape.
 *   - `WorkOfflineBar`, because `OfflineBanner` is the app-wide notice and says
 *     "you are offline"; this one counts a buffer and offers a reconnect, which
 *     is a different sentence to a different reader.
 *   - `WorkButton` and `WorkChips`, because `Button` draws at 32, 40 or 48 and
 *     `Tag` at 30, and neither takes a size this floor can use.
 *   - `WorkEyebrow`, which is one line but is on nine screens.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  Icon,
  PressableScale,
  SectionLabel,
  tabBarContentHeight,
  usePinnedFooter,
  type IconName,
} from '@/components';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { useT } from '@/i18n/i18n';
import { useDomain } from '@/domain';
import type { Phrase } from './work-format';

/**
 * The smallest target on this surface, in points. Above the app's 44 because
 * the reader is wearing gloves and carrying a trolley (frame W1).
 */
export const WORK_TARGET = 56;

/** `t()` applied to a `Phrase`. Every formatter here returns one. */
export function usePhrase(): (phrase: Phrase) => string {
  const t = useT();
  return (phrase) => t(phrase.key, phrase.values);
}

/**
 * "KIVU CREST HOTEL" — the property, and the town where there is one, on every
 * Work screen.
 *
 * It reads the active workspace rather than a constant, so an attendant moved
 * to a second property gets the right eyebrow without a code change.
 *
 * **The town is currently absent, and that is a known loss** (ADR-038 child 0
 * task 8). The eyebrow used to read "KIVU CREST HOTEL · RUBAVU" because
 * Session 0 put `town` on the `WorkspaceEntry` FIXTURE. The seats come from
 * `GET /api/v1/me/workspaces` now and `WorkspaceAccess` carries `propertyName`
 * but no town, so there is nothing to read. It degrades rather than breaking —
 * `filter(Boolean)` drops the empty half and the eyebrow reads the property
 * alone — and a `suffix` still replaces it, which is what frame W4 uses for
 * "36 ROOMS".
 *
 * Restoring the town means the server sending one, which is a contract change
 * and therefore its own decision rather than something to invent here.
 */
export function WorkEyebrow({ suffix }: { suffix?: string }) {
  const { workspace } = useDomain();
  const parts = [workspace.property ?? workspace.name, suffix ?? workspace.town].filter(Boolean);

  return (
    <Text
      weight="bold"
      size="xs"
      color="textMuted"
      style={{ letterSpacing: 1.1, textTransform: 'uppercase' }}
    >
      {parts.join(' · ')}
    </Text>
  );
}

/**
 * Frame W1's sync line: "● Online · 6 tasks · updated 14:03".
 *
 * The dot is a fill AND the sentence names the state, because a status told
 * only in colour is a status a colour-blind reader in sunlight does not have
 * (the canvas rule, restated on most frames).
 */
export function WorkSyncLine({ online, children }: { online: boolean; children: string }) {
  const { c } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={children}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: online ? c.success500 : c.warning500,
        }}
      />
      <Text size="sm" color="textMuted">
        {children}
      </Text>
    </View>
  );
}

export interface WorkTabItem {
  value: string;
  label: string;
  count?: number;
  /**
   * The whole sentence a screen reader hears, count and noun included:
   * "Floor 1, 2 rooms". Without it the tab says its label and its count.
   */
  a11yLabel?: string;
}

/**
 * Underline tabs that scroll and shrink.
 *
 * Frame W8's note is a layout contract rather than a suggestion: "tab labels
 * drop to 11px over 74px, the CTA wraps rather than clips. Nothing truncates."
 * The width is not knowable before layout, so the proxy is the composed label's
 * length, which is what actually varies between "All 6" and "Byose 6" —
 * measured in characters here, and the 12-character threshold is where the
 * Kinyarwanda floor labels cross the frame's 74px.
 *
 * **The count is its own pill.** It used to be joined to the label with a
 * space, and on a floor tab both halves are numbers: the device rig read
 * "Floor 1 2", eye and screen reader alike (mobile audit 2026-10-05, WK-12).
 * The pill is `SegmentedTabs`' own, so the two tab rows in the app agree.
 */
export function WorkFilterTabs({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly WorkTabItem[];
  value: string;
  onChange: (value: string) => void;
  /** What a screen reader calls the group. */
  label: string;
}) {
  const { c, space, radius } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ marginHorizontal: -space[4] }}
      contentContainerStyle={{ paddingHorizontal: space[4] }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: space[1],
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        }}
      >
        {items.map((item) => {
          const active = item.value === value;
          const composed = item.count == null ? item.label : `${item.label} ${item.count}`;
          const spoken =
            item.a11yLabel ?? (item.count == null ? item.label : `${item.label}, ${item.count}`);
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityLabel={spoken}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(item.value)}
              style={{
                minHeight: WORK_TARGET,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                paddingHorizontal: 14,
                borderBottomWidth: 2.5,
                borderBottomColor: active ? c.textStrong : 'transparent',
                marginBottom: -1,
              }}
            >
              <Text
                weight={active ? 'semibold' : 'medium'}
                size={composed.length > 12 ? '2xs' : 'sm'}
                color={active ? 'textStrong' : 'textMuted'}
              >
                {item.label}
              </Text>
              {item.count != null ? (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 1,
                    borderRadius: radius.pill,
                    backgroundColor: active ? c.brand100 : c.neutral200,
                  }}
                >
                  <Text family="mono" size="2xs" color={active ? 'brand700' : 'textMuted'}>
                    {String(item.count)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/**
 * Frame W2's amber banner. It counts the buffer and it never blocks work.
 *
 * "Offline is a state, not an error" is the canvas rule and F-P10's own
 * position, so this is a `status` region rather than an `alert`: an alert
 * interrupts a screen reader mid-sentence to announce a condition the reader
 * is expected to keep working through.
 *
 * Screens draw it for the SIMULATED outage only (`useConnection().simulatedOnly`).
 * A real one already has the app-wide `OfflineBanner`, and this under it was a
 * second notice saying the same thing (mobile audit 2026-10-05, WK-25).
 */
export function WorkOfflineBar({
  title,
  detail,
  actionLabel,
  onAction,
  busy = false,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}) {
  const { c, space, radius } = useTheme();

  return (
    <View
      accessible={!onAction}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${detail}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: space[3],
        borderRadius: radius.lg,
        backgroundColor: c.warning100,
        borderWidth: 1,
        borderColor: c.warning500,
      }}
    >
      <Icon name="wifiOff" size={19} color={c.warning600} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold" size="sm" color="textStrong">
          {title}
        </Text>
        <Text size="xs" color="textBody" style={{ lineHeight: 18 }}>
          {detail}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <PressableScale
          accessibilityLabel={actionLabel}
          haptic
          disabled={busy}
          onPress={onAction}
          style={{
            minHeight: WORK_TARGET,
            justifyContent: 'center',
            paddingHorizontal: 16,
            borderRadius: radius.md,
            backgroundColor: c.surface1,
            borderWidth: 1,
            borderColor: c.warning500,
          }}
        >
          <Text weight="semibold" size="sm" color="warning600">
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * The one primary at the foot of a Work tab.
 *
 * Taller than `Button`'s `lg` and free to wrap onto a second line, because the
 * Kinyarwanda for "Take next task" is "Fata umurimo ukurikira" and frame W8
 * says it wraps rather than clips. No `numberOfLines`, and the bar grows.
 *
 * `paddingBottom` is 14 and not `insets.bottom + 14`: inside a tab screen the
 * tab bar already sits on the home indicator, and adding the inset again is the
 * gap that makes a sticky bar look like it is floating.
 *
 * **It declares its height** (`usePinnedFooter`). On the device rig a toast
 * slid in behind "Take next task": toasts sat at one fixed offset chosen to
 * clear the tab bar, and this bar sits ON the tab bar, inside that band
 * (mobile audit 2026-10-05, WK-14). The height it declares is measured from the
 * screen's bottom edge, so it is the bar plus the tab bar plus the home
 * indicator inset under both.
 */
export function WorkStickyAction({
  label,
  hint,
  onPress,
  muted = false,
  disabled = false,
  icon,
  notice,
  onHeight,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  /**
   * Drawn quiet rather than disabled, and still pressable. The twin does the
   * same, and it is the better behaviour: a greyed-out dead button leaves the
   * reader to guess why, while a quiet one that toasts "you are caught up"
   * answers the question they actually had.
   */
  muted?: boolean;
  /** Not pressable at all: there is nothing behind it yet (the read is out). */
  disabled?: boolean;
  icon?: 'sparkles' | 'check';
  /** Drawn above the primary, inside the pinned bar: a failed write's notice. */
  notice?: ReactNode;
  /** The bar's own measured height, so the list can clear it. */
  onHeight?: (height: number) => void;
}) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  usePinnedFooter(height > 0 ? height + tabBarContentHeight(true) + insets.bottom : 0);
  const quiet = muted || disabled;

  return (
    <View
      onLayout={(e) => {
        const measured = Math.ceil(e.nativeEvent.layout.height);
        setHeight(measured);
        onHeight?.(measured);
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        gap: space[3],
        paddingHorizontal: space[4],
        paddingTop: 12,
        paddingBottom: 14,
        backgroundColor: c.surface1,
        borderTopWidth: 1,
        borderTopColor: c.borderSubtle,
      }}
    >
      {notice}
      <PressableScale
        accessibilityLabel={label}
        accessibilityHint={hint}
        haptic={!disabled}
        disabled={disabled}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          // A gloved thumb, found without looking.
          minHeight: WORK_TARGET,
          paddingHorizontal: space[4],
          paddingVertical: 12,
          borderRadius: radius.md,
          backgroundColor: quiet ? c.surface3 : c.action,
        }}
      >
        {icon ? <Icon name={icon} size={19} color={quiet ? c.textMuted : c.bgApp} /> : null}
        <Text
          weight="semibold"
          size="md"
          center
          color={quiet ? 'textMuted' : c.bgApp}
          style={{ flexShrink: 1 }}
        >
          {label}
        </Text>
      </PressableScale>
    </View>
  );
}

/** The height `WorkStickyAction` occupies, as a spacer row at the list's foot. */
export const STICKY_ACTION_CLEARANCE = 92;

/**
 * Frame W3's "‹ Queue" — a labelled back control rather than a bare chevron.
 *
 * The kit's `BackHeader` is a 38pt floating circle designed to sit over a
 * photograph, which is right for a listing and wrong here: this is aimed at
 * with a glove, and a word beside the chevron is both a bigger target and a
 * statement of where "back" goes.
 */
export function WorkBackRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        minHeight: WORK_TARGET,
        paddingRight: 16,
      }}
    >
      <Icon name="chevronLeft" size={22} color={c.textBody} />
      <Text weight="medium" size="md" color="textBody">
        {label}
      </Text>
    </PressableScale>
  );
}

export type WorkButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

/**
 * A button at Work's floor.
 *
 * `Button`'s variants and fills, with a `minHeight` of 56 where `Button` has a
 * fixed 32, 40 or 48, and a label free to wrap onto a second line (frame W8:
 * nothing truncates). Every Work screen's secondary controls used to be
 * `Button` at 40 with hit slop to 44 (mobile audit 2026-10-05, WK-15).
 */
export function WorkButton({
  label,
  onPress,
  variant = 'outline',
  leadingIcon,
  disabled = false,
  align = 'start',
  hint,
}: {
  label: string;
  onPress: () => void;
  variant?: WorkButtonVariant;
  leadingIcon?: IconName;
  disabled?: boolean;
  /** `stretch` is full width; `start` and `center` hug the label. */
  align?: 'start' | 'center' | 'stretch';
  hint?: string;
}) {
  const { c, space, radius } = useTheme();

  // The same fill and ink pairs `Button` paints, so `contrast.test.ts`'s
  // Button rows cover these too.
  const paint: Record<WorkButtonVariant, { bg: string; ink: string; edge?: string }> = {
    primary: { bg: c.action, ink: c.bgApp },
    outline: { bg: c.surface1, ink: c.textStrong, edge: c.borderDefault },
    ghost: { bg: 'transparent', ink: c.textBody },
    danger: { bg: c.danger500, ink: c.textOnDanger },
  };
  const p = paint[variant];

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityHint={hint}
      disabled={disabled}
      haptic={variant === 'primary' || variant === 'danger'}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: WORK_TARGET,
        paddingHorizontal: space[4],
        paddingVertical: 10,
        borderRadius: radius.md,
        backgroundColor: p.bg,
        borderWidth: p.edge ? 1 : 0,
        borderColor: p.edge,
        alignSelf: align === 'stretch' ? 'stretch' : align === 'center' ? 'center' : 'flex-start',
      }}
    >
      {leadingIcon ? <Icon name={leadingIcon} size={18} color={p.ink} /> : null}
      <Text weight="semibold" size="md" center color={p.ink} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </PressableScale>
  );
}

export interface WorkChipItem {
  value: string;
  label: string;
  /** The fill a SELECTED chip takes. Frame W6 draws High in warning, Urgent in danger. */
  tone?: 'brand' | 'warning' | 'danger';
}

type WorkChipsProps = {
  legend: string;
  items: readonly WorkChipItem[];
  /** Wrap onto several lines instead of scrolling. For short fixed sets. */
  wrap?: boolean;
} & (
  | { mode?: 'single'; value: string; onChange: (value: string) => void }
  | { mode: 'multi'; value: readonly string[]; onChange: (value: string[]) => void }
);

/** Fill, ink and edge per tone, all pairs `contrast.test.ts` already measures. */
const CHIP_TONE: Record<NonNullable<WorkChipItem['tone']>, { bg: keyof Palette; fg: keyof Palette; edge: keyof Palette }> = {
  brand: { bg: 'actionSubtle', fg: 'brand700', edge: 'brand300' },
  warning: { bg: 'warning100', fg: 'warning600', edge: 'warning500' },
  danger: { bg: 'danger100', fg: 'danger600', edge: 'danger500' },
};

/**
 * `ChipGroup`'s semantics at Work's floor: a `radiogroup` of `radio`s for one
 * choice, a group of `checkbox`es for several.
 *
 * `ChipGroup` draws `Tag`s at 30pt with hit slop to 44, which is the app's
 * floor and not this surface's (mobile audit 2026-10-05, WK-15). The room,
 * fault, severity and fail-reason pickers are the controls an attendant uses
 * with the most force and the least looking, so they get the full 56.
 */
export function WorkChips(props: WorkChipsProps) {
  const { c, space, radius } = useTheme();
  const { legend, items, wrap = false } = props;
  const multi = props.mode === 'multi';

  const isOn = (value: string) => (multi ? props.value.includes(value) : props.value === value);

  const toggle = (value: string) => {
    if (props.mode === 'multi') {
      props.onChange(
        props.value.includes(value)
          ? props.value.filter((v) => v !== value)
          : [...props.value, value],
      );
    } else {
      props.onChange(value);
    }
  };

  const chips = items.map((item) => {
    const on = isOn(item.value);
    const tone = CHIP_TONE[item.tone ?? 'brand'];
    return (
      <PressableScale
        key={item.value}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityLabel={item.label}
        accessibilityState={multi ? { checked: on } : { selected: on }}
        onPress={() => toggle(item.value)}
        style={{
          minHeight: WORK_TARGET,
          justifyContent: 'center',
          paddingHorizontal: 18,
          borderRadius: radius.md,
          backgroundColor: on ? c[tone.bg] : c.surface2,
          borderWidth: on ? 1.5 : 1,
          borderColor: on ? c[tone.edge] : c.borderSubtle,
        }}
      >
        <Text weight={on ? 'semibold' : 'medium'} size="md" color={on ? tone.fg : 'textBody'}>
          {item.label}
        </Text>
      </PressableScale>
    );
  });

  const group = (
    <View
      // The group carries the "one of these" or "any of these" meaning; without
      // it a reader hears a row of unrelated controls.
      accessibilityRole={multi ? 'none' : 'radiogroup'}
      accessibilityLabel={legend}
      style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: space[2] }}
    >
      {chips}
    </View>
  );

  return (
    <View style={{ gap: space[2] }}>
      <Text
        weight="bold"
        size="xs"
        color="textMuted"
        style={{ letterSpacing: 1, textTransform: 'uppercase' }}
      >
        {legend}
      </Text>
      {wrap ? (
        group
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Bleeds to the edge and pads inside, so the first chip lines up with
          // the gutter and the last can scroll clear of it (as `ChipGroup` does).
          style={{ marginHorizontal: -space[4] }}
          contentContainerStyle={{ paddingHorizontal: space[4] }}
        >
          {group}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * The head of a Work tab: eyebrow, then title, then whatever the screen puts
 * beside the title.
 *
 * It is composed here rather than through `<Screen.List title greeting>`
 * because the order is the wrong way round for this surface — the scaffold
 * draws the greeting BELOW the title, and every W frame draws the property
 * eyebrow above it, in caps, as the first thing on the screen. Three tabs draw
 * the same head, so it is one component rather than three near-copies.
 */
export function WorkPageHead({
  title,
  eyebrowSuffix,
  action,
  children,
}: {
  title: string;
  /** Replaces the town in the eyebrow. Frame W4 uses "36 ROOMS". */
  eyebrowSuffix?: string;
  action?: ReactNode;
  /** The line under the title: a sync line, a subtitle. */
  children?: ReactNode;
}) {
  const { space } = useTheme();

  return (
    <View style={{ gap: space[2] }}>
      <WorkEyebrow suffix={eyebrowSuffix} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: space[3],
        }}
      >
        <Text
          accessibilityRole="header"
          family="display"
          weight="semibold"
          size="2xl"
          color="textStrong"
          style={{ flexShrink: 1, letterSpacing: -0.4 }}
        >
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/**
 * A titled block with an uppercase label above it, as frames W1, W2, W3 and W7
 * all draw. Thin, but it keeps the label and its content one accessibility
 * grouping instead of a heading floating away from what it heads.
 */
export function WorkSection({ label, children }: { label: string; children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </View>
  );
}
