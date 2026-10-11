/**
 * Frame R18 · Request renewal — FL26 step 1.
 *
 * **A renewal moves one thing: the end date.** F-R13 §6 and FL26 §6 both say a
 * rent change needs a new Lease rather than a renewal, so the frame's "Proposed
 * rent" field is rendered read-only carrying the current rent, with the reason
 * printed under it. An editable rent here would be a screen quietly offering a
 * flow the domain does not have — and the tenant would find that out only when
 * the landlord's approval silently dropped their number.
 *
 * The new start is derived the same way and for the same reason: a renewal
 * continues a tenancy, so it begins the day after the current term ends. There
 * is no gap to choose and no overlap to allow.
 *
 * The Lease itself is untouched by this screen. `endOn` moves only when the
 * landlord approves (FL26 step 3); a portal that moved it on the request would
 * be showing a term nobody has agreed to.
 *
 * **Hidden in v1.0.** Renewal is P2 in the owner's cut of 2026-10-01: the route
 * is registered behind `guard={false}` in `app/_layout.tsx`, and lease detail
 * no longer links here (mobile audit 2026-10-05, TN-13). The screen is kept,
 * not deleted, and it is held to the same rules as the live ones meanwhile: the
 * request is said to be saved on this phone with the landlord not told (it used
 * to be "sent to {landlord}"), and the toast follows the write's outcome rather
 * than firing on every settle (TN-12).
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Button,
  Card,
  Icon,
  InputField,
  MoneyAmount,
  SectionLabel,
  SegmentedTabs,
  StatusBadge,
  StickyBar,
  TextArea,
  Text,
  todayIso,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useRequestRenewal, useTenancy } from '@/data/tenancy-store';
import { addDays, addMonths, formatFullDay, formatMonthYear } from './dates';
import { LeaseBlocked, LeaseError, LeaseLoading, LeaseMissing } from './lease-gate';

/** Frame R18's three segments. */
const TERMS = [6, 12, 24];

