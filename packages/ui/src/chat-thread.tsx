"use client";

import { Button, Modal, Spinner, TextArea, TextField, Tooltip } from "@heroui/react";
import { ChatAttachment } from "@heroui-pro/react/chat-attachment";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "./icon.tsx";
import { fileSize, messageClock, messageDay, placeMessages, unreadStart, voiceClock } from "./message-groups.ts";
import { PhotoGallery } from "./photo-gallery.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** One file on a message. */
export interface ChatFile {
  id: string;
  kind: "image" | "file" | "audio";
  url: string;
  mime: string;
  sizeBytes: number | null;
  filename: string | null;
}

/** One line of a conversation, oldest first. */
export interface ChatLine {
  id: string;
  /** Ours (right), theirs (left) or the platform's (centred). */
  side: "me" | "them" | "system";
  senderName: string | null;
  bodyType: string;
  body: string | null;
  attachments: readonly ChatFile[];
  voiceDurationS: number | null;
  createdAt: string;
  /** Our lines only: sending, delivered (one tick), read (two ticks), failed. */
  receipt?: "sending" | "delivered" | "read" | "failed" | null;
  /** The fault a line is about, with where it opens. */
  fault?: { label: string; href: string } | null;
}

/** What the composer hands the caller to send. */
export interface ChatDraft {
  body: string;
  files: File[];
  voiceDurationS?: number;
}

export interface ChatThreadProps {
  lines: readonly ChatLine[];
  /** The reader's own name: their own lines carry no name; a teammate's do. */
  selfName?: string | null;
  /** When the reader last opened it: the "New messages" line goes after it. */
  lastReadAt?: string | null;
  /** Send, or throw an Error whose message says what went wrong. */
  onSend: (draft: ChatDraft) => Promise<void>;
  /** Older lines exist; `onLoadOlder` reads them. */
  hasOlder?: boolean;
  onLoadOlder?: () => Promise<void>;
  /** Why the conversation takes no messages (read only); the composer is replaced by this line. */
  closedReason?: string | null;
  placeholder?: string;
  /** Shown when there are no lines yet. */
  empty?: ReactNode;
  /** What the file picker offers (`accept`). */
  accept?: string;
  /** What is wrong with these files, in words, or null (the same rule the API keeps). */
  checkFiles?: (
    files: readonly { mime: string; sizeBytes: number; name: string }[],
    voiceDurationS?: number | null,
  ) => string | null;
  /** The longest voice note, in seconds. */
  maxVoiceSeconds?: number;
  className?: string;
}

/** A finger or mouse held this long on the microphone records until it lets go; shorter is a click. */
const HOLD_MS = 350;
/** Within this many pixels of the bottom counts as "at the newest line". */
const NEAR_BOTTOM_PX = 96;

/** The type a browser records voice in, best first: Opus in WebM or Ogg, AAC in MP4 (Safari). */
function recorderType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

