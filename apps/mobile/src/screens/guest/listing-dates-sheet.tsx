/**
 * "Add dates", from the sticky bar.
 *
 * FL06 Path A is explicit: with no dates the catalogue is still browsable and
 * the CTA is disabled until dates are chosen. That only works if the page
 * offers a way to choose them, and a disabled button with no route out of its
 * own disabled state is the orphaned control the quality bar rules out.
 *
 * **It writes the guest's SEARCH, not a local copy.** Dates live in
 * `SEARCH_KEY`, which Explore and the search sheet already read and write
 * (Session 2), so dates picked here are the dates Explore shows when the guest
 * goes back, and dates picked on Explore are already filled in when they arrive.
 * A second store would be two answers to one question.
 *
 * A `Modal` rather than a route, for the reason `listing-photo-viewer.tsx`
 * gives: the route table is frozen until Session 11, and this belongs over the
 * page rather than pushed on top of it.
 *
 * It edits a DRAFT and commits on "Use these dates", which is the same shape
 * the search sheet uses. A calendar that wrote on every tap would leave the
 * guest with a half-range — an arrival and no departure — the moment they
 * dismissed it mid-choice.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  CalendarRange,
  Icon,
  PressableScale,
  Text,
  nightsBetween,
  type DateRange,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { nightsLabel } from './listing-format';

export interface ListingDatesSheetProps {
  open: boolean;
  value: DateRange;
  onClose: () => void;
  onCommit: (range: DateRange) => void;
}

export function ListingDatesSheet({ open, value, onClose, onCommit }: ListingDatesSheetProps) {
  const { c, radius, space, shadow, scrim } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [draft, setDraft] = useState<DateRange>(value);

  // Opening picks up whatever the search holds now, so a range chosen on
  // Explore is already drawn when the sheet appears.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const complete = !!draft.start && !!draft.end;
  const nights = complete ? nightsBetween(draft.start as string, draft.end as string) : 0;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      {/* The dim. A press on it closes, which is what a sheet's backdrop is
          for; it carries the same label as the close control so a screen
          reader hears one way out rather than two. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('sheet.close')}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: scrim.caption[0] }}
      />

      <View
        style={{
          backgroundColor: c.surface1,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingTop: space[2],
          maxHeight: '86%',
          ...shadow.lg,
        }}
      >
        <View style={{ alignItems: 'center', paddingBottom: space[2] }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 38, height: 4, borderRadius: radius.pill, backgroundColor: c.borderDefault }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space[3],
            paddingHorizontal: space[4],
            paddingBottom: space[3],
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              accessibilityRole="header"
              family="display"
              weight="semibold"
              size="xl"
              color="textStrong"
              style={{ letterSpacing: -0.3 }}
            >
              {t('listing.datesTitle')}
            </Text>
            <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
              {t('listing.datesSubtitle')}
            </Text>
          </View>

          <PressableScale
            accessibilityLabel={t('sheet.close')}
            onPress={onClose}
            hitSlop={5}
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surface2,
            }}
          >
            <Icon name="x" size={17} color={c.textBody} />
          </PressableScale>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[4] }}
          showsVerticalScrollIndicator={false}
        >
          <CalendarRange
            value={draft}
            onChange={setDraft}
            // The control applies `nextRange` itself and hands back a whole
            // range, which keeps this sheet out of the date arithmetic.
            months={9}
          />
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            paddingHorizontal: space[4],
            paddingTop: 14,
            paddingBottom: insets.bottom + 14,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
            backgroundColor: c.surface1,
          }}
        >
          <Text size="sm" color="textMuted" style={{ flex: 1, lineHeight: 19 }}>
            {complete ? nightsLabel(nights, t) : t('listing.datesPrompt')}
          </Text>
          {draft.start ? (
            <Button variant="ghost" onPress={() => setDraft({ start: null, end: null })}>
              {t('listing.datesClear')}
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            disabled={!complete}
            onPress={() => onCommit(draft)}
          >
            {t('listing.datesUse')}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
