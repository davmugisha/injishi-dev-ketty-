/**
 * Register tenant — frame R6 (F-R03, FL20).
 *
 * FL20 step 1 creates a `draft`; step 3 invites the tenant and moves it to
 * `pending_signature`. Those are two steps and this screen is only the first,
 * which is why the primary reads "Create lease & send to sign" and the
 * consequence under it says plainly that nothing reaches the tenant until the
 * next screen. The frame's arrow into R8 is not a flourish — it is where the
 * second step happens.
 *
 * **The banner is conditional and the screen has to render both ways.** FL19
 * hands a broker placement over with the tenant already identified, and R6
 * prefills from it. Without one the same form opens blank. A screen written
 * only for the prefilled path is a screen that has never been seen empty.
 *
 * **The unit selector offers vacant units only.** F-R03: a Room holds at most
 * one active Lease, and FL20 §6 says a second one is prevented. Enforcing that
 * by not offering the unit is better than enforcing it with an error after the
 * fact — the rule is visible instead of discovered.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Button,
  Card,
  EmptyState,
  Icon,
  InputField,
  MoneyAmount,
  PressableScale,
  SectionLabel,
  SegmentedTabs,
  StickyBar,
  Text,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useFixtureMutation } from '@/data/use-fixture-mutation';
import {
  applyCreateLease,
  LEASES_KEY,
  nextLeaseRef,
  readPendingPlacement,
  seedLeases,
  useLandlordRead,
  VACANT_UNITS,
  type Tenure,
} from '@/data/landlord';

/** Digits only, so "788 402 116" and "788402116" validate the same. */
const digits = (s: string) => s.replace(/\D/g, '');

