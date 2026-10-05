/**
 * Account — one screen, six seats, and the only tab in every tab set.
 *
 * Frames R5 (Landlord), R14 (Tenant), B25 (Broker), W7 (Work) and the Guest
 * canvas artboard 12 draw five Account screens, and the interesting thing about
 * them is how much they agree: all five open with the same identity block, all
 * five carry the same "Switch workspace ›" row directly under it, all five end
 * with the same PREFERENCES section and the same danger-outline "Sign out".
 * What differs is one section in the middle. So this is one screen that
 * branches on `surface`, not five screens that share a name — five files would
 * be five places to forget the sign-out confirm.
 *
 * The order is the frames' own, and it is an argument rather than a layout:
 *
 *   1. **Who you are and which hat you are wearing.** The badge changes per
 *      seat because the claim changes per seat (`account-fixtures.ts`).
 *   2. **How to change hats**, immediately under it, because the first question
 *      anyone opens this screen with is "am I in the right workspace".
 *   3. **The business of THIS seat** — money out, the org, the people, the plan.
 *      Landlord, Broker and Host only; the two personal seats have no business.
 *   4. **The shift**, on Work only: frame W7's summary and W2's connection
 *      switch, mounted from `screens/work/` where the state behind them lives.
 *   5. **Preferences**, which belong to the person and not the seat, and are
 *      therefore identical on all six.
 *   6. **Sign out**, last and destructive, behind a confirm.
 *
 * ## Two decisions the design did not settle
 *
 * **The Domain segment is gone.** The Guest artboard drew Hospitality |
 * Residence as a segmented control here, and the switcher drew the same choice
 * as two buttons on the Personal row. That asked the reader to make one choice
 * in two places, and `app/switch.tsx`'s own header had already argued the case
 * against it. The switcher keeps it, because a workspace and its surface are
 * one question; Account links to the switcher.
 *
 * **Every row goes somewhere.** Session 0 shipped five rows with a chevron and
 * a "not wired yet" toast and said so in a comment; that is the orphaned
 * control the quality bar rules out, and it is what this session was asked to
 * close. Every row below opens a real screen or sheet with fixture content
 * behind it. There is no `rowSoon` any more.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  Icon,
  ListRow,
  PressableScale,
  Screen,
  SectionLabel,
  SegmentedTabs,
  Text,
  WorkspaceChip,
} from '@/components';
import { useTheme, type Appearance } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT, useLocale, type Locale } from '@/i18n/i18n';
import { WorkConnection, WorkShiftSummary } from '@/screens/work';
import { useBrokerState } from '@/data/broker';
import { IdentityCard } from './identity-card';
// One glyph map, owned beside the sheet that draws the choice, so the row and
// the sheet can never disagree about what an appearance looks like.
import { APPEARANCE_GLYPH } from './appearance';
import { PAYOUT_ACCOUNT, SUBSCRIPTION } from './account-fixtures';
import { useTwoFactor } from './account-store';

/** The seats that own a business: money out, an org, people, a plan. */
type BusinessSurface = 'landlord' | 'broker' | 'host';

function isBusiness(surface: string): surface is BusinessSurface {
  return surface === 'landlord' || surface === 'broker' || surface === 'host';
}

export function Account() {
  const { c, space, appearance } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace, surface } = useDomain();

  return (
    <Screen
      title={t('account.title')}
      action={
        <WorkspaceChip
          name={workspace.name}
          role={workspace.role}
          onPress={() => router.push('/switch')}
        />
      }
    >
      <IdentityCard surface={surface} workspace={workspace} />

      {/* Frame R5's "Switch workspace · Landlord ›", on its own rather than in a
          section: it is not a preference and it is not part of the business —
          it is the way out of both. */}
      <Card bodyStyle={{ paddingVertical: 2 }}>
        <ListRow
          icon="repeat"
          title={t('switch.open')}
          value={workspace.role}
          onPress={() => router.push('/switch')}
          accessibilityLabel={t('switch.open')}
          accessibilityHint={t('account.switchHint', { name: workspace.name })}
        />
      </Card>

      {isBusiness(surface) ? <BusinessSection surface={surface} /> : null}
      {surface === 'work' ? <WorkSection /> : null}

      <PreferencesSection appearance={appearance} />

      <SignOutRow onPress={() => router.push('/sign-out')} />

      {/* The footnote the switcher's frame carries, repeated here because this
          is where somebody reads it before they switch rather than after. */}
      <Text size="xs" color="textSubtle" style={{ lineHeight: 18, paddingHorizontal: 2 }}>
        {t('account.isolationNote')}
      </Text>
      <View style={{ height: space[2] }} />
    </Screen>
  );
}

