"use client";

import { Label, ProgressBar } from "@heroui/react";
import {
  type DragEvent,
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
import { ActionButton, IconAction } from "./buttons.tsx";
import { ConfirmDialog } from "./dialogs.tsx";
import { useReducedMotion } from "./hooks.ts";
import { Icon } from "./icon.tsx";
import { formatFileSize, moveItem, PHOTO_ACCEPT, PHOTO_MAX_BYTES, photoFileProblem, takeRoom } from "./media.ts";
import { slotAt } from "./zoom.ts";

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
/** How long tiles take to slide into a new place, and a dropped photo to settle. */
const SLIDE_MS = 220;
const SLIDE_EASING = "cubic-bezier(0.2, 0, 0, 1)";

interface Slot {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

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
  /** Let go: the lifted copy glides into its new place (screen coordinates), then the drag ends. */
  settle?: { left: number; top: number };
}

export interface PhotoGridProps {
  photos: readonly PhotoItem[];
  /** For screen readers: "Unit photos". */
  label: string;
  /** New order after a drag or a keyboard move (the first is the cover). Without it the order is fixed. */
  onReorder?: (photos: PhotoItem[]) => void;
  /** Remove a photo. A promise keeps the confirm dialog spinning until it settles. */
  onRemove?: (photo: PhotoItem) => void | Promise<void>;
  /** Ask before removing (every photo, or the ones it returns true for). @default true */
  confirmRemove?: boolean | ((photo: PhotoItem) => boolean);
  /** Which photos get a Remove button. @default all, when `onRemove` is given */
  canRemove?: (photo: PhotoItem) => boolean;
  /**
   * Only the first `sortableCount` photos can be moved, among themselves (photos still uploading come
   * after them and stay put). @default all
   */
  sortableCount?: number;
  /** Drawn over a photo (an upload's progress, a Try again). */
  renderOverlay?: (photo: PhotoItem, index: number) => ReactNode;
  /** Mark the first photo as the cover. @default true */
  showCover?: boolean;
  isDisabled?: boolean;
  className?: string;
}

/** A tile's place in the grid, as laid out (a slide running on it doesn't change it). */
const layoutOf = (el: HTMLElement) => ({ x: el.offsetLeft, y: el.offsetTop });

/**
 * Photos in a grid, the first marked Cover. With `onReorder`, pick a photo up (a mouse or pen anywhere on
 * it, a finger on its handle so the page still scrolls): it lifts and follows the pointer, the others
 * slide aside to open the place it would land in, and when let go it glides into that place. With the
 * keyboard, focus a photo's handle and use the arrow keys (Home makes it the cover): the photos slide the
 * same way. With `onRemove`, each photo has a Remove button that asks first. Reduced motion: no slides.
 */
export function PhotoGrid({
  photos,
  label,
  onReorder,
  onRemove,
  confirmRemove = true,
  canRemove,
  sortableCount,
  renderOverlay,
  showCover = true,
  isDisabled,
  className,
}: PhotoGridProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const movable = Math.min(sortableCount ?? photos.length, photos.length);
  const sortable = Boolean(onReorder) && !isDisabled && movable > 1;
  const list = useRef<HTMLUListElement>(null);
  const tiles = useRef(new Map<string, HTMLLIElement>());
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const placed = useRef(new Map<string, { x: number; y: number }>());
  const slides = useRef(new Map<string, Animation>());
  const press = useRef<Press | null>(null);
  const slots = useRef<Slot[]>([]);
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

  // While a photo is lifted, the others make room where it would land.
  const shown = drag && drag.over !== drag.from ? moveItem(photos, drag.from, drag.over) : photos;

  // FLIP: a tile whose place changed (a lifted photo passing over it, a keyboard move) is drawn where it
  // was and slides to its new place. A slide still running is carried on from where it has got to.
  useLayoutEffect(() => {
    const ul = list.current;
    const next = new Map<string, { x: number; y: number }>();
    for (const [key, el] of tiles.current) {
      const now = layoutOf(el);
      next.set(key, now);
      const before = placed.current.get(key);
      if (!before || (before.x === now.x && before.y === now.y) || reduced || !ul) continue;
      const running = slides.current.get(key);
      let drawn = before;
      if (running) {
        const box = el.getBoundingClientRect();
        const grid = ul.getBoundingClientRect();
        drawn = { x: box.left - grid.left, y: box.top - grid.top };
        running.cancel();
      }
      const dx = drawn.x - now.x;
      const dy = drawn.y - now.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      const slide = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
        duration: SLIDE_MS,
        easing: SLIDE_EASING,
      });
      slides.current.set(key, slide);
      slide.onfinish = () => slides.current.delete(key);
    }
    placed.current = next;
  });

  // After a keyboard move the handle is drawn in its new place: keep the focus on it.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    handles.current.get(refocus.current)?.focus();
    refocus.current = null;
  });

  const moved = (from: number, to: number) => {
    if (!onReorder || to === from || to < 0 || to >= movable) return;
    onReorder([...moveItem(photos.slice(0, movable), from, to), ...photos.slice(movable)]);
    setAnnouncement(`Moved to place ${to + 1} of ${photos.length}${to === 0 ? ", now the cover" : ""}.`);
  };

  const onMove = (event: globalThis.PointerEvent) => {
    const p = press.current;
    const ul = list.current;
    if (!p || p.pointerId !== event.pointerId || !ul) return;
    const current = dragRef.current;
    if (current?.settle) return;
    if (!current) {
      if (Math.hypot(event.clientX - p.x, event.clientY - p.y) < DRAG_THRESHOLD) return;
      const from = photos.findIndex((ph) => ph.id === p.id);
      const tile = tiles.current.get(p.id);
      if (from < 0 || from >= movable || !tile) return;
      // The places a photo can land, from the grid's corner (scrolling the panel doesn't move them).
      slots.current = photos.slice(0, movable).map((ph) => {
        const el = tiles.current.get(ph.id);
        const at = el ? layoutOf(el) : { x: 0, y: 0 };
        return { left: at.x, top: at.y, right: at.x + (el?.offsetWidth ?? 0), bottom: at.y + (el?.offsetHeight ?? 0) };
      });
      const rect = tile.getBoundingClientRect();
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
    event.preventDefault();
    const grid = ul.getBoundingClientRect();
    const over = slotAt(slots.current, event.clientX - grid.left, event.clientY - grid.top) ?? current.over;
    setDrag({ ...current, x: event.clientX, y: event.clientY, over });
  };

  const stopListening = () => {
    window.removeEventListener("pointermove", relay.current.move);
    window.removeEventListener("pointerup", relay.current.up);
    window.removeEventListener("pointercancel", relay.current.cancel);
  };

  /** Drop (commit) or let go; runs once per press, whichever pointer event comes first. */
  const endDrag = (commit: boolean) => {
    stopListening();
    if (!press.current) return;
    const done = dragRef.current;
    press.current = null;
    if (!done) return;
    const to = commit ? done.over : done.from;
    if (to !== done.from) moved(done.from, to);
    const ul = list.current;
    const slot = slots.current[to];
    if (reduced || !ul || !slot) {
      setDrag(null);
      return;
    }
    // The lifted copy glides into the place it was dropped on, then the photo shows there again.
    const grid = ul.getBoundingClientRect();
    setDrag({ ...done, from: to, over: to, settle: { left: grid.left + slot.left, top: grid.top + slot.top } });
    window.setTimeout(() => {
      if (dragRef.current?.settle) setDrag(null);
    }, SLIDE_MS + 40);
  };

  const handlers = useRef({ onMove, endDrag });
  handlers.current = { onMove, endDrag };
  const relay = useRef({
    move: (e: globalThis.PointerEvent) => handlers.current.onMove(e),
    up: () => handlers.current.endDrag(true),
    cancel: () => handlers.current.endDrag(false),
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: stop listening when the grid goes away
  useEffect(() => stopListening, []);

  const onPointerDown = (photo: PhotoItem, index: number, event: PointerEvent<HTMLLIElement>) => {
    if (!sortable || index >= movable || dragRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // A finger drags only by the handle, so swiping over the photos still scrolls the page.
    if (event.pointerType === "touch" && !target.closest("[data-drag-handle]")) return;
    press.current = { id: photo.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    window.addEventListener("pointermove", relay.current.move, { passive: false });
    window.addEventListener("pointerup", relay.current.up);
    window.addEventListener("pointercancel", relay.current.cancel);
  };

  const onHandleKey = (index: number, photo: PhotoItem, event: KeyboardEvent<HTMLButtonElement>) => {
    const last = movable - 1;
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
  const asks = (photo: PhotoItem) => (typeof confirmRemove === "function" ? confirmRemove(photo) : confirmRemove);

  if (photos.length === 0) return null;

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <ul ref={list} aria-label={label} className="relative grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((photo, i) => {
          const name = photo.alt ? `${photo.alt}, photo ${i + 1}` : `Photo ${i + 1}`;
          const lifted = drag?.id === photo.id;
          const canMove = sortable && i < movable;
          const removable = Boolean(onRemove) && !isDisabled && (canRemove ? canRemove(photo) : true);
          return (
            <li
              key={photo.id}
              ref={(el) => {
                if (el) tiles.current.set(photo.id, el);
                else tiles.current.delete(photo.id);
              }}
              onPointerDown={(event) => onPointerDown(photo, i, event)}
              className={cx(
                "relative aspect-4/3 overflow-hidden rounded-lg bg-default select-none",
                canMove && "cursor-grab active:cursor-grabbing",
                lifted && "border-2 border-dashed border-accent/60 bg-accent/5",
              )}
            >
              {/* biome-ignore lint/performance/noImgElement: signed URLs and local previews, not optimisable */}
              <img
                src={photo.url}
                alt={name}
                draggable={false}
                className={cx("size-full object-cover select-none", lifted && "invisible")}
              />
              {lifted ? null : (
                <>
                  {showCover && i === 0 ? (
                    <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
                      Cover
                    </span>
                  ) : null}
                  {renderOverlay?.(photo, i)}
                  {canMove ? (
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
                  {removable ? (
                    <span data-no-drag className="absolute top-2 right-2">
                      <IconAction
                        icon="TrashBin"
                        label={`Remove ${name}`}
                        intent="danger"
                        onPress={() => (asks(photo) ? setRemoving(photo) : void remove(photo))}
                        className="bg-background/90 backdrop-blur-sm"
                      />
                    </span>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {sortable ? (
        <p id={`${id}-how`} className="px-1 text-xs text-muted">
          Drag a photo to change the order. The first is the cover.
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
              data-photo-lifted
              className={cx(
                "pointer-events-none fixed overflow-hidden rounded-lg ring-2 ring-accent",
                drag.settle ? "shadow-md" : "shadow-2xl",
              )}
              style={{
                left: drag.settle ? drag.settle.left : drag.x - drag.dx,
                top: drag.settle ? drag.settle.top : drag.y - drag.dy,
                width: drag.width,
                height: drag.height,
                zIndex: 1000,
                transform: drag.settle ? "scale(1)" : "scale(1.05) rotate(-1.5deg)",
                transition: drag.settle
                  ? `left ${SLIDE_MS}ms ${SLIDE_EASING}, top ${SLIDE_MS}ms ${SLIDE_EASING}, transform ${SLIDE_MS}ms ${SLIDE_EASING}, box-shadow ${SLIDE_MS}ms`
                  : "transform 120ms ease-out",
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

/** Send one photo; resolve with the saved photo or throw an Error whose message is the sentence to show. */
export type PhotoUpload = (file: File, onProgress: UploadProgress, signal: AbortSignal) => Promise<PhotoItem>;

interface Pending {
  key: string;
  file: File;
  preview: string;
  progress: number;
  /** "queued": waiting to be sent (held until `upload` is given, when the form isn't saved yet). */
  status: "queued" | "uploading" | "failed";
  error?: string;
  controller: AbortController;
}

/** How many picked photos are waiting, going, or failed. All zero: everything picked is saved. */
export interface UploadState {
  queued: number;
  uploading: number;
  failed: number;
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
   *
   * Null while there is nowhere to send them yet (a unit not saved yet): picked photos wait here, can be
   * arranged and removed, and are sent one by one in that order as soon as `upload` is given.
   */
  upload: PhotoUpload | null;
  /** A photo was saved: add it to `photos`. */
  onUploaded: (photo: PhotoItem) => void;
  onReorder?: (photos: PhotoItem[]) => void;
  onRemove?: (photo: PhotoItem) => void | Promise<void>;
  /** Told whenever photos start or stop waiting, uploading or failing. */
  onStateChange?: (state: UploadState) => void;
  isDisabled?: boolean;
  /** An error about the photos as a whole ("Add at least one photo"). */
  errorMessage?: string | null;
  className?: string;
}

const PENDING = "pending:";

/**
 * Photos for a unit or a fault: add them with the small Add photos button or drop them on the field (JPEG,
 * PNG or WebP, each within `maxBytes`, up to `max`). Each upload shows in the grid with its progress
 * (Cancel, or Try again when it fails); saved photos can be arranged (the first is the cover) and
 * removed. Files are checked here before anything is sent. With `upload` null they wait in the browser
 * until there is somewhere to send them.
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
  onStateChange,
  isDisabled,
  errorMessage,
  className,
}: PhotoUploaderProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPendingState] = useState<Pending[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [dropping, setDropping] = useState(false);
  // The list as the async senders last left it (state lags a render behind).
  const live = useRef(pending);
  const setPending = (change: (list: Pending[]) => Pending[]) => {
    live.current = change(live.current);
    setPendingState(live.current);
  };
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;
  const onStateRef = useRef(onStateChange);
  onStateRef.current = onStateChange;
  const flushing = useRef(false);

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

  const queued = pending.filter((p) => p.status === "queued").length;
  const uploading = pending.filter((p) => p.status === "uploading").length;
  const failed = pending.filter((p) => p.status === "failed").length;
  useEffect(() => {
    onStateRef.current?.({ queued, uploading, failed });
  }, [queued, uploading, failed]);

  const room = Math.max(0, max - photos.length - pending.length);
  const full = room === 0;
  const held = !upload;

  const update = (key: string, change: Partial<Pending>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const drop = (key: string) =>
    setPending((list) => {
      const gone = list.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((p) => p.key !== key);
    });

  const send = async (item: Pending) => {
    const to = uploadRef.current;
    if (!to) return;
    update(item.key, { status: "uploading", progress: 0, error: undefined });
    try {
      const saved = await to(
        item.file,
        (fraction) => update(item.key, { progress: Math.min(1, Math.max(0, fraction)) }),
        item.controller.signal,
      );
      drop(item.key);
      onUploadedRef.current(saved);
    } catch (e) {
      if (item.controller.signal.aborted) return;
      update(item.key, { status: "failed", error: e instanceof Error && e.message ? e.message : "The upload failed." });
    }
  };

  /** Send every waiting photo, one at a time in their order, so the saved order is the one arranged. */
  const flush = async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (;;) {
        const next = live.current.find((p) => p.status === "queued");
        if (!next || !uploadRef.current) break;
        await send(next);
      }
    } finally {
      flushing.current = false;
    }
  };

  // Photos held while there was nowhere to send them go as soon as there is.
  useEffect(() => {
    if (upload) void flush();
  });

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
      status: "queued",
      controller: new AbortController(),
    }));
    if (items.length > 0) setPending((list) => [...list, ...items]);
  };

  const retry = (item: Pending) => {
    update(item.key, { status: "queued", error: undefined, progress: 0, controller: new AbortController() });
  };

  const cancel = (item: Pending) => {
    item.controller.abort();
    drop(item.key);
  };

  const tiles: PhotoItem[] = [
    ...photos,
    ...pending.map((p) => ({ id: `${PENDING}${p.key}`, url: p.preview, alt: p.file.name })),
  ];
  const pendingOf = (photo: PhotoItem) =>
    photo.id.startsWith(PENDING) ? pending.find((p) => `${PENDING}${p.key}` === photo.id) : undefined;
  const count = photos.length + pending.length;

  const onFileDrag = (event: DragEvent<HTMLFieldSetElement>) => {
    if (isDisabled || full || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropping(true);
  };

  return (
    <fieldset
      aria-labelledby={`${id}-label`}
      onDragOver={onFileDrag}
      onDragEnter={onFileDrag}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDropping(false);
        add(Array.from(event.dataTransfer.files));
      }}
      className={cx("relative flex min-w-0 flex-col gap-2 rounded-lg", className)}
    >
      <div className="flex min-h-8 items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <Label id={`${id}-label`} elementType="span" isInvalid={Boolean(errorMessage)}>
            {label}
          </Label>
          <span className="text-xs text-muted tabular">
            {count} of {max}
          </span>
        </div>
        {full || isDisabled ? null : (
          <ActionButton icon="Plus" size="sm" onPress={() => input.current?.click()}>
            {count > 0 ? "Add more" : "Add photos"}
          </ActionButton>
        )}
      </div>

      <PhotoGrid
        photos={tiles}
        label={typeof label === "string" ? label : "Photos"}
        sortableCount={held ? tiles.length : photos.length}
        onReorder={
          held
            ? (next) => {
                const order = new Map(next.map((p, i) => [p.id, i]));
                setPending((list) =>
                  [...list].sort(
                    (a, b) => (order.get(`${PENDING}${a.key}`) ?? 0) - (order.get(`${PENDING}${b.key}`) ?? 0),
                  ),
                );
              }
            : onReorder
              ? (next) => onReorder(next.filter((p) => !p.id.startsWith(PENDING)))
              : undefined
        }
        onRemove={async (photo) => {
          const item = pendingOf(photo);
          if (item) cancel(item);
          else await onRemove?.(photo);
        }}
        canRemove={(photo) => {
          const item = pendingOf(photo);
          return item ? item.status === "queued" && held : Boolean(onRemove);
        }}
        confirmRemove={(photo) => !photo.id.startsWith(PENDING)}
        renderOverlay={(photo) => {
          const item = pendingOf(photo);
          if (!item || (item.status === "queued" && held)) return null;
          if (item.status === "failed") {
            return (
              <div
                data-no-drag
                className="absolute inset-0 flex flex-col items-start justify-end gap-1.5 bg-black/65 p-2 text-white"
              >
                <span className="absolute top-2 right-2">
                  <IconAction
                    icon="Xmark"
                    label={`Remove ${item.file.name}`}
                    onPress={() => cancel(item)}
                    className="bg-background/90 text-foreground backdrop-blur-sm"
                  />
                </span>
                <span role="alert" className="line-clamp-2 text-xs">
                  {item.error}
                </span>
                <ActionButton icon="ArrowRotateRight" size="sm" onPress={() => retry(item)}>
                  Try again
                </ActionButton>
              </div>
            );
          }
          const percent = item.status === "queued" ? 0 : Math.round(item.progress * 100);
          return (
            <div data-no-drag className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-black/45 p-2 text-white">
              <span className="absolute top-2 right-2">
                <IconAction
                  icon="Xmark"
                  label={`Cancel ${item.file.name}`}
                  onPress={() => cancel(item)}
                  className="bg-background/90 text-foreground backdrop-blur-sm"
                />
              </span>
              <span className="text-xs font-medium tabular">
                {item.status === "queued" ? "Waiting" : `Uploading ${percent}%`}
              </span>
              <ProgressBar value={percent} aria-label={`Uploading ${item.file.name}`} size="sm">
                <ProgressBar.Track className="bg-white/30">
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          );
        }}
        isDisabled={isDisabled}
      />

      {tiles.length === 0 ? (
        <p className="px-1 text-xs text-muted">
          {isDisabled ? (
            "No photos yet."
          ) : (
            <>
              JPEG, PNG or WebP, up to {formatFileSize(maxBytes)} each. The first is the cover.
              <span className="hidden sm:inline"> You can also drop them here.</span>
            </>
          )}
        </p>
      ) : null}
      {held && pending.length > 0 ? <p className="px-1 text-xs text-muted">They upload when you save.</p> : null}
      {full && photos.length >= max ? (
        <p className="px-1 text-xs text-muted">All {max} photos added. Remove one to add another.</p>
      ) : null}
      {dropping ? (
        <div className="pointer-events-none absolute -inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/10 text-sm font-medium text-accent">
          Drop to add
        </div>
      ) : null}

      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={isDisabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          add(files);
        }}
      />

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
