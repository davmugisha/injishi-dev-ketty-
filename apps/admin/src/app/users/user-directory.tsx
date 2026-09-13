"use client";

import { Input } from "@heroui/react";
import type { District, GovernmentBody, Province } from "@injishi/contracts";
import { Badge, Button, Checkbox, NativeDialog } from "@injishi/ui";
import { Landmark, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useStaffPermissions } from "@/components/shell/staff-access-provider";
import { revokeAppointment } from "@/lib/actions/oversight";
import { revokeUserSessions } from "@/lib/actions/users";
import { ReasonDialog } from "@/lib/actions/reason-dialog";
import { useAdminUi, useStubAction } from "@/lib/store";
import { EMPTY } from "@/lib/present/format";
import type { BadgeIntent, GlobalRole, OrgMembership, StaffRole, UserRow } from "@/lib/types";
import { notBuilt } from "@/lib/not-built";

import { AppointOfficerDialog } from "./appoint-officer-dialog";

/* ---- Presentation maps for the layered identity model (F-S01) ---- */

const GLOBAL_ROLE_INTENT: Record<GlobalRole, BadgeIntent> = {
  guest: "default",
  broker: "accent",
  gov_oversight: "warning",
  admin: "danger",
};

/** Host = hospitality owner, Landlord = residence owner; manager/receptionist = Staff. */
function membershipLabel(m: OrgMembership): string {
  if (m.orgRole === "owner") return m.domain === "hospitality" ? "Host" : "Landlord";
  return "Staff";
}

/**
 * The staff roles this editor can grant.
 *
 * `trainer` (ADR-049) is the narrowest of them: four `training.*` powers and no
 * `admin.*` power at all, so somebody holding only this role can reach the
 * Training section and nothing else in the console. The label says so, because
 * "Trainer" alone reads like a seniority rather than a scope.
 *
 * ADDING A ROLE TO `StaffRole` MAKES THIS LIST FAIL TO COMPILE, by design: the
 * two `Record<StaffRole, boolean>` states below are keyed on the full union, so
 * a sixth role cannot be added to the contract without this screen learning
 * about it. That is how `trainer` was caught here rather than shipping a grant
 * editor that could not grant it.
 */
const STAFF_ROLE_OPTIONS: { key: StaffRole; label: string }[] = [
  { key: "super_admin", label: "Super Admin" },
  { key: "ops", label: "Ops / Support" },
  { key: "compliance", label: "Compliance" },
  { key: "finance", label: "Finance" },
  { key: "trainer", label: "Trainer (training only)" },
];

/**
 * Global roles this editor still stages — guest is the implicit default and is
 * never granted, and `gov_oversight` is not a checkbox any more: a person becomes
 * an officer through an appointment (`AppointOfficerDialog`), which is real.
 */
type GrantRole = Exclude<GlobalRole, "guest" | "gov_oversight">;

/**
 * One directory row: the presented person, plus the identifiers the API already
 * masked.
 *
 * `phoneMasked` and `nationalIdMasked` ride ALONGSIDE the view type rather than
 * inside it. They are raw facts, redacted server side exactly as
 * `/api/v1/me/profile` redacts them, and rendering one verbatim is not a
 * presentation decision — which is why `presentUserRow` deliberately carries
 * neither. There is no unmasked variant in this console and there must not be
 * one: the platform lists people, it does not export their documents.
 */
export interface UserDirectoryRow {
  id: string;
  row: UserRow;
  phoneMasked: string | null;
  nationalIdMasked: string | null;
}

/**
 * Directory keyed on the single identity.
 *
 * A CLIENT COMPONENT for the grant editor, which is a form, and for the search
 * box. The people themselves are read on the server behind a stated reason, and
 * the read is already in the record-access log by the time this renders.
 *
 * THE "REVEAL" DIALOG IS GONE, and its removal is the point of this screen. It
 * asked for a reason and then printed a full national ID that the fixture had
 * invented. The API masks that number in every response and offers no unmasked
 * route, so there is nothing left to reveal — the masked value is simply shown,
 * and the reason for reading the directory at all was stated by the page before
 * the request went out.
 *
 * THE SEARCH IS OVER THE LOADED PAGE, not the platform. `GET /admin/users`
 * accepts a `q` and filters server side; wiring this box to the URL so it does
 * is its own change, and until then the count line says what is on screen so
 * nobody reads an empty filter as "no such person".
 */
