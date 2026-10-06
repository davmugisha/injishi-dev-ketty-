/**
 * Personal details — frame R14's "Personal details ›", and the Guest
 * artboard's "Profile · Name, email, language".
 *
 * **Read only, and it says so** (mobile audit 2026-10-05, SA-14). The name and
 * the phone are `GET /api/v1/me/profile` through `useMyIdentity()`, the one
 * read that names the person on every screen (SA-01), so this screen draws a
 * name only when the server holds one, a skeleton while it is asked, and "Name
 * not added yet" otherwise.
 *
 * It used to be a form. "Change name" and "Change email" wrote to an in-memory
 * fixture store seeded from the `ME` persona and toasted "Saved." whatever
 * happened, so an edit vanished on the next launch and never reached the
 * server. The write cannot simply move to the server either:
 * `PUT /api/v1/me/profile` takes the WHOLE of Step 1 (full name, gender, date
 * of birth, phone, identity document, address) and replaces it, on purpose, so
 * a PUT built from a name alone would erase the person's stored document and
 * address. The note at the bottom of `queries/profile.ts` has the detail. Until
 * the app carries the full Step 1 form, changes are made on the web, and the
 * screen says that in plain words instead of pretending to save.
 *
 * **How you sign in is one sentence, not a list of methods.** The screen used
 * to list "Phone number · Linked" and offer "Link Google", neither of which
 * signs anybody in: sign in is a code sent by email, and that is all. The
 * address comes from the step-up read (`GET /api/v1/me/two-factor`), already
 * masked by the server, and the sentence simply leaves it out until that read
 * has answered.
 *
 * **"Email never on public profile; reviews show first name + last initial
 * only"** (F-S12 §6) stays checkable: the screen prints the public form beside
 * the name it is derived from, when there is a name to derive it from.
 */
import { View } from 'react-native';
import { BackHeader, Card, Icon, Screen, Skeleton, StatRow, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useMyIdentity } from '@/queries/profile';
import { publicForm, useTwoFactorState } from './account-store';

/** What a row shows when the server holds nothing for it. Not a translated
 *  string: it is a typographic placeholder, the same one `queries/landlord.ts`
 *  uses for a unit the server did not label. */
const UNKNOWN = '—';

export function PersonalDetailsScreen() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const me = useMyIdentity();
  const twoFactor = useTwoFactorState();
  const address = twoFactor.data?.sentTo?.trim();

  return (
    <>
      <BackHeader />
      <Screen title={t('personal.title')}>
        <Card title={t('personal.youTitle')} subtitle={t('personal.youBody')}>
          <View>
            {me.pending ? (
              <>
                <PendingRow label={t('personal.name')} divider />
                <PendingRow label={t('personal.phone')} />
              </>
            ) : (
              <>
                <StatRow
                  label={t('personal.name')}
                  value={me.fromServer ? me.name : t('identity.unnamed')}
                  tone={me.fromServer ? 'textStrong' : 'textMuted'}
                  divider
                />
                <StatRow
                  label={t('personal.phone')}
                  value={me.fromServer && me.phone ? me.phone : UNKNOWN}
                />
              </>
            )}
          </View>
        </Card>

        {/* Said where the edit buttons used to be, so nobody goes looking for
            them: the app cannot change these yet, and here is where they do
            change. */}
        <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
          {t('personal.changeBody')}
        </Text>

        {/* F-S12 §6, made checkable rather than promised. Only with a name:
            there is no public form of a name nobody has given. */}
        {me.fromServer ? (
          <View
            accessible
            accessibilityLabel={`${t('personal.publicTitle')}. ${t('personal.publicBody')}. ${publicForm(me.name)}`}
            style={{
              gap: space[2],
              padding: space[4],
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: c.borderSubtle,
              backgroundColor: c.surface2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="eye" size={15} color={c.textMuted} />
              <Text
                weight="bold"
                size="2xs"
                color="textMuted"
                style={{ letterSpacing: 1, textTransform: 'uppercase' }}
              >
                {t('personal.publicTitle')}
              </Text>
            </View>
            <Text family="display" weight="semibold" size="lg" color="textStrong">
              {publicForm(me.name)}
            </Text>
            <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
              {t('personal.publicBody')}
            </Text>
          </View>
        ) : null}

        <Card title={t('personal.methodsTitle')}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
            <Icon name="mail" size={17} color={c.textMuted} />
            <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
              {address
                ? t('personal.signInBodyTo', { address })
                : t('personal.signInBody')}
            </Text>
          </View>
        </Card>
      </Screen>
    </>
  );
}

/**
 * A detail row while `/me/profile` is still being asked: the label, and a
 * skeleton where the value goes. The same height and rule as `StatRow`, so the
 * card does not jump when the answer lands.
 */
function PendingRow({ label, divider = false }: { label: string; divider?: boolean }) {
  const { c, space } = useTheme();
  const t = useT();

  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${t('state.loading')}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        paddingVertical: space[2],
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: c.borderSubtle,
      }}
    >
      <Text size="sm" color="textBody" style={{ flex: 1 }}>
        {label}
      </Text>
      <Skeleton width={128} height={18} />
    </View>
  );
}
