"use client";

import { Card, Toast, toast } from "@heroui/react";
import type { TenancyInvitationItem, TenancyListItem } from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  DateText,
  EmptyBlock,
  KeyValueList,
  Money,
  PageContent,
  PageHeader,
  SectionHeader,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { tenantHomeHref, tenantLeaseHref } from "../leases/shared";
import { acceptInvitation } from "./actions";

/**
 * The homes a person rents, and leases sent to their email waiting to be accepted (P3.1). One home and
 * nothing waiting goes straight to that home; this page is for more than one, or none.
 */
export function TenantChooserView({
  firstName,
  tenancies,
  invitations,
}: {
  firstName: string;
  tenancies: TenancyListItem[];
  invitations: TenancyInvitationItem[];
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState<string | null>(null);
  const accept = async (i: TenancyInvitationItem) => {
    setAccepting(i.invitationId);
    const r = await acceptInvitation({ invitationId: i.invitationId });
    setAccepting(null);
    if (!r.ok) {
      toast.danger(r.error);
      return;
    }
    router.push(`${tenantLeaseHref(r.value.id)}?sign=1`);
  };
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader size="hello" title={firstName ? `Hello, ${firstName}` : "My home"} />
      {invitations.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="home-invites">
          <SectionHeader id="home-invites" title="Waiting for you" description="A landlord sent you a lease to sign." />
          <div className="grid gap-4 md:grid-cols-2">
            {invitations.map((i) => (
              <Card key={i.invitationId} className="gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">
                      Unit {i.unitLabel} · {i.propertyName}
                    </span>
                    <span className="text-sm text-muted">{i.landlordName}</span>
                  </div>
                  <StatusChip tone="warning">To accept</StatusChip>
                </div>
                <KeyValueList
                  items={[
                    { label: "Rent", value: <Money value={i.monthlyRentRwf} /> },
                    {
                      label: "Term",
                      value: (
                        <>
                          <DateText value={i.startDate} /> to <DateText value={i.endDate} />
                        </>
                      ),
                    },
                  ]}
                />
                <ActionButton
                  icon="Check"
                  intent="primary"
                  className="self-start"
                  isPending={accepting === i.invitationId}
                  onPress={() => accept(i)}
                >
                  Accept and read
                </ActionButton>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
      {tenancies.length === 0 && invitations.length === 0 ? (
        <Card>
          <EmptyBlock
            icon="House"
            title="No home here yet"
            description="When a landlord sends you a lease, open the link in the email. It shows here."
          />
        </Card>
      ) : tenancies.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="home-list">
          {invitations.length > 0 ? <SectionHeader id="home-list" title="Your homes" /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {tenancies.map((t) => (
              <Card key={t.id} className="gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">
                      Unit {t.unitLabel} · {t.propertyName}
                    </span>
                    <span className="text-sm text-muted">
                      {t.landlordName} · {t.reference}
                    </span>
                  </div>
                  <StatusChip kind="lease" status={t.status} />
                </div>
                <KeyValueList
                  items={[
                    { label: "Rent", value: <Money value={t.monthlyRentRwf} /> },
                    { label: "Owed now", value: <Money value={t.balanceRwf} /> },
                  ]}
                />
                <ActionLink
                  href={t.needsMySignature ? `${tenantLeaseHref(t.id)}?sign=1` : tenantHomeHref(t.id)}
                  icon={t.needsMySignature ? "PencilToSquare" : "ArrowRight"}
                  intent={t.needsMySignature ? "primary" : "secondary"}
                  className="self-start"
                >
                  {t.needsMySignature ? "Review and sign" : "Open"}
                </ActionLink>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </PageContent>
  );
}
