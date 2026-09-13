/** A placed order and when its receipt comes (ADR-050 slice 1). */
import { useLocalSearchParams } from 'expo-router';
import { OrderPlaced } from '@/screens/guest/order-placed';

export default function OrderPlacedRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return <OrderPlaced orderId={orderId} />;
}
