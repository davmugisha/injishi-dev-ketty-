"use client";

import { Alert, Card } from "@heroui/react";
import type { LeaseInvitationPreview } from "@injishi/contracts";
import { ActionButton, ActionLink, DateText, Icon, KeyValueList, Money } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand";
import { signOut } from "@/lib/auth-actions";
import { myPasswordStatus } from "@/lib/password-actions";
import { tenantLeaseHref } from "../leases/shared";
import { acceptInvitation } from "./actions";
import { CreatePasswordStep } from "./CreatePasswordStep";

/**
 * A lease invitation from its email link (P3.1, public): what was offered, then sign in with the address
 * it went to, accept, and land on the lease to sign. A link that is no longer open says why.
 */
export function InvitationView({
  token,
  preview,
  signedInAs,
}: {
  token: string;
  preview: LeaseInvitationPreview | null;
  /** The signed-in email, or null when nobody is. */
  signedInAs: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Signed in with another address than the one invited: accepting again cannot work.
  const [otherEmail, setOtherEmail] = useState(false);
  const [switching, setSwitching] = useState(false);
  // Accepted: where the lease opens, once the tenant has made or skipped a password.
  const [accepted, setAccepted] = useState<string | null>(null);
  const here = `/invite/lease/${encodeURIComponent(token)}`;

  const accept = async () => {
    setPending(true);
    setProblem(null);
    const r = await acceptInvitation({ token });
    if (!r.ok) {
      setPending(false);
      setProblem(r.error);
      setOtherEmail(r.code === "invitation_other_email");
      return;
    }
    const leaseHref = `${tenantLeaseHref(r.value.id)}?sign=1`;
    // A tenant is offered a password once, here (2026-10-23). Anyone who has one, or is not offered it, goes on.
    const status = await myPasswordStatus();
    if (status?.offered && !status.set) {
      setPending(false);
      setAccepted(leaseHref);
      return;
    }
    router.push(leaseHref);
  };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-10 sm:py-16">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <BrandMark size={24} />
        Injishi
      </div>
      {accepted && signedInAs ? (
        <Card className="gap-5 p-6">
          <CreatePasswordStep email={signedInAs} onDone={() => router.push(accepted)} />
        </Card>
      ) : preview === null ? (
        <Card className="gap-3 p-6">
          <h1 className="text-xl font-semibold">This link isn&apos;t valid</h1>
          <p className="text-sm text-muted">
            Open the invitation from your email again, or ask your landlord to resend it.
          </p>
        </Card>
      ) : (
        <Card className="gap-5 p-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted">{preview.landlordName} sent you a lease</p>
            <h1 className="text-2xl font-semibold text-balance">
              Unit {preview.unitLabel}, {preview.propertyName}
            </h1>
            {preview.district ? <p className="text-sm text-muted">{preview.district}</p> : null}
          </div>
          <KeyValueList
            items={[
              { label: "Rent a month", value: <Money value={preview.monthlyRentRwf} /> },
              { label: "Deposit", value: <Money value={preview.depositRwf} /> },
              {
                label: "Term",
                value: (
                  <>
                    <DateText value={preview.startDate} style="long" /> to{" "}
                    <DateText value={preview.endDate} style="long" />
                  </>
                ),
              },
              { label: "Sent to", value: preview.invitedEmail },
            ]}
          />
          {preview.state !== "open" ? (
            <Alert status={preview.state === "accepted" ? "success" : "warning"}>
              <Alert.Indicator>
                <Icon name={preview.state === "accepted" ? "CircleCheck" : "TriangleExclamation"} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title className="text-sm">{preview.message ?? "This invitation is no longer open."}</Alert.Title>
              </Alert.Content>
            </Alert>
          ) : null}
          {problem ? (
            <Alert status="danger">
              <Alert.Indicator>
                <Icon name="CircleExclamation" />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title className="text-sm">{problem}</Alert.Title>
              </Alert.Content>
            </Alert>
          ) : null}
          {preview.state === "open" ? (
            signedInAs && otherEmail ? (
              <div className="flex flex-col gap-2">
                <ActionButton
                  icon="ArrowRightToSquare"
                  intent="primary"
                  isPending={switching}
                  onPress={() => {
                    setSwitching(true);
                    void signOut(here);
                  }}
                >
                  Sign in with {preview.invitedEmail}
                </ActionButton>
                <p className="text-xs text-muted">You are signed in as {signedInAs}.</p>
              </div>
            ) : signedInAs ? (
              <div className="flex flex-col gap-2">
                <ActionButton icon="Check" intent="primary" isPending={pending} onPress={accept}>
                  Accept and read the lease
                </ActionButton>
                <p className="text-xs text-muted">Signed in as {signedInAs}. You read it in full before you sign.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <ActionLink
                  href={`/sign-in?next=${encodeURIComponent(here)}`}
                  icon="ArrowRightToSquare"
                  intent="primary"
                >
                  Sign in to continue
                </ActionLink>
                <p className="text-xs text-muted">
                  Use {preview.invitedEmail}. We email you a code, no password needed.
                </p>
              </div>
            )
          ) : signedInAs ? (
            <ActionLink href="/home" icon="House">
              Go to my home
            </ActionLink>
          ) : null}
        </Card>
      )}
      {preview?.state === "open" && !accepted ? (
        <p className="text-center text-xs text-muted">
          The link works until <DateText value={preview.expiresAt} style="long" />.
        </p>
      ) : null}
    </main>
  );
}
