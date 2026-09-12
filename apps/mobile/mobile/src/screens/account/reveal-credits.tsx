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
import { SEED_CREDITS, getUnit, useBrokerState } from '@/data/broker';
import { formatLongDay } from './account-format';

export function RevealCreditsScreen() {
  const { space } = useTheme();
  const t = useT();
  const router = useRouter();
  const { credits, reveals } = useBrokerState();

  // Newest first: the row a broker is looking for is almost always the last one
  // they spent, and a log that reads oldest-first makes them scroll for it.
  const log = [...reveals].sort((a, b) => b.day.localeCompare(a.day));
  const spent = Math.max(0, SEED_CREDITS - credits);

  return (
    <>
      <BackHeader />
      <Screen title={t('credits.title')} greeting={t('credits.greeting')}>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <StatCard
              label={t('credits.left')}
              value={String(credits)}
              icon="eye"
              caption={t('credits.ofMonthly', { total: SEED_CREDITS })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard
              label={t('credits.spent')}
              value={String(spent)}
              icon="clock"
              caption={t('credits.thisMonth')}
            />
          </View>
        </View>

        <Card variant="tint">
          <Text size="sm" color="brand900" style={{ lineHeight: 19 }}>
            {t('credits.whyBody')}
          </Text>
        </Card>

        {log.length === 0 ? (
          <EmptyState
            icon="eye"
            title={t('credits.emptyTitle')}
            body={t('credits.emptyBody')}
            action={
              <Button leadingIcon="grid" onPress={() => router.push('/directory')}>
                {t('credits.emptyAction')}
              </Button>
            }
          />
        ) : (
          <Card
            title={t('credits.logTitle')}
            subtitle={t('credits.logBody')}
            bodyStyle={{ paddingVertical: 2 }}
          >
            <View>
              {log.map((entry, i) => {
                const unit = getUnit(entry.unitId);
                return (
                  <ListRow
                    key={`${entry.unitId}-${entry.day}`}
                    icon="eye"
                    title={
                      unit
                        ? t('credits.logUnit', { property: unit.property, unit: unit.unit })
                        : entry.unitId
                    }
                    subtitle={unit?.district}
                    value={formatLongDay(entry.day, t)}
                    divider={i < log.length - 1}
                    // A log row is a record, not a control. It has nowhere to go
                    // that the Directory does not already go, and a chevron on
                    // it would be the orphaned control the quality bar rules out.
                    chevron={false}
                  />
                );
              })}
            </View>
          </Card>
        )}

        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {t('credits.retentionNote')}
        </Text>
      </Screen>
    </>
  );
}
