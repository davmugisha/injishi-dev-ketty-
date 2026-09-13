"use client";

/**
 * Room types on the property in view: add, edit, archive, restore (ADR-049,
 * AC-I1, AC-I7).
 *
 * **A room type is what the guest gets.** The form asks for exactly that: a
 * name, how many people it sleeps, the price a night, and whether a booking
 * confirms instantly. The price seeds the room type's default rate plan, which
 * the API creates with it; the other terms a room sells on belong to Rate plans.
 *
 * **Archive, not delete.** A room type that has been booked is referenced by
 * those bookings, so it is retired rather than removed, and can be restored. On
 * a published property the API refuses to archive or unprice the last priced
 * room type and says to unpublish first; that sentence renders in this section.
 */

import type { BookingMode, OperatorRoomType } from "@injishi/contracts";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { MediaTile } from "../components/media-tile";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { humanError } from "../data/api";
import { useRoomTypes, useSaveRoomType } from "../data/inventory";
import { fmt } from "../lib/format";
import { roomTypePhoto } from "../lib/media";

const MODE_LABEL: Record<BookingMode, string> = {
  instant_book: "Books instantly",
  request_to_book: "You approve first",
};

const inputClass = "h-10 w-full rounded border border-line2 bg-field px-3 text-sm text-foreground";

type Draft = { name: string; maxGuests: string; price: string; bookingMode: BookingMode };

function draftOf(room: OperatorRoomType | null): Draft {
  return {
    name: room?.name ?? "",
    maxGuests: room?.maxGuests != null ? String(room.maxGuests) : "2",
    price: room?.basePriceRwf != null ? String(room.basePriceRwf) : "",
    bookingMode: room?.bookingMode ?? "instant_book",
  };
}

export function RoomTypesSection({
  workspaceId,
  propertyId,
}: {
  workspaceId: string;
  propertyId: string;
}) {
  const query = useRoomTypes(workspaceId, propertyId);
  const save = useSaveRoomType(workspaceId, propertyId);
  /** `null` closed, `"new"` adding, or the id of the room type being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rooms = query.data?.roomTypes ?? [];
  const active = rooms.filter((r) => r.status === "active");
  const archived = rooms.filter((r) => r.status !== "active");

  const open = (room: OperatorRoomType | null) => {
    setError(null);
    setFormError(null);
    setDraft(draftOf(room));
    setEditing(room ? room.id : "new");
  };

  const submit = () => {
    const name = draft.name.trim();
    const maxGuests = Number(draft.maxGuests);
    const priceText = draft.price.trim().replace(/[,\s]/g, "");
    const price = priceText === "" ? null : Number(priceText);
    if (name.length < 2) return setFormError("Give the room type a name guests will recognise.");
    if (!Number.isInteger(maxGuests) || maxGuests < 1) return setFormError("Say how many people the room sleeps.");
    if (price !== null && (!Number.isInteger(price) || price < 0)) {
      return setFormError("Write the price a night in whole Rwandan francs.");
    }
    setFormError(null);
    save.mutate(
      {
        roomTypeId: editing === "new" ? null : editing,
        body: { name, maxGuests, basePriceRwf: price, bookingMode: draft.bookingMode },
      },
      {
        onSuccess: () => setEditing(null),
        onError: (err) => setFormError(humanError(err)),
      },
    );
  };

  const setStatus = (room: OperatorRoomType, status: "active" | "archived") => {
    if (save.isPending) return;
    setError(null);
    save.mutate(
      { roomTypeId: room.id, body: { status } },
      { onError: (err) => setError(humanError(err)) },
    );
  };

  const tile = (room: OperatorRoomType) => (
    <li
      key={room.id}
      data-room-type={room.name}
      className={cn(surfaceClass, "overflow-hidden", room.status !== "active" && "opacity-70")}
    >
      <MediaTile photo={roomTypePhoto(room.name)} name={room.name} radius={0} />
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">{room.name}</span>
        <span className="flex items-baseline gap-2">
          <span className="pms-num text-base font-bold">
            {room.basePriceRwf === null ? "No price yet" : fmt(room.basePriceRwf)}
          </span>
          {room.basePriceRwf !== null && <span className="text-2xs text-muted-foreground">per night</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {[room.maxGuests ? `Sleeps ${room.maxGuests}` : null, room.bookingMode ? MODE_LABEL[room.bookingMode] : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge intent={room.sellableRoomCount > 0 ? "ok" : "warn"}>
            {room.sellableRoomCount > 0 ? `${room.sellableRoomCount} sellable` : "No sellable rooms"}
          </Badge>
          {room.status !== "active" && <Badge intent="neutral">Archived</Badge>}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {room.status === "active" && <ActionButton onClick={() => open(room)}>Edit</ActionButton>}
          {room.status === "active" ? (
            <ActionButton onClick={() => setStatus(room, "archived")}>Archive</ActionButton>
          ) : (
            <ActionButton onClick={() => setStatus(room, "active")}>Restore</ActionButton>
          )}
        </span>
      </div>
    </li>
  );

  return (
    <section data-section="room-types" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <SectionHeading n={active.length}>Room types</SectionHeading>
        {editing === null && (
          <ActionButton variant="primary" onClick={() => open(null)}>
            Add a room type
          </ActionButton>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {editing !== null && (
        <form
          className={cn(surfaceClass, "flex flex-col gap-3 p-4")}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <span className="text-sm font-semibold text-ink">
            {editing === "new" ? "A new room type" : "Edit room type"}
          </span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ink">Name</span>
              <input
                aria-label="Room type name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Garden Double"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ink">Sleeps</span>
              <input
                aria-label="Sleeps"
                inputMode="numeric"
                value={draft.maxGuests}
                onChange={(e) => setDraft({ ...draft, maxGuests: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ink">Price a night (RWF)</span>
              <input
                aria-label="Price a night in RWF"
                inputMode="numeric"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="Leave empty to price it later"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ink">Booking</span>
              <select
                aria-label="Booking"
                value={draft.bookingMode}
                onChange={(e) => setDraft({ ...draft, bookingMode: e.target.value as BookingMode })}
                className={inputClass}
              >
                <option value="instant_book">{MODE_LABEL.instant_book}</option>
                <option value="request_to_book">{MODE_LABEL.request_to_book}</option>
              </select>
            </label>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <ActionButton onClick={() => setEditing(null)}>Cancel</ActionButton>
            <ActionButton variant="primary" type="submit" pending={save.isPending}>
              Save room type
            </ActionButton>
          </div>
        </form>
      )}

      {query.isPending && <Skeleton height={220} />}
      {query.isError && (
        <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
          We couldn&apos;t load this property&apos;s room types. They are all still there — this
          is on our side, not an empty property.
        </LoadFailed>
      )}
      {query.data && rooms.length === 0 && editing === null && (
        <EmptyState className="p-6">
          No room types yet. A property cannot be published until it has one with a price.
        </EmptyState>
      )}

      {active.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {active.map(tile)}
        </ul>
      )}
      {archived.length > 0 && (
        <>
          <SectionHeading n={archived.length}>Archived</SectionHeading>
          <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map(tile)}
          </ul>
        </>
      )}
    </section>
  );
}
