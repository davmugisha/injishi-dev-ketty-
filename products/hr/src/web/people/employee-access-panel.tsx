"use client";

import { Clock, Envelope, Key, ShieldCheck } from "@gravity-ui/icons";
import { Alert, Button, Chip, Modal, Skeleton, toast } from "@heroui/react";
import { KeyValueList } from "@injishi/ui";
import { useEffect, useState, useTransition } from "react";
import type { EmployeeAccessView } from "../../model/people.ts";
import { useHrActions } from "../mount.tsx";
import { type AccessDraft, AccessPicker, accessErrors, emptyAccess } from "./access-picker";

const STATE: Record<
  EmployeeAccessView["state"],
  { label: string; color: "success" | "accent" | "warning" | "default" }
> = {
  active: { label: "Active login", color: "success" },
  invited: { label: "Invitation sent", color: "accent" },
  awaiting_owner: { label: "Waiting for the owner", color: "warning" },
  none: { label: "No login", color: "default" },
};

/**
 * A file's Injishi login (HR onboarding): where it stands, and what HR may do about it. Give one
 * (sent at once, or asked of the owner for a role that reaches money or people), or take back an
 * invitation or a request still open. A login already in use is the owner's to change, on Team.
 */
export function EmployeeAccessPanel({
  employeeId,
  name,
  email,
}: {
  employeeId: string;
  name: string;
  email: string | null;
}) {
  const { cancelEmployeeAccess, giveEmployeeAccess, loadEmployeeAccess } = useHrActions();
  const [access, setAccess] = useState<EmployeeAccessView | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccessDraft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"email" | "branches", string>>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    setAccess(null);
    setFailure(null);
    loadEmployeeAccess(employeeId).then((result) => {
      if (!live) return;
      if (result.ok) setAccess(result.access);
      else setFailure(result.error);
    });
    return () => {
      live = false;
    };
  }, [employeeId, loadEmployeeAccess]);

  if (failure) {
    return (
      <Alert status="danger">
        <Alert.Content>
          <Alert.Title>The login could not be read</Alert.Title>
          <Alert.Description>{failure}</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  if (!access) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label="Reading the login">
        <Skeleton className="h-5 w-40 rounded-lg" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  const first = name.split(" ")[0] ?? name;
  const role = draft ? access.roles.find((r) => r.id === draft.role) : undefined;
  const ownerDecides = !!role?.needsOwner && !access.grantsEveryRole;

  const give = () => {
    if (!draft) return;
    const found = accessErrors(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    startTransition(async () => {
      const result = await giveEmployeeAccess(employeeId, {
        email: draft.email,
        role: draft.role,
        branchIds: draft.allBranches ? null : draft.branchIds,
        note: draft.note,
      });
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setAccess(result.access);
      setDraft(null);
      toast.success(
        result.outcome === "invited"
          ? `Invitation sent to ${draft.email.trim().toLowerCase()}.`
          : "Sent to the owner for approval.",
      );
    });
  };

  const cancel = () =>
    startTransition(async () => {
      const result = await cancelEmployeeAccess(employeeId);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setAccess(result.access);
      toast.success(access.state === "invited" ? "Invitation cancelled." : "Request withdrawn.");
    });

  const state = STATE[access.state];
  const declined = access.state === "none" && access.request?.status === "declined" ? access.request : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-default text-muted">
            {access.state === "invited" ? (
              <Envelope className="size-4" aria-hidden="true" />
            ) : access.state === "awaiting_owner" ? (
              <Clock className="size-4" aria-hidden="true" />
            ) : access.state === "active" ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <Key className="size-4" aria-hidden="true" />
            )}
          </span>
          <span className="flex flex-col">
            <span className="text-[15px] leading-5 font-semibold">Injishi login</span>
          </span>
        </div>
        <Chip size="sm" variant="soft" color={state.color}>
          {state.label}
        </Chip>
      </div>

      {access.state === "active" && access.member ? (
        <>
          <KeyValueList
            items={[
              { label: "Sign-in email", value: access.member.email ?? "—" },
              { label: "Access level", value: access.member.role },
              { label: "Branches", value: access.member.branches },
              { label: "Last active", value: access.member.lastActive },
            ]}
          />
          <p className="text-xs leading-4 text-muted">The owner changes it on Team and roles.</p>
        </>
      ) : null}

      {access.state === "invited" && access.invitation ? (
        <>
          <KeyValueList
            items={[
              { label: "Sent to", value: access.invitation.email },
              { label: "Access level", value: access.invitation.role },
              { label: "Branches", value: access.invitation.branches },
              { label: "Sent", value: `${access.invitation.sent} · link valid until ${access.invitation.expires}` },
            ]}
          />
          {access.canGrant ? (
            <Button size="sm" variant="secondary" className="self-start" onPress={cancel} isPending={pending}>
              Cancel invitation
            </Button>
          ) : null}
        </>
      ) : null}

      {access.state === "awaiting_owner" && access.request ? (
        <>
          <KeyValueList
            items={[
              { label: "For", value: access.request.email },
              { label: "Access level", value: access.request.role },
              { label: "Branches", value: access.request.branches },
              { label: "Asked by", value: access.request.requested },
            ]}
          />
          {access.canGrant ? (
            <Button size="sm" variant="secondary" className="self-start" onPress={cancel} isPending={pending}>
              Withdraw request
            </Button>
          ) : null}
        </>
      ) : null}

      {access.state === "none" ? (
        <>
          {declined ? (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Title>
                  The owner declined the {declined.role} login{declined.decided ? ` · ${declined.decided}` : ""}
                </Alert.Title>
                {declined.decisionNote ? <Alert.Description>{declined.decisionNote}</Alert.Description> : null}
              </Alert.Content>
            </Alert>
          ) : null}
          <p className="text-[13px] leading-5">No login yet · kiosk and SMS payslips only.</p>
          {access.canGrant ? (
            <Button
              size="sm"
              className="self-start"
              onPress={() => {
                setErrors({});
                setDraft(emptyAccess(access, email ?? ""));
              }}
            >
              <Key className="size-4" aria-hidden="true" />
              Give login access
            </Button>
          ) : (
            <p className="text-xs text-muted">Only the owner gives logins here.</p>
          )}
        </>
      ) : null}

      <Modal.Backdrop isOpen={draft !== null} onOpenChange={(open) => (open ? undefined : setDraft(null))}>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog aria-labelledby="give-access-h">
            {draft ? (
              <>
                <Modal.Header>
                  <Modal.Heading id="give-access-h" className="text-[18px] leading-6 font-semibold">
                    Give {first} an Injishi login
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <AccessPicker
                    idPrefix={`ga-${employeeId.slice(0, 8)}`}
                    options={access}
                    value={draft}
                    onChange={setDraft}
                    errors={errors}
                  />
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button onPress={give} isPending={pending}>
                    {ownerDecides ? "Send to the owner" : "Send invitation"}
                  </Button>
                </Modal.Footer>
              </>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
