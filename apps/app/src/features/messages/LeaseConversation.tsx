"use client";

import {
  type LeaseMessage,
  type LeaseThreadView,
  MESSAGE_ACCEPT,
  messageFilesProblem,
  type PlacementThreadView,
  VOICE_NOTE_MAX_S,
} from "@injishi/contracts";
import { type ChatDraft, type ChatLine, ChatThread, EmptyBlock } from "@injishi/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ConversationRef,
  isAbout,
  isConnected,
  joinThread,
  joinWorkspace,
  onConnection,
  onMessage,
  onThreadRead,
  rejoinThread,
} from "./realtime";

/** Who reads: the landlord's team, the tenant (lease conversations), or the broker (placement ones). */
export type ConversationSide = "landlord" | "tenant" | "broker";

/** A conversation as either side opens it: a lease's, or a placement's (2026-10-26). */
export type ConversationView = LeaseThreadView | PlacementThreadView;

export function refOf(view: ConversationView): ConversationRef {
  return "leaseId" in view ? { kind: "lease", id: view.leaseId } : { kind: "placement", id: view.placementId };
}

/** Where the browser reads and writes this conversation, on the app's own origin. */
export function conversationBase(side: ConversationSide, ref: ConversationRef): string {
  if (ref.kind === "placement") {
    return side === "broker"
      ? `/api/messages/ops/broker/messages/${ref.id}`
      : `/api/messages/ops/rentals/placement-messages/${ref.id}`;
  }
  return side === "landlord"
    ? `/api/messages/ops/rentals/messages/${ref.id}`
    : `/api/messages/me/tenancies/${ref.id}/messages`;
}

/** The API names a file by its own path; the browser opens it through the app. */
function appFileUrl(url: string): string {
  return url.startsWith("/api/v1/") ? `/api/messages/${url.slice("/api/v1/".length)}` : url;
}

/** How long the screen waits between reads when the live line is down, and as a safety net when it is up. */
const POLL_DOWN_MS = 5000;
const POLL_UP_MS = 60_000;

function faultHref(side: ConversationSide, leaseId: string, faultId: string): string {
  return side === "landlord" ? `/faults?fault=${faultId}` : `/home/${leaseId}/faults?fault=${faultId}`;
}

function toLine(m: LeaseMessage, side: ConversationSide, ref: ConversationRef): ChatLine {
  return {
    id: m.id,
    side: m.side === "system" ? "system" : m.fromMe ? "me" : "them",
    senderName: m.senderName,
    bodyType: m.bodyType,
    body: m.body,
    attachments: m.attachments.map((a) => ({ ...a, url: appFileUrl(a.url) })),
    voiceDurationS: m.voiceDurationS,
    createdAt: m.createdAt,
    receipt: m.receipt,
    fault:
      m.fault && ref.kind === "lease"
        ? {
            label: `${m.fault.reference ? `Fault ${m.fault.reference}` : "Fault"}: ${m.fault.title}`,
            href: faultHref(side, ref.id, m.fault.id),
          }
        : null,
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
    issues?: { message?: string }[];
  } | null;
  const issue = body?.issues?.[0]?.message;
  if (issue) return issue;
  if (typeof body?.message === "string" && body.message !== "Validation failed") return body.message;
  if (response.status === 413) return "Those files are too large to send together.";
  if (response.status === 429) return "Too many messages at once. Wait a moment and try again.";
  return "That message was not sent. Check your connection and try again.";
}

/**
 * One conversation, live (P3.4; a broker's about a placement since 2026-10-26): the first page comes from the server; after that it reads and
 * sends through `/api/messages/*`, hears new lines and reads on the socket (thread room), polls every
 * few seconds when the socket is down, and marks the conversation read while it is on screen.
 */
