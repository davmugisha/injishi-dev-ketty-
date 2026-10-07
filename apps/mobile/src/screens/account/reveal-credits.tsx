/**
 * Reveal credits — frame B25's "Reveal credits · 7 left ›".
 *
 * A screen rather than a sheet, because it carries the reveal LOG and the log
 * is the point. F-R09 §10 makes it the security control: a landlord's phone
 * number is personal data, a reveal is the moment it leaves the platform, and
 * the log records who was exposed and when. Nothing deletes a row.
 *
 * So the balance is the small half of this screen and the history is the large
 * one. A broker who only wanted the number would have read it off the Account
 * row they tapped to get here.
 *
 * **Why a credit exists at all**, restated on the screen rather than assumed: a
 * directory with unmetered reveals is a directory that gets scraped, and every
 * landlord on it has their number harvested. The rate limit is the protection,
 * and a reader who does not know that reads the counter as a paywall.
 *
 * **What it no longer says** (mobile audit 2026-10-05, BR-04). The eyebrow
 * named every broker's business "Aline K. Brokerage"; it is the workspace's
 * own name now. The tiles said "Left this month" and "of 7 a month", an
 * allowance that renews monthly, and nothing renews: the server keeps a ledger
 * with no monthly grant. How credits are granted is an open decision, so the
 * tiles state the balance and what was spent, and promise no schedule.
 *
 * **The log is a virtualized list** (`Screen.List`, ADR-031). It grows by one
 * row per reveal and nothing removes a row, which is exactly the list that must
 * not render every row at once (mobile audit 2026-10-05, BR-10).
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BackHeader,
  Button,
  Card,
  EmptyState,
  ListRow,
  Screen,
  StatCard,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useDomain } from '@/domain';
import { SEED_CREDITS, getUnit, useBrokerState, type Reveal } from '@/data/broker';
import { formatLongDay } from './account-format';

export function RevealCreditsScreen() {
  const { space } = useTheme();
  const t = useT();
  const router = useRouter();
  const { workspace } = useDomain();
  const { credits, reveals } = useBrokerState();

  // Newest first: the row a broker is looking for is almost always the last one
  // they spent, and a log that reads oldest-first makes them scroll for it.
  const log = [...reveals].sort((a, b) => b.day.localeCompare(a.day));
  const spent = Math.max(0, SEED_CREDITS - credits);

  return (
    <>
      <BackHeader />
      <Screen.List<Reveal>
        title={t('credits.title')}
        greeting={workspace.name}
        header={
          <>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <StatCard label={t('reveal.creditsLeftLabel')} value={String(credits)} icon="eye" />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard label={t('credits.spent')} value={String(spent)} icon="clock" />
              </View>
            </View>

            <Card variant="tint">
              <Text size="sm" color="brand900" style={{ lineHeight: 19 }}>
                {t('credits.whyBody')}
              </Text>
            </Card>

            {log.length > 0 ? (
              <View style={{ gap: 4 }}>
                <Text weight="semibold" size="md" color="textStrong">
                  {t('credits.logTitle')}
                </Text>
                <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                  {t('credits.logBody')}
                </Text>
              </View>
            ) : null}

            <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
              {t('credits.retentionNote')}
            </Text>
          </>
        }
        data={log}
        keyExtractor={(entry) => `${entry.unitId}-${entry.day}`}
        renderItem={({ item }) => {
          const unit = getUnit(item.unitId);
          return (
            <Card bodyStyle={{ paddingVertical: 2 }}>
              <ListRow
                icon="eye"
                title={
                  unit
                    ? t('credits.logUnit', { property: unit.property, unit: unit.unit })
                    : item.unitId
                }
                subtitle={unit?.district}
                value={formatLongDay(item.day, t)}
                // A log row is a record, not a control. It has nowhere to go
                // that the Directory does not already go, and a chevron on
                // it would be the orphaned control the quality bar rules out.
                chevron={false}
              />
            </Card>
          );
        }}
        empty={
          <EmptyState
            icon="eye"
            title={t('credits.emptyTitle')}
            body={t('credits.emptyBody')}
            action={
              <Button leadingIcon="grid" onPress={() => router.push('/')}>
                {t('credits.emptyAction')}
              </Button>
            }
          />
        }
      />
    </>
  );
}
