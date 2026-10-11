/**
 * Photo credits — every photograph the app ships, and where it came from.
 *
 * **This page does not discharge the licence obligation; it completes it.**
 * ADR-015 call 5 requires a stand-in photograph to carry a VISIBLE credit
 * where it appears, so `PhotoCredit` on the card is what satisfies the rule.
 * This is the other half: the full attribution string the CC BY and CC BY-SA
 * licences ask to travel with the work, which does not fit on a tile, plus a
 * link to the source so a reader can check it.
 *
 * Session 0 builds the screen and the route; **Session 11 mounts the Account
 * row that opens it** (frames R5, R14 and B25 all draw a PREFERENCES section
 * this belongs in). The key is already in the catalogue as
 * `account.photoCredits`.
 *
 * It carries all four list states even though the list is a static generated
 * array. That is not ceremony: `useFixture` is the read the API will replace,
 * and a screen whose loading and error branches never render is a screen whose
 * loading and error branches rot. The empty state is real too — it is what a
 * build that ships no credited photography would show, and the answer to
 * "why is this page blank" should be a sentence, not a guess.
 */
import { Linking, View } from 'react-native';
import { Image } from 'expo-image';
import {
  Badge,
  EmptyState,
  ErrorState,
  Icon,
  PressableScale,
  Screen,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { PHOTO_CREDITS, type PhotoCredit as Credit } from '@/data/photo-credits';
import { photo as photoAsset } from '@/data/photos';

function CreditRow({ credit }: { credit: Credit }) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const asset = photoAsset(credit.stem);

  return (
    <View
      style={{
        gap: space[3],
        padding: space[3],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        backgroundColor: c.surface1,
      }}
    >
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Image
          source={asset?.source}
          // A recycled row would otherwise show the previous credit's photo
          // until this one decodes (gaps.md B8; mobile audit 2026-10-05, GB-11).
          recyclingKey={credit.stem}
          placeholder={asset?.placeholder}
          contentFit="cover"
          transition={140}
          // The subject is printed beside it, so a second announcement of the
          // same words is noise.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 76, height: 76, borderRadius: radius.md, backgroundColor: c.surface2 }}
        />
        <View style={{ flex: 1, gap: 5 }}>
          <Text weight="semibold" size="sm" color="textStrong" style={{ lineHeight: 20 }}>
            {credit.subject}
          </Text>
          <Text size="xs" color="textMuted">
            {credit.author}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            <Badge tone="neutral">{credit.licence}</Badge>
            {credit.depictsActualProperty ? (
              <Badge tone="success" dot>
                {t('photo.actualProperty')}
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                {t('photo.standIn')}
              </Badge>
            )}
          </View>
        </View>
      </View>

      {/* The full sentence the licence asks to travel with the work. It does
          not fit on a tile, which is the whole reason this page exists. */}
      <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
        {credit.attribution}
      </Text>

      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${t('photo.viewSource')}: ${credit.subject}`}
        onPress={() => void Linking.openURL(credit.sourceUrl).catch(() => {})}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 44,
        }}
      >
        <Icon name="externalLink" size={15} color={c.textLink} />
        <Text weight="medium" size="sm" color="textLink">
          {t('photo.viewSource')}
        </Text>
      </PressableScale>
    </View>
  );
}

export function PhotoCreditsScreen() {
  const { space } = useTheme();
  const t = useT();
  const read = useFixture('photo-credits', () => PHOTO_CREDITS);
  const rows = read.data ?? [];

  return (
    <Screen.List
      greeting={t('photo.creditsGreeting')}
      title={t('photo.creditsTitle')}
      data={rows}
      keyExtractor={(credit) => credit.stem}
      renderItem={({ item }) => <CreditRow credit={item} />}
      loading={read.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('photo.creditsListLabel') })}
      loadingRows={4}
      header={
        <View style={{ gap: space[2] }}>
          <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
            {t('photo.creditsIntro')}
          </Text>
          {read.status === 'error' ? (
            // No raw server text as the detail (GB-27).
            <ErrorState
              title={t('state.errorTitle')}
              body={t('state.errorBody', { label: t('photo.creditsListLabel') })}
              onRetry={read.retry}
            />
          ) : null}
        </View>
      }
      empty={
        read.status === 'error' ? null : (
          <EmptyState
            icon="image"
            title={t('photo.creditsEmptyTitle')}
            body={t('photo.creditsEmptyBody')}
          />
        )
      }
    />
  );
}
