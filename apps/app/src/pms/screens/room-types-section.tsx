"use client";

/**
 * Room types on the property in view: add, edit, archive, restore (ADR-053,
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
 *
 * **Every type names its rooms** (2026-09-13). A new type is created with its
 * rooms — a count, or the numbers on the doors — and "Manage rooms" adds,
 * renames and takes them out of sale. The words follow the business: a tented
 * camp adds tents, a landlord adds units priced per month (`setupVocabularyFor`).
 */

import { setupVocabularyFor, type BookingMode, type OperatorRoomType } from "@injishi/contracts";
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
import { useSetupProgress } from "../data/setup";
import { RoomsEditor, parseRoomLabels } from "./rooms-editor";
import { fmt } from "../lib/format";

const MODE_LABEL: Record<BookingMode, string> = {
  instant_book: "Books instantly",
  request_to_book: "You approve first",
};

const inputClass = "h-10 w-full rounded border border-line2 bg-field px-3 text-sm text-foreground";

type Draft = { name: string; maxGuests: string; price: string; bookingMode: BookingMode; rooms: string };

/**
 * A lone number at or above this reads as a door number as easily as a count:
 * "201" was saved as two hundred and one rooms when room 201 was meant. From
 * here up the form asks which, instead of guessing.
 */
const AMBIGUOUS_COUNT = 100;

/** What the rooms field will create: a count of rooms, or rooms by number. */
export function roomsPlan(text: string): { count: number } | { labels: string[] } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return { count: Number(trimmed) };
  return { labels: parseRoomLabels(trimmed) };
}

