/**
 * Frame R19 · Visitor log — F-R14.
 *
 * **The frame's footnote is not quite what the feature says, and the feature
 * wins.** R19 prints "Visitor logs help your landlord with building security
 * and are visible only to your lease", which reads as though the landlord
 * browses it. F-R14 §6 is the opposite and is explicit: compliance and
 * oversight have read-only access through the management console, the landlord
 * has **no standing read access**, and a landlord who wants to know who was in
 * the unit on a given day has to ask — and the request is recorded. That is a
 * privacy guarantee, so the copy here states it rather than the frame's looser
 * line. Session 8's prompt says the landlord seat "opens the tenant's log read
 * only", which contradicts the same clause; it is worth a human decision and it
 * is in this session's report.
 *
 * **An overnight entry with no departure is "still in unit"** (F-R14 §8), drawn
 * rather than guessed. The alternative — inventing a departure date — is how a
 * safety record stops being one.
 *
 * The log is lease-scoped rather than person-scoped: an `ended` lease's log
 * becomes read-only history (F-R14 §9) rather than following the tenant to
 * their next unit.
 *
 * A `ScrollView` rather than `Screen.List`, matching the other lease sub-screens
 * (sign, move-out, renew, report): `BackHeader` floats absolutely over the top
 * of whatever it is mounted on, and a virtualized scaffold's own title block
 * lands underneath it. A visitor log is also bounded by one tenancy, so
 * ADR-031's virtualization threshold does not apply the way it does to My
 * leases. The four states are still all here, hand-rolled above the rows.
 *
 * **The sheet stays open until the entry is saved** (mobile audit 2026-10-05,
 * TN-12). It used to close on the press and toast "logged" on every settle, so
 * an entry that failed to save was announced and its name thrown away. Now the
 * outcome decides: `done` closes and toasts, `error` keeps the name in front of
 * the person with `WriteError` and a retry.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Badge,
  Button,
  ChipGroup,
  EmptyState,
  Icon,
  InputField,
  ModalSheet,
  OfflineNote,
  SectionLabel,
  SegmentedTabs,
  Text,
  todayIso,
  useOffline,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey, type Translate } from '@/i18n/i18n';
import { useLogVisitor, useTenancy } from '@/data/tenancy-store';
import { type VisitorEntry } from '@/data/rentals';
import { formatFullDay } from './dates';
import { LeaseError, LeaseLoading, LeaseMissing } from './lease-gate';

const RELATIONS: { value: VisitorEntry['relation']; label: MessageKey }[] = [
  { value: 'family', label: 'visitors.relationFamily' },
  { value: 'guest', label: 'visitors.relationGuest' },
  { value: 'work', label: 'visitors.relationWork' },
  { value: 'other', label: 'visitors.relationOther' },
];

function relationLabel(relation: VisitorEntry['relation'], t: Translate): string {
  return t(RELATIONS.find((r) => r.value === relation)?.label ?? 'visitors.relationOther');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function VisitorRow({ entry, t }: { entry: VisitorEntry; t: Translate }) {
  const { c, space, radius } = useTheme();
  const stay = t(entry.stay === 'overnight' ? 'visitors.overnight' : 'visitors.day');
  const relation = relationLabel(entry.relation, t);
  // F-R14 §8: an overnight visitor with no departure recorded is still here.
  const present = entry.stay === 'overnight' && !entry.leftOn;

  return (
    <View
      accessible
      accessibilityLabel={t('visitors.entry', {
        name: entry.name,
        relation,
        stay,
        date: formatFullDay(entry.arrivedOn, t),
      })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        padding: space[3],
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.brand100,
        }}
      >
        <Text weight="semibold" size="sm" color="brand700">
          {initials(entry.name)}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
          {entry.name}
        </Text>
        <Text size="xs" color="textMuted" numberOfLines={1}>
          {relation} · {stay} · {formatFullDay(entry.arrivedOn, t)}
        </Text>
      </View>

      {present ? (
        <Badge tone="warning" dot>
          {t('visitors.stillIn')}
        </Badge>
      ) : (
        <Icon name={entry.stay === 'overnight' ? 'moon' : 'sun'} size={17} color={c.textSubtle} />
      )}
    </View>
  );
}

export function LeaseVisitors() {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const toast = useToast();
  const offline = useOffline();
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();

  const read = useTenancy(leaseId);
  const lease = read.data;
  const log = useLogVisitor();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<VisitorEntry['relation']>('family');
  const [stay, setStay] = useState<VisitorEntry['stay']>('overnight');
  const [failed, setFailed] = useState(false);

  const today = todayIso();
  const saving = log.status === 'saving';

  const openSheet = () => {
    setFailed(false);
    setOpen(true);
  };
  const closeSheet = () => {
    setFailed(false);
    setOpen(false);
  };

  if (read.status === 'loading')
    return <LeaseLoading rows={3} label={t('visitors.listLabel')} />;
  if (read.status === 'error') return <LeaseError error={read.error} onRetry={read.retry} />;
  if (!lease) return <LeaseMissing />;

  const readOnly = lease.leaseState === 'ended';
  const entries = lease.visitors;
  // "This month" is the frame's own grouping. Everything else falls below it
  // rather than being hidden, because a log you cannot scroll back through is
  // not a record.
  const thisMonth = entries.filter((e) => e.arrivedOn.slice(0, 7) === today.slice(0, 7));
  const earlier = entries.filter((e) => e.arrivedOn.slice(0, 7) !== today.slice(0, 7));

  const save = async () => {
    const visitorName = name.trim();
    if (!visitorName || saving) return;
    setFailed(false);
    const outcome = await log.mutate({
      leaseId: lease.id,
      visitor: {
        id: `v-${Date.now()}`,
        name: visitorName,
        relation,
        stay,
        arrivedOn: today,
        // An overnight visitor logged today has not left yet, so no
        // departure is recorded; a day visit ends the day it starts.
        ...(stay === 'day' ? { leftOn: today } : null),
      },
    });
    // THIS write's outcome, never a `status` read after the await (TN-12).
    if (outcome === 'done') {
      setOpen(false);
      toast.show(t('visitors.toast', { name: visitorName }), 'success');
      setName('');
      setRelation('family');
      setStay('overnight');
    } else if (outcome === 'error') {
      setFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + space[8],
          paddingHorizontal: space[4],
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
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
            {t('visitors.title')}
          </Text>
          <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
            {lease.unit} · {lease.landlordOrg}
          </Text>
        </View>

        {offline ? <OfflineNote /> : null}

        <>
            {readOnly ? (
              <View
                accessible
                accessibilityRole="summary"
                style={{
                  gap: 4,
                  padding: space[4],
                  borderRadius: radius.lg,
                  backgroundColor: c.surface2,
                }}
              >
                <Text weight="semibold" size="sm" color="textStrong">
                  {t('visitors.readOnlyTitle')}
                </Text>
                <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
                  {t('visitors.readOnlyBody')}
                </Text>
              </View>
            ) : (
              <Button variant="outline" size="lg" block leadingIcon="plus" onPress={openSheet}>
                {t('visitors.add')}
              </Button>
            )}

            {entries.length === 0 ? (
              <EmptyState
                icon="users"
                title={t('visitors.emptyTitle')}
                body={t('visitors.emptyBody')}
                // The screen's own primary, repeated inside the empty state.
                // The button above it is real and reachable, but an empty state
                // that points at nothing makes a reader look for what is
                // missing rather than at what is right there.
                action={
                  <Button variant="outline" size="sm" leadingIcon="plus" onPress={openSheet}>
                    {t('visitors.add')}
                  </Button>
                }
              />
            ) : (
              <>
                {thisMonth.length > 0 ? (
                  <>
                    <SectionLabel>{t('visitors.thisMonth')}</SectionLabel>
                    <View style={{ gap: space[2] }}>
                      {thisMonth.map((e) => (
                        <VisitorRow key={e.id} entry={e} t={t} />
                      ))}
                    </View>
                  </>
                ) : null}

                {earlier.length > 0 ? (
                  <>
                    <SectionLabel>{t('visitors.earlier')}</SectionLabel>
                    <View style={{ gap: space[2] }}>
                      {earlier.map((e) => (
                        <VisitorRow key={e.id} entry={e} t={t} />
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            )}

            {/* The privacy rule, at the foot of the screen it governs — which
                is the frame's own placement, and the right one: it explains
                what the reader has just looked at. */}
            <View
              accessible
              accessibilityRole="summary"
              style={{
                flexDirection: 'row',
                gap: space[2],
                padding: space[3],
                borderRadius: radius.md,
                backgroundColor: c.bgTint,
                borderWidth: 1,
                borderColor: c.borderSubtle,
              }}
            >
              <Icon name="lock" size={15} color={c.brand700} />
              <Text size="xs" color="brand900" style={{ flex: 1, opacity: 0.85, lineHeight: 17 }}>
                {t('visitors.footnote')}
              </Text>
            </View>
        </>
      </ScrollView>

      <ModalSheet
        visible={open}
        onClose={closeSheet}
        title={t('visitors.add')}
        eyebrow={lease.ref}
        footer={
          <>
            <Button
              variant="primary"
              size="lg"
              block
              disabled={!name.trim() || saving}
              onPress={() => void save()}
            >
              {saving ? t('visitors.saving') : t('visitors.save')}
            </Button>
            <Button variant="ghost" size="md" block onPress={closeSheet}>
              {t('visitors.cancel')}
            </Button>
          </>
        }
      >
        {failed ? <WriteError onRetry={() => void save()} /> : null}

        <InputField
          label={t('visitors.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('visitors.namePlaceholder')}
          autoCapitalize="words"
          helper={name.trim() ? undefined : t('visitors.needName')}
        />

        <ChipGroup
          legend={t('visitors.relationLabel')}
          wrap
          items={RELATIONS.map((r) => ({ value: r.value, label: t(r.label) }))}
          value={relation}
          onChange={(v) => setRelation(v as VisitorEntry['relation'])}
        />

        <View style={{ gap: space[2] }}>
          <Text
            weight="bold"
            size="xs"
            color="textMuted"
            style={{ letterSpacing: 1, textTransform: 'uppercase' }}
          >
            {t('visitors.stayLabel')}
          </Text>
          <SegmentedTabs
            value={stay}
            onChange={(v) => setStay(v as VisitorEntry['stay'])}
            items={[
              { value: 'overnight', label: t('visitors.overnight') },
              { value: 'day', label: t('visitors.day') },
            ]}
          />
        </View>

        <View
          accessible
          accessibilityLabel={`${t('visitors.arrivedLabel')}: ${formatFullDay(today, t)}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}
        >
          <Icon name="calendar" size={16} color={c.textMuted} />
          <Text size="sm" color="textMuted">
            {t('visitors.arrivedLabel')} · {formatFullDay(today, t)}
          </Text>
        </View>
      </ModalSheet>
    </View>
  );
}
