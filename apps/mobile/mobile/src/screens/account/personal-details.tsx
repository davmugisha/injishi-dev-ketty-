/**
 * Personal details — frame R14's "Personal details ›", and the Guest
 * artboard's "Profile · Name, email, language".
 *
 * F-S12 §6 is the spec: display name, avatar, and the linked sign-in methods.
 * Two of its rules are the reason this is a screen rather than three rows.
 *
 * **"Email never on public profile; reviews show first name + last initial
 * only."** A rule nobody can check is a rule nobody believes, so the screen
 * prints what a stranger actually sees, beside the private value, and derives
 * it rather than storing it — see `applyPersonalChange`, where renaming
 * recomputes the public form so a rename cannot leave a stale one behind.
 *
 * **The system is passwordless (F-S01), so a "linked method" is a way IN rather
 * than a credential.** That distinction matters at the moment somebody tries to
 * unlink the only one they have, which is why the phone row cannot be unlinked
 * and says why instead of being quietly disabled.
 *
 * Editing is a form that commits, not a field that saves as you type. A name
 * that writes on every keystroke writes six half-names on the way to the right
 * one, and the public form under it would flicker through all six.
 *
 * ## The read moved to the server; the write could not, and here is why
 *
 * The name and the phone are `GET /api/v1/me/profile` now, seeded into the
 * local store the first time that call lands, so this screen names whoever is
 * signed in rather than the `ME` constant.
 *
 * The commit stays local. `PUT /api/v1/me/profile` takes `PersonalDetails`,
 * which is the whole of Step 1 — full name, gender, date of birth, phone,
 * identity document, address — and it REPLACES rather than merges, deliberately:
 * "a person correcting their document type must not be left holding half of the
 * old answer" (`me.controller.ts`). This screen collects a name and an email.
 * A PUT assembled from that would erase the caller's stored document and
 * address, which is a far worse outcome than an edit that does not survive a
 * relaunch — and an edit that does not survive a relaunch is exactly what this
 * screen already did before the read moved.
 *
 * So the write is owed the rest of Step 1 before it can move, and that is a
 * missing SCREEN rather than a missing endpoint. Nothing here should invent a
 * partial PUT in the meantime.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  BackHeader,
  Badge,
  Button,
  Card,
  Icon,
  InputField,
  ListRow,
  ModalSheet,
  Screen,
  StatRow,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { hasFixture, writeFixture } from '@/data/use-fixture-mutation';
import { useMyIdentity } from '@/queries/profile';
import { PERSONAL_KEY } from './account-fixtures';
import { seedPersonal, usePersonalDetails, usePersonalMutation } from './account-store';

/** What the email row shows when nothing serves one. Not a translated string:
 *  it is a typographic placeholder, the same one `queries/landlord.ts` uses for
 *  a unit the server did not label. */
const UNKNOWN = '—';

