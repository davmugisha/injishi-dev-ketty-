import type { OrderableOutlet } from '@injishi/contracts';

import { cartSummary, orderRequest, setQuantity, MAX_QUANTITY } from './ordering';

/**
 * The cart is the only arithmetic the phone does before an order exists, so it
 * is pinned here without a React tree. Everything after placing is the
 * server's own locked snapshot and is not recomputed anywhere (AC-23).
 */
describe('the guest cart', () => {
  const outlet: OrderableOutlet = {
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
          { id: 'coffee', name: 'Coffee', description: null, priceRwf: 2000, prepTimeMinutes: 5, options: [] },
          { id: 'tea', name: 'Tea', description: null, priceRwf: 1500, prepTimeMinutes: null, options: [] },
        ],
      },
    ],
  };

  it('adds, changes and removes a line', () => {
    let cart = setQuantity({}, 'coffee', 2);
    expect(cart).toEqual({ coffee: 2 });
    cart = setQuantity(cart, 'coffee', 0);
    expect(cart).toEqual({});
  });

  it('keeps a quantity inside what the API accepts', () => {
    expect(setQuantity({}, 'coffee', 999)).toEqual({ coffee: MAX_QUANTITY });
    expect(setQuantity({ coffee: 1 }, 'coffee', -3)).toEqual({});
  });

  it('prices the cart from the menu, tax exclusive', () => {
    expect(cartSummary({ coffee: 2, tea: 1 }, outlet)).toEqual({ count: 3, subtotalRwf: 5500 });
  });

  it('leaves out an item that is no longer on the menu rather than pricing it from memory', () => {
    expect(cartSummary({ coffee: 1, gone: 4 }, outlet)).toEqual({ count: 1, subtotalRwf: 2000 });
    expect(orderRequest({ coffee: 1, gone: 4 }, outlet).items).toEqual([
      { serviceItemId: 'coffee', quantity: 1 },
    ]);
  });

  it('charges the order to the room, and sends a note only when there is one', () => {
    expect(orderRequest({ tea: 1 }, outlet, '   ')).toEqual({
      outletId: outlet.id,
      context: 'in_house_folio',
      items: [{ serviceItemId: 'tea', quantity: 1 }],
    });
    expect(orderRequest({ tea: 1 }, outlet, ' no sugar ').guestNote).toBe('no sugar');
  });
});
