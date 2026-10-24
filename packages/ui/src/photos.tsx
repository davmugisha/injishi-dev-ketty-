"use client";

import { Label } from "@heroui/react";
import { DropZone } from "@heroui-pro/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IconAction } from "./buttons.tsx";
import { ConfirmDialog } from "./dialogs.tsx";
import { Icon } from "./icon.tsx";
import { formatFileSize, moveItem, PHOTO_ACCEPT, PHOTO_MAX_BYTES, photoFileProblem, takeRoom } from "./media.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A saved photo: what the API returns for it. */
export interface PhotoItem {
  id: string;
  /** A displayable URL (signed or public). */
  url: string;
  /** What the photo shows ("Kitchen"), when known. */
  alt?: string;
}

/** Pixels a press must travel before it becomes a drag, so a tap on a photo never moves it. */
const DRAG_THRESHOLD = 6;

interface Press {
  id: string;
  pointerId: number;
  x: number;
  y: number;
}

interface Drag {
  id: string;
  from: number;
  over: number;
  url: string;
  x: number;
  y: number;
  /** Where the photo was grabbed, from its top left corner. */
  dx: number;
  dy: number;
  width: number;
  height: number;
}

export interface PhotoGridProps {
  photos: readonly PhotoItem[];
  /** For screen readers: "Unit photos". */
  label: string;
  /** New order after a drag or a keyboard move (the first is the cover). Without it the order is fixed. */
  onReorder?: (photos: PhotoItem[]) => void;
  /** Remove a photo. A promise keeps the confirm dialog spinning until it settles. */
  onRemove?: (photo: PhotoItem) => void | Promise<void>;
  /** Ask before removing. @default true */
  confirmRemove?: boolean;
  /** Mark the first photo as the cover. @default true */
  showCover?: boolean;
  isDisabled?: boolean;
  className?: string;
}

/**
 * Photos in a grid, the first marked Cover. With `onReorder`, drag a photo onto another's place (a mouse
 * or pen anywhere on the photo, a finger on its handle so the page still scrolls), or focus a photo's
 * handle and use the arrow keys (Home makes it the cover). With `onRemove`, each photo has a Remove
 * button that asks first.
 */
