/**
 * Order to your room: every outlet a guest may order from right now, its live
 * menu, a cart and one button (ADR-050 slice 1, AC-19, AC-21, AC-22).
 *
 * THE FIRST GUEST SCREEN ON THE REAL API. `GET /me/orderable` decides what is
 * shown; the phone decides nothing about policy, hours or stock. An outlet that
 * is closed, walk in only or sold out is simply absent, and if the menu goes
 * stale while the screen is open, the server's refusal is shown in its own
 * words rather than guessed at here.
 *
 * One cart per outlet, because one order goes to one outlet's board. The
 * `Idempotency-Key` is minted once per cart and survives a retry of the same
 * cart, so a press that times out and is pressed again is one order on the bill.
 *
 * ## Mobile audit 2026-10-05 (GK-09, GK-24)
 *
 * **Offline, an order is refused with a sentence.** A food order is never
 * queued (benchmarks.md row 40: a meal that reaches a kitchen hours late is
 * worse than none), so the button is off and the bar says why. The cart stays.
 *
 * **A `failed` call does not say nothing was charged.** It is a call whose end
 * the phone never heard, a timeout or a gateway error, so the order may well
 * have been placed. The toast says it could not be confirmed and to retry the
 * SAME cart, which reuses its key and cannot order twice.
 *
 * **The minus and plus buttons reach 44pt** through their hit slop.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OrderableItem, OrderableOutlet } from '@injishi/contracts';
import {
  BackHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  MoneyAmount,
  PressableScale,
  SectionLabel,
  SegmentedTabs,
  SkeletonList,
  StickyBar,
  Text,
  useOffline,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { meKeys } from '@/lib/query-keys';
import {
  cartSummary,
  MAX_QUANTITY,
  orderRequest,
  placeOrder,
  setQuantity,
  useOrderable,
  type Cart,
} from '@/queries/ordering';
import { uuidV4 } from './book-format';

/** Room the sticky bar needs at the bottom of the scroll, so no dish hides under it. */
const BAR_CLEARANCE = 150;

