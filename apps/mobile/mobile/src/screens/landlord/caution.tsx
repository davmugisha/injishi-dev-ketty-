/**
 * Caution deposit — frame R9 (F-R06, FL24).
 *
 * The Injishi word is **Caution**, never "security deposit" (ui-glossary.md).
 * It is held in escrow, it is not rent, it may not be set off against rent, and
 * it settles at the close of the lease.
 *
 * **The two actions are gated on the lease, not on the button.** FL24's entry
 * point is a Lease reaching `ended`, and F-R06 puts settlement-before-`ended`
 * explicitly out of scope. R9 draws Refund and Deduct as available because the
 * lease it draws has a move-out notice filed against it. So the rule here is:
 * a lease with a notice can settle, a lease still running cannot, and when it
 * cannot the buttons are visibly disabled with the reason printed under them.
 * Hiding them would leave a reader wondering where settlement lives; disabling
 * them without the sentence would be the same question with more frustration.
 *
 * **"Deduct & settle" opens a sheet drawn in this file rather than a route.**
 * Every sheet in the pack is an Expo Router `formSheet` (decision D8), but the
 * route table in `app/_layout.tsx` is frozen after Session 0 and R9's amount
 * sheet is not in it. Rather than edit a frozen file, this is an in-page
 * overlay with a scrim and `accessibilityViewIsModal`, which is what a sheet is
 * from the reader's side. **Session 11 should promote it to a real route** at
 * `lease/[leaseId]/settle-caution` when the table opens again.
 *
 * The deduction carries a reason because the operator app's move-out screen
 * says why in one line worth keeping: "a number without a reason is how deposit
 * disputes start", and F-R06 §9 asks for the evidence trail.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AdapterChip,
  BackHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  InputField,
  MoneyAmount,
  PressableScale,
  SectionLabel,
  Text,
  Timeline,
  type TimelineEntry,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { useFixtureMutation } from '@/data/use-fixture-mutation';
import {
  applyCautionSettlement,
  findLease,
  LEASES_KEY,
  seedLeases,
  useLandlordRead,
  type LandlordLease,
} from '@/data/landlord';

const TODAY = '4 Aug 2026';

const digits = (s: string) => s.replace(/\D/g, '');

/* ── The amount sheet ───────────────────────────────────────────────────── */

function DeductSheet({
  lease,
  t,
  busy,
  onCancel,
  onConfirm,
}: {
  lease: LandlordLease;
  t: Translate;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (deduction: { label: string; amount: number }) => void;
}) {
  const { c, space, radius, shadow, scrim } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  const value = Number.parseInt(digits(amount), 10) || 0;
  const over = value > lease.caution.amount;
  const ready = reason.trim().length > 1 && value > 0 && !over;
  const returns = Math.max(0, lease.caution.amount - value);

  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' }}
    >
      <PressableScale
        accessibilityLabel={t('landlord.caution.cancel')}
        onPress={onCancel}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          // A dim over arbitrary content is an ALPHA, and no palette key is
          // one — every key is opaque. `scrim.hero[1]` is the project's
          // ink-at-35% (design brief §6), authored for photography but the
          // same value a sheet needs and, like a photograph, correct in both
          // schemes because it does not invert. Better a token used slightly
          // outside its brief than a literal in a screen.
          backgroundColor: scrim.hero[1],
        }}
      >
        <View />
      </PressableScale>

      <View
        style={{
          gap: space[4],
          paddingHorizontal: space[4],
          paddingTop: space[3],
          paddingBottom: insets.bottom + space[4],
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          backgroundColor: c.surface1,
          ...shadow.lg,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 36, height: 4, borderRadius: radius.pill, backgroundColor: c.borderDefault }}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text
            accessibilityRole="header"
            family="display"
            weight="semibold"
            size="xl"
            color="textStrong"
            style={{ letterSpacing: -0.3 }}
          >
            {t('landlord.caution.sheetTitle')}
          </Text>
          <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
            {t('landlord.caution.sheetBody')}
          </Text>
        </View>

        <InputField
          label={t('landlord.caution.reason')}
          value={reason}
          onChangeText={setReason}
          placeholder={t('landlord.caution.reasonPlaceholder')}
          autoCapitalize="sentences"
        />
        <InputField
          label={t('landlord.caution.amount')}
          value={amount}
          onChangeText={setAmount}
          prefix="RWF"
          keyboardType="number-pad"
          maxLength={9}
          error={over ? t('landlord.caution.overAmount') : undefined}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: c.surface2,
          }}
        >
          <Text size="sm" color="textBody" style={{ flexShrink: 1 }}>
            {t('landlord.caution.returns', { tenant: lease.tenant })}
          </Text>
          <MoneyAmount value={returns} strong size="md" tone="brand" />
        </View>

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button variant="ghost" size="lg" onPress={onCancel}>
            {t('landlord.caution.cancel')}
          </Button>
          <View style={{ flex: 1 }}>
            <Button
              variant="primary"
              size="lg"
              block
              leadingIcon="check"
              disabled={!ready || busy}
              // Its own sentence, not the trigger's word: the trigger is
              // still on the screen behind this sheet, and an irreversible
              // money action owes a reader the two figures out loud.
              accessibilityLabel={
                ready
                  ? t('landlord.caution.sheetConfirmA11y', {
                      amount: `RWF ${value.toLocaleString('en-US')}`,
                      returns: `RWF ${returns.toLocaleString('en-US')}`,
                      tenant: lease.tenant,
                    })
                  : t('landlord.caution.sheetBlocked')
              }
              onPress={() => onConfirm({ label: reason.trim(), amount: value })}
            >
              {busy
                ? t('landlord.saving')
                : ready
                  ? t('landlord.caution.deductAction')
                  : t('landlord.caution.sheetBlocked')}
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ── The screen ─────────────────────────────────────────────────────────── */

