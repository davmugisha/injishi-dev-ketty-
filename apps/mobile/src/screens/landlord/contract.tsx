/**
 * Contract & sign, landlord seat — frame R8 (F-R04, FL21 path A step 2).
 *
 * FL21 is a two-signature flow and this screen is the FIRST signature. The
 * landlord signs, `landlordSignedAt` is set, the lease moves to
 * `pending_signature`, and the tenant is invited. It does not activate the
 * lease and it does not start rent — both of those wait for the second
 * signature, which happens on the tenant's own `lease/[leaseId]/sign` (frame
 * R16, session 7).
 *
 * Three states, and all three are drawn:
 *
 *   - **Unsigned by anybody** — the pad is live, the primary is disabled until
 *     there is ink on it, and the consequence is printed under the button
 *     rather than discovered after it.
 *   - **Landlord signed, tenant has not** — the pad is gone, the landlord's row
 *     shows its date, the tenant's shows "awaiting", and there is no primary,
 *     because the only thing left to do is on the Leases tab as "Nudge tenant
 *     to sign".
 *   - **Both signed** — the contract is immutable (F-R04: a material change is
 *     a new Lease, not an edit) and the screen says so instead of offering an
 *     edit that would be refused.
 *
 * The term-fields in the summary are READ ONLY on purpose. FL21 step 1: parties,
 * room, rent, caution and dates are locked and flow in from the lease; only the
 * clause body is editable, and clause editing is a Tiptap surface the mobile
 * client does not carry. Drawing an editable rent here would let a landlord
 * change a number the contract is generated from.
 *
 * **What signing here is today, said plainly** (mobile audit 2026-10-05,
 * LL-04). `POST /ops/leases/:id/sign` does not exist, so the signature lands in
 * this phone's own store and nowhere else. So the screen claims no more than
 * that: the signatory is the person holding the phone, by their own name from
 * the server and never the fixture persona `ME`; the stamp is today's date,
 * not a fixed "4 Aug 2026"; nothing says the contract went to the tenant, was
 * stored for seven years or will be filed with RRA; and "Read the full
 * contract" and "Download", which only ever toasted that a service was "not
 * wired", are gone.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  SectionLabel,
  SignaturePad,
  StickyBar,
  Text,
  todayIso,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT, type MessageKey } from '@/i18n/i18n';
import { useMyIdentity } from '@/queries/profile';
import { useFixtureMutation } from '@/data/use-fixture-mutation';
import {
  applyLandlordSignature,
  dayStamp,
  findLease,
  LEASES_KEY,
  seedLeases,
  useLandlordRead,
} from '@/data/landlord';

/** The bilingual template's four sections. The same on every lease, so they
 *  are copy rather than fixture data — see `LandlordLease.extraClauses`. */
const CLAUSES: MessageKey[] = [
  'landlord.contract.clause1',
  'landlord.contract.clause2',
  'landlord.contract.clause3',
  'landlord.contract.clause4',
];