export function PersonalDetailsScreen() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const toast = useToast();
  const me = useMyIdentity();
  const details = usePersonalDetails();
  const change = usePersonalMutation();
  const [editing, setEditing] = useState<'name' | 'email' | null>(null);

  /**
   * Replace the placeholder with the real person, once.
   *
   * `GET /api/v1/me/profile` is the source of the name and the phone; the local
   * store stays where it is because the WRITE cannot move yet — see below. So
   * the server's answer seeds the store the first time it lands, and after that
   * whatever the person typed wins.
   *
   * `hasFixture` is the guard that makes "after that" true. Without it a
   * refetch — a window focus, a cache miss — would drop a half-typed name on
   * the floor and put the server's back, which reads as the form undoing itself
   * for no reason anybody can see.
   */
  useEffect(() => {
    if (!me.fromServer) return;
    if (hasFixture(PERSONAL_KEY)) return;
    writeFixture(PERSONAL_KEY, seedPersonal({ name: me.name, phone: me.phone }));
  }, [me.fromServer, me.name, me.phone]);

  const google = details.methods.find((m) => m.id === 'google');
  const saving = change.status === 'saving';

  return (
    <>
      <BackHeader />
      <Screen title={t('personal.title')}>
        <Card title={t('personal.youTitle')} subtitle={t('personal.youBody')}>
          <View>
            <StatRow label={t('personal.name')} value={details.displayName} divider />
            <StatRow label={t('personal.phone')} value={details.phone || UNKNOWN} divider />
            {/* No route serves the caller's own email — `/me/profile` carries a
                name, a phone, a document and an address, and Better Auth's user
                row is not exposed. So on a real session this reads as unknown
                rather than borrowing the placeholder's address, which would be
                a fabricated fact about a real person. */}
            <StatRow label={t('personal.email')} value={details.email || UNKNOWN} />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button variant="outline" leadingIcon="edit" onPress={() => setEditing('name')}>
            {t('personal.editName')}
          </Button>
          <Button variant="outline" leadingIcon="mail" onPress={() => setEditing('email')}>
            {t('personal.editEmail')}
          </Button>
        </View>

        {/* F-S12 §6, made checkable rather than promised. */}
        <View
          accessible
          accessibilityLabel={`${t('personal.publicTitle')}. ${t('personal.publicBody')}. ${details.publicName}`}
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
            {details.publicName}
          </Text>
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {t('personal.publicBody')}
          </Text>
        </View>

        <Card
          title={t('personal.methodsTitle')}
          subtitle={t('personal.methodsBody')}
          bodyStyle={{ paddingVertical: 2 }}
        >
          <View>
            <ListRow
              icon="smartphone"
              title={t('personal.methodPhone')}
              subtitle={details.phone}
              divider
              chevron={false}
              accessibilityLabel={`${t('personal.methodPhone')}, ${t('personal.linked')}`}
              trailing={
                <Badge tone="success" dot>
                  {t('personal.linked')}
                </Badge>
              }
            />
            <ListRow
              icon="globe"
              title={t('personal.methodGoogle')}
              subtitle={t(google?.linked ? 'personal.googleLinkedBody' : 'personal.googleBody')}
              chevron={false}
              accessibilityLabel={`${t('personal.methodGoogle')}, ${t(
                google?.linked ? 'personal.linked' : 'personal.notLinked',
              )}`}
              trailing={
                <Button
                  size="sm"
                  variant={google?.linked ? 'ghost' : 'secondary'}
                  disabled={saving}
                  onPress={() => {
                    void change
                      .mutate({ kind: 'link', id: 'google', linked: !google?.linked })
                      .then(() =>
                        toast.show(
                          t(google?.linked ? 'personal.unlinkedToast' : 'personal.linkedToast'),
                          'success',
                        ),
                      );
                  }}
                >
                  {t(google?.linked ? 'personal.unlink' : 'personal.link')}
                </Button>
              }
            />
          </View>
        </Card>

        {/* The one way in cannot be removed, and the screen says so rather than
            greying a control out and leaving the reader to guess. */}
        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {t('personal.lastMethodNote')}
        </Text>
      </Screen>

      <EditSheet
        field={editing}
        saving={saving}
        current={editing === 'email' ? details.email : details.displayName}
        onClose={() => setEditing(null)}
        onSave={(value) => {
          const field = editing;
          setEditing(null);
          if (!field) return;
          void change
            .mutate(field === 'email' ? { kind: 'email', value } : { kind: 'name', value })
            .then(() => toast.show(t('personal.savedToast'), 'success'));
        }}
      />
    </>
  );
}

/**
 * One field, one commit.
 *
 * A `ModalSheet` for the reason `components/modal-sheet.tsx` names: it is bound
 * to one row of one screen and it is a step inside an edit already begun, so a
 * route would put a navigation boundary through the middle of one action.
 */
function EditSheet({
  field,
  current,
  saving,
  onClose,
  onSave,
}: {
  field: 'name' | 'email' | null;
  current: string;
  saving: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(current);

  const email = field === 'email';
  const ready = email ? /.+@.+\..+/.test(value.trim()) : value.trim().length > 1;

  return (
    <ModalSheet
      visible={field !== null}
      onClose={onClose}
      title={t(email ? 'personal.editEmail' : 'personal.editName')}
      subtitle={t(email ? 'personal.editEmailBody' : 'personal.editNameBody')}
      footer={
        <Button block size="lg" disabled={!ready || saving} onPress={() => onSave(value)}>
          {saving ? t('personal.saving') : t('personal.save')}
        </Button>
      }
    >
      <InputField
        // Remounts per field, so opening "email" after "name" does not show the
        // name still sitting in the box.
        key={field ?? 'none'}
        label={t(email ? 'personal.email' : 'personal.name')}
        value={value}
        onChangeText={setValue}
        autoCapitalize={email ? 'none' : 'words'}
        autoComplete={email ? 'email' : 'name'}
        keyboardType={email ? 'email-address' : 'default'}
        helper={t(email ? 'personal.emailHelper' : 'personal.nameHelper')}
      />
    </ModalSheet>
  );
}
