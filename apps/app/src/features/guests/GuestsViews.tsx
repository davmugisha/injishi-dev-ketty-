"use client";

import { Toast } from "@heroui/react";
import type {
  GuestRelationship,
  HostGuestTab,
  LandlordGuestList,
  LeaseStatus,
  TenantGuestList,
} from "@injishi/contracts";
import { ActionButton, PageContent, PageHeader } from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  cancelLandlordGuest,
  cancelTenantGuest,
  registerLandlordGuest,
  registerTenantGuest,
  updateLandlordGuest,
  updateTenantGuest,
} from "./actions";
import { HostGuestList } from "./HostGuestList";

function useTab(): (tab: HostGuestTab) => void {
  const router = useRouter();
  const pathname = usePathname();
  return (tab) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
}

/** A tenant's guests for one lease (P5): registered here, shared with the local leaders. */
export function TenantGuestsView({
  leaseId,
  place,
  status,
  list,
  tab,
  relationships,
  today,
}: {
  leaseId: string;
  place: string;
  status: LeaseStatus;
  list: TenantGuestList;
  tab: HostGuestTab;
  relationships: GuestRelationship[];
  today: string;
}) {
  const onTab = useTab();
  const [registering, setRegistering] = useState(false);
  // A signed lease that has not ended can have guests; the stay falls inside it.
  const open = (status === "signed" || status === "active" || status === "ending") && list.window.end >= today;
  const reason = open
    ? null
    : status === "pending_signature"
      ? "Once your lease is signed by both."
      : "This lease has ended.";
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={place}
        title="Guests"
        actions={
          open ? (
            <ActionButton icon="PersonPlus" intent="primary" onPress={() => setRegistering(true)}>
              Register a guest
            </ActionButton>
          ) : null
        }
      />
      <HostGuestList
        list={list}
        tab={tab}
        onTab={onTab}
        relationships={relationships}
        today={today}
        window={list.window}
        calls={{
          register: (r) => registerTenantGuest(leaseId, r),
          update: (id, r) => updateTenantGuest(leaseId, id, r),
          cancel: (id) => cancelTenantGuest(leaseId, id),
        }}
        canRegister={open}
        registerReason={reason}
        registering={registering}
        onRegistering={setRegistering}
      />
    </PageContent>
  );
}

/** The landlord's own guests at their buildings (P5), never a tenant's. */
export function LandlordGuestsView({
  list,
  tab,
  relationships,
  today,
}: {
  list: LandlordGuestList;
  tab: HostGuestTab;
  relationships: GuestRelationship[];
  today: string;
}) {
  const onTab = useTab();
  const [registering, setRegistering] = useState(false);
  const body = (
    <HostGuestList
      list={list}
      tab={tab}
      onTab={onTab}
      relationships={relationships}
      today={today}
      buildings={list.buildings}
      calls={{
        register: (r) => registerLandlordGuest(r),
        update: (id, r) => updateLandlordGuest(id, r),
        cancel: (id) => cancelLandlordGuest(id),
      }}
      canRegister={list.buildings.length > 0}
      registerReason="Add a building first."
      registering={registering}
      onRegistering={setRegistering}
    />
  );
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        title="My guests"
        actions={
          list.buildings.length > 0 ? (
            <ActionButton icon="PersonPlus" intent="primary" onPress={() => setRegistering(true)}>
              Register a guest
            </ActionButton>
          ) : null
        }
      />
      {body}
    </PageContent>
  );
}