/* ------------------------------------------------------------- the business */

/**
 * Frame R5's BUSINESS and B25's, which are the same section with two rows
 * swapped: the broker has reveal credits and no org profile or staff, because a
 * brokerage in this build is one person, and the landlord and host have both.
 *
 * The order is money first. It is what somebody opens this section for.
 */
function BusinessSection({ surface }: { surface: BusinessSurface }) {
  const router = useRouter();
  const t = useT();
  const { credits } = useBrokerState();
  const plan = SUBSCRIPTION[surface];

  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{t('account.sectionBusiness')}</SectionLabel>
      <Card bodyStyle={{ paddingVertical: 2 }}>
        <View>
          {/* B25 puts credits first, above the payout: a broker's scarce thing
              is reveals, and the frame's ordering is the frame's argument. */}
          {surface === 'broker' ? (
            <ListRow
              icon="eye"
              title={t('account.rowCredits')}
              value={t('account.creditsLeft', { count: credits })}
              divider
              onPress={() => router.push('/reveal-credits')}
              accessibilityLabel={t('account.rowCredits')}
              accessibilityHint={t('account.creditsHint', { count: credits })}
            />
          ) : null}

          <ListRow
            icon="wallet"
            title={t('account.rowPayout')}
            value={t('account.payoutValue', { tail: PAYOUT_ACCOUNT.tail })}
            divider
            onPress={() => router.push('/payout-account')}
            accessibilityLabel={t('account.rowPayout')}
            accessibilityHint={t('account.payoutHint')}
          />

          {surface !== 'broker' ? (
            <>
              <ListRow
                icon="building"
                title={t('account.rowOrganisation')}
                divider
                onPress={() => router.push('/organisation')}
                accessibilityLabel={t('account.rowOrganisation')}
                accessibilityHint={t('account.organisationHint')}
              />
              <ListRow
                icon="users"
                title={t('account.rowStaff')}
                divider
                onPress={() => router.push('/staff')}
                accessibilityLabel={t('account.rowStaff')}
                accessibilityHint={t('account.staffHint')}
              />
            </>
          ) : null}

          <ListRow
            icon="sparkles"
            title={t('account.rowSubscription')}
            value={t(`plan.${plan.plan}` as const)}
            onPress={() => router.push('/subscription')}
            accessibilityLabel={t('account.rowSubscription')}
            accessibilityHint={t('account.subscriptionHint', { plan: t(`plan.${plan.plan}`) })}
          />
        </View>
      </Card>
    </View>
  );
}

/* ----------------------------------------------------------------- the work */

/**
 * Frame W7's own note: *"this lives on the Work Account tab together with
 * Workspace, Connection and Sign out."* Both blocks are built in
 * `screens/work/` and exported for this screen, because the state behind them
 * is that surface's — the same flag `WorkConnection` toggles decides whether
 * the Queue groups by floor or by sync state.
 */
function WorkSection() {
  const { space } = useTheme();
  return (
    <View style={{ gap: space[5] }}>
      <WorkShiftSummary />
      <WorkConnection />
    </View>
  );
}

/* ---------------------------------------------------------- the preferences */

/**
 * Identical on all six seats, because these belong to the PERSON and a person
 * does not have a different language per workspace.
 *
 * Language is drawn inline rather than behind a row, which is the one place
 * this departs from "every row opens something". R5 and B25 both draw
 * "Language · EN | RW" as a control on the row itself, and they are right to:
 * switching language is the cheapest way to find a line that truncates, and a
 * reader who cannot read the current language should not have to navigate one
 * level deeper in it to get out.
 */
