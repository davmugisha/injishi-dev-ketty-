/**
 * StatusBadge and PaymentStatus — the two components that turn a state string
 * into something a person can read.
 *
 * They are worth testing together because they carry the same risk: a state the
 * map does not know about. A badge that renders blank hides the state, which is
 * the exact failure these exist to prevent, so the fallback is asserted rather
 * than assumed. The tone-to-colour mapping is asserted too, because "overdue is
 * red" is a product rule from the §9.3 status-semantics table, not styling.
 */
import { screen } from '@testing-library/react-native';
import { StatusBadge } from './status-badge';
import { PaymentStatus } from './payment-status';
import { SCHEMES, enclosingFill, paletteFor, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';

/** The pill's fill, which is the tone made visible. */
const fillOf = (label: string) => enclosingFill(screen.getByText(label));

describe.each(SCHEMES)('StatusBadge in the %s scheme', (scheme) => {
  const c = paletteFor(scheme);

  it.each([
    ['lease', 'active', en['status.lease.active'], c.success100],
    ['lease', 'pending_signature', en['status.lease.pending_signature'], c.warning100],
    ['lease', 'cancelled', en['status.lease.cancelled'], c.danger100],
    ['rent', 'overdue', en['status.rent.overdue'], c.danger100],
    ['rent', 'paid', en['status.rent.paid'], c.success100],
    // The brand and neutral fills are ADR-064 AC-10's roles; the retiring
    // `brand100` and `neutral100` they replaced are no longer read.
    ['booking', 'confirmed', en['status.booking.confirmed'], c.surface2],
  ] as const)('renders %s/%s as "%s" in its tone (fills per ADR-064 AC-10)', (domain, state, label, fill) => {
    renderInScheme(<StatusBadge domain={domain} state={state} />, scheme);
    expect(screen.getByText(label)).toBeTruthy();
    expect(fillOf(label)).toBe(fill);
  });

  it('falls back to the state name, on the neutral fill (ADR-064 AC-10), for a state the map does not know', () => {
    // A blank badge would hide the state entirely, which is worse than showing
    // a raw name that a reviewer can spot.
    renderInScheme(<StatusBadge domain="lease" state="repossessed" />, scheme);
    expect(screen.getByText('repossessed')).toBeTruthy();
    expect(fillOf('repossessed')).toBe(c.surface3);
  });

  it('takes an explicit label over the mapped one', () => {
    renderInScheme(<StatusBadge domain="lease" state="active" label="Running" />, scheme);
    expect(screen.getByText('Running')).toBeTruthy();
  });

  it('reads the active catalogue, so a badge is translated too', () => {
    renderInScheme(<StatusBadge domain="lease" state="active" />, scheme, { locale: 'rw' });
    expect(screen.getByText(rw['status.lease.active'])).toBeTruthy();
  });
});

describe.each(SCHEMES)('PaymentStatus in the %s scheme', (scheme) => {
  const c = paletteFor(scheme);

  it.each([
    ['paid', en['payment.paid'], c.success100],
    ['due', en['payment.due'], c.warning100],
    ['overdue', en['payment.overdue'], c.danger100],
    ['refunded', en['payment.refunded'], c.surface3],
  ] as const)('renders %s as "%s" in its tone (fills per ADR-064 AC-10)', (status, label, fill) => {
    renderInScheme(<PaymentStatus status={status} />, scheme);
    expect(screen.getByText(label)).toBeTruthy();
    expect(fillOf(label)).toBe(fill);
  });

  it('falls back to pending for a status the map does not know', () => {
    // Unlike StatusBadge this one has a sensible default, because a payment
    // with an unrecognised state has not been shown to have settled.
    renderInScheme(<PaymentStatus status="in_arbitration" />, scheme);
    expect(screen.getByText(en['payment.pending'])).toBeTruthy();
  });

  it('defaults to pending when given no status at all', () => {
    renderInScheme(<PaymentStatus />, scheme);
    expect(screen.getByText(en['payment.pending'])).toBeTruthy();
  });
});
