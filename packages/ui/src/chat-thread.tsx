"use client";

import { Avatar, Button, Dropdown, Label, Modal } from "@heroui/react";
import {
  ChatAttachment,
  ChatAttachmentGroup,
  ChatAttachmentInput,
  ChatConversation,
  ChatListView,
  ChatLoader,
  ChatMessage,
  PromptInput,
  Segment,
} from "@heroui-pro/react";
import { type PointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialsOf } from "./cells.tsx";
import { Icon } from "./icon.tsx";
import { fileSize, messageClock, messageDay, placeMessages, unreadStart, voiceClock } from "./message-groups.ts";
import { PhotoGallery } from "./photo-gallery.tsx";
import { EmptyBlock } from "./states.tsx";
import { SearchBar } from "./table.tsx";

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
  /** Send a line that failed again, or drop it (lines with `receipt: "failed"`). */
  onRetry?: (lineId: string) => void;
  onDiscard?: (lineId: string) => void;
  /** Older lines exist; `onLoadOlder` reads them. */
  hasOlder?: boolean;
  onLoadOlder?: () => Promise<void>;
  /** Why the conversation takes no messages (read only); the composer is replaced by this line. */
  closedReason?: string | null;
  placeholder?: string;
  /** Shown when there are no lines yet. */
  empty?: ReactNode;
  /** What the file picker offers (`accept`). Without it the composer takes text only. */
  accept?: string;
  /** What is wrong with these files, in words, or null (the same rule the API keeps). */
  checkFiles?: (
    files: readonly { mime: string; sizeBytes: number; name: string }[],
    voiceDurationS?: number | null,
  ) => string | null;
  /** The longest voice note, in seconds; 0 turns voice notes off. */
  maxVoiceSeconds?: number;
  /** The lines are on their way: a skeleton in their place. */
  isLoading?: boolean;
  /** Who is typing now, when the live line says so. */
  typing?: string | null;
  /** Saved replies the composer offers (a business's templates), by group (a language). */
  suggestions?: readonly ChatSuggestion[];
  className?: string;
}

/** A saved reply: pressing it puts its words in the composer. */
export interface ChatSuggestion {
  id: string;
  label: string;
  text: string;
  /** "English", "Kinyarwanda". */
  group?: string;
}

/** A finger or mouse held this long on the microphone records until it lets go; shorter is a click. */
const HOLD_MS = 350;

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

/** Bar heights for a voice note's waveform, steady for the same note (from its address), 0.25 to 1. */
export function waveform(seed: string, bars = 32): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    // Speech-like: louder in the middle, softer at both ends.
    const shape = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / bars);
    out.push(Math.max(0.25, Math.min(1, 0.3 + r * 0.7 * shape)));
  }
  return out;
}

