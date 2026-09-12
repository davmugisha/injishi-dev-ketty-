/**
 * Frame R17 · Move-out notice — FL23. The tenant picks a date, optionally says
 * why, and files. The Lease moves to `ending`, the unit is flagged
 * upcoming-available, and the Caution settles at close (FL24).
 *
 * **The notice period is the lease's, not a constant.** An earlier build hard-
 * coded fourteen days, which was right for one of the fixtures' leases and
 * wrong for the Ingoro contract, whose clause 5 asks for thirty. So the banner,
 * the earliest selectable date and the caption under the field all read
 * `noticeDays` off the lease the reader is actually ending.
 *
 * **Shown, not enforced** (FL23 Path A): the calendar opens at the earliest
 * compliant date and days before it are closed, but the field itself accepts a
 * shorter notice and says by how much it falls short. A tenant who has to leave
 * in a week still needs to be able to say so, and a hard gate is named as a
 * later enhancement rather than as this version's behaviour.
 *
 * **Filing is irreversible from the app, so it is confirmed.** The confirm is a
 * sheet on this screen rather than a route: a confirmation you can arrive at
 * without the action behind it — by a back gesture, by a deep link — is worse
 * than no confirmation. `ModalSheet`'s header has the rest of that reasoning.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Button,
  CalendarRange,
  Card,
  Icon,
  ModalSheet,
  MoneyAmount,
  PressableScale,
  SectionLabel,
  StatusBadge,
  StickyBar,
  Text,
  TextArea,
  todayIso,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useFileMoveOut, useTenancy } from '@/data/tenancy-store';
import { addDays, formatFullDay, noticeCaption } from './dates';
import { LeaseBlocked, LeaseError, LeaseLoading, LeaseMissing } from './lease-gate';

export function LeaseMoveOut() {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();

  const read = useTenancy(leaseId);
  const lease = read.data;
  const file = useFileMoveOut();

  const [date, setDate] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const today = todayIso();
  const filing = file.status === 'saving';

  if (read.status === 'loading') return <LeaseLoading rows={3} />;
  if (read.status === 'error') return <LeaseError error={read.error} onRetry={read.retry} />;
  if (!lease) return <LeaseMissing />;

  /** The first date this contract's notice period allows. */
  const earliest = addDays(today, lease.noticeDays);
  const filed = lease.notice;
  const eligible = lease.leaseState === 'active' || lease.leaseState === 'ending';

  const submit = () => {
    if (!date) return;
    setConfirmOpen(false);
    void file
      .mutate({
        leaseId: lease.id,
        notice: { filedOn: today, moveOutOn: date, message: message.trim() },
      })
      .then(() => {
        toast.show(t('moveOut.toast', { date: formatFullDay(date, t) }), 'warning');
      });
  };

  /* A lease that has not started or has already closed cannot be moved out of.
     That is a fact rather than a failure, so it offers the way back rather
     than a retry that cannot change the answer. */
  if (!eligible) {
    return (
      <LeaseBlocked
        icon="clock"
        title={t('moveOut.unavailableTitle')}
        body={t('moveOut.unavailableBody')}
      />
    );
  }

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
            {filed ? t('moveOut.filedTitle') : t('moveOut.title')}
          </Text>
          <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
            {lease.unit} · {lease.landlordOrg}
          </Text>
        </View>

        {filed ? (
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
                    {t('moveOut.alreadyFiledTitle')}
                  </Text>
                  <StatusBadge domain="lease" state="ending" />
                </View>
                <Text size="sm" color="brand900" style={{ opacity: 0.82, lineHeight: 19 }}>
                  {t('moveOut.filedBody', {
                    landlord: lease.landlord,
                    date: formatFullDay(filed.moveOutOn, t),
                  })}
                </Text>
              </View>
            </Card>

            <Card title={t('moveOut.next')}>
              <View style={{ gap: space[4] }}>
                {[
                  [t('moveOut.nextRentTitle'), t('moveOut.nextRentBody')],
                  [t('moveOut.nextCautionTitle'), t('moveOut.nextCautionBody')],
                  [t('moveOut.nextDisputeTitle'), t('moveOut.nextDisputeBody')],
                ].map(([title, body]) => (
                  <View
                    key={title}
                    accessible
                    accessibilityLabel={`${title}. ${body}`}
                    style={{ flexDirection: 'row', gap: space[3] }}
                  >
                    <Icon name="chevronRight" size={16} color={c.textSubtle} />
                    <View style={{ flex: 1 }}>
                      <Text weight="semibold" size="sm" color="textStrong">
                        {title}
                      </Text>
                      <Text size="sm" color="textMuted" style={{ lineHeight: 19, marginTop: 2 }}>
                        {body}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
              {t('moveOut.notWired')}
            </Text>
          </>
        ) : (
          <>
            {/* The rule, and the date it produces. Both, because the rule
                alone leaves the reader doing the arithmetic. */}
            <Card variant="tint">
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <Icon name="info" size={18} color={c.brand700} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text weight="semibold" size="sm" color="brand900" style={{ lineHeight: 20 }}>
                    {t('moveOut.rule', { days: lease.noticeDays })}
                  </Text>
                  <Text size="sm" color="brand900" style={{ opacity: 0.82, lineHeight: 19 }}>
                    {t('moveOut.earliest', { date: formatFullDay(earliest, t) })}
                  </Text>
                </View>
              </View>
            </Card>

            <View style={{ gap: space[2] }}>
              <SectionLabel>{t('moveOut.dateLabel')}</SectionLabel>
              <PressableScale
                accessibilityLabel={t('moveOut.pickDate')}
                accessibilityHint={
                  date ? noticeCaption(date, today, lease.noticeDays, t) : undefined
                }
                onPress={() => setCalendarOpen(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  minHeight: 52,
                  paddingHorizontal: space[4],
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: date ? c.borderBrand : c.borderDefault,
                  backgroundColor: c.surface1,
                }}
              >
                <Icon name="calendar" size={19} color={date ? c.textLink : c.textMuted} />
                <Text
                  size="md"
                  color={date ? 'textStrong' : 'textSubtle'}
                  weight={date ? 'semibold' : 'regular'}
                  style={{ flex: 1 }}
                >
                  {date ? formatFullDay(date, t) : t('moveOut.datePlaceholder')}
                </Text>
                <Icon name="chevronRight" size={18} color={c.textSubtle} />
              </PressableScale>

              {date ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}
                >
                  <Icon
                    name={date < earliest ? 'alertTriangle' : 'check'}
                    size={15}
                    color={date < earliest ? c.warning600 : c.success600}
                  />
                  <Text
                    size="xs"
                    color={date < earliest ? 'warning600' : 'textMuted'}
                    style={{ flex: 1, lineHeight: 18 }}
                  >
                    {noticeCaption(date, today, lease.noticeDays, t)}
                  </Text>
                </View>
              ) : null}
            </View>

            <TextArea
              label={t('moveOut.messageLabel')}
              value={message}
              onChangeText={setMessage}
              placeholder={t('moveOut.messagePlaceholder')}
              helper={t('moveOut.messageHelper', { landlord: lease.landlord })}
              rows={4}
            />

            {/* The consequence for the money, before the button that starts it. */}
            <Card>
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: c.warning100,
                  }}
                >
                  <Icon name="shield" size={19} color={c.warning600} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: space[2],
                    }}
                  >
                    <Text weight="semibold" size="sm" color="textStrong" style={{ flexShrink: 1 }}>
                      {t('moveOut.cautionTitle')}
                    </Text>
                    <MoneyAmount value={lease.caution} strong size="md" />
                  </View>
                  <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                    {t('moveOut.cautionBody')}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <StickyBar>
        {filed ? (
          <>
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {t('moveOut.dateLabel')}
              </Text>
              <Text weight="semibold" size="md" color="textStrong">
                {formatFullDay(filed.moveOutOn, t)}
              </Text>
            </View>
            <Button variant="primary" onPress={() => router.back()}>
              {t('moveOut.done')}
            </Button>
          </>
        ) : (
          <>
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {date ? t('moveOut.dateLabel') : t('moveOut.pickDate')}
              </Text>
              <Text weight="semibold" size="md" color="textStrong">
                {date ? formatFullDay(date, t) : '—'}
              </Text>
            </View>
            <Button
              variant="danger"
              leadingIcon="logOut"
              disabled={!date || filing}
              onPress={() => setConfirmOpen(true)}
            >
              {filing ? t('moveOut.filing') : t('moveOut.action')}
            </Button>
          </>
        )}
      </StickyBar>

      <ModalSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        title={t('moveOut.calendarTitle')}
        subtitle={t('moveOut.calendarBody', { date: formatFullDay(earliest, t) })}
        footer={
          <Button
            variant="primary"
            size="lg"
            block
            disabled={!date}
            onPress={() => setCalendarOpen(false)}
          >
            {t('moveOut.useDate')}
          </Button>
        }
      >
        {/* `CalendarRange` is a range control and this is a single date, so the
            end is never set: every tap starts a new range, which for one
            endpoint is exactly "pick a day". `min` is what closes the days the
            notice period rules out. */}
        <CalendarRange
          value={{ start: date, end: null }}
          onChange={(range) => setDate(range.start)}
          min={earliest}
          months={12}
        />
      </ModalSheet>

      <ModalSheet
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('moveOut.confirmTitle')}
        eyebrow={lease.ref}
        footer={
          <>
            <Button
              variant="danger"
              size="lg"
              block
              disabled={filing}
              onPress={submit}
            >
              {filing ? t('moveOut.filing') : t('moveOut.confirmAction')}
            </Button>
            <Button variant="ghost" size="md" block onPress={() => setConfirmOpen(false)}>
              {t('moveOut.confirmCancel')}
            </Button>
          </>
        }
      >
        <Text size="sm" color="textBody" style={{ lineHeight: 21 }}>
          {t('moveOut.confirmBody', {
            date: date ? formatFullDay(date, t) : '',
            landlord: lease.landlord,
          })}
        </Text>
      </ModalSheet>
    </View>
  );
}
