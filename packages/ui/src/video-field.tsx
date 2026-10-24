"use client";

import { Label, ProgressBar, Spinner } from "@heroui/react";
import { DropZone } from "@heroui-pro/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ActionButton, IconAction } from "./buttons.tsx";
import { ConfirmDialog } from "./dialogs.tsx";
import { Icon } from "./icon.tsx";
import {
  durationWords,
  formatFileSize,
  VIDEO_ACCEPT,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
  VIDEO_MIN_SECONDS,
  videoDurationProblem,
  videoFileProblem,
  videoLength,
} from "./media.ts";
import type { UploadProgress } from "./photos.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A saved video. */
export interface VideoItem {
  url: string;
  /** A still to show before it plays. */
  posterUrl?: string | null;
  durationS: number;
}

/** What the browser read from a video before it is sent. */
export interface VideoFacts {
  durationS: number;
  width: number;
  height: number;
  /** A still from about a second in, as a JPEG; null when the browser could not draw one. */
  poster: Blob | null;
}

const UNREADABLE = "We couldn't play that video here. Try an MP4 recorded on a phone.";

function once(target: HTMLVideoElement, event: string, ms = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(UNREADABLE));
    }, ms);
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error(UNREADABLE));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(event, ok);
      target.removeEventListener("error", bad);
    };
    target.addEventListener(event, ok);
    target.addEventListener("error", bad);
  });
}

/**
 * Open a video in a hidden player: its length, its size and a still for the poster. Throws an Error whose
 * message is the sentence to show when it can't be played, has no picture, or its length is outside
 * `min`..`max` seconds.
 */
export async function readVideo(
  file: File,
  { minSeconds = VIDEO_MIN_SECONDS, maxSeconds = VIDEO_MAX_SECONDS }: { minSeconds?: number; maxSeconds?: number } = {},
): Promise<VideoFacts> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "metadata";
  v.muted = true;
  v.playsInline = true;
  try {
    const loaded = once(v, "loadedmetadata");
    v.src = url;
    await loaded;
    // A recording straight from a browser (MediaRecorder) has no length in its header: seeking far past
    // the end makes the player find it.
    if (!Number.isFinite(v.duration)) {
      const found = once(v, "durationchange");
      v.currentTime = Number.MAX_SAFE_INTEGER;
      await found;
    }
    const duration = v.duration;
    const lengthProblem = videoDurationProblem(duration, minSeconds, maxSeconds);
    if (lengthProblem) throw new Error(lengthProblem);
    if (!v.videoWidth || !v.videoHeight) throw new Error("That file has sound but no picture.");
    const width = v.videoWidth;
    const height = v.videoHeight;
    let poster: Blob | null = null;
    try {
      const scale = Math.min(1, 1280 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      // About a second in; if that frame comes out blank (a recording seeks badly), the very start.
      for (const at of [Math.min(1, duration / 3), Math.min(0.1, duration / 10)]) {
        const seeked = once(v, "seeked", 8_000);
        v.currentTime = at;
        await seeked;
        if (v.readyState < 2) await once(v, "loadeddata", 3_000).catch(() => undefined);
        ctx?.drawImage(v, 0, 0, canvas.width, canvas.height);
        if (ctx && !isBlank(ctx, canvas.width, canvas.height)) {
          poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
          break;
        }
      }
    } catch {
      // No still is no reason to refuse the video: it plays without one.
      poster = null;
    }
    return { durationS: Math.max(1, Math.round(duration)), width, height, poster };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

/** A frame that is all one dark colour: a seek that has not drawn yet, not a still worth showing. */
function isBlank(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  const step = Math.max(4, Math.floor(data.length / 4 / 400)) * 4;
  let sum = 0;
  let max = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += step) {
    const light = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += light;
    max = Math.max(max, light);
    n += 1;
  }
  return n === 0 || (sum / n < 6 && max < 24);
}

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; name: string }
  | { kind: "uploading"; file: File; posterUrl: string | null; progress: number; controller: AbortController }
  | { kind: "failed"; file: File; facts: VideoFacts; posterUrl: string | null; error: string };