/** A voice note: play and pause, a waveform that fills as it plays (press it to seek), and the time. */
export function VoiceNote({ url, durationS, mine }: { url: string; durationS: number | null; mine?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(durationS ?? 0);
  const total = length > 0 ? length : (durationS ?? 0);
  const bars = useMemo(() => waveform(url), [url]);
  const progress = total > 0 ? Math.min(1, at / total) : 0;

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const seek = (fraction: number) => {
    const a = audio.current;
    if (!a || total <= 0) return;
    a.currentTime = Math.max(0, Math.min(total, fraction * total));
    setAt(a.currentTime);
  };

  return (
    <div className="flex w-56 max-w-full items-center gap-2.5">
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
        variant="primary"
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        onPress={toggle}
        className="size-9 shrink-0 rounded-full"
      >
        <Icon name={playing ? "PauseFill" : "PlayFill"} />
      </Button>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Position in the voice note"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(at)}
        aria-valuetext={`${voiceClock(at)} of ${voiceClock(total)}`}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          seek((e.clientX - box.left) / box.width);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seek(progress + 0.1);
          else if (e.key === "ArrowLeft") seek(progress - 0.1);
          else return;
          e.preventDefault();
        }}
        className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-0.5 rounded-sm focus-visible:outline-2 focus-visible:outline-focus"
      >
        {bars.map((v, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars, never reordered
            key={i}
            className={cx(
              "w-0.5 flex-1 rounded-full transition-colors",
              (i + 0.5) / bars.length <= progress ? "bg-accent" : mine ? "bg-accent/35" : "bg-muted/40",
            )}
            style={{ height: `${Math.round(v * 100)}%` }}
          />
        ))}
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular text-muted">
        {voiceClock(playing || at > 0 ? at : total)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Ticks({ receipt }: { receipt: ChatLine["receipt"] }) {
  if (!receipt || receipt === "failed") return null;
  const [icon, words, tone] =
    receipt === "sending"
      ? (["Clock", "Sending", "text-muted"] as const)
      : receipt === "read"
        ? (["CheckDouble", "Read", "text-accent"] as const)
        : (["Check", "Sent", "text-muted"] as const);
  return (
    <span className={cx("inline-flex", tone)} title={words}>
      <Icon name={icon} className="size-3.5" />
      <span className="sr-only">{words}</span>
    </span>
  );
}

/** A document on a message (Pro ChatAttachment as a file card); opens from the app's own origin. */
function FileCard({ file }: { file: ChatFile }) {
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="block max-w-full rounded-xl text-foreground no-underline focus-visible:outline-2 focus-visible:outline-focus"
      aria-label={`Open ${file.filename ?? "the document"}${file.sizeBytes ? `, ${fileSize(file.sizeBytes)}` : ""}`}
    >
      <ChatAttachment
        mimeType={file.mime}
        name={file.filename ?? "Document"}
        size={file.sizeBytes ?? undefined}
        mediaType="document"
      />
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
        "grid w-64 max-w-full gap-0.5 overflow-hidden rounded-lg",
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

/**
 * The composer (Pro PromptInput): the words, files picked or dropped (ChatAttachmentInput, shown as
 * ChatAttachments with Remove), a hold-or-click voice note, and Send. Enter sends, Shift+Enter breaks a line.
 */
function Composer({
  onSend,
  placeholder,
  accept,
  checkFiles,
  maxVoiceSeconds,
  suggestions,
}: {
  onSend: (draft: ChatDraft) => Promise<void>;
  placeholder: string;
  accept?: string;
  checkFiles?: ChatThreadProps["checkFiles"];
  maxVoiceSeconds: number;
  suggestions?: readonly ChatSuggestion[];
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const takesFiles = Boolean(accept);
  const takesVoice = takesFiles && maxVoiceSeconds > 0;

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

  const add = (list: File[]) => {
    if (list.length === 0) return;
    const next = [
      ...files,
      ...list.map((file) => ({
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

  // Sending never blocks typing: the line shows at once (the caller draws it as "sending", then sent
  // or failed with Retry), and the box is free for the next one straight away.
  const send = async (draft: ChatDraft) => {
    if (!draft.body.trim() && draft.files.length === 0) return;
    const problem = checkFiles?.(
      draft.files.map((f) => ({ mime: f.type, sizeBytes: f.size, name: f.name })),
      draft.voiceDurationS ?? null,
    );
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (!draft.voiceDurationS) {
      setText("");
      setFiles([]);
    }
    try {
      await onSend(draft);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "That message was not sent. Try again.");
    }
  };

  const sendTyped = () => void send({ body: text.trim(), files: files.map((p) => p.file) });

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
    if (e.button !== 0 || rec !== "idle") return;
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
  const canSend = text.trim().length > 0 || files.length > 0;

  const shellBody = (
    <>
      {files.length > 0 ? (
        <PromptInput.Attachments>
          <ChatAttachmentGroup>
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
          </ChatAttachmentGroup>
        </PromptInput.Attachments>
      ) : null}
      <PromptInput.Content>
        {recording ? (
          <div className="flex min-h-10 items-center gap-3 px-1 text-sm text-danger" aria-live="polite">
            <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            <span className="font-medium tabular">{voiceClock(seconds)}</span>
            <span className="text-xs text-muted">{rec === "held" ? "Let go to send" : "Recording"}</span>
          </div>
        ) : (
          <PromptInput.TextArea aria-label="Message" placeholder={placeholder} rows={1} />
        )}
      </PromptInput.Content>
      <PromptInput.Toolbar>
        <PromptInput.ToolbarStart>
          {takesFiles && !recording ? (
            <ChatAttachmentInput.Trigger
              aria-label="Attach photos or files"
              render={(props) => (
                <PromptInput.Action {...props} tooltip="Attach photos or files">
                  <Icon name="Paperclip" />
                </PromptInput.Action>
              )}
            />
          ) : null}
          {suggestions && suggestions.length > 0 && !recording ? (
            <Dropdown>
              <PromptInput.Action aria-label="Saved replies" tooltip="Saved replies">
                <Icon name="FileText" />
              </PromptInput.Action>
              <Dropdown.Popover placement="top start" className="max-h-80 min-w-56 overflow-y-auto">
                <Dropdown.Menu
                  aria-label="Saved replies"
                  onAction={(key) => {
                    const hit = suggestions.find((x) => x.id === String(key));
                    if (hit) setText(hit.text);
                  }}
                >
                  {[...new Set(suggestions.map((x) => x.group ?? ""))].map((group) => (
                    <Dropdown.Section key={group || "all"} aria-label={group || "Replies"}>
                      {suggestions
                        .filter((x) => (x.group ?? "") === group)
                        .map((x) => (
                          <Dropdown.Item key={x.id} id={x.id} textValue={x.label}>
                            <Label>{group ? `${x.label} (${group})` : x.label}</Label>
                          </Dropdown.Item>
                        ))}
                    </Dropdown.Section>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : null}
        </PromptInput.ToolbarStart>
        <PromptInput.ToolbarEnd className="gap-1.5">
          {recording ? (
            <>
              <Button size="sm" variant="ghost" onPress={() => stopRecording(false)} aria-label="Cancel the voice note">
                <Icon name="TrashBin" />
                <span className="max-sm:sr-only">Cancel</span>
              </Button>
              {rec === "locked" ? (
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => stopRecording(true)}
                  aria-label="Send the voice note"
                >
                  <Icon name="PaperPlane" />
                  Send
                </Button>
              ) : null}
            </>
          ) : takesVoice && !canSend ? (
            <Button
              isIconOnly
              size="sm"
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
              className="touch-none select-none"
              data-chat-mic=""
            >
              <Icon name="Microphone" />
            </Button>
          ) : (
            <PromptInput.Send isDisabled={!canSend} aria-label="Send" />
          )}
        </PromptInput.ToolbarEnd>
      </PromptInput.Toolbar>
    </>
  );

  return (
    <div className="flex flex-col gap-1.5 border-t border-separator bg-surface px-3 pt-2.5 pb-3 sm:px-4">
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <Icon name="CircleExclamation" className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      <PromptInput
        value={text}
        onValueChange={setText}
        onSubmit={sendTyped}
        status={error ? "error" : "ready"}
        layout="inline"
        variant="secondary"
        maxHeight={160}
      >
        {takesFiles ? (
          <ChatAttachmentInput accept={accept} onFilesSelected={add}>
            <ChatAttachmentInput.Dropzone
              render={(props) => <PromptInput.Shell {...props}>{shellBody}</PromptInput.Shell>}
            />
          </ChatAttachmentInput>
        ) : (
          <PromptInput.Shell>{shellBody}</PromptInput.Shell>
        )}
      </PromptInput>
    </div>
  );
}

/* ----------------------------------------------------------------- thread */

function Divider({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <span className={cx("h-px flex-1", accent ? "bg-accent/40" : "bg-separator")} />
      <span className={cx("text-xs font-medium", accent ? "text-accent" : "text-muted")}>{children}</span>
      <span className={cx("h-px flex-1", accent ? "bg-accent/40" : "bg-separator")} />
    </div>
  );
}

/**
 * A conversation, the same for every role (HeroUI Pro chat): a ChatConversation viewport that stays at
 * the newest line, ChatMessage.User bubbles for our lines and ChatMessage.Assistant rows (with the
 * sender's avatar once per group) for theirs, day dividers and a "New messages" line, photos that open
 * in the zoomable gallery, documents as ChatAttachments, voice notes with a player, sent and read
 * ticks, Retry on a line that failed, a skeleton while loading, and the PromptInput composer.
 * Reads and sends are the caller's: the kit never calls the API.
 */
export function ChatThread({
  lines,
  selfName,
  lastReadAt,
  onSend,
  onRetry,
  onDiscard,
  hasOlder,
  onLoadOlder,
  closedReason,
  placeholder = "Write a message",
  empty,
  accept,
  checkFiles,
  maxVoiceSeconds = 120,
  isLoading = false,
  typing,
  suggestions,
  className,
}: ChatThreadProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [gallery, setGallery] = useState<{ files: readonly ChatFile[]; start: number } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [now, setNow] = useState<string | undefined>(undefined);
  // "Today" and "Yesterday" are the browser's: the server prints full dates, so the first paint matches.
  useEffect(() => setNow(new Date().toISOString()), []);

  // The unread line is fixed when the conversation opens, so it does not jump as it is read.
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
      <ChatConversation
        ref={scroller}
        initial="instant"
        className="min-h-0 flex-1 px-3 sm:px-5"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-relevant="additions"
      >
        <ChatConversation.Content className="flex min-h-full max-w-none flex-col justify-end gap-0 py-4">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              <ChatLoader.Skeleton label="Loading the conversation" />
              <ChatLoader.Skeleton />
            </div>
          ) : null}
          {hasOlder && !isLoading ? (
            <div className="flex justify-center pb-3">
              <Button size="sm" variant="ghost" onPress={older} isPending={loadingOlder}>
                <Icon name="ChevronUp" />
                Earlier messages
              </Button>
            </div>
          ) : null}
          {lines.length === 0 && !isLoading ? (
            <div className="flex flex-1 items-center justify-center py-10">{empty}</div>
          ) : null}
          {lines.map((line, i) => {
            const place = places[i] ?? { newDay: false, first: true, last: true };
            const mine = line.side === "me";
            const photos = line.attachments.filter((a) => a.kind === "image");
            const docs = line.attachments.filter((a) => a.kind === "file");
            const voice = line.attachments.find((a) => a.kind === "audio");
            // One to one: the header names the other side, so only a teammate's own lines carry a name.
            const showName = place.first && mine && line.senderName && selfName && line.senderName !== selfName;
            const media = photos.length > 0 || docs.length > 0;
            const bubble = (
              <ChatMessage.Bubble
                className={cx(
                  "flex max-w-full flex-col gap-1 overflow-hidden",
                  mine ? "bg-accent-soft text-accent-soft-foreground" : "bg-default",
                  media ? "p-1" : voice ? "px-2 py-1.5" : "",
                  line.receipt === "sending" && "opacity-80",
                )}
              >
                {photos.length > 0 ? (
                  <Photos files={photos} onOpen={(start) => setGallery({ files: photos, start })} />
                ) : null}
                {voice ? <VoiceNote url={voice.url} durationS={line.voiceDurationS} mine={mine} /> : null}
                {docs.length > 0 ? (
                  <ChatMessage.Media>
                    {docs.map((d) => (
                      <FileCard key={d.id} file={d} />
                    ))}
                  </ChatMessage.Media>
                ) : null}
                {line.body || line.fault ? (
                  <ChatMessage.Content
                    className={cx(
                      "flex flex-col gap-1 whitespace-pre-wrap break-words text-inherit",
                      media && "px-2 pt-0.5 pb-1",
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
                  </ChatMessage.Content>
                ) : null}
              </ChatMessage.Bubble>
            );
            const foot =
              line.receipt === "failed" ? (
                <ChatMessage.Actions className="items-center gap-1 text-xs text-danger opacity-100">
                  <Icon name="CircleExclamation" className="size-3.5" />
                  <span className="pr-1">Not sent</span>
                  {onRetry ? (
                    <ChatMessage.Action aria-label="Send again" tooltip="Send again" onPress={() => onRetry(line.id)}>
                      <Icon name="ArrowRotateRight" className="size-3.5" />
                    </ChatMessage.Action>
                  ) : null}
                  {onDiscard ? (
                    <ChatMessage.Action aria-label="Remove" tooltip="Remove" onPress={() => onDiscard(line.id)}>
                      <Icon name="TrashBin" className="size-3.5" />
                    </ChatMessage.Action>
                  ) : null}
                </ChatMessage.Actions>
              ) : place.last || line.receipt === "sending" ? (
                <span className="mt-1 flex items-center gap-1 px-1 text-xs text-muted tabular">
                  <time dateTime={line.createdAt}>{messageClock(line.createdAt)}</time>
                  {mine ? <Ticks receipt={line.receipt ?? null} /> : null}
                </span>
              ) : null;
            return (
              <div key={line.id} data-line={line.id} className="flex flex-col">
                {place.newDay ? <Divider>{messageDay(line.createdAt, now)}</Divider> : null}
                {line.id === unreadId ? <Divider accent>New messages</Divider> : null}
                {line.side === "system" ? (
                  <p className="my-2 self-center rounded-full bg-default px-3 py-1 text-center text-xs text-muted">
                    {line.body}
                  </p>
                ) : mine ? (
                  <ChatMessage.User className={cx("gap-0", place.first ? "mt-3" : "mt-0.5")}>
                    {showName ? (
                      <span className="mb-1 px-1 text-xs font-medium text-muted">{line.senderName}</span>
                    ) : null}
                    <div className="flex max-w-[85%] flex-col items-end sm:max-w-[68%]">
                      {bubble}
                      {foot}
                    </div>
                  </ChatMessage.User>
                ) : (
                  <ChatMessage.Assistant className={cx("py-0", place.first ? "mt-3" : "mt-0.5")}>
                    <ChatMessage.Avatar
                      show={place.first}
                      alt={line.senderName ?? "Them"}
                      fallback={initialsOf(line.senderName ?? "?")}
                    />
                    <ChatMessage.Body className="items-start gap-0 pe-0">
                      <div className="flex max-w-[85%] flex-col items-start sm:max-w-[68%]">
                        {bubble}
                        {foot}
                      </div>
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                )}
              </div>
            );
          })}
          {typing ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <ChatLoader.Dots label={`${typing} is typing`} />
              <span>{typing} is typing</span>
            </div>
          ) : null}
        </ChatConversation.Content>
        <ChatConversation.ScrollAnchor />
        <ChatConversation.ScrollButton aria-label="Go to the newest message" />
      </ChatConversation>
      {closedReason ? (
        <p className="flex items-center gap-2 border-t border-separator px-4 py-3 text-sm text-muted">
          <Icon name="Lock" className="shrink-0" />
          {closedReason}
        </p>
      ) : (
        <Composer
          onSend={onSend}
          placeholder={placeholder}
          accept={accept}
          checkFiles={checkFiles}
          maxVoiceSeconds={maxVoiceSeconds}
          suggestions={suggestions}
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

/* ------------------------------------------------------------------ inbox */

/** One conversation in an inbox list. */
export interface ChatInboxRow {
  id: string;
  name: string;
  /** Beside the name: the unit, the room. */
  tag?: string | null;
  /** The last line, or what the conversation is about. */
  preview?: string | null;
  /** When the last line came (ISO), for "14:05", "Yesterday", "Tue 20 Oct". */
  at?: string | null;
  unread?: number;
  /** The words a search finds it by. */
  search?: readonly (string | null | undefined)[];
  /** Which filter beyond All and Unread it belongs to ("brokers"). */
  group?: string;
}

/** "14:05" today, "Yesterday", "28 Oct" before. */
function when(iso: string | null | undefined, now: string | undefined): string {
  if (!iso) return "";
  const day = messageDay(iso, now);
  if (day === "Today") return messageClock(iso);
  if (day === "Yesterday") return day;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Kigali" }).format(
    new Date(iso),
  );
}

/**
 * Every role's inbox (HeroUI Pro ChatListView): the conversations with a search and All / Unread
 * filters on the left, the open one on the right. On a phone one pane shows at a time, with Back.
 */
export function ChatInbox({
  rows,
  selectedId,
  onSelect,
  onBack,
  searchPlaceholder = "Search",
  groups,
  header,
  children,
  className,
}: {
  rows: readonly ChatInboxRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Back to the list on a phone. */
  onBack: () => void;
  searchPlaceholder?: string;
  /** More filters beside All and Unread, by `row.group` ("Brokers"). */
  groups?: readonly { id: string; label: string }[];
  /** The open conversation's header (who, about what, links). */
  header?: ReactNode;
  /** The open conversation (a ChatThread), or nothing. */
  children?: ReactNode;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const [now, setNow] = useState<string | undefined>(undefined);
  useEffect(() => setNow(new Date().toISOString()), []);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (show === "all" || (show === "unread" ? (r.unread ?? 0) > 0 : r.group === show)) &&
      (!needle || [r.name, r.tag, ...(r.search ?? [])].some((v) => v?.toLowerCase().includes(needle))),
  );
  const filters = [
    { id: "all", label: "All", count: rows.length },
    { id: "unread", label: "Unread", count: rows.filter((r) => (r.unread ?? 0) > 0).length },
    ...(groups ?? [])
      .map((g) => ({ ...g, count: rows.filter((r) => r.group === g.id).length }))
      .filter((g) => g.count > 0),
  ];
  const open = selectedId !== null && children;
  return (
    <div
      className={cx(
        "grid h-[min(780px,calc(100dvh-12rem))] min-h-[520px] grid-cols-1 overflow-hidden rounded-xl border border-separator bg-surface md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]",
        className,
      )}
    >
      <section
        aria-label="Conversations"
        className={cx("flex min-h-0 flex-col border-separator md:border-r", open ? "max-md:hidden" : "")}
      >
        <div className="flex flex-col gap-2 border-b border-separator p-3">
          <SearchBar
            label="Search conversations"
            value={q}
            onChange={setQ}
            placeholder={searchPlaceholder}
            className="md:w-full"
          />
          {rows.length > 0 ? (
            <Segment
              aria-label="Show"
              size="sm"
              selectedKey={show}
              onSelectionChange={(k) => setShow(String(k))}
              className="w-full"
            >
              {filters.map((f) => (
                <Segment.Item key={f.id} id={f.id} className="flex-1">
                  {f.label}
                  {f.count > 0 ? <span className="tabular"> {f.count}</span> : null}
                </Segment.Item>
              ))}
            </Segment>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          <ChatListView
            aria-label="Conversations"
            items={shown}
            selectionMode="single"
            selectionBehavior="replace"
            selectedKeys={selectedId ? [selectedId] : []}
            onAction={(key) => onSelect(String(key))}
            onSelectionChange={(keys) => {
              const k = keys === "all" ? null : [...keys][0];
              if (k != null) onSelect(String(k));
            }}
            className="bg-transparent p-0"
            renderEmptyState={() => (
              <EmptyBlock
                size="sm"
                icon={rows.length === 0 ? "Comments" : "Magnifier"}
                title={rows.length === 0 ? "No conversations yet" : "No conversation matches"}
              />
            )}
          >
            {(r) => {
              const unread = (r.unread ?? 0) > 0;
              return (
                <ChatListView.Item id={r.id} textValue={r.name} className="h-auto rounded-lg px-2.5 py-2">
                  <ChatListView.ItemContent className="items-center gap-3">
                    <Avatar size="sm" variant="soft" color={unread ? "accent" : "default"} className="shrink-0">
                      <Avatar.Fallback>{initialsOf(r.name)}</Avatar.Fallback>
                    </Avatar>
                    <ChatListView.Text className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-baseline gap-2">
                        <ChatListView.Title
                          className={cx("min-w-0 truncate text-sm", unread ? "font-semibold" : "font-medium")}
                        >
                          {r.name}
                        </ChatListView.Title>
                        {r.tag ? <span className="shrink-0 text-xs text-muted">{r.tag}</span> : null}
                      </span>
                      <ChatListView.Preview
                        className={cx("truncate text-xs", unread ? "text-foreground" : "text-muted")}
                      >
                        {r.preview ?? "No messages yet"}
                      </ChatListView.Preview>
                    </ChatListView.Text>
                  </ChatListView.ItemContent>
                  <ChatListView.Meta className="flex shrink-0 flex-col items-end gap-1 self-start pt-0.5">
                    <span className={cx("text-xs tabular", unread ? "font-medium text-accent" : "text-muted")}>
                      {when(r.at, now)}
                    </span>
                    {unread ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground tabular">
                        {r.unread}
                        <span className="sr-only"> unread</span>
                      </span>
                    ) : null}
                  </ChatListView.Meta>
                </ChatListView.Item>
              );
            }}
          </ChatListView>
        </div>
      </section>
      <section aria-label="Conversation" className={cx("flex min-h-0 min-w-0 flex-col", open ? "" : "max-md:hidden")}>
        {open ? (
          <>
            <header className="flex items-center gap-3 border-b border-separator px-3 py-2.5 sm:px-4">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="All conversations"
                onPress={onBack}
                className="md:hidden"
              >
                <Icon name="ArrowLeft" />
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>
            </header>
            {children}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyBlock icon="Comments" title={rows.length === 0 ? "No conversations yet" : "Pick a conversation"} />
          </div>
        )}
      </section>
    </div>
  );
}

/** The header line of an open conversation: avatar, name, a chip, what it is about, and a link. */
export function ChatHeader({
  name,
  about,
  chip,
  status,
  action,
}: {
  name: string;
  about?: ReactNode;
  chip?: ReactNode;
  /** A small live dot or state beside the name. */
  status?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <>
      <Avatar size="sm" variant="soft" className="shrink-0">
        <Avatar.Fallback>{initialsOf(name)}</Avatar.Fallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="truncate">{name}</span>
          {chip}
          {status}
        </h2>
        {about ? <span className="truncate text-xs text-muted">{about}</span> : null}
      </div>
      {action}
    </>
  );
}