export function UserDirectory({
  rows,
  total,
  searched,
  bodies,
  provinces,
  districts,
}: {
  rows: UserDirectoryRow[];
  total: number;
  /** The platform-side search this page was read with (`?q=`), or empty. */
  searched: string;
  bodies: GovernmentBody[];
  provinces: Province[];
  districts: District[];
}) {
  const toast = useAdminUi((s) => s.toast);
  const stubAction = useStubAction();
  const router = useRouter();
  const permissions = useStaffPermissions();
  const mayAppoint = permissions.includes("admin.user.role.grant");
  const [query, setQuery] = useState(searched);

  // Officer appointments are real writes (ADR-053, AC-G1): the appointment dialog
  // posts one, and the revoke asks why, then deletes it. Both re-read the page so
  // the row shows what the platform now holds, not what was pressed.
  const [appointing, setAppointing] = useState<{ id: string; name: string } | null>(null);
  const [unappointing, setUnappointing] = useState<{ id: string; name: string; assignmentId: string } | null>(null);

  async function confirmUnappoint(reason: string): Promise<boolean> {
    if (!unappointing) return true;
    const out = await revokeAppointment(unappointing.id, unappointing.assignmentId, reason);
    toast(`${unappointing.name}: ${out.message}`, out.tone);
    if (out.ok) router.refresh();
    return out.ok || out.reason !== "bad_input";
  }

  // "Sign out all" is a real write now: it asks why, then calls
  // `POST /admin/users/:userId/revoke-sessions`. The toast is the platform's
  // answer — it used to announce "All sessions revoked" while every session
  // stayed live, which is the one lie a staffer containing a compromised
  // account can least afford to be told.
  const [revoking, setRevoking] = useState<{ id: string; name: string } | null>(null);

  async function confirmRevoke(reason: string): Promise<boolean> {
    if (!revoking) return true;
    const out = await revokeUserSessions(revoking.id, reason);
    toast(`${revoking.name}: ${out.message}`, out.tone);
    return out.ok || out.reason !== "bad_input";
  }

  // Grant editor state — scoped to the row the operator opened it from.
  const [roleOpen, setRoleOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);
  const [grants, setGrants] = useState<Record<GrantRole, boolean>>({
    broker: false,
    admin: false,
  });
  const [staffRoles, setStaffRoles] = useState<Record<StaffRole, boolean>>({
    super_admin: false,
    ops: false,
    compliance: false,
    finance: false,
    trainer: false,
  });

  function openEditor(user: UserRow) {
    setActiveUser(user);
    setGrants({
      broker: user.globalRoles.includes("broker"),
      admin: user.globalRoles.includes("admin"),
    });
    // Built from `STAFF_ROLE_OPTIONS` rather than listed by hand, so a role
    // added to the contract is picked up here the moment it is added to that
    // list. The hand-written version silently defaulted a new role to false for
    // a user who held it, which would have shown a granted role as ungranted.
    setStaffRoles(
      Object.fromEntries(
        STAFF_ROLE_OPTIONS.map((option) => [
          option.key,
          user.staffRoles?.includes(option.key) ?? false,
        ]),
      ) as Record<StaffRole, boolean>,
    );
    setRoleOpen(true);
  }

  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter(({ row }) => [row.name, row.email].some((v) => v.toLowerCase().includes(q)))
    : rows;

  return (
    <section className="mt-8" aria-label="User directory">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Directory — the single identity (F-S01)
        </h2>
        {/* Enter searches the PLATFORM (`?q=`, read again behind the page's stated
            reason); typing filters the people already loaded. A person on page
            twelve can be found, which appointing an officer depends on. */}
        <form
          className="flex items-center gap-2"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const q = query.trim();
            router.push(q ? `/users?q=${encodeURIComponent(q)}` : "/users");
          }}
        >
          <label className="sr-only" htmlFor="user-search">
            Search users
          </label>
          <Input
            id="user-search"
            className="w-full !w-64"
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          Nobody has signed up yet. The directory fills in from the first account
          — this is an empty platform, not a failed read.
        </div>
      ) : (
        <>
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[64rem] text-sm">
              <caption className="sr-only">User directory keyed on the single identity</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">User</th>
                  <th className="p-4">KYC</th>
                  <th className="p-4">National ID</th>
                  <th className="p-4">Roles &amp; grants</th>
                  <th className="p-4">Workspaces</th>
                  <th className="p-4">Joined</th>
                  <th className="sticky right-0 bg-field p-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(({ id, row, phoneMasked, nationalIdMasked }) => (
                  <tr key={id}>
                    <td className="p-4">
                      <span className="font-semibold">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.email}
                        {row.emailBadge && (
                          <>
                            {" · "}
                            <Badge variant={row.emailBadge.intent}>{row.emailBadge.text}</Badge>
                          </>
                        )}
                      </span>
                      <span className="money block text-xs text-muted-foreground">
                        {phoneMasked ?? EMPTY}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="flex flex-wrap items-center gap-1">
                        {row.kyc === "verified" && <Badge variant="success">KYC verified</Badge>}
                        {row.kyc === "pending" && <Badge variant="warning">KYC pending</Badge>}
                        {row.kyc === "none" && <Badge variant="default">OTP-only</Badge>}
                      </span>
                    </td>
                    <td className="money p-4 text-xs">{nationalIdMasked ?? EMPTY}</td>
                    <td className="p-4">
                      <span className="flex flex-wrap items-center gap-1">
                        {/* Global identity grants (guest is the implicit default). */}
                        {row.globalRoles.map((role) => (
                          <Badge key={role} variant={GLOBAL_ROLE_INTENT[role]}>
                            {role}
                          </Badge>
                        ))}
                        {/* Platform staff roles (admin_users.staff_roles[]). */}
                        {row.staffRoles?.map((sr) => (
                          <Badge key={sr} variant="danger">
                            staff:{sr}
                          </Badge>
                        ))}
                        {/* Government oversight assignment (function · body · title). */}
                        {row.oversight && (
                          <Badge variant="warning">
                            {row.oversight.role} · {row.oversight.bodyCode} · “
                            {row.oversight.title}”
                            {row.oversight.scopeLabel
                              ? ` · ${row.oversight.scopeLabel}`
                              : " · country"}
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="p-4">
                      {row.memberships.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Personal only</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1">
                          {row.memberships.map((m) => (
                            <Badge key={m.org} variant={m.payoutLocked ? "warning" : "accent"}>
                              {membershipLabel(m)} · {m.orgRole}
                              {m.payoutLocked ? " · payout locked (OBO)" : ""}
                            </Badge>
                          ))}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {row.workspaces}
                      </span>
                    </td>
                    <td className="money p-4 text-xs">{row.joined}</td>
                    <td className="sticky right-0 bg-field p-4">
                      {/* Stacked and pinned to the scroller's right edge, so a person's
                          actions stay in view however wide the other columns are. */}
                      <div className="flex flex-col items-end gap-1">
                      {row.actions.includes("roles") && (
                        <Button variant="ghost" size="sm" onClick={() => openEditor(row)}>
                          Roles…
                        </Button>
                      )}
                      {mayAppoint && (
                        <Button variant="ghost" size="sm" onClick={() => setAppointing({ id, name: row.name || row.email })}>
                          Appoint officer…
                        </Button>
                      )}
                      {mayAppoint && row.oversight && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setUnappointing({ id, name: row.name || row.email, assignmentId: row.oversight!.id })
                          }
                        >
                          Revoke appointment…
                        </Button>
                      )}
                      {row.actions.includes("signout") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevoking({ id, name: row.name || row.email })}
                        >
                          Sign out all
                        </Button>
                      )}
                      {row.actions.includes("assist-2fa") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={stubAction(
                            "Assist 2FA reset — Super-Admin-assisted, dual-authorized, logged",
                          )}
                        >
                          Assist 2FA
                        </Button>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                      Nobody on this page matches “{query}”. The search covers the{" "}
                      {rows.length} people loaded, not all {total}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {visible.length} of {total} people.
          </p>
        </>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Phone and national ID arrive <span className="font-semibold">masked</span> and there is no
        route that unmasks them — staff confirm a number they were told, they do not read one they
        were not. Opening this screen wrote a record-access log entry naming you, the people listed
        and the stated reason. One login, one KYC&apos;d identity, many workspaces:{" "}
        <span className="money">guest</span> is the default — every user has it. Any elevation
        (Host/Landlord, staff, OBO, broker, government) requires a verified identity with an active
        document. A <span className="money">gov_oversight</span> grant is a console seat; its
        function, body, title and region live on the assignment and drive the oversight console,
        never this app.
      </p>

      <ReasonDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={confirmRevoke}
        tone="danger"
        title={`End every session ${revoking?.name ?? "this person"} holds?`}
        confirmLabel="End all sessions"
        pendingLabel="Ending their sessions…"
        body={
          <p>
            Every device they are signed in on is refused from its next request, and they sign in
            again with an emailed code. Nothing else about the account changes. Your own account
            cannot be signed out from here — use sign-out for that.
          </p>
        }
      />

      <AppointOfficerDialog
        person={appointing}
        bodies={bodies}
        provinces={provinces}
        districts={districts}
        onClose={() => setAppointing(null)}
      />

      <ReasonDialog
        open={unappointing !== null}
        onClose={() => setUnappointing(null)}
        onConfirm={confirmUnappoint}
        tone="danger"
        title={`Revoke ${unappointing?.name ?? "this person"}'s appointment?`}
        confirmLabel="Revoke appointment"
        pendingLabel="Revoking the appointment…"
        body={
          <p>
            Their oversight console refuses them from the next request. Decisions they already
            took keep the body and title they held when they took them.
          </p>
        }
      />

      {/* Grant editor for the global roles and staff roles that still wait on a
          second signer (ADR-012), so it still says `notBuilt` on save. Officer
          appointments left this dialog for `AppointOfficerDialog`, which is real. */}
      <NativeDialog
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        ariaLabel="Edit roles and grants"
        className="max-w-narrow"
      >
        <form
          className="p-7"
          onSubmit={(e) => {
            e.preventDefault();
            setRoleOpen(false);
            if (grants.admin) {
              toast(notBuilt("Requesting an admin grant"));
            } else {
              toast(notBuilt("Updating a user's grants"));
            }
          }}
        >
          <h2 className="font-display text-2xl font-bold">
            Roles &amp; grants{activeUser ? ` — ${activeUser.name}` : ""}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One identity, many workspaces. Roles gate what each workspace can do. Every grant is
            attributed and audited.
          </p>

          {activeUser && activeUser.kyc !== "verified" && (
            <p className="mt-3 rounded-card bg-muted p-3 text-xs text-muted-foreground">
              <Shield className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              This identity is not KYC-verified. Any elevation below requires a verified identity
              with an active document first (Decision A) — the grant is staged until KYC passes.
            </p>
          )}

          {/* Business memberships are read-here (granted via org invitations). */}
          {activeUser && activeUser.memberships.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Business workspaces</p>
              <p className="text-xs text-muted-foreground">
                Owner = Host/Landlord; manager/receptionist = staff. Managed through org invitations,
                not here.
              </p>
              <span className="mt-2 flex flex-wrap gap-1">
                {activeUser.memberships.map((m) => (
                  <Badge key={m.org} variant={m.payoutLocked ? "warning" : "accent"}>
                    {m.org} · {membershipLabel(m)} · {m.orgRole}
                    {m.payoutLocked ? " · payout locked" : ""}
                  </Badge>
                ))}
              </span>
            </div>
          )}

          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">Global roles</legend>
            <p className="text-xs text-muted-foreground">
              <span className="money">guest</span> is always held (the default) — grant the rest.
            </p>
            <div className="mt-2 space-y-2">
              <Checkbox
                isSelected={grants.broker}
                onChange={(isSelected) => setGrants((g) => ({ ...g, broker: isSelected }))}
                className="flex w-full items-start gap-2.5 rounded border border-border p-2.5 text-sm font-normal"
                controlClassName="mt-0.5"
              >
                <span>
                  <span className="font-semibold">broker</span>
                  <span className="block text-xs text-muted-foreground">
                    residence directory &amp; placements, region-scoped
                  </span>
                </span>
              </Checkbox>
              <Checkbox
                isSelected={grants.admin}
                onChange={(isSelected) => setGrants((g) => ({ ...g, admin: isSelected }))}
                className="flex w-full items-start gap-2.5 rounded border border-border p-2.5 text-sm font-normal"
                controlClassName="mt-0.5"
              >
                <span>
                  <span className="font-semibold">admin</span>
                  <span className="block text-xs text-muted-foreground">
                    this control tower — pick staff roles below (dual-authorized)
                  </span>
                </span>
              </Checkbox>
            </div>
          </fieldset>

          <p className="mt-4 flex items-start gap-1.5 rounded-card bg-muted p-3 text-xs text-muted-foreground">
            <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            A government officer is appointed with Appoint officer… on the person&apos;s row, which
            chooses the body, title and region and is refused where the separation of duties
            forbids it.
          </p>

          {/* Platform staff roles — admin_users.staff_roles[] (multiple allowed) */}
          {grants.admin && (
            <fieldset className="mt-4 rounded-card bg-muted p-3.5">
              <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
                <Shield className="h-4 w-4" aria-hidden /> Staff roles
              </legend>
              <p className="px-1 text-xs text-muted-foreground">
                An admin_users row can carry several. Granting admin is Super-Admin-only and requires
                a second admin to approve.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {STAFF_ROLE_OPTIONS.map((sr) => (
                  <Checkbox
                    key={sr.key}
                    isSelected={staffRoles[sr.key]}
                    onChange={(isSelected) =>
                      setStaffRoles((s) => ({ ...s, [sr.key]: isSelected }))
                    }
                    className="flex w-full items-center gap-2 rounded border border-border bg-background p-2.5 text-sm font-normal"
                  >
                    <span className="font-semibold">{sr.label}</span>
                  </Checkbox>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-5 flex gap-2">
            <Button variant="primary" type="submit" className="grow">
              Save grants
            </Button>
            <Button variant="outline" className="grow" onClick={() => setRoleOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </NativeDialog>
    </section>
  );
}