export interface VideoFieldProps {
  /** @default "Video tour" */
  label?: ReactNode;
  /** The saved video, or null. */
  video: VideoItem | null;
  /**
   * Send the video (the caller's route handler, which streams to the API). `facts` carry the length and
   * a poster still to send with it. Report progress, stop when `signal` aborts, resolve with the saved
   * video or throw an Error whose message is the sentence to show. The kit never calls the API itself.
   */
  upload: (file: File, facts: VideoFacts, onProgress: UploadProgress, signal: AbortSignal) => Promise<VideoItem>;
  /** A video was saved (a new one, or a replacement). */
  onUploaded: (video: VideoItem) => void;
  /** Take the saved video off (asked first). A promise keeps the dialog spinning. */
  onRemove?: () => void | Promise<void>;
  /** @default 100 MB */
  maxBytes?: number;
  /** @default 1 */
  minSeconds?: number;
  /** @default 180 (three minutes) */
  maxSeconds?: number;
  isDisabled?: boolean;
  errorMessage?: string | null;
  className?: string;
}

/**
 * One short video (a unit's walk-through): drop or choose an MP4, MOV or WebM file. The browser checks
 * the type and size, then opens it for its length (`minSeconds` to `maxSeconds`) and a poster still,
 * before anything is sent. The upload shows its progress with Cancel; a saved video plays inline with
 * the player's controls, and can be replaced or removed.
 */
