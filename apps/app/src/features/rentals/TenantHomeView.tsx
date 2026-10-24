"use client";

import { Card, Chip } from "@heroui/react";
import type { LeaseStatus } from "@injishi/contracts";
import {
  DateText,
  EmptyBlock,
  KeyValueList,
  Money,
  PageContent,
  PageHeader,
  SectionHeader,
  StatusChip,
} from "@injishi/ui";

export interface HomeTenancy {
  id: string;
  reference: string;
  status: LeaseStatus;
  landlordName: string;
  propertyName: string;
  unitLabel: string;
  monthlyRentRwf: number;
  startDate: string;
  endDate: string;
  needsMySignature?: boolean;
  nextDue?: { dueOn: string; amountRwf: number } | null;
  balanceRwf?: number;
}

export interface HomeInvitation {
  invitationId: string;
  landlordName: string;
  propertyName: string;
  unitLabel: string;
  monthlyRentRwf: number;
  startDate: string;
  expiresAt: string;
}

/**
 * A tenant's home (until the tenant app of P3): the homes they rent, from the leases that name them, and
 * leases sent to them that wait for them to accept.
 */
export function TenantHomeView({
  firstName,
  tenancies,
  invitations,
}: {
  firstName: string;
  tenancies: HomeTenancy[];
  invitations: HomeInvitation[];
}) {
  return (
    <PageContent>
      <PageHeader
        size="hello"
        title={firstName ? `Hello, ${firstName}` : "My home"}
        description="The homes you rent."
      />
      {invitations.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="home-invites">
          <SectionHeader
            id="home-invites"
            title="Waiting for you"
            description="Open the email your landlord's lease came with to accept it."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {invitations.map((i) => (
              <Card key={i.invitationId} className="gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">
                      {i.unitLabel} · {i.propertyName}
                    </span>
                    <span className="text-sm text-muted">{i.landlordName}</span>
                  </div>
                  <Chip size="sm" color="warning" variant="soft">
                    To accept
                  </Chip>
                </div>
                <KeyValueList
                  items={[
                    { label: "Rent", value: <Money value={i.monthlyRentRwf} /> },
                    { label: "Starts", value: <DateText value={i.startDate} style="long" /> },
                  ]}
                />
              </Card>
            ))}
          </div>
        </section>
      ) : null}
      {tenancies.length === 0 && invitations.length === 0 ? (
        <EmptyBlock
          icon="House"
          title="No home here yet"
          description="When a landlord sends you a lease, it shows here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tenancies.map((t) => (
            <Card key={t.id} className="gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">
                    {t.unitLabel} · {t.propertyName}
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
                  {
                    label: "Term",
                    value: (
                      <>
                        <DateText value={t.startDate} /> to <DateText value={t.endDate} />
                      </>
                    ),
                  },
                  ...(t.nextDue
                    ? [
                        {
                          label: "Next due",
                          value: (
                            <>
                              <Money value={t.nextDue.amountRwf} /> on <DateText value={t.nextDue.dueOn} />
                            </>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
              {t.needsMySignature ? (
                <Chip size="sm" color="warning" variant="soft" className="self-start">
                  Waiting for your signature
                </Chip>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </PageContent>
  );
}