export function OrderScreen() {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const orderable = useOrderable();
  const outlets = orderable.data?.outlets ?? [];

  const [outletId, setOutletId] = useState<string | null>(null);
  const outlet = outlets.find((o) => o.id === outletId) ?? outlets[0];

  const [carts, setCarts] = useState<Record<string, Cart>>({});
  const cart = outlet ? (carts[outlet.id] ?? {}) : {};
  const summary = cartSummary(cart, outlet);

  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const offline = useOffline();

  // One key per cart. A different cart is a different intent; the same cart
  // pressed again is the same one.
  const cartSignature = useMemo(
    () => `${outlet?.id ?? ''}|${JSON.stringify(Object.entries(cart).sort())}`,
    [outlet?.id, cart],
  );
  const key = useRef<{ signature: string; value: string } | null>(null);
  useEffect(() => {
    setRefusal(null);
  }, [cartSignature]);

  const change = (item: OrderableItem, quantity: number) => {
    if (!outlet) return;
    setCarts((all) => ({ ...all, [outlet.id]: setQuantity(all[outlet.id] ?? {}, item.id, quantity) }));
  };

  const submit = async () => {
    if (!outlet || summary.count === 0 || busy || offline) return;
    if (key.current?.signature !== cartSignature) {
      key.current = { signature: cartSignature, value: uuidV4() };
    }
    setBusy(true);
    setRefusal(null);
    const answer = await placeOrder(orderRequest(cart, outlet), key.current.value);
    setBusy(false);

    if (answer.status === 'ok') {
      queryClient.setQueryData(meKeys.order(answer.data.id), answer.data);
      void queryClient.invalidateQueries({ queryKey: meKeys.orderable() });
      setCarts((all) => ({ ...all, [outlet.id]: {} }));
      key.current = null;
      router.push({ pathname: '/order-placed', params: { orderId: answer.data.id } });
      return;
    }
    if (answer.status === 'refused') {
      // The server's own sentence: a closed outlet, a sold out dish, a bill
      // already signed. Refetch so the menu stops offering what it refused.
      setRefusal(answer.message);
      void orderable.refetch();
      return;
    }
    toast.show(t('order.failed'), 'danger');
  };

  if (orderable.status === 'pending') {
    return (
      <Frame>
        <SkeletonList rows={4} label={t('state.loadingList', { label: t('order.listLabel') })} />
      </Frame>
    );
  }
  if (orderable.status === 'error') {
    return (
      <Frame>
        {/* No raw server text as the detail (GB-27). */}
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('order.listLabel') })}
          onRetry={() => void orderable.refetch()}
        />
      </Frame>
    );
  }
  if (!outlet) {
    return (
      <Frame>
        <Header t={t} property={null} />
        <EmptyState
          icon="clock"
          title={t('order.emptyTitle')}
          body={t('order.emptyBody')}
          action={
            <Button variant="outline" size="md" onPress={() => router.back()}>
              {t('order.done')}
            </Button>
          }
        />
      </Frame>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 44,
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + BAR_CLEARANCE,
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Header t={t} property={outlet.propertyName} />

        {outlets.length > 1 ? (
          <View style={{ gap: space[2] }}>
            <SectionLabel>{t('order.pickOutlet')}</SectionLabel>
            <SegmentedTabs
              items={outlets.map((o) => ({
                value: o.id,
                label: o.name,
                count: cartSummary(carts[o.id] ?? {}, o).count || undefined,
              }))}
              value={outlet.id}
              onChange={setOutletId}
            />
          </View>
        ) : null}

        <OutletCard outlet={outlet} t={t} />

        {outlet.categories.map((category) => (
          <View key={category.id} style={{ gap: space[2] }}>
            <SectionLabel>{category.name}</SectionLabel>
            <Card variant="flat" bodyStyle={{ paddingVertical: 4 }}>
              {category.items.map((item, index) => (
                <MenuRow
                  key={item.id}
                  item={item}
                  quantity={cart[item.id] ?? 0}
                  divider={index < category.items.length - 1}
                  onChange={(q) => change(item, q)}
                  t={t}
                />
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>

      <StickyBar>
        <View style={{ flex: 1, gap: 10 }}>
          {offline ? (
            <View
              accessible
              accessibilityRole="alert"
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}
            >
              <Icon name="wifiOff" size={16} color={c.warning600} />
              <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 19 }}>
                {t('order.offline')}
              </Text>
            </View>
          ) : null}
          {refusal ? (
            <View
              accessible
              accessibilityRole="alert"
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}
            >
              <Icon name="alertCircle" size={16} color={c.danger600} />
              <Text size="sm" color={c.danger600} style={{ flex: 1, lineHeight: 19 }}>
                {refusal}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text size="xs" color="textMuted" numberOfLines={1}>
                {summary.count === 1
                  ? t('order.cartOne')
                  : t('order.cartMany', { count: summary.count })}
              </Text>
              <MoneyAmount value={summary.subtotalRwf} strong size="lg" />
              <Text size="2xs" color="textMuted" numberOfLines={2}>
                {t('order.beforeTax')}
              </Text>
            </View>
            <Button
              variant="primary"
              size="lg"
              leadingIcon="send"
              disabled={summary.count === 0 || busy || offline}
              accessibilityHint={t('order.placeHint', { outlet: outlet.name })}
              onPress={() => void submit()}
            >
              {busy ? t('order.placing') : t('order.place')}
            </Button>
          </View>
        </View>
      </StickyBar>

      <BackHeader overlay />
    </View>
  );

  function Frame({ children }: { children: React.ReactNode }) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <View style={{ paddingTop: insets.top + 44, paddingHorizontal: space[4], gap: space[4] }}>
          {children}
        </View>
        <BackHeader overlay />
      </View>
    );
  }
}

function Header({ t, property }: { t: Translate; property: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Text family="display" weight="semibold" size="xl" color="textStrong">
        {t('order.title')}
      </Text>
      {property ? (
        <Text size="sm" color="textMuted">
          {t('order.subtitle', { property })}
        </Text>
      ) : null}
    </View>
  );
}

function OutletCard({ outlet, t }: { outlet: OrderableOutlet; t: Translate }) {
  const { c, space, radius } = useTheme();
  return (
    <Card variant="tint">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surface1,
          }}
        >
          <Icon name="bell" size={20} color={c.action} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text weight="semibold" size="md" color="textStrong" numberOfLines={1}>
            {outlet.name}
          </Text>
          {outlet.operatorLabel ? (
            <Text size="xs" color="textMuted" numberOfLines={1}>
              {outlet.operatorLabel}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row' }}>
            <Badge tone="brand" dot>
              {t('order.chargeToRoom')}
            </Badge>
          </View>
        </View>
      </View>
    </Card>
  );
}

function MenuRow({
  item,
  quantity,
  divider,
  onChange,
  t,
}: {
  item: OrderableItem;
  quantity: number;
  divider: boolean;
  onChange: (quantity: number) => void;
  t: Translate;
}) {
  const { c, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingVertical: space[3],
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: c.borderSubtle,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {item.name}
        </Text>
        {item.description ? (
          <Text size="sm" color="textMuted" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <MoneyAmount value={item.priceRwf} size="sm" />
          {item.prepTimeMinutes ? (
            <Text size="xs" color="textMuted">
              {t('order.prepTime', { minutes: item.prepTimeMinutes })}
            </Text>
          ) : null}
        </View>
      </View>
      <Quantity item={item} quantity={quantity} onChange={onChange} t={t} />
    </View>
  );
}

/**
 * Minus, count, plus. The count is announced with the item, so a screen reader
 * user hears "2 in your order" rather than a bare number after a button.
 */
function Quantity({
  item,
  quantity,
  onChange,
  t,
}: {
  item: OrderableItem;
  quantity: number;
  onChange: (quantity: number) => void;
  t: Translate;
}) {
  const { c, space } = useTheme();
  const step = (name: 'plus' | 'minus', label: string, next: number, disabled: boolean) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic
      onPress={() => onChange(next)}
      // Drawn at 36; the slop carries the target to the 44pt floor (GK-24).
      hitSlop={4}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: name === 'plus' ? c.action : c.surface2,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon name={name} size={18} color={name === 'plus' ? c.bgApp : c.textStrong} />
    </PressableScale>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      {quantity > 0 ? (
        <>
          {step('minus', t('order.removeOne', { item: item.name }), quantity - 1, false)}
          <Text
            weight="semibold"
            size="md"
            color="textStrong"
            accessibilityLabel={t('order.inCart', { count: quantity })}
            style={{ minWidth: 20, textAlign: 'center' }}
          >
            {String(quantity)}
          </Text>
        </>
      ) : null}
      {step('plus', t('order.addOne', { item: item.name }), quantity + 1, quantity >= MAX_QUANTITY)}
    </View>
  );
}
