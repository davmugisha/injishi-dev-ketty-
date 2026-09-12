/**
 * Subscription — frame R5's "Subscription · Growth ›" and B25's "· Pro ›".
 *
 * The plan is per SEAT rather than per account, which the two frames settle
 * between them: R5 puts the landlord on Growth and B25 puts the broker on Pro,
 * and under decision D7 those are the same person. That is also the product
 * rule — a subscription belongs to a workspace — so this reads
 * `SUBSCRIPTION[surface]` rather than one plan on the identity.
 *
 * **What the plan allows is the screen, not the price.** A plan row that only
 * printed a name and a number would leave the reader to guess what changing it
 * would cost them, which is the discovery-after-the-fact the canvas rules out.
 * So the includes are listed with a tick each, and the upgrade — where there is
 * one — says what it adds rather than only what it costs.
 *
 * No card is charged and the screen says so. Every amount in this build is
 * mocked, and a plan screen is exactly where a reader would assume otherwise.
 */
import { View } from 'react-native';
import {
  AdapterNote,
  BackHeader,
  Badge,
  Button,
  Card,
  Icon,
  MoneyAmount,
  Screen,
  StatRow,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { SUBSCRIPTION } from './account-fixtures';
import { formatLongDay, planKey } from './account-format';

export function SubscriptionScreen() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const toast = useToast();
  const { workspace, surface } = useDomain();

  // Only the three business seats reach this route from a row; a deep link from
  // anywhere else lands on the landlord plan rather than on a blank screen.
  const key = surface === 'broker' || surface === 'host' ? surface : 'landlord';
  const plan = SUBSCRIPTION[key];

  return (
    <>
      <BackHeader />
      <Screen title={t('subscription.title')} greeting={workspace.name}>
        <Card
          title={t(planKey(plan.plan))}
          subtitle={t('subscription.renews', { day: formatLongDay(plan.renewsOn, t) })}
          action={
            <Badge tone="brand" dot>
              {t('subscription.current')}
            </Badge>
          }
          footer={
            <View
              accessible
              accessibilityLabel={`${t('subscription.price')}: ${t('subscription.perMonth')}`}
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}
            >
              <MoneyAmount value={plan.priceRwf} size="xl" strong />
              <Text size="sm" color="textMuted">
                {t('subscription.perMonth')}
              </Text>
            </View>
          }
        >
          <View style={{ gap: space[2] }}>
            <Text
              weight="bold"
              size="2xs"
              color="textMuted"
              style={{ letterSpacing: 1, textTransform: 'uppercase' }}
            >
              {t('subscription.includes')}
            </Text>
            {plan.includes.map((line) => (
              <View
                key={line}
                accessible
                accessibilityLabel={t(line)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}
              >
                <Icon name="check" size={15} color={c.success600} />
                <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 19 }}>
                  {t(line)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card title={t('subscription.billingTitle')}>
          <View>
            <StatRow
              icon="calendar"
              label={t('subscription.nextCharge')}
              value={formatLongDay(plan.renewsOn, t)}
              divider
            />
            <StatRow icon="wallet" label={t('subscription.method')} value={t('payout.momo')} divider />
            <StatRow icon="receipt" label={t('subscription.invoices')} value={t('subscription.onWeb')} />
          </View>
        </Card>

        <AdapterNote label={t('subscription.adapterMock')} body={t('subscription.adapterMockBody')} />

        {plan.nextPlan ? (
          <View
            style={{
              gap: space[3],
              padding: space[4],
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: c.borderBrand,
              backgroundColor: c.bgTint,
            }}
          >
            <Text weight="semibold" size="md" color="textStrong">
              {t('subscription.upgradeTitle', { plan: t(planKey(plan.nextPlan)) })}
            </Text>
            <Text size="sm" color="textBody" style={{ lineHeight: 19 }}>
              {t(`subscription.upgradeBody.${plan.nextPlan}` as const)}
            </Text>
            <Button
              block
              size="lg"
              leadingIcon="externalLink"
              onPress={() => toast.show(t('subscription.upgradeToast'), 'neutral')}
              accessibilityHint={t('subscription.upgradeHint')}
            >
              {t('subscription.upgrade', { plan: t(planKey(plan.nextPlan)) })}
            </Button>
          </View>
        ) : (
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {t('subscription.topPlan')}
          </Text>
        )}
      </Screen>
    </>
  );
}
