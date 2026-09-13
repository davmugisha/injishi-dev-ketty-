"use client";

/**
 * A property's photographs: add, order, choose the cover, remove (ADR-053,
 * AC-I3, AC-I7).
 *
 * **Order is buttons, not dragging.** "Move earlier" and "Move later" work from
 * a keyboard, a screen reader and a phone, and every press is one complete
 * arrangement the API writes in a single call, so an order can never be left
 * half written. The first photograph is what guests see first; the cover is
 * what the marketplace shows on a card, and the two are chosen separately.
 *
 * **A refusal is shown where it happened.** On a published property the API
 * refuses to remove the last photograph (a listing guests cannot see is not a
 * listing) and says to unpublish first. That sentence renders in this section,
 * next to the photograph that could not go.
 *
 * The images are short lived signed reads from the operator API. They are for
 * this screen only; the public page reads through the photo route instead.
 */

import type { PropertyPhoto } from "@injishi/contracts";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { ActionButton, Badge, EmptyState, SectionHeading, surfaceClass } from "../components/ui";
import { humanError } from "../data/api";
import {
  useAddPropertyPhotos,
  useArrangePropertyPhotos,
  useRemovePropertyPhoto,
} from "../data/inventory";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic";

export function PropertyPhotos({
  workspaceId,
  propertyId,
  propertyName,
  photos,
}: {
  workspaceId: string;
  propertyId: string;
  propertyName: string;
  photos: PropertyPhoto[];
}) {
  const add = useAddPropertyPhotos(workspaceId, propertyId);
  const arrange = useArrangePropertyPhotos(workspaceId, propertyId);
  const remove = useRemovePropertyPhoto(workspaceId, propertyId);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const ordered = [...photos].sort((a, b) => a.position - b.position);
  const busy = add.isPending || arrange.isPending || remove.isPending;

  const onFiles = (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    if (input.current) input.current.value = "";
    if (picked.length === 0) return;
    setError(null);
    add.mutate(picked, { onError: (err) => setError(humanError(err)) });
  };

  /** Send the whole arrangement: every photograph's position, and which is cover. */
  const send = (order: PropertyPhoto[], coverId: string) => {
    if (busy) return;
    setError(null);
    arrange.mutate(
      order.map((photo, position) => ({ id: photo.id, position, isCover: photo.id === coverId })),
      { onError: (err) => setError(humanError(err)) },
    );
  };

  const cover = ordered.find((p) => p.isCover)?.id ?? ordered[0]?.id ?? "";

  const move = (index: number, by: -1 | 1) => {
    const next = [...ordered];
    const [photo] = next.splice(index, 1);
    next.splice(index + by, 0, photo);
    send(next, cover);
  };

  return (
    <section data-section="photos" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <SectionHeading n={ordered.length}>Photographs</SectionHeading>
        <label className="inline-flex">
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            aria-label="Add photographs"
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
          <ActionButton onClick={() => input.current?.click()} pending={add.isPending}>
            {add.isPending ? "Uploading" : "Add photographs"}
          </ActionButton>
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {ordered.length === 0 ? (
        <EmptyState className="p-5">
          No photographs yet. A property needs at least one before it can be published, and
          the first one becomes its cover.
        </EmptyState>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((photo, index) => (
            <li key={photo.id} data-photo-id={photo.id} className={cn(surfaceClass, "overflow-hidden")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a short lived signed read; the optimiser would cache an expiring URL */}
              <img
                src={photo.url}
                alt={`${propertyName}, photo ${index + 1} of ${ordered.length}`}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-col gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="pms-num">Photo {index + 1}</span>
                  {photo.isCover && <Badge intent="ok">Cover</Badge>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!photo.isCover && (
                    <ActionButton onClick={() => send(ordered, photo.id)} aria-disabled={busy || undefined}>
                      Make cover
                    </ActionButton>
                  )}
                  {index > 0 && (
                    <ActionButton onClick={() => move(index, -1)} aria-disabled={busy || undefined}>
                      Move earlier
                    </ActionButton>
                  )}
                  {index < ordered.length - 1 && (
                    <ActionButton onClick={() => move(index, 1)} aria-disabled={busy || undefined}>
                      Move later
                    </ActionButton>
                  )}
                  <ActionButton
                    onClick={() => {
                      if (busy) return;
                      setError(null);
                      remove.mutate(photo.id, { onError: (err) => setError(humanError(err)) });
                    }}
                    aria-disabled={busy || undefined}
                  >
                    Remove
                  </ActionButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
