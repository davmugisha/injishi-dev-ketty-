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
 * Staff-role lens — previews what each role can reach.
 *
 * The sentence this used to carry ("previews what route guards hide") was
 * true of the words and not of the code: nothing refused a typed URL. It is
 * true now (ADR-049 AC-25, `section-boundary.tsx`), and the lens previews the
 * SIDEBAR rather than the guard — the guard reads the permissions the server
 * resolved for the real account, because a lens is a way of looking, never an
 * identity.
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
          Each role reaches its own sections — a Support staffer cannot open Finance at all.
          Preview what each one sees. Your own access does not change.
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
                  // A preview of the sidebar, not an access control. The
                  // per-section route guard exists now (ADR-049 AC-25), but it
                  // reads the permissions the server resolved for the REAL
                  // account, never this lens — so a Super Admin previewing
                  // Support can still type /finance and open it. The toast says
                  // so, because a staffer testing what a colleague can reach
                  // would otherwise trust the preview as the guard.
                  toast(`Previewing ${role.label} — hidden from the sidebar only. Your own access is unchanged`);
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