function extensionFor(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

/* ------------------------------------------------------------------ pieces */

function Ticks({ receipt }: { receipt: ChatLine["receipt"] }) {
  if (!receipt) return null;
  if (receipt === "sending")
    return (
      <span className="inline-flex items-center gap-1 text-muted" title="Sending">
        <Icon name="Clock" className="size-3.5" />
        <span className="sr-only">Sending</span>
      </span>
    );
  if (receipt === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-danger">
        <Icon name="CircleExclamation" className="size-3.5" />
        Not sent
      </span>
    );
  return receipt === "read" ? (
    <span className="inline-flex text-accent" title="Read">
      <Icon name="CheckDouble" className="size-3.5" />
      <span className="sr-only">Read</span>
    </span>
  ) : (
    <span className="inline-flex text-muted" title="Delivered">
      <Icon name="Check" className="size-3.5" />
      <span className="sr-only">Delivered</span>
    </span>
  );
}

/** A voice note: play and pause, a bar to seek, and the time. The length comes with the note. */
export function VoiceNote({ url, durationS, mine }: { url: string; durationS: number | null; mine?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(durationS ?? 0);
  const total = length > 0 ? length : (durationS ?? 0);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };

  return (
    <div
      className={cx(
        "flex w-60 max-w-full items-center gap-2.5",
        mine ? "text-accent-soft-foreground" : "text-foreground",
      )}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: a voice note has no captions; its words are the sender's */}
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setLength(d);
        }}
      />
      <Button
        isIconOnly
        size="sm"
        variant={mine ? "primary" : "secondary"}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        onPress={toggle}
        className="shrink-0 rounded-full"
      >
        <Icon name={playing ? "PauseFill" : "PlayFill"} />
      </Button>
      <input
        type="range"
        min={0}
        max={Math.max(total, 0.1)}
        step={0.1}
        value={Math.min(at, total || at)}
        aria-label="Position in the voice note"
        onChange={(e) => {
          const a = audio.current;
          if (!a) return;
          a.currentTime = Number(e.currentTarget.value);
          setAt(a.currentTime);
        }}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-(--accent)"
      />
      <span className="w-10 shrink-0 text-right text-xs tabular text-muted">
        {voiceClock(playing || at > 0 ? at : total)}
      </span>
    </div>
  );
}

/** A document on a message: an icon, the name and size; opens or downloads from the app's own origin. */
function FileCard({ file }: { file: ChatFile }) {
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="flex w-64 max-w-full items-center gap-2.5 rounded-lg border border-separator bg-surface px-3 py-2 text-foreground no-underline transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-focus"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-default text-muted">
        <Icon name={file.mime === "application/pdf" ? "FileText" : "File"} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{file.filename ?? "Document"}</span>
        <span className="text-xs text-muted">
          {[file.mime === "application/pdf" ? "PDF" : null, fileSize(file.sizeBytes)].filter(Boolean).join(" · ")}
        </span>
      </span>
      <Icon name="ArrowDownToLine" className="text-muted" />
    </a>
  );
}

