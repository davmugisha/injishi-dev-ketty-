/**
 * Activate - frame X3.
 *
 * The invited tenant's first screen. A landlord registered a lease against a
 * email address and the person holding that address is here: FL03 entry point 2,
 * and the claim shape F-B10 asks for, where activating binds an existing record
 * to one identity rather than creating a second one.
 *
 * Three things the frame settles and this keeps:
 *
 *   - **The card is read out of the lease, not out of the invite.** The unit,
 *     the org, the rent and the photograph all come from the same `Tenancy`
 *     the sign screen will render, so what a person agrees to here and what
 *     they read on the next screen cannot drift.
 *   - **The address is read-only and says why.** The landlord entered it; it is
 *     how the invite arrived; editing it here would address the invite to
 *     somebody else. The tick beside it is an `Icon`, not the frame's dingbat.
 *   - **The consequence is printed under the button.** Activating opens the
 *     lease to read and sign. It signs nothing, and the line says so, because
 *     "consequences are printed, not discovered later" is the canvas rule and
 *     this is the screen where getting it wrong costs the most.
 *
 * ## Why the hand-off is a state machine and not three calls
 *
 * Activating has to land the reader on `lease/[leaseId]/sign` with the TENANT
 * surface active, which is three separate facts: the seat is Personal, the
 * domain is Residence, and the session is authenticated. `setWorkspace` and
 * `setDomain` in `@/domain` each read the OTHER value out of their closure and
 * write both, so calling them in one tick makes the second one undo the first.
 *
 * So the hand-off advances one commit at a time and re-checks what actually
 * landed: seat, then domain, then session and route. It is longer than three
 * calls in a row and it is the version that is still correct when someone
 * signs out of the Landlord seat and opens an invite link.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  InputField,
  MoneyAmount,
  PhotoCredit,
  SectionLabel,
  StatusBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useSession } from '@/session';
import { useDomain } from '@/domain';
import { photo as photoAsset } from '@/data/photos';
import { AuthCanvas } from './auth-canvas';
import { BrandMark } from './brand-mark';
import { INVITE, invitedLease } from './invite';

/** The pause behind the "Activating" state. The same beat as verify. */
const ACTIVATE_MS = 800;