export function LandlordContract({ leaseId }: { leaseId: string }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { workspace } = useDomain();
  const me = useMyIdentity();
  const [inked, setInked] = useState(false);

  const read = useLandlordRead(LEASES_KEY, seedLeases);
  const lease = findLease(read.data ?? [], leaseId);
  const sign = useFixtureMutation(LEASES_KEY, applyLandlordSignature, seedLeases);

  if (read.status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <BackHeader />
        <View style={{ paddingTop: insets.top + 80, paddingHorizontal: space[4] }}>
          <Text
            accessibilityRole="progressbar"
            accessibilityLabel={t('state.loading')}
            size="sm"
            color="textMuted"
          >
            {t('state.loading')}
          </Text>
        </View>
      </View>
    );
  }

  // A failed read is not a missing lease (mobile audit 2026-10-05, LL-21).
  if (read.status === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <BackHeader />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[4] }}>
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('landlord.leaseLabel') })}
            detail={read.error?.message}
            onRetry={read.retry}
          />
        </View>
      </View>
    );
  }

  if (!lease) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <BackHeader />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[4] }}>
          <EmptyState
            icon="fileText"
            title={t('landlord.notFoundTitle')}
            body={t('landlord.notFoundBody')}
            action={
              <Button variant="outline" size="sm" onPress={() => router.replace('/leases')}>
                {t('landlord.backToLeases')}
              </Button>
            }
          />
        </View>
      </View>
    );
  }

  const landlordSigned = !!lease.landlordSignedOn;
  const tenantSigned = !!lease.tenantSignedOn;
  const bothSigned = landlordSigned && tenantSigned;
  const busy = sign.status === 'saving';

  const termLabel = lease.tenure === 'long_term' ? '12 months' : '6 months';

  /**
   * Signing, and failing to (gaps.md §5.1, P1).
   *
   * A contract is a legal artefact and this screen had `err=0`: the signature
   * was captured, the write ran, and the screen toasted "signed" and navigated
   * away **whether or not the write landed**. A half-signed contract that
   * reports itself signed is the worst outcome this surface has — the landlord
   * believes the lease is executed and the tenant's copy says otherwise.
   *
   * So the toast and the navigation now sit behind the write's own RESULT, and
   * a failure keeps the person on the screen with their signature intact. Not
   * behind `sign.status`: read after the `await`, that is the value from the
   * render that pressed the button, from before the write, and it let a failed
   * signature toast and go back anyway (gaps.md §0.3).
   */
  const confirm = async () => {
    if (!inked || busy) return;
    const outcome = await sign.mutate({ id: lease.id, on: dayStamp(todayIso(), t) });
    if (outcome !== 'done') return;
    toast.show(t('landlord.contract.done', { tenant: lease.tenant }), 'success');
    router.back();
  };

  // The person signing is the person holding the phone. Their name only when
  // the server has one; the role alone while it loads; "Name not added yet"
  // when the account has none. Never the fixture persona.
  const signatory = me.fromServer
    ? t('landlord.contract.landlord', { name: me.name })
    : me.pending
      ? t('landlord.contract.landlordRole')
      : t('landlord.contract.landlord', { name: t('identity.unnamed') });

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + (landlordSigned ? 40 : 150),
          paddingHorizontal: space[4],
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          accessibilityRole="header"
          family="display"
          weight="semibold"
          size="2xl"
          color="textStrong"
          style={{ letterSpacing: -0.4 }}
        >
          {t('landlord.contract.title')}
        </Text>

        {/* The agreement. Locked term-fields, rendered as prose because that is
            what they are — the contract's own first paragraph. */}
        <Card
          title={t('landlord.contract.agreement')}
          action={<Badge tone="brand">{t('landlord.contract.bilingual')}</Badge>}
        >
          <View style={{ gap: space[4] }}>
            <Text size="sm" color="textBody" style={{ lineHeight: 22 }}>
              {t('landlord.contract.summary', {
                org: workspace.name,
                tenant: lease.tenant,
                unit: lease.unit,
                rent: `RWF ${lease.rent.toLocaleString('en-US')}`,
                term: termLabel,
              })}
            </Text>

            <View
              style={{
                gap: 9,
                paddingTop: space[3],
                borderTopWidth: 1,
                borderTopColor: c.borderSubtle,
              }}
            >
              {CLAUSES.map((key) => (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <Icon name="check" size={14} color={c.textSubtle} />
                  <Text size="sm" color="textBody" style={{ flex: 1 }}>
                    {t(key)}
                  </Text>
                </View>
              ))}
            </View>

            <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
              {lease.extraClauses === 0
                ? t('landlord.contract.templatePlain')
                : t('landlord.contract.template', { count: lease.extraClauses })}
            </Text>
          </View>
        </Card>

        <SectionLabel>{t('landlord.contract.signatures')}</SectionLabel>

        {/* Landlord */}
        <View style={{ gap: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Text weight="semibold" size="sm" color="textStrong" style={{ flexShrink: 1 }}>
              {signatory}
            </Text>
            {landlordSigned ? (
              <Badge tone="success">
                {t('landlord.contract.signedOn', { date: lease.landlordSignedOn ?? '' })}
              </Badge>
            ) : (
              <Badge tone="warning">{t('landlord.contract.awaiting')}</Badge>
            )}
          </View>
          {landlordSigned ? null : <SignaturePad onChange={setInked} />}
        </View>

        {/* Tenant */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: 14,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: c.borderSubtle,
            backgroundColor: c.surface2,
          }}
        >
          <Text weight="semibold" size="sm" color="textStrong" style={{ flexShrink: 1 }}>
            {t('landlord.contract.tenant', { name: lease.tenant })}
          </Text>
          {tenantSigned ? (
            <Badge tone="success">
              {t('landlord.contract.signedOn', { date: lease.tenantSignedOn ?? '' })}
            </Badge>
          ) : (
            <Badge tone="warning">{t('landlord.contract.awaiting')}</Badge>
          )}
        </View>

        {bothSigned ? (
          <Card variant="tint">
            <View style={{ flexDirection: 'row', gap: 11 }}>
              <Icon name="lock" size={18} color={c.brand700} />
              <Text size="sm" color="brand900" style={{ flex: 1, lineHeight: 19 }}>
                {t('landlord.contract.bothSigned')}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* A signature that did not save. It sits at the FOOT of the scroll,
            beside the signature pad, rather than at the top: the landlord is
            looking at the thing they just drew, and an error at the top of a
            long contract is an error nobody sees. */}
        {sign.status === 'error' ? (
          <WriteError body="write.failedLegalBody" onRetry={() => void confirm()} />
        ) : null}
      </ScrollView>

      {landlordSigned ? null : (
        <StickyBar>
          <View style={{ flex: 1, paddingRight: 12 }}>
            {/* The consequence, printed under the button rather than found
                after it — the canvas rule this whole pack repeats. */}
            <Text size="xs" color="textMuted" style={{ lineHeight: 16 }}>
              {t('landlord.contract.consequence', { tenant: lease.tenant })}
            </Text>
          </View>
          <Button
            variant="primary"
            leadingIcon="check"
            disabled={!inked || busy}
            accessibilityLabel={
              inked ? t('landlord.contract.confirm') : t('landlord.contract.blocked')
            }
            onPress={() => void confirm()}
          >
            {busy
              ? t('landlord.contract.signing')
              : inked
                ? t('landlord.contract.confirm')
                : t('landlord.contract.blocked')}
          </Button>
        </StickyBar>
      )}
    </View>
  );
}