function draftOf(room: OperatorRoomType | null): Draft {
  return {
    name: room?.name ?? "",
    maxGuests: room?.maxGuests != null ? String(room.maxGuests) : "2",
    price: room?.basePriceRwf != null ? String(room.basePriceRwf) : "",
    bookingMode: room?.bookingMode ?? "instant_book",
    rooms: "",
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
  /** A lone large number awaiting "that many rooms" or "one room, that number". */
  const [askRooms, setAskRooms] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The room type whose rooms are open for editing. */
  const [managing, setManaging] = useState<string | null>(null);
  const progress = useSetupProgress(workspaceId, propertyId);
  const words = setupVocabularyFor({
    domain: progress.data?.domain ?? "hospitality",
    accommodationClass: progress.data?.accommodationClass ?? "hotel",
  });
  const perMonth = words.pricePeriod === "per month";

  const rooms = query.data?.roomTypes ?? [];
  const active = rooms.filter((r) => r.status === "active");
  const archived = rooms.filter((r) => r.status !== "active");

  const open = (room: OperatorRoomType | null) => {
    setError(null);
    setFormError(null);
    setDraft(draftOf(room));
    setEditing(room ? room.id : "new");
  };

  /** `choice` answers the "how many, or which number?" question, when asked. */
  const submit = (choice?: "count" | "number") => {
    const name = draft.name.trim();
    const maxGuests = Number(draft.maxGuests);
    const priceText = draft.price.trim().replace(/[,\s]/g, "");
    const price = priceText === "" ? null : Number(priceText);
    if (name.length < 2) return setFormError("Give the room type a name guests will recognise.");
    if (!Number.isInteger(maxGuests) || maxGuests < 1) return setFormError("Say how many people the room sleeps.");
    if (price !== null && (!Number.isInteger(price) || price < 0)) {
      return setFormError(`Write the price ${words.pricePeriod} in whole Rwandan francs.`);
    }
    // On create: a plain number is how many, anything else is the door numbers.
    const roomsText = draft.rooms.trim();
    const asNumber = choice === "number" && /^\d+$/.test(roomsText);
    const count = !asNumber && /^\d+$/.test(roomsText) ? Number(roomsText) : null;
    const roomLabels = asNumber
      ? [roomsText]
      : roomsText && count === null
        ? parseRoomLabels(roomsText)
        : undefined;
    if (editing === "new" && !roomsText) {
      return setFormError(`Say how many ${words.unitPlural} of this type you have, or list their numbers.`);
    }
    if (count !== null && (count < 1 || count > 500)) {
      return setFormError(`Between 1 and 500 ${words.unitPlural} at once.`);
    }
    if (editing === "new" && count !== null && count >= AMBIGUOUS_COUNT && choice !== "count") {
      setFormError(null);
      return setAskRooms(count);
    }
    setAskRooms(null);
    setFormError(null);
    save.mutate(
      {
        roomTypeId: editing === "new" ? null : editing,
        body:
          editing === "new"
            ? { name, maxGuests, basePriceRwf: price, bookingMode: draft.bookingMode, roomCount: count ?? roomLabels?.length, roomLabels }
            : { name, maxGuests, basePriceRwf: price, bookingMode: draft.bookingMode },
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
      {/* No photo: a room type has none of its own yet, and the stock picture
          this used to borrow (picked by hashing the name) showed a ski lift or
          New York taxis as the host's room. The tile's own placeholder says
          the room's name instead, and nothing it isn't. */}
      <MediaTile photo={null} name={room.name} radius={0} />
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">{room.name}</span>
        <span className="flex items-baseline gap-2">
          <span className="pms-num text-base font-bold">
            {room.basePriceRwf === null ? "No price yet" : fmt(room.basePriceRwf)}
          </span>
          {room.basePriceRwf !== null && <span className="text-2xs text-muted-foreground">{words.pricePeriod}</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {[room.maxGuests ? `Sleeps ${room.maxGuests}` : null, room.bookingMode ? MODE_LABEL[room.bookingMode] : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge intent={room.sellableRoomCount > 0 ? "ok" : "warn"}>
            {room.sellableRoomCount > 0 ? `${room.sellableRoomCount} ${room.sellableRoomCount === 1 ? words.unitSingular : words.unitPlural} to ${perMonth ? "let" : "sell"}` : `No ${words.unitPlural} yet`}
          </Badge>
          {room.status !== "active" && <Badge intent="neutral">Archived</Badge>}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {room.status === "active" && <ActionButton onClick={() => open(room)}>Edit</ActionButton>}
          {room.status === "active" && (
            <ActionButton variant={room.sellableRoomCount === 0 ? "primary" : "secondary"} onClick={() => setManaging(managing === room.id ? null : room.id)}>
              Manage {words.unitPlural}
            </ActionButton>
          )}
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
        <SectionHeading n={active.length}>{words.typePlural}</SectionHeading>
        {editing === null && (
          <ActionButton variant="primary" onClick={() => open(null)}>
            Add {words.typePlural.toLowerCase().replace(/s$/, "")}
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
            {editing === "new" ? `New: ${words.typePlural.toLowerCase().replace(/s$/, "")}` : "Edit"}
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
              <span className="font-semibold text-ink">Price {words.pricePeriod} (RWF)</span>
              <input
                aria-label={`Price ${words.pricePeriod} in RWF`}
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
            {editing === "new" && (
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="font-semibold text-ink">
                  How many {words.unitPlural}, or their numbers
                </span>
                <input
                  aria-label={`Number of ${words.unitPlural}`}
                  value={draft.rooms}
                  onChange={(e) => {
                    setAskRooms(null);
                    setDraft({ ...draft, rooms: e.target.value });
                  }}
                  placeholder="e.g. 12, or 101-106, 201-206"
                  className={inputClass}
                />
                <RoomsPreview text={draft.rooms} words={words} />
                {askRooms !== null ? (
                  <span
                    role="alert"
                    className="flex flex-col gap-2 rounded border border-line2 bg-field p-3 text-sm text-foreground"
                  >
                    <span>
                      Did you mean {askRooms} {words.unitPlural}, or one {words.unitSingular} numbered {askRooms}?
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => submit("number")}>
                        One {words.unitSingular}, number {askRooms}
                      </ActionButton>
                      <ActionButton onClick={() => submit("count")}>
                        {askRooms} {words.unitPlural}
                      </ActionButton>
                    </span>
                  </span>
                ) : null}
                <span className="text-2xs text-muted-foreground">
                  Each becomes a real {words.unitSingular} you can book, clean and track. Add more later under Manage {words.unitPlural}.
                </span>
              </label>
            )}
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
      {managing && active.some((r) => r.id === managing) && (
        <RoomsEditor
          workspaceId={workspaceId}
          roomType={active.find((r) => r.id === managing) as OperatorRoomType}
          words={words}
          onClose={() => setManaging(null)}
        />
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

/** One line under the rooms field saying exactly what Save will create. */
function RoomsPreview({
  text,
  words,
}: {
  text: string;
  words: { unitSingular: string; unitPlural: string };
}) {
  const plan = roomsPlan(text);
  if (!plan) return null;
  if ("count" in plan) {
    return (
      <span className="text-xs font-semibold text-ink">
        Creates {plan.count} {plan.count === 1 ? words.unitSingular : words.unitPlural}
      </span>
    );
  }
  const shown = plan.labels.slice(0, 6).join(", ");
  const more = plan.labels.length > 6 ? ` and ${plan.labels.length - 6} more` : "";
  return (
    <span className="text-xs font-semibold text-ink">
      Creates {plan.labels.length} {plan.labels.length === 1 ? words.unitSingular : words.unitPlural}: {shown}
      {more}
    </span>
  );
}
