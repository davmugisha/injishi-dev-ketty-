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

/**
 * Staff-role lens — which of the staff roles this console is labelled with.
 *
 * IT NO LONGER PREVIEWS A ROLE (ADR-053, ruled 2026-09-13). The sidebar reads the
 * `permissions[]` the server resolved for this account, and a preview of another
 * role would mean turning that role into powers in the browser, a second copy of
 * the staff matrix that contract rule 3 forbids. A true preview needs the server
 * to answer for a role, which does not exist.
 */
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
          The sidebar always shows the sections your own permissions reach. Choosing a lens
          changes the label, not what you can open.
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
                  // A label, not a preview and not an access control. The sidebar
                  // and each section's refusal follow this account's own
                  // permissions whatever the lens says (ADR-053), and the API
                  // refuses by permission on its own. Saying so here keeps a
                  // staffer from believing they are seeing a colleague's view.
                  toast(`Labelled ${role.label}. The sidebar still shows what your own account can open.`);
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