export function VideoField({
  label = "Video tour",
  video,
  upload,
  onUploaded,
  onRemove,
  maxBytes = VIDEO_MAX_BYTES,
  minSeconds = VIDEO_MIN_SECONDS,
  maxSeconds = VIDEO_MAX_SECONDS,
  isDisabled,
  errorMessage,
  className,
}: VideoFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [problem, setProblem] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const live = useRef(phase);
  live.current = phase;

  // A new video starts on its poster again.
  const [shownUrl, setShownUrl] = useState(video?.url);
  if (shownUrl !== video?.url) {
    setShownUrl(video?.url);
    setPlaying(false);
  }
  // Stop an upload and free a preview when the field goes away.
  useEffect(
    () => () => {
      const p = live.current;
      if (p.kind === "uploading") p.controller.abort();
      if ((p.kind === "uploading" || p.kind === "failed") && p.posterUrl) URL.revokeObjectURL(p.posterUrl);
    },
    [],
  );

  const send = async (file: File, facts: VideoFacts, posterUrl: string | null) => {
    const controller = new AbortController();
    setPhase({ kind: "uploading", file, posterUrl, progress: 0, controller });
    try {
      const saved = await upload(
        file,
        facts,
        (fraction) =>
          setPhase((p) =>
            p.kind === "uploading" && p.controller === controller
              ? { ...p, progress: Math.min(1, Math.max(0, fraction)) }
              : p,
          ),
        controller.signal,
      );
      if (posterUrl) URL.revokeObjectURL(posterUrl);
      setPhase({ kind: "idle" });
      onUploaded(saved);
    } catch (e) {
      if (controller.signal.aborted) return;
      setPhase({
        kind: "failed",
        file,
        facts,
        posterUrl,
        error: e instanceof Error && e.message ? e.message : "The upload failed.",
      });
    }
  };

  const picked = async (file: File | undefined) => {
    if (!file || isDisabled) return;
    setProblem(null);
    const wrong = videoFileProblem(file, maxBytes);
    if (wrong) return setProblem(wrong);
    setPhase({ kind: "reading", name: file.name });
    try {
      const facts = await readVideo(file, { minSeconds, maxSeconds });
      await send(file, facts, facts.poster ? URL.createObjectURL(facts.poster) : null);
    } catch (e) {
      setPhase({ kind: "idle" });
      setProblem(e instanceof Error && e.message ? e.message : UNREADABLE);
    }
  };

  const cancel = () => {
    const p = live.current;
    if (p.kind === "uploading") p.controller.abort();
    if ((p.kind === "uploading" || p.kind === "failed") && p.posterUrl) URL.revokeObjectURL(p.posterUrl);
    setPhase({ kind: "idle" });
  };

  const remove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove();
      setConfirm(false);
    } finally {
      setRemoving(false);
    }
  };

  const choose = () => input.current?.click();
  const busy = phase.kind === "reading" || phase.kind === "uploading";
  const shownError = errorMessage || problem;
  const limits = `MP4, MOV or WebM, up to ${formatFileSize(maxBytes)}.`;

  return (
    <fieldset aria-labelledby={`${id}-label`} className={cx("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label id={`${id}-label`} elementType="span" isInvalid={Boolean(shownError)}>
          {label}
        </Label>
        <span className="text-xs text-muted">Up to {durationWords(maxSeconds)}</span>
      </div>

      {phase.kind === "uploading" || phase.kind === "failed" ? (
        <div
          className={cx(
            "flex items-start gap-3 rounded-lg border p-3",
            phase.kind === "failed" ? "border-danger/40" : "border-border",
          )}
        >
          <span className="relative flex aspect-video w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-default text-muted">
            {phase.posterUrl ? (
              // biome-ignore lint/performance/noImgElement: a local preview of the video being sent
              <img src={phase.posterUrl} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <Icon name="Video" />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm font-medium text-foreground">{phase.file.name}</span>
            {phase.kind === "uploading" ? (
              <>
                <span className="text-xs text-muted tabular">
                  {formatFileSize(phase.file.size)} · Uploading {Math.round(phase.progress * 100)}%
                </span>
                <ProgressBar value={phase.progress * 100} aria-label={`Uploading ${phase.file.name}`} size="sm">
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </>
            ) : (
              <span role="alert" className="text-xs text-danger">
                {phase.error}
              </span>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            {phase.kind === "failed" ? (
              <IconAction
                icon="ArrowRotateRight"
                label="Try again"
                onPress={() => void send(phase.file, phase.facts, phase.posterUrl)}
              />
            ) : null}
            <IconAction
              icon="Xmark"
              label={phase.kind === "uploading" ? "Cancel the upload" : "Remove"}
              onPress={cancel}
            />
          </div>
        </div>
      ) : video ? (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-default">
            {playing ? (
              // biome-ignore lint/a11y/useMediaCaption: a silent walk-through of a home, with no speech to caption
              <video
                src={video.url}
                poster={video.posterUrl ?? undefined}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="size-full bg-black object-contain"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={`Play the video, ${videoLength(video.durationS)}`}
                className="group relative flex size-full items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                {video.posterUrl ? (
                  // biome-ignore lint/performance/noImgElement: a signed, short-lived URL
                  <img src={video.posterUrl} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <video
                    src={video.url}
                    preload="metadata"
                    muted
                    playsInline
                    className="absolute inset-0 size-full object-cover"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="relative flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform group-hover:scale-105 motion-reduce:transition-none"
                >
                  <Icon name="PlayFill" className="size-5" />
                </span>
                <span
                  aria-hidden="true"
                  className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white tabular"
                >
                  {videoLength(video.durationS)}
                </span>
              </button>
            )}
          </div>
          {isDisabled ? null : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="flex gap-1.5">
                <ActionButton icon="ArrowsRotateRight" size="sm" isPending={phase.kind === "reading"} onPress={choose}>
                  Replace
                </ActionButton>
                {onRemove ? (
                  <ActionButton icon="TrashBin" size="sm" intent="danger-soft" onPress={() => setConfirm(true)}>
                    Remove
                  </ActionButton>
                ) : null}
              </span>
            </div>
          )}
        </div>
      ) : (
        <DropZone>
          <DropZone.Area
            isDisabled={isDisabled || busy}
            getDropOperation={() => (isDisabled || busy ? "cancel" : "copy")}
            onDrop={async (event) => {
              const first = event.items.find((item) => item.kind === "file");
              if (first?.kind === "file") await picked(await first.getFile());
            }}
            className={cx("py-6", shownError && "border-danger")}
          >
            <DropZone.Icon>{phase.kind === "reading" ? <Spinner size="sm" /> : <Icon name="Video" />}</DropZone.Icon>
            <DropZone.Label>
              {phase.kind === "reading" ? (
                `Checking ${phase.name}`
              ) : (
                <>
                  <span className="hidden sm:inline">Drop a video here</span>
                  <span className="sm:hidden">Add a video of the home</span>
                </>
              )}
            </DropZone.Label>
            <DropZone.Description>{limits}</DropZone.Description>
            <DropZone.Trigger isDisabled={isDisabled || busy} onPress={choose}>
              Choose a video
            </DropZone.Trigger>
          </DropZone.Area>
        </DropZone>
      )}

      {/* One picker for Choose and Replace. */}
      <input
        ref={input}
        type="file"
        accept={VIDEO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={isDisabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void picked(file);
        }}
      />

      {shownError ? (
        <p role="alert" className="px-1 text-xs text-danger">
          {shownError}
        </p>
      ) : null}

      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title="Remove the video?"
        confirmLabel="Remove video"
        intent="danger"
        isPending={removing}
        onConfirm={() => void remove()}
      >
        People looking at the home stop seeing it. You can add another at any time.
      </ConfirmDialog>
    </fieldset>
  );
}