/** A message's photos: one large, or a grid of up to four with "+n". Pressing one opens the zoomable gallery. */
function Photos({ files, onOpen }: { files: readonly ChatFile[]; onOpen: (index: number) => void }) {
  const shown = files.slice(0, 4);
  const more = files.length - shown.length;
  return (
    <div
      className={cx(
        "grid w-64 max-w-full gap-1 overflow-hidden rounded-lg",
        shown.length > 1 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {shown.map((f, i) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={`Open photo ${i + 1} of ${files.length}`}
          className={cx(
            "relative block cursor-zoom-in overflow-hidden bg-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
            shown.length === 1 ? "aspect-4/3" : "aspect-square",
          )}
        >
          {/* biome-ignore lint/performance/noImgElement: the app's own short-lived file route */}
          <img src={f.url} alt="" loading="lazy" className="size-full object-cover" />
          {more > 0 && i === shown.length - 1 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
              +{more}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- composer */

interface Pending {
  key: string;
  file: File;
  preview: string | null;
}

function Composer({
  onSend,
  placeholder,
  accept,
  checkFiles,
  maxVoiceSeconds,
}: {
  onSend: (draft: ChatDraft) => Promise<void>;
  placeholder: string;
  accept?: string;
  checkFiles?: ChatThreadProps["checkFiles"];
  maxVoiceSeconds: number;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // Voice: idle, held (records while pressed), locked (a click: records until Stop or Send).
  const [rec, setRec] = useState<"idle" | "held" | "locked">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const pressedAt = useRef(0);
  const sendOnStop = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      for (const f of files) if (f.preview) URL.revokeObjectURL(f.preview);
    },
    [files],
  );
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      for (const t of recorder.current?.stream.getTracks() ?? []) t.stop();
    },
    [],
  );

  // The box grows with what is typed, up to six lines.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measured whenever the text changes
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const add = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const next = [
      ...files,
      ...Array.from(list).map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    ];
    const problem = checkFiles?.(next.map((p) => ({ mime: p.file.type, sizeBytes: p.file.size, name: p.file.name })));
    setError(problem ?? null);
    if (!problem) setFiles(next);
    else for (const p of next.slice(files.length)) if (p.preview) URL.revokeObjectURL(p.preview);
  };

  const send = async (draft: ChatDraft) => {
    if (busy) return;
    if (!draft.body.trim() && draft.files.length === 0) return;
    const problem = checkFiles?.(
      draft.files.map((f) => ({ mime: f.type, sizeBytes: f.size, name: f.name })),
      draft.voiceDurationS ?? null,
    );
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const keep = { text, files };
    if (!draft.voiceDurationS) {
      setText("");
      setFiles([]);
    }
    try {
      await onSend(draft);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "That message was not sent. Try again.");
      if (!draft.voiceDurationS) {
        setText(keep.text);
        setFiles(keep.files);
      }
    } finally {
      setBusy(false);
      area.current?.focus();
    }
  };

  const sendTyped = () => void send({ body: text.trim(), files: files.map((p) => p.file) });

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendTyped();
    }
  };

  // --- voice ---
  // The recorder's stop handler sends with the composer as it is then, not as it was when recording began.
  const sendRef = useRef(send);
  sendRef.current = send;

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("This browser can't record voice notes.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = recorderType();
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      r.onstop = () => {
        for (const t of stream.getTracks()) t.stop();
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
        const mime = (r.mimeType || type || "audio/webm").split(";")[0] ?? "audio/webm";
        const blob = new Blob(chunks.current, { type: mime });
        const go = sendOnStop.current;
        recorder.current = null;
        setRec("idle");
        setSeconds(0);
        if (!go) return;
        if (elapsed < 1 || blob.size === 0) {
          setError("Hold the microphone a little longer to record.");
          return;
        }
        const file = new File([blob], `voice-note.${extensionFor(mime)}`, { type: mime });
        void sendRef.current({
          body: "",
          files: [file],
          voiceDurationS: Math.min(Math.max(1, elapsed), maxVoiceSeconds),
        });
      };
      recorder.current = r;
      startedAt.current = Date.now();
      setSeconds(0);
      setError(null);
      r.start(250);
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(s);
        if (s >= maxVoiceSeconds) {
          sendOnStop.current = true;
          r.stop();
        }
      }, 200);
      return true;
    } catch {
      setError("Allow the microphone to record a voice note.");
      return false;
    }
  }, [maxVoiceSeconds]);

  const stopRecording = (sendIt: boolean) => {
    sendOnStop.current = sendIt;
    recorder.current?.stop();
  };

  const pressing = useRef(false);
  const onMicDown = async (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || rec !== "idle" || busy) return;
    pressedAt.current = Date.now();
    pressing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (!(await startRecording())) return;
    // Let go while the microphone was being opened: that was a click, so record until Stop or Send.
    setRec(pressing.current ? "held" : "locked");
  };
  const onMicUp = () => {
    const quick = Date.now() - pressedAt.current < HOLD_MS;
    pressing.current = false;
    if (rec !== "held") return;
    if (quick) setRec("locked");
    else stopRecording(true);
  };

  const recording = rec !== "idle";
  const canSend = (text.trim().length > 0 || files.length > 0) && !busy;

  return (
    <div className="flex flex-col gap-2 border-t border-separator bg-surface px-3 pt-2.5 pb-3 sm:px-4">
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <Icon name="CircleExclamation" className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((p) => (
            <ChatAttachment
              key={p.key}
              mimeType={p.file.type}
              name={p.file.name}
              size={p.file.size}
              src={p.preview ?? undefined}
            >
              <ChatAttachment.Preview />
              <ChatAttachment.Info />
              <ChatAttachment.Remove
                aria-label={`Remove ${p.file.name}`}
                onPress={() => {
                  if (p.preview) URL.revokeObjectURL(p.preview);
                  setFiles(files.filter((f) => f.key !== p.key));
                }}
              />
            </ChatAttachment>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-1.5">
        <input
          ref={picker}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-chat-files=""
          onChange={(e) => {
            add(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
        {recording ? (
          <div
            className="flex min-h-10 flex-1 items-center gap-3 rounded-xl bg-danger-soft px-3 text-sm text-danger-soft-foreground"
            aria-live="polite"
          >
            <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            <span className="tabular font-medium">{voiceClock(seconds)}</span>
            <span className="text-xs">
              {rec === "held" ? "Recording. Let go to send." : `Recording, up to ${voiceClock(maxVoiceSeconds)}`}
            </span>
          </div>
        ) : (
          <>
            <Tooltip delay={400}>
              <Button
                isIconOnly
                variant="ghost"
                aria-label="Attach photos or files"
                onPress={() => picker.current?.click()}
                isDisabled={busy}
                className="shrink-0"
              >
                <Icon name="Paperclip" />
              </Button>
              <Tooltip.Content>Attach photos or files</Tooltip.Content>
            </Tooltip>
            <TextField
              aria-label="Message"
              value={text}
              onChange={setText}
              className="min-w-0 flex-1"
              isDisabled={busy && files.length > 0}
            >
              <TextArea
                ref={area}
                rows={1}
                placeholder={placeholder}
                onKeyDown={onKeyDown}
                className="max-h-40 min-h-10 w-full resize-none py-2"
              />
            </TextField>
          </>
        )}
        {recording ? (
          <>
            <Button
              variant="ghost"
              onPress={() => stopRecording(false)}
              aria-label="Cancel the voice note"
              className="shrink-0"
            >
              <Icon name="TrashBin" />
              <span className="max-sm:sr-only">Cancel</span>
            </Button>
            {rec === "locked" ? (
              <Button
                variant="primary"
                onPress={() => stopRecording(true)}
                aria-label="Send the voice note"
                className="shrink-0"
              >
                <Icon name="PaperPlane" />
                Send
              </Button>
            ) : null}
          </>
        ) : canSend || text.length > 0 || files.length > 0 ? (
          <Button
            isIconOnly
            variant="primary"
            aria-label="Send"
            onPress={sendTyped}
            isDisabled={!canSend}
            isPending={busy}
            className="shrink-0"
          >
            {busy ? <Spinner size="sm" color="current" /> : <Icon name="PaperPlane" />}
          </Button>
        ) : (
          <Tooltip delay={400}>
            <Button
              isIconOnly
              variant="secondary"
              aria-label="Record a voice note: hold to talk, or click to start and stop"
              onPointerDown={onMicDown}
              onPointerUp={onMicUp}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && rec === "idle") {
                  e.preventDefault();
                  void startRecording().then((ok) => ok && setRec("locked"));
                }
              }}
              isDisabled={busy}
              className="shrink-0 touch-none select-none"
              data-chat-mic=""
            >
              {busy ? <Spinner size="sm" color="current" /> : <Icon name="Microphone" />}
            </Button>
            <Tooltip.Content>Hold to record, or click to start</Tooltip.Content>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- thread */

/**
 * A conversation (rentals P3.4): bubbles grouped by sender (lines within five minutes sit under one
 * time and one name), day dividers (Today, Yesterday, the date), photos that open in the zoomable
 * gallery, documents as cards, voice notes with a player and their length, a "New messages" line,
 * delivered and read ticks on our lines, and a composer with files, photos, a hold-or-click voice
 * recorder and Enter to send. It stays at the newest line while photos load and while new lines
 * arrive, unless the reader scrolled up to read older ones (then a button takes them back down).
 * Reads and sends are the caller's: the kit never calls the API.
 */
export function ChatThread({
  lines,
  selfName,
  lastReadAt,
  onSend,
  hasOlder,
  onLoadOlder,
  closedReason,
  placeholder = "Write a message",
  empty,
  accept,
  checkFiles,
  maxVoiceSeconds = 120,
  className,
}: ChatThreadProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [gallery, setGallery] = useState<{ files: readonly ChatFile[]; start: number } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [now, setNow] = useState<string | undefined>(undefined);
  // "Today" and "Yesterday" are the browser's: the server prints full dates, so the first paint matches.
  useEffect(() => setNow(new Date().toISOString()), []);

  // The unread line is fixed when the conversation opens, so it does not jump as it is read.
  // The parent keys this component by conversation, so this runs once per opened conversation.
  const [unreadId] = useState(() =>
    unreadStart(
      lines.map((l) => ({
        id: l.id,
        createdAt: l.createdAt,
        fromUs: l.side === "me",
        bodyType: l.side === "system" ? "system" : l.bodyType,
      })),
      lastReadAt,
    ),
  );

  const places = useMemo(
    () =>
      placeMessages(
        lines.map((l) => ({
          createdAt: l.createdAt,
          fromUs: l.side === "me",
          bodyType: l.side === "system" ? "system" : l.bodyType === "system" ? "system" : "text",
          senderName: l.senderName,
        })),
      ),
    [lines],
  );

  const toBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setShowJump(false);
  }, []);

  // Opening: at the "New messages" line when there is one, else at the newest line.
  const opened = useRef(false);
  useLayoutEffect(() => {
    if (opened.current || lines.length === 0) return;
    opened.current = true;
    const el = scroller.current;
    const mark = unreadId ? el?.querySelector<HTMLElement>(`[data-line="${unreadId}"]`) : null;
    if (el && mark) {
      el.scrollTop = Math.max(0, mark.offsetTop - 64);
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      setShowJump(!atBottom.current);
    } else toBottom();
  }, [lines.length, unreadId, toBottom]);

  // A new line at the end: follow it when the reader was at the bottom, or when it is ours.
  const lastId = lines.at(-1)?.id;
  const lastMine = lines.at(-1)?.side === "me";
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the newest line changes
  useLayoutEffect(() => {
    if (!opened.current) return;
    if (atBottom.current || lastMine) toBottom();
    else setShowJump(true);
  }, [lastId]);

  // Photos and players load after the lines are drawn and grow them: stay at the newest line meanwhile.
  useEffect(() => {
    const box = content.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) {
        const el = scroller.current;
        if (el) el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottom.current = near;
    if (near) setShowJump(false);
  };

  const older = async () => {
    const el = scroller.current;
    if (!el || !onLoadOlder || loadingOlder) return;
    const before = el.scrollHeight - el.scrollTop;
    setLoadingOlder(true);
    try {
      await onLoadOlder();
    } finally {
      setLoadingOlder(false);
      // Keep the line the reader was looking at where it was.
      requestAnimationFrame(() => {
        if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight - before;
      });
    }
  };

  return (
    <div className={cx("relative flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-5"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div ref={content} className="flex min-h-full flex-col justify-end py-4">
          {hasOlder ? (
            <div className="flex justify-center pb-3">
              <Button size="sm" variant="ghost" onPress={older} isPending={loadingOlder}>
                {loadingOlder ? <Spinner size="sm" color="current" /> : <Icon name="ChevronUp" />}
                Earlier messages
              </Button>
            </div>
          ) : null}
          {lines.length === 0 ? <div className="flex flex-1 items-center justify-center py-10">{empty}</div> : null}
          {lines.map((line, i) => {
            const place = places[i] ?? { newDay: false, first: true, last: true };
            const mine = line.side === "me";
            const photos = line.attachments.filter((a) => a.kind === "image");
            const docs = line.attachments.filter((a) => a.kind === "file");
            const voice = line.attachments.find((a) => a.kind === "audio");
            const showName =
              place.first &&
              line.side !== "system" &&
              line.senderName &&
              (!mine || (selfName && line.senderName !== selfName));
            return (
              <div key={line.id} data-line={line.id} className="flex flex-col">
                {place.newDay ? (
                  <div className="my-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-separator" />
                    <span className="text-xs font-medium text-muted">{messageDay(line.createdAt, now)}</span>
                    <span className="h-px flex-1 bg-separator" />
                  </div>
                ) : null}
                {line.id === unreadId ? (
                  <div className="my-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-accent/40" />
                    <span className="text-xs font-semibold text-accent">New messages</span>
                    <span className="h-px flex-1 bg-accent/40" />
                  </div>
                ) : null}
                {line.side === "system" ? (
                  <p className="my-2 self-center rounded-full bg-default px-3 py-1 text-center text-xs text-muted">
                    {line.body}
                  </p>
                ) : (
                  <div
                    className={cx("flex flex-col", mine ? "items-end" : "items-start", place.first ? "mt-3" : "mt-0.5")}
                  >
                    {showName ? (
                      <span className="mb-1 px-1 text-xs font-medium text-muted">{line.senderName}</span>
                    ) : null}
                    <div
                      className={cx(
                        "flex max-w-[85%] flex-col gap-1.5 sm:max-w-[70%]",
                        mine ? "items-end" : "items-start",
                      )}
                    >
                      {photos.length > 0 ? (
                        <Photos files={photos} onOpen={(start) => setGallery({ files: photos, start })} />
                      ) : null}
                      {voice ? (
                        <div className={cx("rounded-2xl px-3 py-2", mine ? "bg-accent-soft" : "bg-default")}>
                          <VoiceNote url={voice.url} durationS={line.voiceDurationS} mine={mine} />
                        </div>
                      ) : null}
                      {docs.map((d) => (
                        <FileCard key={d.id} file={d} />
                      ))}
                      {line.body || line.fault ? (
                        <div
                          className={cx(
                            "flex flex-col gap-1 rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                            mine ? "bg-accent-soft text-accent-soft-foreground" : "bg-default text-foreground",
                            mine ? (place.last ? "rounded-br-md" : "") : place.last ? "rounded-bl-md" : "",
                          )}
                        >
                          {line.fault ? (
                            <a
                              href={line.fault.href}
                              className="inline-flex items-center gap-1.5 self-start rounded-md bg-surface/70 px-2 py-0.5 text-xs font-medium text-foreground no-underline hover:underline"
                            >
                              <Icon name="Wrench" className="size-3.5" />
                              {line.fault.label}
                            </a>
                          ) : null}
                          {line.body ? <span>{line.body}</span> : null}
                        </div>
                      ) : null}
                    </div>
                    {place.last ? (
                      <span className="mt-1 flex items-center gap-1 px-1 text-xs tabular text-muted">
                        <time dateTime={line.createdAt}>{messageClock(line.createdAt)}</time>
                        {mine ? <Ticks receipt={line.receipt ?? null} /> : null}
                      </span>
                    ) : mine && (line.receipt === "sending" || line.receipt === "failed") ? (
                      <span className="mt-0.5 px-1 text-xs">
                        <Ticks receipt={line.receipt} />
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {showJump ? (
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label="Go to the newest message"
          onPress={() => toBottom(true)}
          className="absolute right-4 bottom-24 z-10 rounded-full shadow-md"
        >
          <Icon name="ArrowDown" />
        </Button>
      ) : null}
      {closedReason ? (
        <p className="flex items-center gap-2 border-t border-separator px-4 py-3 text-sm text-muted">
          <Icon name="Lock" className="shrink-0" />
          {closedReason}
        </p>
      ) : (
        <Composer
          onSend={async (d) => {
            atBottom.current = true;
            await onSend(d);
          }}
          placeholder={placeholder}
          accept={accept}
          checkFiles={checkFiles}
          maxVoiceSeconds={maxVoiceSeconds}
        />
      )}
      <Modal.Backdrop isOpen={gallery !== null} onOpenChange={(open) => (open ? undefined : setGallery(null))}>
        <Modal.Container size="lg">
          <Modal.Dialog aria-label="Photos">
            <Modal.CloseTrigger aria-label="Close" />
            <Modal.Body className="pt-10">
              {gallery ? (
                <PhotoGallery
                  label="Photos in this message"
                  photos={[...gallery.files.slice(gallery.start), ...gallery.files.slice(0, gallery.start)].map(
                    (f) => ({
                      url: f.url,
                      alt: f.filename ?? undefined,
                    }),
                  )}
                />
              ) : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
