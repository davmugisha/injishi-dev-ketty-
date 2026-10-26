"use client";

import {
  type LeaseMessage,
  type LeaseThreadView,
  MESSAGE_ACCEPT,
  messageFilesProblem,
  VOICE_NOTE_MAX_S,
} from "@injishi/contracts";
import { type ChatDraft, type ChatLine, ChatThread, EmptyBlock } from "@injishi/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isConnected,
  joinThread,
  joinWorkspace,
  onConnection,
  onMessage,
  onThreadRead,
  rejoinThread,
} from "./realtime";

export type ConversationSide = "landlord" | "tenant";

/** Where the browser reads and writes this conversation, on the app's own origin. */
export function conversationBase(side: ConversationSide, leaseId: string): string {
  return side === "landlord"
    ? `/api/messages/ops/rentals/messages/${leaseId}`
    : `/api/messages/me/tenancies/${leaseId}/messages`;
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

function toLine(m: LeaseMessage, side: ConversationSide, leaseId: string): ChatLine {
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
    fault: m.fault
      ? {
          label: `${m.fault.reference ? `Fault ${m.fault.reference}` : "Fault"}: ${m.fault.title}`,
          href: faultHref(side, leaseId, m.fault.id),
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
 * One lease conversation, live (P3.4): the first page comes from the server; after that it reads and
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
  initial: LeaseThreadView;
  /** The landlord's business (for the socket's rooms); null on the tenant's side. */
  workspaceId: string | null;
  selfName?: string | null;
  /** Told after a send or a read, so a list beside it can refresh its counts. */
  onActivity?: () => void;
}) {
  const leaseId = initial.leaseId;
  const base = conversationBase(side, leaseId);
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
    const next = (await response.json()) as LeaseThreadView;
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

  // The live line: this lease's room, and the business's for the landlord.
  useEffect(() => {
    if (workspaceId) joinWorkspace(workspaceId);
    const leave = joinThread(leaseId, workspaceId);
    const offNew = onMessage((e) => {
      if (e.leaseId === leaseId) void refresh();
    });
    const offRead = onThreadRead((e) => {
      if (e.leaseId === leaseId) void refresh();
    });
    const offStatus = onConnection(setLive);
    return () => {
      leave();
      offNew();
      offRead();
      offStatus();
    };
  }, [leaseId, workspaceId, refresh]);

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
      if (!hadThread) rejoinThread(leaseId, workspaceId);
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
    const page = (await response.json()) as LeaseThreadView;
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
    return [...all.map((m) => toLine(m, side, leaseId)), ...pending];
  }, [older, view.messages, pending, side, leaseId]);

  return (
    <ChatThread
      key={leaseId}
      lines={lines}
      selfName={selfName}
      lastReadAt={initial.myLastReadAt}
      onSend={send}
      onRetry={retry}
      onDiscard={drop}
      hasOlder={Boolean(olderCursor)}
      onLoadOlder={loadOlder}
      closedReason={view.writable ? null : "This lease has ended, so the conversation is read only."}
      placeholder={side === "landlord" ? `Message ${view.counterpartName}` : "Message your landlord"}
      accept={MESSAGE_ACCEPT}
      checkFiles={(files, voice) => messageFilesProblem(files, voice)}
      maxVoiceSeconds={VOICE_NOTE_MAX_S}
      empty={
        <EmptyBlock
          icon="Comments"
          title="No messages yet"
          description={
            side === "landlord"
              ? `Write to ${view.counterpartName}. Photos, documents and voice notes work too.`
              : "Write to your landlord. Photos, documents and voice notes work too."
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