export function LeaseConversation({
  side,
  initial,
  workspaceId,
  selfName,
  onActivity,
}: {
  side: ConversationSide;
  initial: ConversationView;
  /** The landlord's business (for the socket's rooms); null on the tenant's and the broker's side. */
  workspaceId: string | null;
  selfName?: string | null;
  /** Told after a send or a read, so a list beside it can refresh its counts. */
  onActivity?: () => void;
}) {
  const ref = useMemo(() => refOf(initial), [initial]);
  const key = `${ref.kind}:${ref.id}`;
  const base = conversationBase(side, ref);
  const [view, setView] = useState(initial);
  const [older, setOlder] = useState<LeaseMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState(initial.olderCursor);
  const [pending, setPending] = useState<ChatLine[]>([]);
  const [live, setLive] = useState(false);
  const lastRead = useRef<string | null>(null);
  const activity = useRef(onActivity);
  activity.current = onActivity;

  const refresh = useCallback(async () => {
    const response = await fetch(base, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const next = (await response.json()) as ConversationView;
    setView((prev) => ({ ...next, myLastReadAt: prev.myLastReadAt }));
  }, [base]);

  // Mark read while the conversation is on screen and the other side wrote something new.
  const newestTheirs = useMemo(
    () => [...view.messages].reverse().find((m) => !m.fromMe && m.side !== "system")?.createdAt ?? null,
    [view.messages],
  );
  useEffect(() => {
    if (!view.threadId || !newestTheirs || lastRead.current === newestTheirs) return;
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      lastRead.current = newestTheirs;
      void fetch(`${base}/read`, { method: "POST" })
        .then(() => activity.current?.())
        .catch(() => undefined);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [base, view.threadId, newestTheirs]);

  // The live line: this conversation's room, and the business's for the landlord.
  useEffect(() => {
    if (workspaceId) joinWorkspace(workspaceId);
    const leave = joinThread(ref, workspaceId);
    const offNew = onMessage((e) => {
      if (isAbout(e, ref)) void refresh();
    });
    const offRead = onThreadRead((e) => {
      if (isAbout(e, ref)) void refresh();
    });
    const offStatus = onConnection(setLive);
    return () => {
      leave();
      offNew();
      offRead();
      offStatus();
    };
  }, [ref, workspaceId, refresh]);

  // The fallback: read every few seconds while the socket is down, rarely while it is up.
  useEffect(() => {
    const every = live ? POLL_UP_MS : POLL_DOWN_MS;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, every);
    return () => clearInterval(t);
  }, [live, refresh]);

  // Drafts of lines that are sending or failed, to send again with Retry.
  const drafts = useRef(new Map<string, ChatDraft>());

  const deliver = async (key: string, draft: ChatDraft) => {
    setPending((p) => p.map((l) => (l.id === key ? { ...l, receipt: "sending" } : l)));
    try {
      const form = new FormData();
      if (draft.body) form.set("body", draft.body);
      if (draft.voiceDurationS) form.set("voiceDurationS", String(draft.voiceDurationS));
      for (const f of draft.files) form.append("files", f, f.name);
      const response = await fetch(base, { method: "POST", body: form }).catch(() => null);
      if (!response?.ok) {
        // A refusal in words (too large, wrong type) is worth a toast-like line; a lost connection is a Retry.
        if (response && response.status < 500) console.warn(await readError(response));
        setPending((p) => p.map((l) => (l.id === key ? { ...l, receipt: "failed" } : l)));
        return;
      }
      const hadThread = Boolean(view.threadId);
      await refresh();
      if (!hadThread) rejoinThread(ref, workspaceId);
      drop(key);
      activity.current?.();
    } catch {
      setPending((p) => p.map((l) => (l.id === key ? { ...l, receipt: "failed" } : l)));
    }
  };

  const drop = (key: string) => {
    setPending((p) => {
      const line = p.find((l) => l.id === key);
      for (const a of line?.attachments ?? []) URL.revokeObjectURL(a.url);
      return p.filter((l) => l.id !== key);
    });
    drafts.current.delete(key);
  };

  /** The line shows at once as "sending"; it turns into the real one, or "Not sent" with Retry. */
  const send = async (draft: ChatDraft) => {
    const key = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    drafts.current.set(key, draft);
    const optimistic: ChatLine = {
      id: key,
      side: "me",
      senderName: selfName ?? null,
      bodyType: draft.voiceDurationS ? "voice" : "text",
      body: draft.body || null,
      attachments: draft.files.map((f, i) => ({
        id: `${key}-${i}`,
        kind: f.type.startsWith("image/") ? "image" : f.type.startsWith("audio/") ? "audio" : "file",
        url: URL.createObjectURL(f),
        mime: f.type,
        sizeBytes: f.size,
        filename: f.name,
      })),
      voiceDurationS: draft.voiceDurationS ?? null,
      createdAt: new Date().toISOString(),
      receipt: "sending",
    };
    setPending((p) => [...p, optimistic]);
    await deliver(key, draft);
  };

  const retry = (key: string) => {
    const draft = drafts.current.get(key);
    if (draft) void deliver(key, draft);
  };

  const loadOlder = async () => {
    if (!olderCursor) return;
    const response = await fetch(`${base}?before=${encodeURIComponent(olderCursor)}`, { cache: "no-store" }).catch(
      () => null,
    );
    if (!response?.ok) return;
    const page = (await response.json()) as ConversationView;
    setOlder((o) => [...page.messages, ...o]);
    setOlderCursor(page.olderCursor);
  };

  const lines = useMemo(() => {
    const seen = new Set<string>();
    const all = [...older, ...view.messages].filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    return [...all.map((m) => toLine(m, side, ref)), ...pending];
  }, [older, view.messages, pending, side, ref]);

  return (
    <ChatThread
      key={key}
      lines={lines}
      selfName={selfName}
      lastReadAt={initial.myLastReadAt}
      onSend={send}
      onRetry={retry}
      onDiscard={drop}
      hasOlder={Boolean(olderCursor)}
      onLoadOlder={loadOlder}
      closedReason={
        view.writable
          ? null
          : ref.kind === "lease"
            ? "This lease has ended, so the conversation is read only."
            : "This placement was closed, so the conversation is read only."
      }
      placeholder={side === "tenant" ? "Message your landlord" : `Message ${view.counterpartName}`}
      accept={MESSAGE_ACCEPT}
      checkFiles={(files, voice) => messageFilesProblem(files, voice)}
      maxVoiceSeconds={VOICE_NOTE_MAX_S}
      empty={
        <EmptyBlock
          icon="Comments"
          title="No messages yet"
          description={
            side === "tenant"
              ? "Write to your landlord. Photos, documents and voice notes work too."
              : `Write to ${view.counterpartName}. Photos, documents and voice notes work too.`
          }
        />
      }
    />
  );
}

/** A small live dot: green when updates arrive instantly, grey while the screen checks every few seconds. */
export function LiveDot() {
  const [live, setLive] = useState(isConnected());
  useEffect(() => onConnection(setLive), []);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted"
      title={live ? "Live" : "Checking every few seconds"}
    >
      <span
        className={live ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-default-400"}
        aria-hidden="true"
      />
      <span className="sr-only">{live ? "Live updates on" : "Live updates off, checking every few seconds"}</span>
    </span>
  );
}
