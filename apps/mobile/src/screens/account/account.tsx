/**
 * Account — one screen, six seats, and the only tab in every tab set.
 *
 * Frames R5 (Landlord), R14 (Tenant), B25 (Broker), W7 (Work) and the Guest
 * canvas artboard 12 draw five Account screens, and the interesting thing about
 * them is how much they agree: all five open with the same identity block, all
 * five carry the same "Switch workspace ›" row directly under it, all five end
 * with the same PREFERENCES section and the same danger-outline "Sign out".
 * What differs is one section in the middle. So this is one screen that
 * branches on the seat, not five screens that share a name — five files would
 * be five places to forget the sign-out confirm.
 *
 * The order is the frames' own, and it is an argument rather than a layout:
 *
 *   1. **Who you are and which seat you are in.** The person from
 *      `GET /me/profile`, the seat from `/me/workspaces` (`identity-card.tsx`).
 *   2. **How to change seats**, immediately under it, because the first
 *      question anyone opens this screen with is "am I in the right workspace".
 *   3. **The business of THIS seat.** Today that is the broker's reveal
 *      credits and nothing else; see "What the business section lost" below.
 *   4. **The shift**, on Work only: frame W7's summary and W2's connection
 *      switch, mounted from `screens/work/` where the state behind them lives.
 *   5. **Preferences**, which belong to the person and not the seat, and are
 *      therefore identical on all six.
 *   6. **Sign out**, last and destructive, behind a confirm.
 *
 * ## What the business section lost (mobile audit 2026-10-05)
 *
 * Landlord and Host used to get Payout account, Organisation profile, People
 * and Subscription here, and the broker got Payout account too. Every one was a
 * fixture presented as the workspace's own: a MoMo number and a balance nobody
 * holds (SA-04), another company's legal name and TIN (SA-03), four invented
 * staff (HO-05), and a paid plan the owner decided to unlink (SA-05). Their
 * routes are closed for every seat in `app/_layout.tsx`, so a row left here
 * would bounce whoever pressed it back home. The rows are gone and the screens
 * are kept for the reads that replace their fixtures.
 *
 * They were also chosen by the wrong test. `isBusiness(surface)` showed all
 * four to every member of a residence business, a caretaker included, and to
 * an org whose permissions are empty because it is not yet active (SA-15). When
 * a row comes back it is chosen by the seat's resolved permissions through
 * `useMayI` from `@/workspace` — `money.view` for the payout, `team.manage` for
 * the people — never by a surface. The one row left is the broker's, and it is
 * chosen by the seat's KIND, because a broker seat holds no permissions by
 * design (`permissionsForWorkspace` in `@injishi/contracts`). The API decides
 * the same way: `ops/broker/*` declares no permission and refuses anything that
 * is not a broker's own workspace (`broker.controller.ts`), and kind is what
 * ADR-038 child 7 says a row may be chosen by alongside the permissions.
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
 * **Every row goes somewhere, and somewhere open to this seat.** Session 0
 * shipped five rows with a chevron and a "not wired yet" toast, the orphaned
 * control the quality bar rules out. Every row below opens a screen this seat
 * may open; a row whose route is closed is not drawn at all.
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
import { KINYARWANDA_AVAILABLE, useT, useLocale, type Locale } from '@/i18n/i18n';
import { WorkConnection, WorkShiftSummary } from '@/screens/work';
import { DIAGNOSTICS_ALLOWED } from '@/lib/crash-env';
import { IdentityCard } from './identity-card';
import { useCrashReportingChoice } from './privacy';
// One glyph map, owned beside the sheet that draws the choice, so the row and
// the sheet can never disagree about what an appearance looks like.
import { APPEARANCE_GLYPH } from './appearance';
import { seatRoleLabel } from './account-format';
import { useTwoFactorState } from './account-store';

export function Account() {
  const { space, appearance } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace, surface } = useDomain();

  // A word rather than the server's enum, and never blank: the chip and the
  // switch row used to print "owner", or nothing at all on a broker seat
  // (mobile audit 2026-10-05, SA-10).
  const role = seatRoleLabel(workspace, surface, t);

  return (
    <Screen
      title={t('account.title')}
      action={
        <WorkspaceChip
          name={workspace.name}
          role={role}
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
          value={role || undefined}
          onPress={() => router.push('/switch')}
          accessibilityLabel={t('switch.open')}
          accessibilityHint={t('account.switchHint', { name: workspace.name })}
        />
      </Card>

      {workspace.type === 'broker' ? <BrokerSection /> : null}
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
 * Frame B25's BUSINESS section, down to the one row that is still true.
 *
 * The row carries no count. "7 left" was the fixture's seed balance, printed on
 * every broker's Account (SA-24); the ledger read that replaces it is the next
 * phase, and a row with no number is honest where a wrong number is not.
 */
