/**
 * Unit detail — frame B22. The screen a broker decides from, and the one place
 * a landlord's number can be spent on.
 *
 * It replaces the Residence branch that used to live inside
 * `app/listing/[id]/index.tsx`, which Session 0 parked there and marked as this
 * session's to rebuild. That route now redirects a Residence id here, so an old
 * link still resolves and there is exactly one Residence unit screen.
 *
 * ## The contact is not on the device until it is revealed
 *
 * The masked number below is a MASK, not a blurred real one. That distinction
 * is the whole security posture of F-R09 §10 and it is easy to get wrong: a
 * blur is a visual effect, and a visual effect that fails — an Android build
 * without the native module, a web export, a screen reader reading the tree, a
 * screenshot taken by an OS feature — leaks the very thing the screen exists to
 * withhold. So the digits are never rendered until `isRevealed` is true. The
 * blur sits ON TOP of the mask, because frame B22 draws a blur and it reads as
 * "there is something here", but nothing depends on it holding.
 *
 * ## What a reveal actually does, and why it is a confirm rather than a tap
 *
 * It spends one of the broker's credits, writes a row to the reveal log, and
 * opens a placement intent with the broker recorded on it (FL18 step 3, FL19
 * step 1). Three consequences, none of them undoable, which is why the sheet
 * exists and why the credit count and the intent window are printed under the
 * button rather than in terms nobody opens.
 *
 * ## The states it owes
 *
 * Loading (a skeleton shaped like this page, not like a list), error with a
 * retry, a unit id that resolves to nothing, and a unit already let — FL18 path
 * B, which is a state rather than an absence and says why the action is gone.
 */
import { useCallback } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  BackHeader,
  Badge,
  Button,
  Card,
  DomainBadge,
  ErrorState,
  Gallery,
  Icon,
  ListRow,
  SectionLabel,
  Skeleton,
  StickyBar,
  Text,
  MoneyAmount,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { formatDay } from '@/data/search';
import {
  getUnit,
  isPlaceable,
  useBrokerState,
  type DirectoryUnit,
} from '@/data/broker';
import {
  INTENT_DAYS,
  availableLine,
  feeLine,
  intentLine,
  moneyText,
  unitFee,
  vacancyChip,
} from './broker-format';

export function UnitDetail({ id }: { id: string }) {
  const t = useT();
  const read = useFixture<DirectoryUnit | undefined>(`broker.unit:${id}`, () => getUnit(id));

  if (read.status === 'loading') return <UnitSkeleton />;

  if (read.status === 'error') {
    return (
      <Framed>
        <ErrorState
          title={t('unit.errorTitle')}
          body={t('unit.errorBody')}
          detail={read.error?.message}
          onRetry={read.retry}
        />
      </Framed>
    );
  }

  if (!read.data) return <NotFound />;

  return <Loaded unit={read.data} />;
}

/**
 * The page with data.
 *
 * Split from the screen above so every hook it needs is declared
 * unconditionally: the loading, error and not-found branches return before
 * there is a unit, a credit balance or a placement to hold.
 */
