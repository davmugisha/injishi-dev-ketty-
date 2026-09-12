"use client";

import { Button, NativeDialog } from "@injishi/ui";
import { LifeBuoy, Shield, ShieldCheck, Wallet } from "lucide-react";
import { STAFF_ROLES } from "@/lib/nav";
import { useAdminUi } from "@/lib/store";

const ROLE_ICONS = {
  shield: Shield,
  "life-buoy": LifeBuoy,
  "shield-check": ShieldCheck,
  wallet: Wallet,
} as const;

/** Staff-role lens — previews what route guards hide from each role. */
export function RoleLensDialog() {
  const open = useAdminUi((s) => s.roleLensOpen);
  const close = useAdminUi((s) => s.closeRoleLens);
  const setRoleLens = useAdminUi((s) => s.setRoleLens);
  const toast = useAdminUi((s) => s.toast);

  return (
    <NativeDialog open={open} onClose={close} ariaLabel="Switch staff-role lens">
      <div className="p-6">
        <h2 className="font-display text-2xl font-bold">Staff-role lens</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Route guards hide what a role cannot reach — a Support staffer cannot see the Finance
          override screen at all. Preview each lens.
        </p>
        <div className="mt-5 space-y-2">
          {STAFF_ROLES.map((role) => {
            const Icon = ROLE_ICONS[role.icon];
            return (
              <Button variant="primary"
                key={role.key}
               
                className="flex w-full items-center gap-3 rounded border border-border p-3.5 text-left hover:bg-muted"
                onClick={() => {
                  setRoleLens(role.key, `${role.label} · 2FA on`);
                  close();
                  // A preview of the sidebar, not an access control. There is no
                  // per-section route guard in this console: a hidden section
                  // still renders when its url is typed, and the API refuses
                  // the reads behind it by permission. The old wording said
                  // "hidden by route guards", which described a control that
                  // does not exist — and a staffer testing what a colleague
                  // can reach would have trusted it.
                  toast(`Previewing ${role.label} — sections this role cannot use are hidden from the sidebar only`);
                }}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-card font-display font-bold ${role.swatch}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="grow">
                  <span className="block text-sm font-semibold">{role.label}</span>
                  <span className="block text-xs text-muted-foreground">{role.detail}</span>
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </NativeDialog>
  );
}
