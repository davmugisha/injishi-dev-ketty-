/**
 * The outcomes a lease-scoped screen shows INSTEAD of itself.
 *
 * Six screens hang off `lease/[leaseId]/…` and every one of them has the same
 * four ways of not rendering: the read is in flight, the read failed, the lease
 * is gone, or the lease is real but cannot do this. Written out per screen that
 * was a hundred lines of near-identical branches, and — worse — they had drifted
 * into using the wrong one: a lease that has ended is not an ERROR, and offering
 * "Try again" on it is a button that cannot work. The distinction the kit already
 * draws is the right one and this keeps it:
 *
 *   - **`ErrorState`** is for something that failed and might not next time, so
 *     it carries a retry.
 *   - **`EmptyState`** is for a true and stable fact, so it carries a way
 *     onwards rather than a way to try the same thing again.
 *
 * Each of these paints the whole screen, `BackHeader` included, because the one
 * control a reader always needs on a dead end is the way back out of it.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BackHeader,
  Button,
  EmptyState,
  ErrorState,
  SkeletonList,
  type IconName,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

/** `BackHeader` over a body that clears it. Every gate below draws this. */
function Frame({ children, center }: { children: ReactNode; center?: boolean }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <BackHeader />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 56,
          paddingHorizontal: space[4],
          ...(center ? { justifyContent: 'center', paddingBottom: 56 } : null),
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * The read is in flight. `label` names what is loading for a screen reader —
 * "your visitor log" rather than "this lease" — because a skeleton with a
 * generic announcement tells a non-sighted reader nothing about where they are.
 */
export function LeaseLoading({ rows = 4, label }: { rows?: number; label?: string }) {
  const t = useT();
  return (
    <Frame>
      <SkeletonList
        rows={rows}
        label={t('state.loadingList', { label: label ?? t('lease.listLabel') })}
      />
    </Frame>
  );
}

/** The read failed. Retrying is the right offer, so `ErrorState` carries one. */
export function LeaseError({ error, onRetry }: { error?: Error; onRetry: () => void }) {
  const t = useT();
  return (
    <Frame center>
      <ErrorState
        title={t('state.errorTitle')}
        body={t('state.errorBody', { label: t('lease.listLabel') })}
        detail={error?.message}
        onRetry={onRetry}
      />
    </Frame>
  );
}

/**
 * The read succeeded and the lease is not there — a withdrawn invite, a stale
 * deep link. Retrying cannot fix it, so the offer is the way back.
 */
export function LeaseMissing() {
  const t = useT();
  return (
    <LeaseBlocked icon="alertCircle" title={t('lease.notFound')} body={t('leases.emptyBody')} />
  );
}

/**
 * The lease is real and this screen does not apply to it: a move-out notice on
 * a tenancy that never started, a renewal on one that has closed, a maintenance
 * ticket against a lease that ended last year. All true, stable facts.
 */
export function LeaseBlocked({
  icon = 'lock',
  title,
  body,
}: {
  icon?: IconName;
  title: string;
  body: string;
}) {
  const router = useRouter();
  const t = useT();

  return (
    <Frame center>
      <EmptyState
        icon={icon}
        title={title}
        body={body}
        action={
          <Button variant="outline" leadingIcon="arrowLeft" onPress={() => router.back()}>
            {t('tenant.goBack')}
          </Button>
        }
      />
    </Frame>
  );
}
