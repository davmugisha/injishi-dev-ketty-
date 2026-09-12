/**
 * The chrome every Work screen shares — the eyebrow, the sync line, the floor
 * tabs, the offline banner and the sticky primary.
 *
 * **This surface is not the rest of the app, and the difference is physical.**
 * Frame W1's note is the brief: used one-handed, gloved, standing, in corridors
 * with no signal. So the targets here are larger than the design brief's 44pt
 * floor rather than merely at it, the primary is one and full-width, and the
 * status of the connection is on the screen at all times rather than surfaced
 * when something fails.
 *
 * Four pieces the shared kit could not supply as they are, each built here and
 * listed in the session report for Session 11 to lift if a second surface wants
 * one:
 *
 *   - `WorkFilterTabs`, because `SegmentedTabs` neither scrolls nor shrinks its
 *     label, and frame W8's contract is that Kinyarwanda labels drop to 11px
 *     rather than truncate.
 *   - `WorkStickyAction`, because `StickyBar` pads for the home indicator and
 *     inside a TAB screen the tab bar already owns that inset — and because a
 *     54pt primary whose label may wrap onto two lines is not `Button`'s
 *     fixed-height shape.
 *   - `WorkOfflineBar`, because `OfflineBanner` is the app-wide notice and says
 *     "you are offline"; this one counts a buffer and offers a reconnect, which
 *     is a different sentence to a different reader.
 *   - `WorkEyebrow`, which is one line but is on nine screens.
 */
import { type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text, Icon, PressableScale, SectionLabel } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useDomain } from '@/domain';
import type { Phrase } from './work-format';

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
 * Frame W1's "● Synced · 6 tasks · 10:24".
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
  const { c, space } = useTheme();

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
          const text = item.count == null ? item.label : `${item.label} ${item.count}`;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityLabel={text}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(item.value)}
              style={{
                // 48 rather than the 44 floor: gloved, standing, moving.
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderBottomWidth: 2.5,
                borderBottomColor: active ? c.textStrong : 'transparent',
                marginBottom: -1,
              }}
            >
              <Text
                weight={active ? 'semibold' : 'medium'}
                size={text.length > 12 ? '2xs' : 'sm'}
                color={active ? 'textStrong' : 'textMuted'}
              >
                {text}
              </Text>
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
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 14,
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
 */
export function WorkStickyAction({
  label,
  hint,
  onPress,
  muted = false,
  icon,
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
  icon?: 'sparkles' | 'check';
}) {
  const { c, space, radius } = useTheme();
  const disabled = muted;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: space[4],
        paddingTop: 12,
        paddingBottom: 14,
        backgroundColor: c.surface1,
        borderTopWidth: 1,
        borderTopColor: c.borderSubtle,
      }}
    >
      <PressableScale
        accessibilityLabel={label}
        accessibilityHint={hint}
        haptic
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          // 54: a gloved thumb, found without looking.
          minHeight: 54,
          paddingHorizontal: space[4],
          paddingVertical: 12,
          borderRadius: radius.md,
          backgroundColor: disabled ? c.surface3 : c.action,
        }}
      >
        {icon ? <Icon name={icon} size={19} color={disabled ? c.textMuted : c.bgApp} /> : null}
        <Text
          weight="semibold"
          size="md"
          center
          color={disabled ? 'textMuted' : c.bgApp}
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
        minHeight: 44,
        paddingRight: 12,
      }}
    >
      <Icon name="chevronLeft" size={22} color={c.textBody} />
      <Text weight="medium" size="md" color="textBody">
        {label}
      </Text>
    </PressableScale>
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
