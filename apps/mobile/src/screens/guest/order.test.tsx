/**
 * Guest ordering on the phone (ADR-050 slice 1).
 *
 * The network is mocked at the query layer, where `landlord.test.tsx` mocks it:
 * `fetchOrderable` and `placeOrder` stand where the API is, and the cart helpers
 * stay real. What these pin is the part the phone owns: every screen state is
 * drawn, the cart sends exactly what was picked, a retry of the SAME cart
 * reuses its `Idempotency-Key` (a fresh key per press is a double order), a
 * refusal shows the server's own sentence, and the placed order says when the
 * official receipt comes instead of printing one.
 */
import { type ReactNode } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { GuestOrder, OrderableList } from '@injishi/contracts';

import { ToastProvider } from '@/components';
import { renderInScheme, SCHEMES } from '@/test-utils';
import { meKeys } from '@/lib/query-keys';
import { OrderScreen } from './order';
import { OrderPlaced } from './order-placed';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: jest.fn(),
    canDismiss: () => false,
    dismiss: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

const mockFetchOrderable = jest.fn<Promise<OrderableList>, []>();
const mockPlaceOrder = jest.fn();
jest.mock('@/queries/ordering', () => {
  const actual = jest.requireActual('@/queries/ordering');
  const { useQuery } = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    // The real hook waits on a signed-in session; the screen is what is tested.
    useOrderable: () => useQuery({ queryKey: ['me', 'orderable'], queryFn: () => mockFetchOrderable() }),
    placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
  };
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const MENU: OrderableList = {
  outlets: [
    {
      id: 'o0000000-0000-4000-8000-000000000001',
      name: 'Lobby cafe',
      outletKind: 'restaurant',
      propertyId: 'p0000000-0000-4000-8000-000000000001',
      propertyName: 'Umurage Hotel',
      orderingAccess: 'in_house_only',
      hours: null,
      chargeToRoom: true,
      payNow: false,
      distanceKm: null,
      operatorLabel: null,
      categories: [
        {
          id: 'c0000000-0000-4000-8000-000000000001',
          name: 'Drinks',
          items: [
            { id: 'i0000000-0000-4000-8000-000000000001', name: 'Coffee', description: 'Rwandan single origin', priceRwf: 2000, prepTimeMinutes: 5, options: [] },
          ],
        },
      ],
    },
  ],
};

const PLACED: GuestOrder = {
  id: 'r0000000-0000-4000-8000-000000000001',
  orderNumber: 'SO-7K2M',
  status: 'submitted',
  outletId: MENU.outlets[0]!.id,
  outletName: 'Lobby cafe',
  propertyName: 'Umurage Hotel',
  context: 'in_house_folio',
  lines: [{ name: 'Coffee', quantity: 2, unitPriceRwf: 2000, lineTotalRwf: 4000, selectedOptions: [] }],
  subtotalRwf: 4000,
  taxRwf: 720,
  totalRwf: 4720,
  paidAt: null,
  paymentMethod: null,
  cancellable: true,
  createdAt: '2026-09-12T10:00:00.000Z',
};

const withToast = (ui: ReactNode) => <ToastProvider>{ui}</ToastProvider>;

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockFetchOrderable.mockReset();
  mockPlaceOrder.mockReset();
});

describe.each(SCHEMES)('OrderScreen (%s)', (scheme) => {
  it('lists what the server says is orderable, charged to the room', async () => {
    mockFetchOrderable.mockResolvedValue(MENU);
    renderInScheme(withToast(<OrderScreen />), scheme);

    expect(await screen.findByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Lobby cafe')).toBeTruthy();
    expect(screen.getByText('Charged to your room')).toBeTruthy();
    // Nothing picked, nothing to place.
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
  });

  it('says plainly when there is nothing to order', async () => {
    mockFetchOrderable.mockResolvedValue({ outlets: [] });
    renderInScheme(withToast(<OrderScreen />), scheme);

    expect(await screen.findByText('Nothing to order right now')).toBeTruthy();
  });
});

describe('placing an order', () => {
  it('sends exactly the cart, with a UUID key, and opens the placed order', async () => {
    mockFetchOrderable.mockResolvedValue(MENU);
    mockPlaceOrder.mockResolvedValue({ status: 'ok', data: PLACED });
    renderInScheme(withToast(<OrderScreen />), 'light');

    fireEvent.press(await screen.findByRole('button', { name: 'One more Coffee' }));
    fireEvent.press(screen.getByRole('button', { name: 'One more Coffee' }));
    expect(screen.getByText('2 items')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    const [body, key] = mockPlaceOrder.mock.calls[0]!;
    expect(body).toEqual({
      outletId: MENU.outlets[0]!.id,
      context: 'in_house_folio',
      items: [{ serviceItemId: MENU.outlets[0]!.categories[0]!.items[0]!.id, quantity: 2 }],
    });
    expect(key).toMatch(UUID);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/order-placed', params: { orderId: PLACED.id } });
  });

  it('reuses the key when the same cart is retried, so a timeout is not a second order', async () => {
    mockFetchOrderable.mockResolvedValue(MENU);
    mockPlaceOrder
      .mockResolvedValueOnce({ status: 'failed' })
      .mockResolvedValueOnce({ status: 'ok', data: PLACED });
    renderInScheme(withToast(<OrderScreen />), 'light');

    fireEvent.press(await screen.findByRole('button', { name: 'One more Coffee' }));
    fireEvent.press(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(mockPlaceOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Place order' })).not.toBeDisabled());

    fireEvent.press(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(mockPlaceOrder).toHaveBeenCalledTimes(2));
    expect(mockPlaceOrder.mock.calls[1]![1]).toBe(mockPlaceOrder.mock.calls[0]![1]);
  });

  it("shows the server's own sentence when it refuses", async () => {
    mockFetchOrderable.mockResolvedValue(MENU);
    mockPlaceOrder.mockResolvedValue({
      status: 'refused',
      httpStatus: 409,
      message: 'Lobby cafe is closed right now.',
    });
    renderInScheme(withToast(<OrderScreen />), 'light');

    fireEvent.press(await screen.findByRole('button', { name: 'One more Coffee' }));
    fireEvent.press(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByText('Lobby cafe is closed right now.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe.each(SCHEMES)('OrderPlaced (%s)', (scheme) => {
  function Seeded({ children }: { children: ReactNode }) {
    useQueryClient().setQueryData(meKeys.order(PLACED.id), PLACED);
    return <>{children}</>;
  }

  it('shows the order as the server priced it, and when the official receipt comes', () => {
    renderInScheme(
      <Seeded>
        <OrderPlaced orderId={PLACED.id} />
      </Seeded>,
      scheme,
    );

    expect(screen.getByText('Order placed')).toBeTruthy();
    expect(screen.getByText('SO-7K2M')).toBeTruthy();
    expect(screen.getByText('2 × Coffee')).toBeTruthy();
    expect(screen.getByText('Sent')).toBeTruthy();
    // No fiscal document is shown before the VSDC has answered (D-b).
    expect(screen.getByText(/official RRA receipt is issued when you check out/)).toBeTruthy();
  });

  it('says the order was placed, rather than inventing it, when opened cold', () => {
    renderInScheme(<OrderPlaced orderId="r0000000-0000-4000-8000-00000000ffff" />, scheme);
    expect(screen.getByText('Your order was placed')).toBeTruthy();
  });
});
