"use client";

import { Toast } from "@heroui/react";
import type { GuestRelationship, LandlordGuestList, LeaseStatus, TenantGuestList } from "@injishi/contracts";
import { ActionButton, PageContent } from "@injishi/ui";
import { useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import {
  cancelLandlordGuest,
  cancelTenantGuest,
  registerLandlordGuest,
  registerTenantGuest,
  updateLandlordGuest,
  updateTenantGuest,
} from "./actions";
import { HostGuestList } from "./HostGuestList";

/** A tenant's guests for one lease (P5): registered here, shared with the local leaders. */
export function TenantGuestsView({
  leaseId,
  place,
  status,
  list,
  relationships,
  today,
  arrival = null,
}: {
  leaseId: string;
  place: string;
  status: LeaseStatus;
  list: TenantGuestList;
  relationships: GuestRelationship[];
  today: string;
  /** `?arrival=` from the calendar: the register panel opens on that day. */
  arrival?: string | null;
}) {
  const [registering, setRegistering] = useState(arrival !== null);
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
      <AreaHeader
        eyebrow={place}
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
        arrivalDefault={arrival}
      />
    </PageContent>
  );
}

/** The landlord's own guests at their buildings (P5), never a tenant's. */
export function LandlordGuestsView({
  list,
  relationships,
  today,
}: {
  list: LandlordGuestList;
  relationships: GuestRelationship[];
  today: string;
}) {
  const [registering, setRegistering] = useState(false);
  const body = (
    <HostGuestList
      list={list}
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
      <AreaHeader
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
