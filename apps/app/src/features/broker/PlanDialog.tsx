"use client";

import { Modal } from "@heroui/react";
import type { BrokerPlanOverview } from "@injishi/contracts";
import { Icon } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type PlanSection, PlanView } from "./PlanView";

/**
 * Cursor-style plan settings: wide dialog with a left tab rail (Plans · Payments · Home district).
 * Opened from Account (`?plan=1`) so the plan is not a separate sidebar page.
 */
export function PlanDialog({
  data,
  openPaymentId,
  open,
}: {
  data: BrokerPlanOverview;
  openPaymentId: string | null;
  open: boolean;
}) {
  const router = useRouter();
  const [section, setSection] = useState<PlanSection>(openPaymentId ? "payments" : "plan");

  const close = () => {
    router.replace("/account");
  };

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(next) => !next && close()}>
      <Modal.Container size="cover" className="w-[min(960px,94vw)]">
        <Modal.Dialog className="flex max-h-[90dvh] flex-col overflow-hidden p-0" aria-labelledby="broker-plan-h">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Icon name="CreditCard" className="text-muted" />
              <Modal.Heading id="broker-plan-h" className="text-lg font-semibold">
                Plan & billing
              </Modal.Heading>
            </div>
            <Modal.CloseTrigger />
          </div>
          <div className="grid min-h-0 flex-1 md:grid-cols-[13rem_1fr]">
            <nav
              aria-label="Plan sections"
              className="flex gap-1 overflow-x-auto border-b border-border bg-surface-secondary/40 p-3 md:flex-col md:overflow-visible md:border-b-0 md:border-r"
            >
              {(
                [
                  { id: "plan" as const, label: "Plans", icon: "CreditCard" as const },
                  { id: "payments" as const, label: "Payments", icon: "Wallet" as const },
                  { id: "district" as const, label: "Home district", icon: "MapPin" as const },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={
                    section === item.id
                      ? "flex items-center gap-2 rounded-full bg-accent/15 px-3 py-2.5 text-left text-sm font-medium text-accent"
                      : "flex items-center gap-2 rounded-full px-3 py-2.5 text-left text-sm text-muted hover:bg-default hover:text-foreground"
                  }
                >
                  <Icon name={item.icon} />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="min-h-0 overflow-y-auto p-4 md:p-6">
              <PlanView data={data} openPaymentId={openPaymentId} embedded section={section} />
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