export function ActivateScreen() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const router = useRouter();
  const { signIn } = useSession();
  const { domain, setDomain, workspace, workspaces, setWorkspace } = useDomain();

  const lease = invitedLease();

  const [name, setName] = useState(INVITE.invitedName);
  const [touched, setTouched] = useState(false);
  const [activating, setActivating] = useState(false);
  /** Set once the button has been pressed; drives the hand-off below. */
  const [handingOff, setHandingOff] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  /**
   * One step per commit, re-reading what landed. See the note in the header:
   * the two domain setters cannot both be called in the same tick.
   */
  useEffect(() => {
    if (!handingOff || !lease) return;
    if (workspace.kind !== 'personal') {
      // The Personal seat as the SERVER returned it (ADR-038 child 0 task 8).
      // It used to be `PERSONAL_WORKSPACE` from the fixtures, which named a
      // workspace id that existed nowhere. When the list has not resolved, the
      // hand-off falls through to the sign screen rather than stalling: every
      // person holds a Personal workspace, so there is nothing to refuse here,
      // and blocking on a round trip would strand somebody activating a lease.
      const personal = workspaces.find((w) => w.type === 'personal');
      if (personal) {
        void setWorkspace(personal);
        return;
      }
    }
    if (domain !== 'residence') {
      setDomain('residence');
      return;
    }
    signIn();
    router.replace({ pathname: '/lease/[leaseId]/sign', params: { leaseId: lease.id } });
  }, [handingOff, lease, workspace, workspaces, domain, setWorkspace, setDomain, signIn, router]);

  // An invite whose lease has been withdrawn. It is a real outcome and it gets
  // a real screen: the alternative is a card reading "undefined · undefined".
  if (!lease) {
    return (
      <AuthCanvas>
        <EmptyState
          icon="alertCircle"
          title={t('auth.activateTitle')}
          body={t('auth.activateBody', { org: '—' })}
          action={
            <Button variant="primary" size="lg" onPress={() => router.replace('/(auth)/sign-in')}>
              {t('auth.notYou')}
            </Button>
          }
        />
      </AuthCanvas>
    );
  }

  const nameError = touched && name.trim().length === 0 ? t('auth.nameError') : undefined;
  const ready = name.trim().length > 0 && !activating;

  const activate = () => {
    setTouched(true);
    if (!ready) return;
    setActivating(true);
    timer.current = setTimeout(() => setHandingOff(true), ACTIVATE_MS);
  };

  const asset = photoAsset(lease.photos.thumbnail);

  return (
    /*
     * No back control, and that is the frame. X3 draws a small mark at the top
     * and no chevron, because an invite link is an ENTRY: there is nothing
     * behind it to go back to, and a chevron that no-ops is the orphaned
     * control the quality bar rules out. The way out is "Not you? Sign in
     * instead" at the foot, which is FL03 Path B - an activation that is not
     * yours is a prompt to sign in, not a dead end.
     */
    <AuthCanvas>
      <BrandMark width={32} />

      <View style={{ marginTop: space[5], gap: space[3] }}>
        <Text
          accessibilityRole="header"
          family="display"
          weight="semibold"
          size="2xl"
          color="textStrong"
          style={{ letterSpacing: -0.4 }}
        >
          {t('auth.activateTitle')}
        </Text>
        <Text size="md" color="textMuted">
          {t('auth.activateBody', { org: lease.landlordOrg })}
        </Text>
      </View>

      <View style={{ marginTop: space[5], gap: space[3] }}>
        <SectionLabel>{t('auth.inviteLabel')}</SectionLabel>

        <Card
          media={
            <View style={{ position: 'relative' }}>
              <Image
                source={asset?.source}
                placeholder={asset?.placeholder}
                contentFit="cover"
                transition={200}
                style={{ width: '100%', height: 132 }}
                // The card's own copy names the unit, so the picture repeating
                // it would be a second announcement of the same fact.
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              {/* ADR-015 call 5: a stand-in photograph carries a visible credit
                  where it appears, not only on the credits page. */}
              <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
                <PhotoCredit stem={lease.photos.thumbnail} placement="over" />
              </View>
            </View>
          }
        >
          <View style={{ gap: space[2] }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: space[3],
              }}
            >
              <Text
                family="display"
                weight="semibold"
                size="lg"
                color="textStrong"
                style={{ flex: 1 }}
              >
                {t('auth.unitLine', { unit: lease.unit, org: lease.landlordOrg })}
              </Text>
              <StatusBadge domain="lease" state={lease.leaseState} />
            </View>

            <Text size="sm" color="textMuted">
              {lease.address}
            </Text>

            <View
              accessible
              accessibilityLabel={`${lease.rent} RWF ${t('auth.perMonth')}, ${t('auth.termMonths', { count: INVITE.termMonths })}`}
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 6,
                marginTop: space[1],
              }}
            >
              <MoneyAmount value={lease.rent} strong tone="brand" size="lg" />
              <Text size="sm" color="textMuted">
                {t('auth.perMonth')}
              </Text>
              <Text size="sm" color="textSubtle">
                ·
              </Text>
              <Text size="sm" color="textMuted">
                {t('auth.termMonths', { count: INVITE.termMonths })}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ marginTop: space[5], gap: space[4] }}>
        <InputField
          label={t('auth.nameLabel')}
          value={name}
          onChangeText={(next) => {
            setTouched(true);
            setName(next);
          }}
          helper={t('auth.nameHint')}
          error={nameError}
          autoCapitalize="words"
          autoComplete="name"
          editable={!activating}
          testID="name-field"
        />

        <InputField
          label={t('auth.inviteEmailLabel')}
          value={INVITE.invitedEmail}
          // Read-only: the landlord entered it and it is how the invite
          // arrived. `InputField` draws a non-editable field on `surface2`.
          onChangeText={() => {}}
          editable={false}
          helper={t('auth.inviteEmailHint')}
          suffix={
            <View
              accessible
              accessibilityLabel={t('auth.inviteVerified')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Icon name="checkCircle" size={15} color={c.success600} />
              <Text size="xs" color="success600">
                {t('auth.inviteVerified')}
              </Text>
            </View>
          }
          testID="invite-email-field"
        />
      </View>

      <View style={{ marginTop: space[5], gap: space[3] }}>
        <Button variant="primary" size="lg" block disabled={!ready} onPress={activate}>
          {activating ? t('auth.activating') : t('auth.activateAction')}
        </Button>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: c.surface2,
          }}
        >
          <Icon name="info" size={15} color={c.textMuted} />
          <Text size="xs" color="textBody" style={{ flex: 1 }}>
            {t('auth.activateConsequence')}
          </Text>
        </View>

        <Text size="xs" color="textMuted">
          {t('auth.activateFootnote')}
        </Text>
      </View>

      <View style={{ flexGrow: 1, minHeight: space[4] }} />

      <View style={{ alignItems: 'center', marginTop: space[4] }}>
        <Button variant="ghost" size="md" onPress={() => router.replace('/(auth)/sign-in')}>
          {t('auth.notYou')}
        </Button>
      </View>
    </AuthCanvas>
  );
}
