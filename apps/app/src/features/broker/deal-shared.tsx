import type { BrokerDealStatus } from "@injishi/contracts";
import { StatusChip, type StatusTone } from "@injishi/ui";

/** A deal's status in the words both sides read: the broker's Hotels page and the hotel's Brokers page. */
const DEAL: Record<BrokerDealStatus, { tone: StatusTone; label: string }> = {
  proposed: { tone: "warning", label: "Waiting for an answer" },
  active: { tone: "success", label: "Running" },
  declined: { tone: "default", label: "Declined" },
  withdrawn: { tone: "default", label: "Withdrawn" },
  ended: { tone: "default", label: "Ended" },
};

export function DealChip({ status }: { status: BrokerDealStatus }) {
  const s = DEAL[status];
  return <StatusChip tone={s.tone}>{s.label}</StatusChip>;
}