function PreferencesSection({ appearance }: { appearance: Appearance }) {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { on: twoFactor } = useTwoFactor();

  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{t('account.sectionPreferences')}</SectionLabel>
      <Card bodyStyle={{ paddingVertical: 2 }}>
        <View>
          <ListRow
            icon="user"
            title={t('account.rowPersonal')}
            divider
            onPress={() => router.push('/personal-details')}
            accessibilityLabel={t('account.rowPersonal')}
            accessibilityHint={t('account.personalHint')}
          />
          <ListRow
            icon="shield"
            title={t('account.rowSecurity')}
            value={t(twoFactor ? 'account.twoFactorOn' : 'account.twoFactorOff')}
            divider
            onPress={() => router.push('/security')}
            accessibilityLabel={t('account.rowSecurity')}
            accessibilityHint={t('account.securityHint')}
          />

          {/* The one row whose control is on the row. See the note above. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              minHeight: 44,
              paddingVertical: space[2],
              borderBottomWidth: 1,
              borderBottomColor: c.borderSubtle,
            }}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.surface2,
              }}
            >
              <Icon name="globe" size={17} color={c.textBody} />
            </View>
            <Text weight="medium" size="sm" color="textStrong" style={{ flex: 1 }}>
              {t('account.language')}
            </Text>
            <View style={{ width: 128 }}>
              <SegmentedTabs
                items={[
                  { value: 'en', label: t('account.localeEn') },
                  { value: 'rw', label: t('account.localeRw') },
                ]}
                value={locale}
                onChange={(v) => setLocale(v as Locale)}
              />
            </View>
          </View>

          <ListRow
            icon={APPEARANCE_GLYPH[appearance]}
            title={t('account.rowAppearance')}
            value={t(`appearance.${appearance}` as const)}
            divider
            onPress={() => router.push('/appearance')}
            accessibilityLabel={t('account.rowAppearance')}
            accessibilityHint={t('account.appearanceHint')}
          />

          {/* ADR-015 call 5's other half. 22 of the 25 photographs this app
              ships stand in for a property whose own pictures the project does
              not hold, and the licence chain owes a full attribution somewhere
              that a tile-sized credit cannot carry. Session 0 built the screen
              and asked Session 11 to mount the row; this is it. */}
          {/* The support assistant (ADR-061 slice G). */}
          <ListRow
            icon="message"
            title={t('assistant.entry')}
            subtitle={t('assistant.entryMeta')}
            divider
            onPress={() => router.push('/assistant')}
            accessibilityLabel={t('assistant.entry')}
            accessibilityHint={t('assistant.entryMeta')}
          />

          <ListRow
            icon="image"
            title={t('account.photoCredits')}
            subtitle={t('account.photoCreditsMeta')}
            onPress={() => router.push('/photo-credits')}
            accessibilityLabel={t('account.photoCredits')}
            accessibilityHint={t('account.photoCreditsMeta')}
          />
        </View>
      </Card>
    </View>
  );
}

/* ------------------------------------------------------------- the sign out */

/**
 * A danger OUTLINE rather than a danger fill, which is what all three frames
 * draw. A filled destructive button at the foot of a settings page reads as the
 * page's primary action, and this page's primary action is everything above it.
 *
 * It opens a confirm rather than signing out on the tap. Signing out is cheap
 * to undo in this build — the session is a keychain flag — but it will not
 * always be, and a control whose only feedback is the whole app disappearing
 * deserves the question.
 */
function SignOutRow({ onPress }: { onPress: () => void }) {
  const { c, radius, space } = useTheme();
  const t = useT();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('account.signOut')}
      accessibilityHint={t('account.signOutHint')}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        minHeight: 48,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.danger500,
      }}
    >
      <Icon name="logOut" size={16} color={c.danger600} />
      <Text weight="semibold" size="sm" color="danger600">
        {t('account.signOut')}
      </Text>
    </PressableScale>
  );
}
