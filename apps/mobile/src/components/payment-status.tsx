/**
 * PaymentStatus — canonical mapping of payment lifecycle to a Badge, so
 * "paid / due / overdue" look identical everywhere. Port of the DS component.
 */
import { Badge, type Tone } from './badge';
import { useT, type MessageKey } from '@/i18n/i18n';

const MAP: Record<string, { tone: Tone; label: MessageKey; dot: boolean }> = {
  paid: { tone: 'success', label: 'payment.paid', dot: true },
  cleared: { tone: 'success', label: 'payment.cleared', dot: true },
  scheduled: { tone: 'brand', label: 'payment.scheduled', dot: true },
  pending: { tone: 'warning', label: 'payment.pending', dot: true },
  due: { tone: 'warning', label: 'payment.due', dot: true },
  overdue: { tone: 'danger', label: 'payment.overdue', dot: true },
  failed: { tone: 'danger', label: 'payment.failed', dot: true },
  refunded: { tone: 'neutral', label: 'payment.refunded', dot: false },
  partial: { tone: 'warning', label: 'payment.partial', dot: true },
};

export function PaymentStatus({ status = 'pending', label }: { status?: string; label?: string }) {
  const t = useT();
  const cfg = MAP[status] ?? MAP.pending;
  return (
    <Badge tone={cfg.tone} dot={cfg.dot}>
      {label ?? t(cfg.label)}
    </Badge>
  );
}
