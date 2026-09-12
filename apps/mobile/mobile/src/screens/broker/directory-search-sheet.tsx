/**
 * The Directory's search sheet — where, how big, how much at most.
 *
 * This is the Explore search sheet in residence mode: the same anatomy (a
 * grabber, a title, a close, sectioned controls, a footer that counts the
 * result before the reader commits) with the three questions a tenancy actually
 * has. Session 2's sheet asks for nights, a party and an accommodation class,
 * none of which mean anything on a flat — see `@/data/broker-search` for why
 * that is two modules rather than one with a mode.
 *
 * **A `Modal` rather than a route.** The route table is frozen until Session 11
 * and registers no `directory/search`; this belongs over the tab rather than
 * pushed on top of it, which is the same call `listing-dates-sheet.tsx` made.
 *
 * **It edits a draft and commits once.** Nothing reaches the Directory until
 * "Show N units" is pressed. That is what makes "Clear all" safe to press, what
 * lets the footer count the draft, and what stops a half-typed search being
 * left behind when the sheet is dismissed by a swipe.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  ChipGroup,
  Icon,
  InputField,
  PressableScale,
  SectionLabel,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { DirectoryUnit } from '@/data/broker';
import {
  BEDROOM_STEPS,
  DEFAULT_UNIT_SEARCH,
  RENT_CEILINGS,
  UNIT_DISTRICTS,
  searchUnits,
  shortRwf,
  type UnitSearch,
} from '@/data/broker-search';

export interface DirectorySearchSheetProps {
  open: boolean;
  value: UnitSearch;
  catalogue: readonly DirectoryUnit[];
  onClose: () => void;
  onCommit: (next: UnitSearch) => void;
}

export function DirectorySearchSheet({
  open,
  value,
  catalogue,
  onClose,
  onCommit,
}: DirectorySearchSheetProps) {
  const { c, radius, space, shadow, scrim } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [draft, setDraft] = useState<UnitSearch>(value);

  // Opening picks up whatever the search holds now, so a chip chosen on the
  // rail is already drawn when the sheet appears.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const hits = searchUnits(draft, catalogue).length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(DEFAULT_UNIT_SEARCH);

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
          maxHeight: '88%',
          ...shadow.lg,
        }}
      >
        <View style={{ alignItems: 'center', paddingBottom: space[2] }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 38,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: c.borderDefault,
            }}
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
              {t('directory.filtersTitle')}
            </Text>
            <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
              {t('directory.filtersSubtitle')}
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
          contentContainerStyle={{
            paddingHorizontal: space[4],
            paddingBottom: space[4],
            gap: space[5],
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ------------------------------------------------------- where */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('directory.sectionWhere')}</SectionLabel>
            <InputField
              label={t('directory.whereLabel')}
              value={draft.where}
              onChangeText={(where) => setDraft({ ...draft, where })}
              placeholder={t('directory.wherePlaceholder')}
              autoCapitalize="words"
            />
            {/* Districts are a multi-select: ticking two means either, never
                both, and `ChipGroup` is what carries that to a reader. */}
            <ChipGroup
              mode="multi"
              legend={t('directory.dimDistrict')}
              items={UNIT_DISTRICTS.map((d) => ({
                value: d.name,
                label: d.name,
                count: d.count,
              }))}
              value={draft.districts}
              onChange={(districts) => setDraft({ ...draft, districts })}
            />
          </View>

          {/* -------------------------------------------------------- size */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('directory.sectionSize')}</SectionLabel>
            <ChipGroup
              legend={t('directory.dimBedrooms')}
              items={[
                { value: '0', label: t('directory.bedroomsAny') },
                ...BEDROOM_STEPS.map((n) => ({
                  value: String(n),
                  label: t('directory.bedPlus', { count: n }),
                  count: catalogue.filter((u) => u.bedrooms >= n).length,
                })),
              ]}
              value={String(draft.bedrooms)}
              onChange={(v) => setDraft({ ...draft, bedrooms: Number(v) })}
            />
          </View>

          {/* ----------------------------------------------------- ceiling */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('directory.sectionCeiling')}</SectionLabel>
            <ChipGroup
              legend={t('directory.dimCeiling')}
              items={[
                { value: 'any', label: t('directory.ceilingAny') },
                ...RENT_CEILINGS.map((amount) => ({
                  value: String(amount),
                  label: t('directory.ceilingChip', { amount: shortRwf(amount) }),
                  count: catalogue.filter((u) => u.rent <= amount).length,
                })),
              ]}
              value={draft.ceiling === null ? 'any' : String(draft.ceiling)}
              onChange={(v) => setDraft({ ...draft, ceiling: v === 'any' ? null : Number(v) })}
            />
            <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
              {t('directory.ceilingNote')}
            </Text>
          </View>

          {/* ------------------------------------------------ availability */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('directory.sectionAvailability')}</SectionLabel>
            <ChipGroup
              legend={t('directory.dimVacancy')}
              items={[
                { value: 'any', label: t('directory.chipAll') },
                {
                  value: 'now',
                  label: t('directory.chipVacantNow'),
                  count: catalogue.filter((u) => u.vacancy.state === 'now').length,
                },
                {
                  value: 'soon',
                  label: t('directory.chipVacantSoon'),
                  count: catalogue.filter((u) => u.vacancy.state !== 'leased').length,
                },
              ]}
              value={draft.vacancy}
              onChange={(v) => setDraft({ ...draft, vacancy: v as UnitSearch['vacancy'] })}
            />
            <ChipGroup
              legend={t('directory.tenureLabel')}
              items={[
                { value: 'any', label: t('directory.chipAll') },
                {
                  value: 'long_term',
                  label: t('directory.chipLongTerm'),
                  count: catalogue.filter((u) => u.tenure === 'long_term').length,
                },
                {
                  value: 'short_term',
                  label: t('directory.chipShortTerm'),
                  count: catalogue.filter((u) => u.tenure === 'short_term').length,
                },
              ]}
              value={draft.tenure}
              onChange={(v) => setDraft({ ...draft, tenure: v as UnitSearch['tenure'] })}
            />
          </View>
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
          {dirty ? (
            <Button variant="ghost" onPress={() => setDraft(DEFAULT_UNIT_SEARCH)}>
              {t('directory.filtersClear')}
            </Button>
          ) : null}
          <View style={{ flex: 1 }} />
          {/* The count is on the button, so the reader knows what pressing it
              gets them before they press it. A draft that returns nothing
              still commits: the empty state names the filter to lift, which is
              more use than a disabled button with no way out of itself. */}
          <Button variant="primary" size="lg" onPress={() => onCommit(draft)}>
            {hits === 0
              ? t('directory.filtersApplyNone')
              : hits === 1
                ? t('directory.filtersApplyOne')
                : t('directory.filtersApply', { count: hits })}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