function Loaded({ unit }: { unit: DirectoryUnit }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  const { credits, reveals, isRevealed, placementFor } = useBrokerState();
  const revealed = isRevealed(unit.id);
  const placement = placementFor(unit.id);
  const revealedOn = reveals.find((r) => r.unitId === unit.id)?.day;
  const placeable = isPlaceable(unit);
  const vacancy = vacancyChip(unit.vacancy, t);
  const fee = unitFee(unit);

  const chips = [
    vacancy.label,
    unit.tenure === 'long_term' ? t('unit.tenureLong') : t('unit.tenureShort'),
    feeLine(unit, t, moneyText(fee)),
  ];

  // `openURL` rather than a hand-built anchor: the platform decides which app
  // answers a `tel:` or a `mailto:`, and a failure is swallowed because a
  // handset with no dialler is not a reason to take the screen down.
  const open = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        showsVerticalScrollIndicator={false}
      >
        <Gallery
          stems={[unit.photos.cover, ...unit.photos.gallery]}
          right={<DomainBadge domain="residence" solid />}
        />

        <View style={{ padding: space[4], gap: space[5] }}>
          {/* ------------------------------------------------ name and place */}
          <View style={{ gap: 8 }}>
            <Text
              accessibilityRole="header"
              family="display"
              weight="semibold"
              size="2xl"
              color="textStrong"
              style={{ letterSpacing: -0.4, lineHeight: 31 }}
            >
              {unit.title}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <MoneyAmount value={unit.rent} strong tone="brand" size="xl" />
              <Text size="sm" color="textMuted">
                {t('directory.perMonth')}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="mapPin" size={15} color={c.textMuted} />
              <Text size="sm" color="textMuted" style={{ flex: 1 }}>
                {`${t('directory.bedCount', { count: unit.bedrooms })} · ${t('directory.bathCount', {
                  count: unit.bathrooms,
                })} · ${unit.location}`}
              </Text>
            </View>

            {/* The three chips B22 draws. Wrapped rather than scrolled: there
                are exactly three and the Kinyarwanda fee line is long enough
                that a row would push two of them off screen. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {chips.map((label, i) => (
                <View
                  key={label}
                  accessible
                  accessibilityLabel={label}
                  style={{
                    backgroundColor: i === 0 ? c.surface2 : c.bgTint,
                    borderWidth: 1,
                    borderColor: i === 0 ? c.borderDefault : c.borderSubtle,
                    borderRadius: radius.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text weight="medium" size="xs" color="textBody">
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* --------------------------------------------------- unavailable */}
          {placeable ? null : (
            <Card variant="tint">
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="lock" size={16} color={c.textMuted} />
                  <Text weight="semibold" size="sm" color="textStrong">
                    {t('unit.leasedTitle')}
                  </Text>
                </View>
                <Text size="sm" color="textBody" style={{ lineHeight: 20 }}>
                  {t('unit.leasedBody')}
                </Text>
              </View>
            </Card>
          )}

          {/* --------------------------------------------------- the terms */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('unit.sectionFacts')}</SectionLabel>
            <Card variant="flat" bodyStyle={{ paddingVertical: 4, paddingHorizontal: 18 }}>
              <Fact label={t('unit.factRent')} value={moneyText(unit.rent)} divider />
              <Fact
                label={t('unit.factCaution')}
                value={moneyText(unit.caution)}
                note={t('unit.cautionNote')}
                divider
              />
              <Fact
                label={t('unit.factSize')}
                value={`${t('directory.bedCount', { count: unit.bedrooms })} · ${t(
                  'directory.bathCount',
                  { count: unit.bathrooms },
                )}`}
                divider
              />
              <Fact
                label={t('unit.factAvailable')}
                value={availableLine(unit.vacancy, t)}
                divider
              />
              <Fact
                label={t('unit.factTenure')}
                value={unit.tenure === 'long_term' ? t('unit.tenureLong') : t('unit.tenureShort')}
                divider
              />
              <Fact label={t('unit.factFee')} value={moneyText(fee)} />
            </Card>
          </View>

          {/* --------------------------------------------------- about */}
          <View style={{ gap: 8 }}>
            <SectionLabel>{t('unit.sectionAbout')}</SectionLabel>
            <Text size="sm" color="textBody" style={{ lineHeight: 22 }}>
              {unit.description}
            </Text>
          </View>

          {/* --------------------------------------------------- landlord */}
          <View style={{ gap: space[3] }}>
            <SectionLabel>{t('unit.sectionLandlord')}</SectionLabel>
            <Card>
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Avatar name={unit.landlord.org} square />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text weight="semibold" size="md" color="textStrong">
                      {unit.landlord.org}
                    </Text>
                    <Text size="xs" color="textMuted">
                      {revealed ? unit.landlord.name : t('unit.landlordHidden')}
                    </Text>
                  </View>
                  {revealed ? (
                    <Badge tone="neutral" dot>
                      {t('unit.revealed')}
                    </Badge>
                  ) : null}
                </View>

                <View style={{ height: 1, backgroundColor: c.borderSubtle }} />

                {revealed ? (
                  <View style={{ gap: 2 }}>
                    <ListRow
                      icon="phone"
                      title={unit.landlord.phone}
                      subtitle={t('unit.landlordPhoneLabel')}
                      chevron={false}
                      accessibilityLabel={t('unit.callLandlord', { name: unit.landlord.name })}
                      onPress={() => open(`tel:${unit.landlord.phone.replace(/\s/g, '')}`)}
                      divider
                    />
                    <ListRow
                      icon="mail"
                      title={unit.landlord.email}
                      subtitle={t('unit.landlordEmailLabel')}
                      chevron={false}
                      accessibilityLabel={t('unit.emailLandlord', { name: unit.landlord.name })}
                      onPress={() => open(`mailto:${unit.landlord.email}`)}
                    />
                    {revealedOn ? (
                      <Text size="xs" color="textSubtle" style={{ paddingTop: 8 }}>
                        {t('unit.revealedOn', { day: formatDay(revealedOn, t) })}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <MaskedContact />
                )}
              </View>
            </Card>
          </View>

          {/* --------------------------------------------------- placement */}
          {placement ? (
            <View style={{ gap: space[3] }}>
              <SectionLabel>{t('unit.sectionPlacement')}</SectionLabel>
              <Card variant="tint" bodyStyle={{ paddingVertical: 6, paddingHorizontal: 18 }}>
                <ListRow
                  icon="key"
                  title={
                    placement.client
                      ? t('unit.placementNamed', { client: placement.client })
                      : t('placements.noClient')
                  }
                  subtitle={intentLine(placement, t)}
                  onPress={() => router.push('/placements')}
                  accessibilityHint={t('unit.viewPlacements')}
                />
                {/* "Place a tenant" used to follow, and pushed `/lease/new`:
                    the LANDLORD's register form, which is closed to a broker,
                    so the press bounced to the home tab. Removed rather than
                    repointed, because the server's placement model has its own
                    start (`POST /ops/broker/directory/:listingId/placements`)
                    and adopting it is a model change for the next phase
                    (mobile audit 2026-10-05, BR-05). */}
              </Card>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <StickyBar>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="semibold" size="sm" color="textStrong">
            {t('directory.feeLabel')}
          </Text>
          <MoneyAmount value={fee} strong size="md" />
        </View>

        {revealed ? (
          <Button
            variant="primary"
            leadingIcon="phone"
            disabled={!placeable}
            onPress={() => open(`tel:${unit.landlord.phone.replace(/\s/g, '')}`)}
          >
            {t('unit.callLandlord', { name: unit.landlord.name.split(' ')[0] })}
          </Button>
        ) : (
          <Button
            variant="primary"
            leadingIcon="eye"
            disabled={!placeable}
            onPress={() =>
              router.push({ pathname: '/directory/[unitId]/reveal', params: { unitId: unit.id } })
            }
          >
            {t('unit.revealCta')}
          </Button>
        )}
      </StickyBar>

      {/* The consequence, printed under the button rather than discovered
          after it — the canvas rule, and the reason a broker never taps into
          the sheet only to learn the month is spent. */}
      {revealed || !placeable ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: insets.bottom + 4,
            alignItems: 'center',
          }}
        >
          <Text size="xs" color={credits === 0 ? 'danger600' : 'textMuted'}>
            {credits === 0
              ? t('unit.revealCreditsNone')
              : credits === 1
                ? t('unit.revealCreditsOne')
                : t('unit.revealCreditsLeft', { count: credits })}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The landlord's contact before it is revealed.
 *
 * A MASK under a blur, never the real digits under a blur — see this file's
 * header. The blur is frame B22's texture and nothing depends on it holding.
 */
function MaskedContact() {
  const { c, scheme, radius, space } = useTheme();
  const t = useT();

  return (
    <View style={{ gap: 10 }}>
      <View
        accessible
        // What a screen reader hears is the FACT that it is hidden, not a row
        // of bullets. Reading "dot dot dot dot" aloud is not privacy, it is
        // noise with the same information content.
        accessibilityLabel={`${t('unit.landlordHidden')}. ${t('unit.landlordMaskedHint')}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          padding: 14,
          borderRadius: radius.md,
          backgroundColor: c.surfaceSunken,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          overflow: 'hidden',
        }}
      >
        <Icon name="eyeOff" size={17} color={c.textSubtle} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text family="mono" weight="medium" size="md" color="textMuted">
            {t('unit.landlordMasked')}
          </Text>
          <Text family="mono" size="xs" color="textSubtle">
            {t('unit.landlordMaskedEmail')}
          </Text>
        </View>

        <BlurView
          intensity={14}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          pointerEvents="none"
          // Frame B22's blur. Inset so the glyph stays legible: the reader has
          // to be able to see that there IS something behind it.
          style={{ position: 'absolute', left: 44, right: 0, top: 0, bottom: 0 }}
        />
      </View>

      <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
        {t('unit.landlordMaskedHint')}
      </Text>
      <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
        {t('reveal.consequence', { days: INTENT_DAYS })}
      </Text>
    </View>
  );
}

/** One row of the terms card: a label, a figure, and sometimes a caveat. */
function Fact({
  label,
  value,
  note,
  divider = false,
}: {
  label: string;
  value: string;
  note?: string;
  divider?: boolean;
}) {
  const { c } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={note ? `${label}, ${value}. ${note}` : `${label}, ${value}`}
      style={{
        paddingVertical: 12,
        gap: 4,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: c.borderSubtle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          minHeight: 20,
        }}
      >
        <Text size="sm" color="textMuted">
          {label}
        </Text>
        <Text family="mono" weight="medium" size="sm" color="textStrong" style={{ flexShrink: 1 }}>
          {value}
        </Text>
      </View>
      {note ? (
        <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** A skeleton shaped like this page: a hero, a title block, then rows. */
function UnitSkeleton() {
  const { c, space } = useTheme();
  const t = useT();

  return (
    <View
      accessible
      accessibilityLabel={t('state.loadingList', { label: t('unit.listLabel') })}
      style={{ flex: 1, backgroundColor: c.bgApp }}
    >
      <Skeleton height={260} radius={0} />
      <View style={{ padding: space[4], gap: space[4] }}>
        <Skeleton height={30} width="72%" />
        <Skeleton height={20} width="42%" />
        <Skeleton height={18} width="62%" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton height={28} width={92} />
          <Skeleton height={28} width={84} />
        </View>
        <Skeleton height={180} />
        <Skeleton height={130} />
      </View>
      <BackHeader />
    </View>
  );
}

/**
 * A unit id that resolves to nothing.
 *
 * A surface rather than a sentence: a landlord can withdraw a unit, and an old
 * shared link is the other way to land here, so both need a way onward rather
 * than a dead end with a back gesture.
 */
function NotFound() {
  const { c, radius } = useTheme();
  const t = useT();
  const router = useRouter();

  return (
    <Framed>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${t('unit.notFoundTitle')}. ${t('unit.notFoundBody')}`}
        style={{
          alignItems: 'center',
          gap: 10,
          paddingVertical: 30,
          paddingHorizontal: 24,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surface1,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surface2,
          }}
        >
          <Icon name="building" size={20} color={c.textMuted} />
        </View>
        <Text family="display" weight="semibold" size="lg" color="textStrong" center>
          {t('unit.notFoundTitle')}
        </Text>
        <Text size="sm" color="textMuted" center style={{ lineHeight: 20, maxWidth: 280 }}>
          {t('unit.notFoundBody')}
        </Text>
        <View style={{ marginTop: 4 }}>
          <Button variant="outline" leadingIcon="grid" onPress={() => router.replace('/')}>
            {t('unit.notFoundAction')}
          </Button>
        </View>
      </View>
    </Framed>
  );
}

/**
 * The frame the two non-content states sit in: the app canvas, the safe area,
 * and the way back. Without it a not-found page is a lone sentence floating on
 * an empty screen, which the quality bar names explicitly.
 */
function Framed({ children }: { children: React.ReactNode }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: space[4],
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + space[6],
        }}
      >
        {children}
      </View>
      <BackHeader />
    </View>
  );
}