export function RegisterTenant() {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const read = useLandlordRead(LEASES_KEY, seedLeases);
  const leases = read.data ?? [];
  const create = useFixtureMutation(LEASES_KEY, applyCreateLease, seedLeases);

  // FL19's hand-off, or `null` on FL20 path C — a landlord registering a known
  // tenant with no broker involved. Read once into the initial form state
  // rather than held as a source of truth, so editing a prefilled field is
  // just editing a field.
  const placement = readPendingPlacement();

  const [name, setName] = useState(placement?.tenantName ?? '');
  const [phone, setPhone] = useState(placement?.tenantPhone ?? '');
  const [nid, setNid] = useState(placement?.tenantNationalId ?? '');
  const [unit, setUnit] = useState(placement?.unit ?? VACANT_UNITS[0]?.unit ?? '');
  const [rent, setRent] = useState(placement ? String(placement.rent) : '');
  const [caution, setCaution] = useState(placement ? String(placement.caution) : '');
  const [tenure, setTenure] = useState<Tenure>('long_term');
  // Errors appear on blur or on a blocked submit, never while the first
  // character is still being typed — a field that goes red at keystroke one
  // reads as broken rather than as incomplete.
  const [touched, setTouched] = useState(false);

  const chosen = VACANT_UNITS.find((u) => u.unit === unit) ?? VACANT_UNITS[0];
  const rentValue = Number.parseInt(digits(rent), 10) || 0;
  const cautionValue = Number.parseInt(digits(caution), 10) || 0;

  const errors = {
    name: name.trim().length < 2 ? t('landlord.new.nameError') : undefined,
    phone: digits(phone).length === 9 ? undefined : t('landlord.new.phoneError'),
    nid: digits(nid).length === 16 ? undefined : t('landlord.new.nidError'),
    rent: rentValue > 0 ? undefined : t('landlord.new.rentError'),
  };
  const valid = !errors.name && !errors.phone && !errors.nid && !errors.rent && !!chosen;
  const busy = create.status === 'saving';

  const submit = async () => {
    setTouched(true);
    if (!valid || !chosen || busy) return;

    // Minted ONCE, before the write, because `applyCreateLease` derives the
    // same pair from the same list and the route that follows has to address
    // the row the write is about to create.
    const { id, ref } = nextLeaseRef(leases);
    await create.mutate({
      tenant: name.trim(),
      unit: chosen.unit,
      unitType: chosen.unitType,
      rent: rentValue,
      caution: cautionValue,
      tenure,
      placement: placement ? { broker: placement.broker, fee: placement.fee } : undefined,
    });

    // A capture form that navigated on failure lost everything the landlord
    // had typed — name, NID, rent, the unit — and told them it had been
    // created. Staying on the screen keeps the form; `ui-rules.md` asks the
    // same of a workspace switch, and a failed save is the same loss.
    if (create.status === 'error') return;

    toast.show(t('landlord.new.created', { ref, name: name.trim() }), 'success');
    // FL20's own arrow: the create lands on the contract, because the lease is
    // not with the tenant until it is signed. `replace` so Back from the
    // contract returns to the list rather than to a form that has already run.
    router.replace({ pathname: '/lease/[leaseId]/contract', params: { leaseId: id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 140,
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
          {t('landlord.new.title')}
        </Text>

        {/* R6's banner. Present only when a broker actually placed the tenant;
            the fee is recorded on the lease, so it is stated before the lease
            exists rather than discovered on the first payout (F-R08). Without
            one the same form opens blank, which is FL20 path C. */}
        {placement ? (
        <Card variant="tint">
          <View style={{ flexDirection: 'row', gap: 11 }}>
            <Icon name="key" size={18} color={c.brand700} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text weight="semibold" size="sm" color="brand900">
                {t('landlord.new.placementTitle', { broker: placement.broker })}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5 }}>
                <Text size="xs" color="brand900" style={{ opacity: 0.8 }}>
                  {t('landlord.new.placementFeeLabel')}
                </Text>
                <MoneyAmount value={placement.fee} size="xs" strong />
                <Text size="xs" color="brand900" style={{ opacity: 0.8 }}>
                  · {t('landlord.new.placementFeeNote')}
                </Text>
              </View>
            </View>
          </View>
        </Card>
        ) : null}

        <SectionLabel>{t('landlord.new.sectionTenant')}</SectionLabel>
        <View style={{ gap: space[3] }}>
          <InputField
            label={t('landlord.new.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('landlord.new.namePlaceholder')}
            autoCapitalize="words"
            autoComplete="name"
            error={touched ? errors.name : undefined}
          />
          <InputField
            label={t('landlord.new.phone')}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('landlord.new.phonePlaceholder')}
            prefix="RW +250"
            keyboardType="phone-pad"
            maxLength={13}
            helper={t('landlord.new.phoneHelper')}
            error={touched ? errors.phone : undefined}
          />
          <InputField
            label={t('landlord.new.nid')}
            value={nid}
            onChangeText={setNid}
            placeholder={t('landlord.new.nidPlaceholder')}
            keyboardType="number-pad"
            maxLength={21}
            helper={t('landlord.new.nidHelper')}
            error={touched ? errors.nid : undefined}
          />
        </View>

        <SectionLabel>{t('landlord.new.sectionTerms')}</SectionLabel>

        <View style={{ gap: 6 }}>
          <Text weight="medium" size="sm" color="textBody">
            {t('landlord.new.unit')}
          </Text>
          {VACANT_UNITS.length === 0 ? (
            <EmptyState
              icon="building"
              title={t('landlord.new.unitEmptyTitle')}
              body={t('landlord.new.unitEmptyBody')}
            />
          ) : (
            <View accessibilityRole="radiogroup" style={{ gap: space[2] }}>
              {VACANT_UNITS.map((u) => {
                const on = u.unit === chosen?.unit;
                return (
                  <PressableScale
                    key={u.unit}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${u.unit}, ${u.unitType}`}
                    onPress={() => setUnit(u.unit)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      minHeight: 48,
                      paddingHorizontal: 14,
                      borderRadius: radius.md,
                      // The selected edge is `borderBrand`, not a tint: a
                      // control boundary owes 3:1 and `borderDefault` is a
                      // decorative hairline (design brief §7.4).
                      borderWidth: on ? 1.5 : 1,
                      borderColor: on ? c.borderBrand : c.borderStrong,
                      backgroundColor: on ? c.actionSubtle : c.surface1,
                    }}
                  >
                    <Icon
                      name={on ? 'checkCircle' : 'building'}
                      size={17}
                      color={on ? c.brand700 : c.textSubtle}
                    />
                    <Text
                      weight={on ? 'semibold' : 'regular'}
                      size="sm"
                      color={on ? 'brand700' : 'textStrong'}
                      style={{ flex: 1 }}
                    >
                      {u.unit}
                    </Text>
                    <Text size="xs" color="textMuted">
                      {u.unitType}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {t('landlord.new.unitHelper')}
          </Text>
        </View>

        <View style={{ gap: space[3] }}>
          <InputField
            label={t('landlord.new.rent')}
            value={rent}
            onChangeText={setRent}
            prefix="RWF"
            keyboardType="number-pad"
            maxLength={9}
            error={touched ? errors.rent : undefined}
          />
          <InputField
            label={t('landlord.new.caution')}
            value={caution}
            onChangeText={setCaution}
            prefix="RWF"
            keyboardType="number-pad"
            maxLength={9}
            helper={t('landlord.new.cautionHelper')}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text weight="medium" size="sm" color="textBody">
            {t('landlord.new.tenure')}
          </Text>
          <SegmentedTabs
            value={tenure}
            onChange={(v) => setTenure(v as Tenure)}
            items={[
              { value: 'long_term', label: t('landlord.tenureLongLabel') },
              { value: 'short_term', label: t('landlord.tenureShortLabel') },
            ]}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {t('landlord.new.consequence', { name: name.trim() || t('landlord.new.namePlaceholder') })}
          </Text>
          <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
            {t('landlord.new.footnote')}
          </Text>

          {/* The form is still full. That is the point: a create that failed
              and navigated away took everything the landlord had typed with
              it. */}
          {create.status === 'error' ? (
            <WriteError onRetry={() => void submit()} />
          ) : null}
        </View>
      </ScrollView>

      <StickyBar>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text size="xs" color="textMuted">
            {chosen ? `${chosen.unit} · ${chosen.unitType}` : t('landlord.new.unit')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <MoneyAmount value={rentValue} strong tone="brand" size="lg" />
            <Text size="xs" color="textSubtle">
              {t('landlord.perMonth')}
            </Text>
          </View>
        </View>
        <Button
          variant="primary"
          leadingIcon="arrowRight"
          disabled={busy || VACANT_UNITS.length === 0}
          accessibilityLabel={valid ? t('landlord.new.create') : t('landlord.new.blocked')}
          onPress={() => void submit()}
        >
          {busy ? t('landlord.new.creating') : valid ? t('landlord.new.create') : t('landlord.new.blocked')}
        </Button>
      </StickyBar>
    </View>
  );
}
