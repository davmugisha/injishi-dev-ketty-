"use client";

import { Toast } from "@heroui/react";
import { type Persona, screenHref } from "@injishi/data";
import type { MessageTemplate, MessageThread, ThreadMessage } from "@injishi/data/fixtures/stays";
import {
  ActionLink,
  type ChatDraft,
  ChatHeader,
  ChatInbox,
  type ChatLine,
  type ChatSuggestion,
  ChatThread,
  EmptyBlock,
  PageContent,
  PageHeader,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { replyToGuest } from "./actions";

const LANGS = [
  { key: "EN", words: "English" },
  { key: "RW", words: "Kinyarwanda" },
  { key: "FR", words: "French" },
] as const;

type Said = Extract<ThreadMessage, { t: "guest" } | { t: "staff" }>;

/** The stored lines of a conversation as the shared thread reads them (text replies only, as the API keeps). */
function linesOf(thread: MessageThread): ChatLine[] {
  return thread.messages
    .filter((m): m is Said => (m.t === "guest" || m.t === "staff") && Boolean(m.at))
    .map((m, i) => ({
      id: m.id ?? `${thread.id}-${i}`,
      side: m.t === "staff" ? "me" : "them",
      senderName: m.t === "staff" ? (m.sender ?? "Front desk") : thread.name,
      bodyType: "text",
      body: m.text,
      attachments: [],
      voiceDurationS: null,
      createdAt: m.at as string,
      receipt: m.t === "staff" ? "delivered" : null,
    }));
}

/**
 * A stay business's guest messages (2026-10-30) on the shared chat inbox: the conversations with a
 * search and All / Unread, the open one with the guest's stay in its header, and a reply box with the
 * business's saved replies in each language. Replies go to the guest app; only what the API keeps is
 * offered (text replies), nothing that would pretend to work.
 */
export function MessagesView({
  persona,
  threads,
  templates,
  property,
}: {
  persona: Persona;
  threads: MessageThread[];
  templates: MessageTemplate[];
  /** The property the desk's day is read for, as the API names it. */
  property: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(threads[0]?.id ?? null);
  const cur = threads.find((t) => t.id === sel) ?? null;
  const [pending, setPending] = useState<ChatLine[]>([]);
  // A reply read back from the API replaces the line shown while it was sending.
  // biome-ignore lint/correctness/useExhaustiveDependencies: cleared whenever the conversations are read again
  useEffect(() => setPending([]), [threads]);

  const suggestions = useMemo<ChatSuggestion[]>(
    () =>
      templates.flatMap((tp) =>
        LANGS.map((l) => ({ id: `${tp.id}-${l.key}`, label: tp.label, text: tp[l.key], group: l.words })),
      ),
    [templates],
  );

  const send = async (draft: ChatDraft) => {
    if (!cur) return;
    const text = draft.body.trim();
    if (!text) return;
    const line: ChatLine = {
      id: `pending-${Date.now()}`,
      side: "me",
      senderName: persona.name,
      bodyType: "text",
      body: text,
      attachments: [],
      voiceDurationS: null,
      createdAt: new Date().toISOString(),
      receipt: "sending",
    };
    setPending((p) => [...p, line]);
    const result = await replyToGuest(cur.id, text);
    if (!result.ok) {
      setPending((p) => p.filter((l) => l.id !== line.id));
      throw new Error(`Not sent: ${result.error}`);
    }
    router.refresh();
  };

  const stayRef = cur?.facts.find((f) => f.label === "Stay")?.value.split(" · ")[0] ?? "";
  const hasStay = /^ST-/.test(stayRef);
  const stayHref = hasStay ? `/stays/${encodeURIComponent(stayRef)}` : screenHref("Reservations");

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader eyebrow={property} title="Messages" />
      {threads.length === 0 ? (
        <EmptyBlock icon="Comments" title="No guest conversations yet" />
      ) : (
        <ChatInbox
          rows={threads.map((t) => {
            const last = [...t.messages].reverse().find((m): m is Said => m.t === "guest" || m.t === "staff");
            return {
              id: t.id,
              name: t.name,
              tag: t.ctx.split(" · ")[0] ?? null,
              preview: last ? `${last.t === "staff" ? "You: " : ""}${last.text}` : t.ctx,
              at: last?.at ?? null,
              unread: t.unread,
              search: [t.ctx, t.who],
            };
          })}
          selectedId={cur?.id ?? null}
          onSelect={(id) => {
            setSel(id);
            setPending([]);
          }}
          onBack={() => setSel(null)}
          searchPlaceholder="Guest, room or booking"
          header={
            cur ? (
              <ChatHeader
                name={cur.name}
                about={cur.ctx}
                action={
                  <ActionLink href={stayHref} icon="Suitcase" intent="ghost" size="sm">
                    <span className="max-sm:sr-only">{hasStay ? "Stay" : "Bookings"}</span>
                  </ActionLink>
                }
              />
            ) : null
          }
        >
          {cur ? (
            <ChatThread
              key={cur.id}
              lines={[...linesOf(cur), ...pending]}
              onSend={send}
              closedReason={cur.closed ? "This stay has ended. The conversation is read only." : null}
              placeholder={`Write to ${cur.name}`}
              suggestions={suggestions}
              maxVoiceSeconds={0}
              empty={<EmptyBlock icon="Comments" title="No messages yet" />}
            />
          ) : null}
        </ChatInbox>
      )}
    </PageContent>
  );
}