export function LandlordCaution({ leaseId }: { leaseId: string }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);

  const read = useLandlordRead(LEASES_KEY, seedLeases);
  const lease = findLease(read.data ?? [], leaseId);
  const settle = useFixtureMutation(LEASES_KEY, applyCautionSettlement, seedLeases);

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

  if (!lease) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <BackHeader />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[4] }}>
          <EmptyState
            icon="shield"
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

  const caution = lease.caution;
  const settled = caution.state !== 'held';
  // FL24: settlement belongs at the close of the lease. A notice filed is the
  // earliest honest moment, because it is the first point at which there is a
  // move-out to settle against.
  const canSettle = !settled && (!!lease.moveOutNotice || lease.state === 'ended');
  const busy = settle.status === 'saving';
  const deducted = (caution.deductions ?? []).reduce((a, d) => a + d.amount, 0);

  const heroLabel =
    caution.state === 'held'
      ? t('landlord.caution.held')
      : caution.state === 'refunded'
        ? t('landlord.caution.refunded')
        : t('landlord.caution.forfeited');

  const entries: TimelineEntry[] = [
    {
      key: 'collected',
      title: t('landlord.caution.stepCollected'),
      meta: caution.collectedOn,
      body: t('landlord.caution.stepCollectedBody'),
      state: 'done',
    },
    {
      key: 'held',
      title: t('landlord.caution.stepHeld'),
      meta: settled ? undefined : t('landlord.caution.stepHeldMeta'),
      body: t('landlord.caution.stepHeldBody', {
        state: t(`status.lease.${lease.state}` as const).toLowerCase(),
      }),
      state: settled ? 'done' : 'current',
    },
    settled
      ? {
          key: 'settled',
          title: t('landlord.caution.stepSettled'),
          meta: caution.settledOn,
          body: heroLabel,
          state: 'done',
        }
      : {
          key: 'settle',
          title: t('landlord.caution.stepSettle'),
          body: t('landlord.caution.stepSettleBody'),
          state: canSettle ? 'current' : 'pending',
        },
  ];

  const refund = async () => {
    if (busy) return;
    await settle.mutate({ id: lease.id, on: TODAY });
    // A deposit screen with no error state told the landlord money had been
    // returned when it had not. The toast now waits for the write.
    if (settle.status === 'error') return;
    toast.show(
      t('landlord.caution.refundedToast', {
        amount: `RWF ${caution.amount.toLocaleString('en-US')}`,
        tenant: lease.tenant,
      }),
      'success',
    );
  };

  const deduct = async (deduction: { label: string; amount: number }) => {
    if (busy) return;
    await settle.mutate({ id: lease.id, on: TODAY, deduction });
    if (settle.status === 'error') return;
    setSheet(false);
    toast.show(
      t('landlord.caution.settledToast', {
        amount: `RWF ${(caution.amount - deduction.amount).toLocaleString('en-US')}`,
        deducted: `RWF ${deduction.amount.toLocaleString('en-US')}`,
      }),
      'warning',
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 40,
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
          {t('landlord.caution.title')}
        </Text>

        {/* R9's hero. The frame draws it dark; in the teal palette the raised
            tint surface is what a "dark card" resolves to on mobile (ADR-019),
            and the accent edge is what keeps it reading as the hero. */}
        <Card variant="tint" style={{ borderWidth: 1.5, borderColor: c.borderBrand }}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon
                name={caution.state === 'held' ? 'shield' : 'checkCircle'}
                size={17}
                color={c.brand700}
              />
              <Text
                weight="bold"
                size="2xs"
                color="brand900"
                style={{ letterSpacing: 0.9, textTransform: 'uppercase' }}
              >
                {heroLabel}
              </Text>
            </View>
            <MoneyAmount value={caution.amount} strong size="2xl" />
            <Text size="sm" color="brand900" style={{ opacity: 0.8, lineHeight: 19 }}>
              {t('landlord.caution.who', {
                tenant: lease.tenant,
                unit: lease.unit,
                date: caution.collectedOn,
              })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
              <AdapterChip label={t('landlord.caution.mock')} />
            </View>
          </View>
        </Card>

        <SectionLabel>{t('landlord.caution.timeline')}</SectionLabel>
        <Card>
          <Timeline entries={entries} />
        </Card>

        {caution.deductions && caution.deductions.length > 0 ? (
          <>
            <SectionLabel>{t('landlord.caution.deductions')}</SectionLabel>
            <Card bodyStyle={{ paddingVertical: 6 }}>
              <View>
                {caution.deductions.map((d) => (
                  <View
                    key={d.label}
                    accessible
                    accessibilityLabel={`${d.label}, RWF ${d.amount.toLocaleString('en-US')}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      paddingVertical: 11,
                    }}
                  >
                    <Text size="sm" color="textBody" style={{ flex: 1 }}>
                      {d.label}
                    </Text>
                    <MoneyAmount value={-d.amount} strong size="sm" tone="negative" />
                  </View>
                ))}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingVertical: 11,
                    borderTopWidth: 1,
                    borderTopColor: c.borderSubtle,
                  }}
                >
                  <Text weight="semibold" size="sm" color="textStrong" style={{ flex: 1 }}>
                    {t('landlord.caution.returns', { tenant: lease.tenant })}
                  </Text>
                  <MoneyAmount value={caution.amount - deducted} strong size="md" />
                </View>
              </View>
            </Card>
          </>
        ) : null}

        {lease.moveOutNotice && !settled ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 11,
              padding: 14,
              borderRadius: radius.lg,
              backgroundColor: c.warning100,
              borderWidth: 1,
              borderColor: c.warning600,
            }}
          >
            <Icon name="alertTriangle" size={18} color={c.warning600} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" size="sm" color={c.warning600}>
                {t('landlord.caution.noticeTitle')}
              </Text>
              <Text size="xs" color={c.warning600} style={{ lineHeight: 18 }}>
                {t('landlord.caution.noticeBody')}
              </Text>
            </View>
          </View>
        ) : null}

        {settled ? (
          <Badge tone={caution.state === 'refunded' ? 'success' : 'warning'} size="lg">
            {t('landlord.caution.stepSettled')}
          </Badge>
        ) : (
          <View style={{ gap: 10 }}>
            {settle.status === 'error' ? (
              <WriteError body="write.failedMoneyBody" onRetry={() => void refund()} />
            ) : null}
            <Button
              variant="primary"
              size="lg"
              block
              leadingIcon="checkCircle"
              disabled={!canSettle || busy}
              onPress={() => void refund()}
            >
              {busy ? t('landlord.saving') : t('landlord.caution.refundAction')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              block
              leadingIcon="minus"
              disabled={!canSettle || busy}
              onPress={() => setSheet(true)}
            >
              {t('landlord.caution.deductAction')}
            </Button>
            <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
              {canSettle
                ? t('landlord.caution.refundConsequence', {
                    amount: `RWF ${caution.amount.toLocaleString('en-US')}`,
                    tenant: lease.tenant,
                  })
                : t('landlord.caution.lockedNote')}
            </Text>
          </View>
        )}

        <Text size="xs" color="textSubtle" style={{ lineHeight: 17 }}>
          {t('landlord.caution.escrowNote')}
        </Text>
      </ScrollView>

      {sheet ? (
        <DeductSheet
          lease={lease}
          t={t}
          busy={busy}
          onCancel={() => setSheet(false)}
          onConfirm={(d) => void deduct(d)}
        />
      ) : null}
    </View>
  );
}
