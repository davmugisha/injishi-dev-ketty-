/**
 * Guest ordering copy (ADR-050 slice 1): the order screen and the placed order.
 *
 * English only. The `rw` catalogue is derived, each message marked `(RW)`, the
 * way `pay.ts` does it: v1.0 ships no Kinyarwanda, and the catalogue test still
 * needs every key present with its placeholders intact. Keep messages length
 * tolerant, because the real translation will be longer.
 */
export const en = {
  'order.title': 'Order to your room',
  'order.subtitle': 'Food and drinks from {property}, charged to your room.',
  'order.listLabel': 'outlets',
  'order.emptyTitle': 'Nothing to order right now',
  'order.emptyBody':
    'Ordering opens while you are staying at a property. Outlets that are closed or sold out are not shown.',
  'order.chargeToRoom': 'Charged to your room',
  'order.prepTime': 'About {minutes} min',
  'order.addOne': 'One more {item}',
  'order.removeOne': 'One fewer {item}',
  'order.inCart': '{count} in your order',
  'order.cartOne': '1 item',
  'order.cartMany': '{count} items',
  'order.beforeTax': 'Before tax. The total is confirmed when you place the order.',
  'order.place': 'Place order',
  'order.placing': 'Placing your order',
  'order.placeHint': 'Sends the order to {outlet} and charges it to your room.',
  'order.failed': 'The order did not go through, and nothing was charged. Please try again.',
  'order.pickOutlet': 'Where from',

  'order.placedTitle': 'Order placed',
  'order.placedBody': '{outlet} has your order. It is added to your bill when it reaches you.',
  'order.number': 'Order number',
  'order.status': 'Status',
  'order.subtotal': 'Subtotal',
  'order.tax': 'Tax',
  'order.total': 'Total charged to your room',
  'order.lineQty': '{count} × {item}',
  'order.receiptTitle': 'Your receipt',
  'order.receiptNote':
    'Your official RRA receipt is issued when you check out and your bill is closed. It covers everything charged to your room, and it is sent to you once it is certified.',
  'order.done': 'Done',
  'order.orderMore': 'Order something else',
  'order.missingTitle': 'Your order was placed',
  'order.missingBody': 'Its details are on your bill. Ask the front desk if you need them now.',

  'status.order.submitted': 'Sent',
  'status.order.acknowledged': 'Received',
  'status.order.in_progress': 'Being prepared',
  'status.order.ready': 'Ready',
  'status.order.delivered': 'Delivered',
  'status.order.completed': 'Completed',
  'status.order.cancelled': 'Cancelled',
  'status.order.rejected': 'Declined',
};

export const rw: Record<keyof typeof en, string> = Object.fromEntries(
  Object.entries(en).map(([key, message]) => [key, `${message} (RW)`]),
) as Record<keyof typeof en, string>;