export function PhotoGrid({
  photos,
  label,
  onReorder,
  onRemove,
  confirmRemove = true,
  showCover = true,
  isDisabled,
  className,
}: PhotoGridProps) {
  const id = useId();
  const sortable = Boolean(onReorder) && !isDisabled && photos.length > 1;
  const tiles = useRef(new Map<string, HTMLLIElement>());
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const press = useRef<Press | null>(null);
  const rects = useRef<{ id: string; rect: DOMRect }[]>([]);
  const [drag, setDragState] = useState<Drag | null>(null);
  // The drag as the pointer handlers last left it (state lags a render behind).
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const [announcement, setAnnouncement] = useState("");
  const refocus = useRef<string | null>(null);
  const [removing, setRemoving] = useState<PhotoItem | null>(null);
  const [removePending, setRemovePending] = useState(false);

  // After a keyboard move the handle is re-rendered in its new place: keep the focus on it.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    handles.current.get(refocus.current)?.focus();
    refocus.current = null;
  });

  const moved = (from: number, to: number) => {
    if (!onReorder || to === from || to < 0 || to >= photos.length) return;
    onReorder(moveItem(photos, from, to));
    setAnnouncement(`Moved to place ${to + 1} of ${photos.length}${to === 0 ? ", now the cover" : ""}.`);
  };

  const indexAt = (x: number, y: number): number | null => {
    let best: { index: number; distance: number } | null = null;
    for (const [index, { rect }] of rects.current.entries()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return index;
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      const distance = Math.hypot(midX - x, midY - y);
      if (!best || distance < best.distance) best = { index, distance };
    }
    return best?.index ?? null;
  };

  const onPointerDown = (photo: PhotoItem, event: PointerEvent<HTMLLIElement>) => {
    if (!sortable) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // A finger drags only by the handle, so swiping over the photos still scrolls the page.
    if (event.pointerType === "touch" && !target.closest("[data-drag-handle]")) return;
    press.current = { id: photo.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLLIElement>) => {
    const p = press.current;
    if (!p || p.pointerId !== event.pointerId) return;
    const current = dragRef.current;
    if (!current) {
      if (Math.hypot(event.clientX - p.x, event.clientY - p.y) < DRAG_THRESHOLD) return;
      rects.current = photos.map((ph) => ({
        id: ph.id,
        rect: tiles.current.get(ph.id)?.getBoundingClientRect() ?? new DOMRect(),
      }));
      const from = photos.findIndex((ph) => ph.id === p.id);
      const rect = rects.current[from]?.rect;
      if (from < 0 || !rect) return;
      setDrag({
        id: p.id,
        from,
        over: from,
        url: photos[from].url,
        x: event.clientX,
        y: event.clientY,
        dx: p.x - rect.left,
        dy: p.y - rect.top,
        width: rect.width,
        height: rect.height,
      });
      return;
    }
    const over = indexAt(event.clientX, event.clientY) ?? current.over;
    setDrag({ ...current, x: event.clientX, y: event.clientY, over });
  };

  /** Drop (commit) or let go; runs once per press, whichever pointer event comes first. */
  const endDrag = (commit: boolean) => {
    if (!press.current) return;
    const done = dragRef.current;
    press.current = null;
    setDrag(null);
    if (done && commit) moved(done.from, done.over);
  };

  const onHandleKey = (index: number, photo: PhotoItem, event: KeyboardEvent<HTMLButtonElement>) => {
    const last = photos.length - 1;
    const to =
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? index - 1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? index + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (to === null) return;
    event.preventDefault();
    if (to < 0 || to > last || to === index) return;
    refocus.current = photo.id;
    moved(index, to);
  };

  const remove = async (photo: PhotoItem) => {
    if (!onRemove) return;
    setRemovePending(true);
    try {
      await onRemove(photo);
      setRemoving(null);
      setAnnouncement("Photo removed.");
    } finally {
      setRemovePending(false);
    }
  };

  if (photos.length === 0) return null;

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <ul aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, i) => {
          const name = photo.alt ? `${photo.alt}, photo ${i + 1}` : `Photo ${i + 1}`;
          const dragging = drag?.id === photo.id;
          const target = drag && drag.over === i && drag.from !== i;
          return (
            <li
              key={photo.id}
              ref={(el) => {
                if (el) tiles.current.set(photo.id, el);
                else tiles.current.delete(photo.id);
              }}
              onPointerDown={(event) => onPointerDown(photo, event)}
              onPointerMove={onPointerMove}
              onPointerUp={() => endDrag(true)}
              onPointerCancel={() => endDrag(false)}
              onLostPointerCapture={() => endDrag(false)}
              className={cx(
                "relative aspect-4/3 overflow-hidden rounded-lg bg-default transition-opacity motion-reduce:transition-none",
                sortable && "cursor-grab active:cursor-grabbing",
                dragging && "opacity-35",
                target && "ring-2 ring-accent ring-offset-2 ring-offset-background",
              )}
            >
              {/* biome-ignore lint/performance/noImgElement: signed URLs and local previews, not optimisable */}
              <img src={photo.url} alt={name} draggable={false} className="size-full object-cover select-none" />
              {showCover && i === 0 ? (
                <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
                  Cover
                </span>
              ) : null}
              {sortable ? (
                <button
                  type="button"
                  data-drag-handle
                  ref={(el) => {
                    if (el) handles.current.set(photo.id, el);
                    else handles.current.delete(photo.id);
                  }}
                  aria-label={`Move ${name}${i === 0 ? ", the cover" : ""}`}
                  aria-describedby={`${id}-how`}
                  onKeyDown={(event) => onHandleKey(i, photo, event)}
                  className="absolute bottom-2 left-2 flex size-8 cursor-grab touch-none items-center justify-center rounded-full border border-border bg-background/90 text-muted backdrop-blur-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:cursor-grabbing"
                >
                  <Icon name="Grip" />
                </button>
              ) : null}
              {onRemove && !isDisabled ? (
                <span data-no-drag className="absolute top-2 right-2">
                  <IconAction
                    icon="TrashBin"
                    label={`Remove ${name}`}
                    intent="danger"
                    onPress={() => (confirmRemove ? setRemoving(photo) : void remove(photo))}
                    className="bg-background/90 backdrop-blur-sm"
                  />
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {sortable ? (
        <p id={`${id}-how`} className="px-1 text-xs text-muted">
          Drag a photo by its handle to change the order. The first is the cover.
          <span className="sr-only"> With the keyboard, focus a photo's handle and use the arrow keys.</span>
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {drag && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed overflow-hidden rounded-lg shadow-xl ring-2 ring-accent"
              style={{
                left: drag.x - drag.dx,
                top: drag.y - drag.dy,
                width: drag.width,
                height: drag.height,
                zIndex: 1000,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: a copy of the photo under the pointer */}
              <img src={drag.url} alt="" className="size-full object-cover" />
            </div>,
            document.body,
          )
        : null}
      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title="Remove this photo?"
        confirmLabel="Remove photo"
        intent="danger"
        isPending={removePending}
        onConfirm={() => (removing ? void remove(removing) : undefined)}
      >
        It comes off the listing and the unit. You can add it again later.
      </ConfirmDialog>
    </div>
  );
}

// --- PhotoUploader -----------------------------------------------------------------------------------

/** Report how far an upload has gone, 0 to 1. */
export type UploadProgress = (fraction: number) => void;

interface Pending {
  key: string;
  file: File;
  preview: string;
  progress: number;
  status: "uploading" | "failed";
  error?: string;
  controller: AbortController;
}

export interface PhotoUploaderProps {
  /** @default "Photos" */
  label?: ReactNode;
  /** The saved photos, in order (the first is the cover). */
  photos: readonly PhotoItem[];
  /** The most photos allowed. */
  max: number;
  /** One photo's size limit. @default 10 MB */
  maxBytes?: number;
  /**
   * Send one photo (the caller's server action or route). Report progress with `onProgress`; stop when
   * `signal` aborts (Cancel). Resolve with the saved photo, or throw an Error whose message is the
   * sentence to show. The kit never calls the API itself.
   */
  upload: (file: File, onProgress: UploadProgress, signal: AbortSignal) => Promise<PhotoItem>;
  /** A photo was saved: add it to `photos`. */
  onUploaded: (photo: PhotoItem) => void;
  onReorder?: (photos: PhotoItem[]) => void;
  onRemove?: (photo: PhotoItem) => void | Promise<void>;
  isDisabled?: boolean;
  /** An error about the photos as a whole ("Add at least one photo"). */
  errorMessage?: string | null;
  className?: string;
}

/**
 * Photos for a unit or a fault: drop them or choose them (JPEG, PNG or WebP, each within `maxBytes`, up
 * to `max`), watch each upload with its progress (Cancel, or Try again when it fails), then order them
 * in the grid (the first is the cover) and remove any. Files are checked here before anything is sent.
 */
export function PhotoUploader({
  label = "Photos",
  photos,
  max,
  maxBytes = PHOTO_MAX_BYTES,
  upload,
  onUploaded,
  onReorder,
  onRemove,
  isDisabled,
  errorMessage,
  className,
}: PhotoUploaderProps) {
  const id = useId();
  const [pending, setPending] = useState<Pending[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const live = useRef(pending);
  live.current = pending;

  // Stop every upload and free the previews when the uploader goes away.
  useEffect(
    () => () => {
      for (const p of live.current) {
        p.controller.abort();
        URL.revokeObjectURL(p.preview);
      }
    },
    [],
  );

  const room = Math.max(0, max - photos.length - pending.length);
  const full = room === 0;

  const update = (key: string, change: Partial<Pending>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const drop = (key: string) =>
    setPending((list) => {
      const gone = list.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((p) => p.key !== key);
    });

  const send = async (item: Pending) => {
    try {
      const saved = await upload(
        item.file,
        (fraction) => update(item.key, { progress: Math.min(1, Math.max(0, fraction)) }),
        item.controller.signal,
      );
      drop(item.key);
      onUploaded(saved);
    } catch (e) {
      if (item.controller.signal.aborted) return;
      update(item.key, {
        status: "failed",
        error: e instanceof Error && e.message ? e.message : "The upload failed.",
      });
    }
  };

  const add = (files: File[]) => {
    if (isDisabled || files.length === 0) return;
    const problems: string[] = [];
    const good: File[] = [];
    for (const file of files) {
      const problem = photoFileProblem(file, maxBytes);
      if (problem) problems.push(problem);
      else good.push(file);
    }
    const { taken, left } = takeRoom(good, room);
    if (left.length > 0) {
      problems.push(
        room === 0
          ? `You already have ${max} photos. Remove one to add another.`
          : `Only ${room} more ${room === 1 ? "photo fits" : "photos fit"}. ${left.length} ${left.length === 1 ? "was" : "were"} left out.`,
      );
    }
    setIssues(problems);
    const items: Pending[] = taken.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: "uploading",
      controller: new AbortController(),
    }));
    if (items.length === 0) return;
    setPending((list) => [...list, ...items]);
    for (const item of items) void send(item);
  };

  const retry = (item: Pending) => {
    const again: Pending = {
      ...item,
      status: "uploading",
      error: undefined,
      progress: 0,
      controller: new AbortController(),
    };
    setPending((list) => list.map((p) => (p.key === item.key ? again : p)));
    void send(again);
  };

  const cancel = (item: Pending) => {
    item.controller.abort();
    drop(item.key);
  };

  return (
    <fieldset aria-labelledby={`${id}-label`} className={cx("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label id={`${id}-label`} elementType="span" isInvalid={Boolean(errorMessage)}>
          {label}
        </Label>
        <span className="text-xs text-muted tabular">
          {photos.length} of {max}
        </span>
      </div>

      <PhotoGrid
        photos={photos}
        label={typeof label === "string" ? label : "Photos"}
        onReorder={onReorder}
        onRemove={onRemove}
        isDisabled={isDisabled}
      />

      <DropZone className="gap-2">
        {pending.length > 0 ? (
          <DropZone.FileList>
            {pending.map((item) => (
              <DropZone.FileItem key={item.key} status={item.status}>
                {/* biome-ignore lint/performance/noImgElement: a local preview of the file being sent */}
                <img src={item.preview} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                <DropZone.FileInfo>
                  <DropZone.FileName>{item.file.name}</DropZone.FileName>
                  <DropZone.FileMeta>
                    {item.status === "failed" ? (
                      <span className="text-danger">{item.error}</span>
                    ) : (
                      <>
                        <span className="tabular">{formatFileSize(item.file.size)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular">Uploading {Math.round(item.progress * 100)}%</span>
                      </>
                    )}
                  </DropZone.FileMeta>
                  {item.status === "uploading" ? (
                    <DropZone.FileProgress value={item.progress * 100} aria-label={`Uploading ${item.file.name}`}>
                      <DropZone.FileProgressTrack>
                        <DropZone.FileProgressFill />
                      </DropZone.FileProgressTrack>
                    </DropZone.FileProgress>
                  ) : (
                    <DropZone.FileRetryTrigger onPress={() => retry(item)} className="self-start">
                      Try again
                    </DropZone.FileRetryTrigger>
                  )}
                </DropZone.FileInfo>
                <DropZone.FileRemoveTrigger
                  aria-label={item.status === "uploading" ? `Cancel ${item.file.name}` : `Remove ${item.file.name}`}
                  onPress={() => cancel(item)}
                >
                  <Icon name="Xmark" />
                </DropZone.FileRemoveTrigger>
              </DropZone.FileItem>
            ))}
          </DropZone.FileList>
        ) : null}

        {full ? (
          photos.length >= max ? (
            <p className="px-1 text-xs text-muted">All {max} photos added. Remove one to add another.</p>
          ) : null
        ) : (
          <>
            <DropZone.Area
              isDisabled={isDisabled}
              getDropOperation={() => (isDisabled ? "cancel" : "copy")}
              onDrop={async (event) => {
                const files = await Promise.all(
                  event.items.flatMap((item) => (item.kind === "file" ? [item.getFile()] : [])),
                );
                add(files);
              }}
              className={cx(photos.length + pending.length > 0 ? "py-5" : "py-8", errorMessage && "border-danger")}
            >
              <DropZone.Icon>
                <Icon name="Picture" />
              </DropZone.Icon>
              <DropZone.Label>
                {/* Phones can't drop files: there the label says what the button does. */}
                <span className="hidden sm:inline">
                  {photos.length + pending.length > 0
                    ? "Drop more photos here"
                    : "Drop photos here. The first is the cover."}
                </span>
                <span className="sm:hidden">
                  {photos.length + pending.length > 0 ? "Add more photos" : "Add photos. The first is the cover."}
                </span>
              </DropZone.Label>
              <DropZone.Description>JPEG, PNG or WebP, up to {formatFileSize(maxBytes)} each.</DropZone.Description>
              <DropZone.Trigger isDisabled={isDisabled}>Choose photos</DropZone.Trigger>
            </DropZone.Area>
            <DropZone.Input
              accept={PHOTO_ACCEPT}
              multiple
              disabled={isDisabled}
              onSelect={(list) => add(Array.from(list))}
            />
          </>
        )}
      </DropZone>

      {errorMessage ? (
        <p role="alert" className="px-1 text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
      {issues.length > 0 ? (
        <ul role="alert" className="flex flex-col gap-0.5 px-1 text-xs text-danger">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
