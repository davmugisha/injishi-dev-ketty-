"use client";

import { Badge, Button, NativeDialog } from "@injishi/ui";
import { BadgeCheck, Wallet, Zap } from "lucide-react";
import { useAdminUi } from "@/lib/store";
import { notBuilt } from "@/lib/not-built";

/** Money override — dual authorization; one staffer never initiates AND approves. */
export function OverrideDialog() {
  const open = useAdminUi((s) => s.overrideOpen);
  const close = useAdminUi((s) => s.closeOverride);
  const toast = useAdminUi((s) => s.toast);

  return (
    <NativeDialog open={open} onClose={close} ariaLabel="Money override — second signature">
      <div className="p-7">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Wallet className="h-6 w-6 text-accent-text" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">Money override — second signature</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One staffer cannot both initiate and approve. Signing executes the action and writes both
          the money audit trail and the ledger.
        </p>
        <dl className="mt-4 space-y-2 rounded-card bg-card p-4 text-sm text-card-foreground">
          <div className="flex justify-between gap-2">
            <dt className="text-card-foreground/70">Action</dt>
            <dd className="font-semibold">Re-target stuck payout</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-card-foreground/70">Payout</dt>
            <dd className="money font-semibold">#P-0871 · RWF 245,000</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-card-foreground/70">Initiated by</dt>
            <dd className="font-semibold">Chantal M. (Finance)</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-card-foreground/70">Reason</dt>
            <dd className="max-w-[28ch] text-right">
              Host payout account was missing; owner added MoMo account, re-targeting
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-card-foreground/70">Adapter</dt>
            <dd>
              <Badge variant="warning">

                <Zap className="size-3" aria-hidden />

                mock

              </Badge>
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex gap-2">
          <Button variant="primary"
           
            className="grow"
            onClick={() => {
              close();
              toast(notBuilt("Executing a money override"));
            }}
          >
            <BadgeCheck className="h-4 w-4" aria-hidden /> Sign as second admin
          </Button>
          <Button variant="outline" className="grow" onClick={close}>
            Decline
          </Button>
        </div>
      </div>
    </NativeDialog>
  );
}
