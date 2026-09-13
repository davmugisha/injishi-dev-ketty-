/**
 * The placed order, as its receipt (ADR-050 slice 1, AC-3, AC-23).
 *
 * Everything on this screen is the server's answer to `POST /me/orders`,
 * shown as it came: the locked prices, the tax the API computed, the total that
 * will reach the bill. Nothing is recomputed here.
 *
 * WHAT IT DOES NOT SHOW, ON PURPOSE: a fiscal receipt. An in house order is not
 * a sale yet; it is one line on the guest's bill, and the bill is signed with
 * RRA once, when it closes at check out (D-a). No document of any kind is shown
 * before the VSDC has answered (D-b), so this says when the official receipt
 * comes rather than printing something that looks like one.
 *
 * Slice 1 has no read route for one order, so the screen reads the answer the
 * order screen put in the query cache. Opened cold (a reload, a deep link), it
 * says the order was placed and where its details live, rather than inventing
 * them.
 */
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GuestOrder } from '@injishi/contracts';
import {
  BackHeader,
  Button,
  Card,
  EmptyState,
  Icon,
  MoneyBreakdown,
  SectionLabel,
  StatusBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { meKeys } from '@/lib/query-keys';

export function OrderPlaced({ orderId }: { orderId: string | undefined }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  const order = orderId
    ? queryClient.getQueryData<GuestOrder>(meKeys.order(orderId))
    : undefined;

  const done = () => {
    // Back past the order screen to wherever ordering was opened from.
    if (router.canDismiss()) router.dismiss(2);
    else router.back();
  };

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <View style={{ paddingTop: insets.top + 44, paddingHorizontal: space[4] }}>
          <EmptyState
            icon="checkCircle"
            title={t('order.missingTitle')}
            body={t('order.missingBody')}
            action={
              <Button variant="outline" size="md" onPress={done}>
                {t('order.done')}
              </Button>
            }
          />
        </View>
        <BackHeader overlay />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 44,
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[4] }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.success100,
            }}
          >
            <Icon name="checkCircle" size={32} color={c.success600} />
          </View>
          <Text
            family="display"
            weight="semibold"
            size="xl"
            color="textStrong"
            center
            accessibilityRole="header"
          >
            {t('order.placedTitle')}
          </Text>
          <Text size="sm" color="textMuted" center style={{ lineHeight: 20 }}>
            {t('order.placedBody', { outlet: order.outletName })}
          </Text>
        </View>

        <Card>
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
              <Text size="sm" color="textMuted">
                {t('order.number')}
              </Text>
              <Text family="mono" size="sm" color="textStrong">
                {order.orderNumber}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
              <Text size="sm" color="textMuted">
                {t('order.status')}
              </Text>
              <StatusBadge domain="order" state={order.status} />
            </View>
          </View>
        </Card>

        <SectionLabel>{order.outletName}</SectionLabel>
        <Card>
          <MoneyBreakdown
            items={[
              ...order.lines.map((line) => ({
                label: t('order.lineQty', { count: line.quantity, item: line.name }),
                value: line.lineTotalRwf,
              })),
              { label: t('order.subtotal'), value: order.subtotalRwf, muted: true },
              { label: t('order.tax'), value: order.taxRwf, muted: true },
            ]}
            total={{ label: t('order.total'), value: order.totalRwf }}
          />
        </Card>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space[3],
            padding: space[4],
            borderRadius: radius.lg,
            backgroundColor: c.surface2,
          }}
        >
          <Icon name="receipt" size={20} color={c.textMuted} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text weight="semibold" size="sm" color="textStrong">
              {t('order.receiptTitle')}
            </Text>
            <Text size="sm" color="textBody" style={{ lineHeight: 20 }}>
              {t('order.receiptNote')}
            </Text>
          </View>
        </View>

        <View style={{ gap: space[2] }}>
          <Button variant="primary" size="lg" block onPress={done}>
            {t('order.done')}
          </Button>
          <Button variant="ghost" size="lg" block onPress={() => router.back()}>
            {t('order.orderMore')}
          </Button>
        </View>
      </ScrollView>
      <BackHeader overlay />
    </View>
  );
}
