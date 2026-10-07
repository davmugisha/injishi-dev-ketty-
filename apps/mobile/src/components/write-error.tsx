/**
 * WriteError — what a form says when the save did not happen.
 *
 * `gaps.md` §7 found eleven new P1s when the scope widened and then made the
 * useful observation about them: they *"collapse into three shapes rather than
 * into eleven separate problems"*, and the first shape is **`err=0` on a write
 * that moves money or creates a legal record** — `record-payment`,
 * `lease/[leaseId]/caution`, `lease/[leaseId]/contract`, `lease/new`,
 * `payout-account`, `reservation/[id]/check-in`, `directory/[unitId]/reveal`.
 *
 * Seven screens with the same hole get one component rather than seven
 * variations, because the words that matter are the same on all of them and
 * they are the words a person needs at that moment:
 *
 *   **Nothing was saved.** The single most important sentence. Someone whose
 *   save failed does not know whether it half-happened, and the thing they do
 *   next depends entirely on that. A landlord who thinks a payment may have
 *   recorded will not record it again; one who knows it did not, will.
 *
 *   **What to do now.** `ui-rules.md` bans a raw error message. "Could not
 *   save" alone is one — it describes a state and leaves the person holding it.
 *
 * ## The bug this component exists beside
 *
 * Every one of those seven screens `await`ed its mutation and then toasted and
 * navigated **unconditionally**. On a failure the person was shown a success
 * toast and moved to the next screen, which is worse than no error state: an
 * absent error leaves someone unsure, and a success toast on a failed write
 * tells them something untrue. Rendering this is half the fix; not navigating
 * past a failure is the other half, and it is at each call site because only
 * the call site knows where it was going.
 *
 * **The alert is the words, the buttons are its siblings.** The whole box used
 * to be one `accessible` element, which on iOS swallowed Retry: a VoiceOver
 * user heard the failure and could not reach the one control that fixes it
 * (mobile audit 2026-10-05, XC-02). iOS also ignores role `alert` and live
 * regions, so the failure is announced there by hand.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { Button } from './button';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';

export interface WriteErrorProps {
  /** What failed, in this screen's own words. */
  title?: MessageKey;
  /** What to do about it. Defaults to the shared "try again" sentence. */
  body?: MessageKey;
  onRetry?: () => void;
  /** Where the person goes instead, when retrying is not the answer. */
  secondary?: { label: MessageKey; onPress: () => void };
}

export function WriteError({
  title = 'write.failedTitle',
  body = 'write.failedBody',
  onRetry,
  secondary,
}: WriteErrorProps) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const announcement = `${t(title)}. ${t(body)}`;

  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  return (
    <View
      style={{
        gap: space[3],
        padding: space[4],
        borderRadius: radius.lg,
        backgroundColor: c.danger100,
        borderWidth: 1,
        borderColor: c.danger500,
      }}
    >
      <View
        // `alert` and a live region: a save that failed while the person was
        // reading further down the form has to reach them without being looked
        // at, which is the whole difference between an error state and a red box.
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={announcement}
        style={{ gap: space[3] }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="alertCircle" size={18} color={c.danger600} />
          <Text weight="semibold" size="sm" color="textStrong" style={{ flex: 1 }}>
            {t(title)}
          </Text>
        </View>
        <Text size="sm" color="textBody">
          {t(body)}
        </Text>
      </View>
      {onRetry || secondary ? (
        <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
          {onRetry ? (
            <Button variant="primary" size="sm" onPress={onRetry} leadingIcon="rotateCcw">
              {t('write.retry')}
            </Button>
          ) : null}
          {secondary ? (
            <Button variant="ghost" size="sm" onPress={secondary.onPress}>
              {t(secondary.label)}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
