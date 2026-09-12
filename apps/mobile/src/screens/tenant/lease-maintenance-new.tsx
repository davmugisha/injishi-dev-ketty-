/**
 * Frame R20 · Report an issue — F-R11, the tenant filing a maintenance ticket
 * against their own unit.
 *
 * **The ticket goes into the store the Landlord surface reads.** That is the
 * whole point of F-R11 ("maintenance requests happen off-platform with no
 * record") and it is why `@/data/tickets` is a shared store rather than a
 * tenant-private one: file here and the row appears on frame R4's Repairs tab.
 * A tenant-only store would have produced a screen that looks like it works and
 * a landlord who never hears about the leak.
 *
 * **Photographs lead the ticket** (frame W6's phrase, and the same reasoning
 * here): a picture of the sink settles in one glance what a paragraph argues
 * about. `PhotoPicker` handles the camera, the library and the permission-denied
 * state; nothing is uploaded in this build and the screen says so.
 *
 * Priority is the tenant's claim, not a fact — so `Urgent` carries a sentence
 * saying what urgent means here. Without it every ticket is urgent within a
 * week and the field stops sorting anything.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Badge,
  Button,
  Card,
  Icon,
  InputField,
  PhotoPicker,
  SectionLabel,
  SegmentedTabs,
  StatusBadge,
  StickyBar,
  TextArea,
  Text,
  todayIso,
  useToast,
  type PickedPhoto,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useTenancy } from '@/data/tenancy-store';
import {
  nextRef,
  ticketsForLease,
  useFileTicketOffline,
  useTickets,
  type TicketPriority,
} from '@/data/tickets';
import { ME } from '@/data/personas';
import { formatFullDay } from './dates';
import { LeaseBlocked, LeaseError, LeaseLoading, LeaseMissing } from './lease-gate';

const PRIORITIES: { value: TicketPriority; key: 'issue.priorityUrgent' | 'issue.priorityNormal' | 'issue.priorityLow' }[] = [
  { value: 'urgent', key: 'issue.priorityUrgent' },
  { value: 'normal', key: 'issue.priorityNormal' },
  { value: 'low', key: 'issue.priorityLow' },
];

export function LeaseMaintenanceNew() {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();

  const read = useTenancy(leaseId);
  const lease = read.data;
  const tickets = useTickets();
  const fileTicket = useFileTicketOffline();

  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  // Frame R20 draws Urgent selected. That is the frame's example, not a sane
  // default — a form that pre-claims urgency is a form that never sorts — so
  // Normal leads and Urgent is a deliberate choice with its meaning printed.
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [filedRef, setFiledRef] = useState<string | null>(null);

  const filing = fileTicket.state === 'saving';

  if (read.status === 'loading') return <LeaseLoading rows={3} />;
  if (read.status === 'error') return <LeaseError error={read.error} onRetry={read.retry} />;
  if (!lease) return <LeaseMissing />;

  // F-R11 §9 and FL25 §6: a ticket on an `ending` lease is fine — you still
  // live there — and one on an `ended` lease is not.
  if (lease.leaseState === 'ended' || lease.leaseState === 'pending_signature') {
    return (
      <LeaseBlocked
        icon="wrench"
        title={t('issue.closedTitle')}
        body={t('issue.closedBody', { landlord: lease.landlord })}
      />
    );
  }

  const openOnLease = ticketsForLease(tickets.data ?? [], lease.id);

  const submit = () => {
    if (!title.trim()) return;
    const ref = nextRef(tickets.data ?? []);
    void fileTicket
      .submit({
        title: title.trim(),
        detail: detail.trim(),
        location: lease.unit,
        leaseId: lease.id,
        reporter: ME.name,
        priority,
        photos: photos.map((p) => p.uri),
        filedOn: todayIso(),
      })
      .then(() => {
        if (fileTicket.state === 'error') return;
        setFiledRef(ref);
        // The two confirmations are DIFFERENT and the difference matters.
        // `data-seam.md` §5: a queued report is confirmed as "submitted when
        // you reconnect", never as "received" — nobody has seen it, and a
        // tenant who believes the landlord has their report stops chasing it.
        toast.show(
          fileTicket.offline
            ? t('queue.submittedWhenOnline')
            : t('issue.toast', { ref, org: lease.landlordOrg }),
          fileTicket.offline ? 'warning' : 'success',
        );
      });
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
            {filedRef ? t('issue.filedTitle', { ref: filedRef }) : t('issue.title')}
          </Text>
          <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
            {lease.unit} · {t('issue.goesTo', { org: lease.landlordOrg })}
          </Text>
        </View>

        {filedRef ? (
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
                    {t('issue.filedTitle', { ref: filedRef })}
                  </Text>
                  <StatusBadge domain="ticket" state="open" />
                </View>
                <Text size="sm" color="brand900" style={{ opacity: 0.82, lineHeight: 19 }}>
                  {t('issue.filedBody', { org: lease.landlordOrg })}
                </Text>
              </View>
            </Card>
            <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
              {t('issue.notWired')}
            </Text>
          </>
        ) : (
          <>
            <InputField
              label={t('issue.whatLabel')}
              value={title}
              onChangeText={setTitle}
              placeholder={t('issue.whatPlaceholder')}
              autoCapitalize="sentences"
            />

            <TextArea
              label={t('issue.detailLabel')}
              value={detail}
              onChangeText={setDetail}
              placeholder={t('issue.detailPlaceholder')}
              helper={t('issue.detailHelper')}
              rows={4}
            />

            <View style={{ gap: space[2] }}>
              <SectionLabel>{t('issue.photos')}</SectionLabel>
              <PhotoPicker value={photos} onChange={setPhotos} max={4} hint={t('issue.photoHint')} />
            </View>

            <View style={{ gap: space[2] }}>
              <SectionLabel>{t('issue.priority')}</SectionLabel>
              <SegmentedTabs
                value={priority}
                onChange={(v) => setPriority(v as TicketPriority)}
                items={PRIORITIES.map((p) => ({ value: p.value, label: t(p.key) }))}
              />
              {/* What "urgent" means, on the control that claims it. */}
              {priority === 'urgent' ? (
                <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                  <Icon name="alertTriangle" size={15} color={c.warning600} />
                  <Text size="xs" color="warning600" style={{ flex: 1, lineHeight: 18 }}>
                    {t('issue.urgentNote')}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        )}

        {/* What is already outstanding on this unit, so a second report of the
            same leak is a decision rather than an accident. */}
        {openOnLease.length > 0 ? (
          <>
            <SectionLabel>{t('issue.openOnLease')}</SectionLabel>
            <Card bodyStyle={{ paddingVertical: 4 }}>
              <View>
                {openOnLease.map((ticket, i) => (
                  <View
                    key={ticket.ref}
                    accessible
                    accessibilityLabel={`${ticket.ref}, ${ticket.title}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[3],
                      minHeight: 44,
                      paddingVertical: space[3],
                      borderBottomWidth: i < openOnLease.length - 1 ? 1 : 0,
                      borderBottomColor: c.borderSubtle,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text weight="medium" size="sm" color="textStrong" numberOfLines={1}>
                        {ticket.title}
                      </Text>
                      <Text size="xs" color="textMuted" numberOfLines={1}>
                        {ticket.ref} · {formatFullDay(ticket.filedOn, t)}
                      </Text>
                    </View>
                    {ticket.priority === 'urgent' ? (
                      <Badge tone="danger">{t('issue.priorityUrgent')}</Badge>
                    ) : null}
                    <StatusBadge domain="ticket" state={ticket.state} />
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>

      <StickyBar>
        {filedRef ? (
          <>
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {t('issue.ticketRef', { ref: filedRef, state: t('status.ticket.open') })}
              </Text>
              <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
                {lease.unit}
              </Text>
            </View>
            <Button variant="primary" onPress={() => router.back()}>
              {t('issue.done')}
            </Button>
          </>
        ) : (
          <>
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {title.trim() ? t('issue.goesTo', { org: lease.landlordOrg }) : t('issue.needTitle')}
              </Text>
              <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
                {lease.unit}
              </Text>
            </View>
            <Button
              variant="primary"
              leadingIcon="wrench"
              disabled={!title.trim() || filing}
              onPress={submit}
            >
              {filing ? t('issue.submitting') : t('issue.action')}
            </Button>
          </>
        )}
      </StickyBar>
    </View>
  );
}