function BrokerSection() {
  const router = useRouter();
  const t = useT();

  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{t('account.sectionBusiness')}</SectionLabel>
      <Card bodyStyle={{ paddingVertical: 2 }}>
        <ListRow
          icon="eye"
          title={t('account.rowCredits')}
          onPress={() => router.push('/reveal-credits')}
          accessibilityLabel={t('account.rowCredits')}
          accessibilityHint={t('account.creditsHint')}
        />
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
 */
function PreferencesSection({ appearance }: { appearance: Appearance }) {
  const router = useRouter();
  const t = useT();
  const twoFactor = useTwoFactorState();
  const crashReports = useCrashReportingChoice();

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
          {/* "2FA · On" only when `GET /me/two-factor` says this account needs
              it, and nothing while that read is out or failed. It used to say
              On for everyone, from a fixture (mobile audit 2026-10-05, SA-06).
              "Off" is not offered either: there is no switch to turn it on,
              and the Security screen says why it is not needed. */}
          <ListRow
            icon="shield"
            title={t('account.rowSecurity')}
            value={twoFactor.data?.required ? t('account.twoFactorOn') : undefined}
            divider
            onPress={() => router.push('/security')}
            accessibilityLabel={t('account.rowSecurity')}
            accessibilityHint={t('account.securityHint')}
          />
          {/* ADR-063 AC-8: the crash reports switch, a choice about this phone
              rather than the account, so it sits with the person's other
              preferences on every seat. */}
          <ListRow
            icon="lock"
            title={t('account.rowPrivacy')}
            value={t(crashReports === 'on' ? 'account.privacyOn' : 'account.privacyOff')}
            divider
            onPress={() => router.push('/privacy')}
            accessibilityLabel={t('account.rowPrivacy')}
            accessibilityHint={t('account.privacyHint')}
          />

          {/* v1 ships in English only, so there is no language to choose
              (mobile audit 2026-10-05, SA-18). The row comes back with the
              flag that brings Kinyarwanda back. */}
          {KINYARWANDA_AVAILABLE ? <LanguageRow /> : null}

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
          <ListRow
            icon="image"
            title={t('account.photoCredits')}
            subtitle={t('account.photoCreditsMeta')}
            divider={DIAGNOSTICS_ALLOWED}
            onPress={() => router.push('/photo-credits')}
            accessibilityLabel={t('account.photoCredits')}
            accessibilityHint={t('account.photoCreditsMeta')}
          />
          {/* ADR-063 AC-7: development and tester builds only. A production
              build has no row, and its route shows not found. */}
          {DIAGNOSTICS_ALLOWED ? (
            <ListRow
              icon="wrench"
              title={t('diagnostics.row')}
              onPress={() => router.push('/diagnostics')}
              accessibilityLabel={t('diagnostics.row')}
            />
          ) : null}
        </View>
      </Card>
    </View>
  );
}

/**
 * Language, drawn inline rather than behind a row, which is the one place this
 * departs from "every row opens something". R5 and B25 both draw
 * "Language · EN | RW" as a control on the row itself, and they are right to:
 * switching language is the cheapest way to find a line that truncates, and a
 * reader who cannot read the current language should not have to navigate one
 * level deeper in it to get out.
 *
 * Mounted only while Kinyarwanda is available; see the note where it is used.
 */
function LanguageRow() {
  const { c, space } = useTheme();
  const t = useT();
  const { locale, setLocale } = useLocale();

  return (
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
  );
}

/* ------------------------------------------------------------- the sign out */

/**
 * A danger OUTLINE rather than a danger fill, which is what all three frames
 * draw. A filled destructive button at the foot of a settings page reads as the
 * page's primary action, and this page's primary action is everything above it.
 *
 * It opens a confirm rather than signing out on the tap. Signing out ends the
 * session and drops anything still waiting to be sent, and a control whose only
 * feedback is the whole app disappearing deserves the question.
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
