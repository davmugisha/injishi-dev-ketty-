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
 * **That store is on this phone, and the screen says so.** No endpoint takes a
 * tenant's report yet, so the landlord on their own phone is not told and the
 * photographs are not uploaded. The confirmation used to say "{org} sees it
 * now" and promise a message when someone was assigned; both were false, and
 * a tenant who believes the landlord has their report stops chasing it (mobile
 * audit 2026-10-05, TN-06). It now says the report is saved here and the
 * landlord is not told.
 *
 * **The outcome is the write's STATE, not the render that pressed the
 * button.** That render predates the write, which is how a failed send used to
 * be confirmed as filed (TN-11, gaps.md §0.3). So there are four endings, each
 * drawn from `useFileTicketOffline().state`:
 *
 *   - `done`: saved on this phone, and the landlord not told;
 *   - `queued`: no signal, kept, and sent when the connection returns, in its
 *     own words (`data-seam.md` §5 forbids "received" for that);
 *   - `error` that the queue kept: it did not send, it is still kept, and
 *     Retry sends it now;
 *   - `error` the server refused: nothing was saved, so the form comes back.
 *
 * **Photographs lead the ticket** (frame W6's phrase, and the same reasoning
 * here): a picture of the sink settles in one glance what a paragraph argues
 * about. `PhotoPicker` handles the camera, the library and the permission-denied
 * state.
 *
 * Priority is the tenant's claim, not a fact — so `Urgent` carries a sentence
 * saying what urgent means here. Without it every ticket is urgent within a
 * week and the field stops sorting anything.
 */
import { useEffect, useRef, useState } from 'react';
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
  WriteError,
  type PickedPhoto,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useTenancy } from '@/data/tenancy-store';
import {
  openTicketsForLease,
  useFileTicketOffline,
  useTickets,
  type FileTicketInput,
  type TicketPriority,
} from '@/data/tickets';
import { type SubmitState } from '@/data/offline-submit';
import { useWriteQueue } from '@/data/write-queue';
import { useMyIdentity } from '@/queries/profile';
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
  const identity = useMyIdentity();
  const queue = useWriteQueue();
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
  /** What was last submitted, for a retry that has no queued intent to drain. */
  const lastPayload = useRef<FileTicketInput | null>(null);

  const state = fileTicket.state;
  const filing = state === 'saving';

  // Announce a state once, on the change into it. A queued report that sends
  // later, while the person is still on this screen, moves to `done` and is
  // announced then; a failure is announced by `WriteError` itself.
  const announced = useRef<SubmitState>(state);
  useEffect(() => {
    if (announced.current === state) return;
    announced.current = state;
    if (state === 'done') toast.show(t('issue.toast'), 'success');
    // The two confirmations are DIFFERENT and the difference matters.
    // `data-seam.md` §5: a queued report is confirmed as "submitted when you
    // reconnect", never as "received". Nobody has seen it.
    else if (state === 'queued') toast.show(t('queue.submittedWhenOnline'), 'warning');
  }, [state, toast, t]);

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

  const openOnLease = openTicketsForLease(tickets.data ?? [], lease.id);

  const saved = state === 'done';
  const waiting = state === 'queued';
  // A refusal is the server's answer and is never queued, so the person
  // changes the report rather than retrying it.
  const refused = state === 'error' && fileTicket.refusal !== null;
  // Any other failure was queued by `useOfflineSubmit`: the report is kept on
  // this phone, so the form stays away and a second press cannot file it twice.
  const kept = state === 'error' && !refused;
  const showForm = !saved && !waiting && state !== 'error';

  const submit = () => {
    if (!title.trim() || filing) return;
    const payload: FileTicketInput = {
      title: title.trim(),
      detail: detail.trim(),
      location: lease.unit,
      leaseId: lease.id,
      // The person holding the phone, from the server, and never the fixture
      // persona (mobile audit 2026-10-05, TN-03). An account with no name on
      // file is said to be one rather than given somebody else's.
      reporter: identity.fromServer ? identity.name : t('identity.unnamed'),
      priority,
      photos: photos.map((p) => p.uri),
      filedOn: todayIso(),
    };
    lastPayload.current = payload;
    void fileTicket.submit(payload);
  };

  // A kept report is sent by draining the queue it sits in. Submitting again
  // would mint a second intent beside the first and file the leak twice.
  const retry = () => {
    if (fileTicket.queuedId) void queue.retry();
    else if (lastPayload.current) void fileTicket.submit(lastPayload.current);
  };

  // Back to the form with the person's words intact. A refused intent the
  // queue still holds is abandoned first, or it would sit in the queue banner
  // beside the corrected report.
  const changeReport = () => {
    if (fileTicket.queuedId) queue.cancel(fileTicket.queuedId);
    fileTicket.reset();
  };

  const heading = saved ? t('issue.filedTitle') : waiting ? t('issue.queuedTitle') : t('issue.title');

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
            {heading}
          </Text>
          <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
            {lease.unit} · {t('issue.goesTo', { org: lease.landlordOrg })}
          </Text>
        </View>

        {saved ? (
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
                  {t('issue.filedTitle')}
                </Text>
                <StatusBadge domain="ticket" state="open" />
              </View>
              <Text size="sm" color="brand900" style={{ opacity: 0.82, lineHeight: 19 }}>
                {t('issue.filedBody', { org: lease.landlordOrg })}
              </Text>
            </View>
          </Card>
        ) : null}

        {waiting ? (
          <Card>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <Icon name="clock" size={18} color={c.warning600} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text weight="semibold" size="sm" color="textStrong">
                  {t('issue.queuedTitle')}
                </Text>
                <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
                  {t('issue.queuedBody')}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {kept ? (
          <WriteError
            title={fileTicket.error ?? 'queue.sendFailed'}
            body="issue.keptBody"
            onRetry={retry}
          />
        ) : null}

        {refused ? (
          <View style={{ gap: space[2] }}>
            <WriteError
              title="queue.refused"
              body="issue.refusedBody"
              secondary={{ label: 'issue.edit', onPress: changeReport }}
            />
            {/* The server's own sentence. The one place a raw string may
                reach the screen: the app has no words for a refusal it did
                not make (AC-S8). */}
            <Text size="sm" color="textBody" style={{ lineHeight: 19 }}>
              {fileTicket.refusal}
            </Text>
          </View>
        ) : null}

        {showForm ? (
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
        ) : null}

        {/* What is already outstanding on this unit, so a second report of the
            same leak is a decision rather than an accident. Resolved tickets
            are not outstanding (TN-19). */}
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
        {showForm ? (
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
        ) : (
          <>
            <View style={{ flex: 1, paddingRight: space[3] }}>
              <Text size="xs" color="textMuted">
                {heading}
              </Text>
              <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
                {lease.unit}
              </Text>
            </View>
            <Button variant={saved || waiting ? 'primary' : 'outline'} onPress={() => router.back()}>
              {saved || waiting ? t('issue.done') : t('write.goBack')}
            </Button>
          </>
        )}
      </StickyBar>
    </View>
  );
}