export function LeaseRenew() {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();

  const read = useTenancy(leaseId);
  const lease = read.data;
  const request = useRequestRenewal();

  // Twelve is the segment the frame draws selected, and the term nearly every
  // Rwandan residential lease actually runs.
  const [months, setMonths] = useState(12);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(false);

  const sending = request.status === 'saving';
  // A request that landed in THIS session reads differently from one that was
  // already there when the screen opened: "sent" answers what just happened,
  // "already with your landlord" answers why the form is not here.
  const justSent = request.status === 'done';

  if (read.status === 'loading') return <LeaseLoading rows={3} />;
  if (read.status === 'error') return <LeaseError error={read.error} onRetry={read.retry} />;
  if (!lease) return <LeaseMissing />;

  const eligible = lease.leaseState === 'active' || lease.leaseState === 'ending';
  if (!eligible) {
    return (
      <LeaseBlocked
        icon="repeat"
        title={t('renew.unavailableTitle')}
        body={t('renew.unavailableBody')}
      />
    );
  }

  const startOn = addDays(lease.endOn, 1);
  const endOn = addDays(addMonths(startOn, months), -1);
  const pending = lease.renewal?.state === 'pending';

  const send = async () => {
    setFailed(false);
    const outcome = await request.mutate({
      leaseId: lease.id,
      renewal: {
        requestedOn: todayIso(),
        termMonths: months,
        startOn,
        endOn,
        rent: lease.rent,
        note: note.trim(),
        state: 'pending',
      },
    });
    // THIS write's outcome (mobile audit 2026-10-05, TN-12).
    if (outcome === 'done') toast.show(t('renew.toast'), 'success');
    else if (outcome === 'error') setFailed(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 150,
          paddingHorizontal: space[4],
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text
            accessibilityRole="header"
            family="display"
            weight="semibold"
            size="xl"
            color="textStrong"
            style={{ letterSpacing: -0.3 }}
          >
            {pending ? t('renew.sentTitle') : t('renew.title')}
          </Text>
          <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
            {lease.unit} · {lease.landlordOrg}
          </Text>
        </View>

        {pending && lease.renewal ? (
          <>
            <Card variant="tint">
              <View style={{ gap: space[3] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space[2],
                  }}
                >
                  <Text weight="semibold" size="md" color="brand900" style={{ flexShrink: 1 }}>
                    {justSent ? t('renew.sentTitle') : t('renew.pendingTitle')}
                  </Text>
                  <StatusBadge domain="lease" state={lease.leaseState} />
                </View>
                <Text size="sm" color="brand900" style={{ opacity: 0.82, lineHeight: 19 }}>
                  {justSent
                    ? t('renew.sentBody', {
                        landlord: lease.landlord,
                        date: formatFullDay(lease.renewal.endOn, t),
                      })
                    : t('renew.pendingBody', {
                        on: formatFullDay(lease.renewal.requestedOn, t),
                        date: formatFullDay(lease.renewal.endOn, t),
                      })}
                </Text>
              </View>
            </Card>

            <Card>
              <View style={{ gap: space[3] }}>
                <Row label={t('renew.newStart')} value={formatFullDay(lease.renewal.startOn, t)} />
                <Row label={t('renew.newEnd')} value={formatFullDay(lease.renewal.endOn, t)} />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space[3],
                  }}
                >
                  <Text size="sm" color="textMuted">
                    {t('renew.rent')}
                  </Text>
                  <MoneyAmount value={lease.renewal.rent} strong size="md" />
                </View>
                {lease.renewal.note ? (
                  <Text size="sm" color="textBody" style={{ lineHeight: 19 }}>
                    “{lease.renewal.note}”
                  </Text>
                ) : null}
              </View>
            </Card>
          </>
        ) : (
          <>
            <SectionLabel>{t('renew.current')}</SectionLabel>
            <Card>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: space[3],
                }}
              >
                <View style={{ flexShrink: 1, gap: 2 }}>
                  <Text weight="semibold" size="md" color="textStrong">
                    {t('renew.currentEnds', { date: formatFullDay(lease.endOn, t) })}
                  </Text>
                  <Text size="xs" color="textMuted">
                    {lease.ref} · {lease.startDate} — {lease.endDate}
                  </Text>
                </View>
                <MoneyAmount value={lease.rent} strong size="md" />
              </View>
            </Card>

            {/* A notice already filed is not a blocker, but sending a renewal
                on top of one asks the landlord to undo something. Say so. */}
            {lease.notice ? (
              <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                <Icon name="alertTriangle" size={16} color={c.warning600} />
                <Text size="xs" color="warning600" style={{ flex: 1, lineHeight: 18 }}>
                  {t('renew.endingNote')}
                </Text>
              </View>
            ) : null}

            <View style={{ gap: space[2] }}>
              <SectionLabel>{t('renew.newTerm')}</SectionLabel>
              <SegmentedTabs
                value={String(months)}
                onChange={(v) => setMonths(Number(v))}
                items={TERMS.map((n) => ({
                  value: String(n),
                  label: t(n === 6 ? 'renew.term6' : n === 12 ? 'renew.term12' : 'renew.term24'),
                }))}
              />
            </View>

            {/* Both fields are derived and both are read-only, which is what
                the domain actually allows. See the file header. */}
            <InputField
              label={t('renew.newStart')}
              value={`${formatFullDay(startOn, t)} — ${formatMonthYear(endOn, t)}`}
              onChangeText={() => {}}
              editable={false}
              helper={t('renew.newEnd')}
            />

            <InputField
              label={t('renew.rent')}
              value={lease.rent.toLocaleString('en-US')}
              onChangeText={() => {}}
              editable={false}
              prefix="RWF"
              helper={t('renew.rentLocked')}
            />

            <TextArea
              label={t('renew.note')}
              value={note}
              onChangeText={setNote}
              placeholder={t('renew.notePlaceholder')}
              rows={4}
            />

            {failed ? <WriteError onRetry={() => void send()} /> : null}
          </>
        )}
      </ScrollView>

      <StickyBar>
        {pending && lease.renewal ? (
          <>
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {t('renew.newEnd')}
              </Text>
              <Text weight="semibold" size="md" color="textStrong">
                {formatFullDay(lease.renewal.endOn, t)}
              </Text>
            </View>
            <Button variant="primary" onPress={() => router.back()}>
              {t('renew.done')}
            </Button>
          </>
        ) : (
          <>
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {t('renew.newEnd')}
              </Text>
              <Text weight="semibold" size="md" color="textStrong">
                {formatFullDay(endOn, t)}
              </Text>
            </View>
            <Button
              variant="primary"
              leadingIcon="send"
              disabled={sending}
              onPress={() => void send()}
            >
              {sending ? t('renew.sending') : t('renew.action')}
            </Button>
          </>
        )}
      </StickyBar>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { space } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[3],
      }}
    >
      <Text size="sm" color="textMuted">
        {label}
      </Text>
      <Text weight="semibold" size="sm" color="textStrong">
        {value}
      </Text>
    </View>
  );
}
