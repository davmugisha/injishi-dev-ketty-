"use client";

import {
  ASSISTANT_MESSAGE_MAX,
  type AssistantConversation,
  type AssistantMessage,
  type SupportTopic,
} from "@injishi/contracts";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Textarea } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  sendAdminAssistantEscalation,
  sendAdminAssistantFeedback,
  sendAdminAssistantMessage,
} from "@/lib/actions/assistant";

/**
 * The support assistant in the admin console (ADR-061 slice G).
 *
 * It answers from Injishi's knowledge and step by step guides. The console
 * names no workspace, so the API gives it no business's data and no operator
 * tool: a staffer reads records through the console's own screens, which check
 * their staff permissions, not through the assistant (D-f).
 *
 * Mounted by `AdminAssistant`, which reads the open conversation on the
 * server and draws nothing when the assistant is off. It never acts.
 */
export function AssistantPanel({ initialConversation }: { initialConversation: AssistantConversation | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<AssistantConversation | null>(initialConversation);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startFresh, setStartFresh] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation, pending, open]);

  async function send() {
    const message = draft.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    const result = await sendAdminAssistantMessage({
      message,
      pagePath: pathname || undefined,
      ...(startFresh ? { startNew: true } : {}),
    });
    setPending(false);
    if (result.ok) {
      setConversation(result.data.conversation);
      setDraft("");
      setStartFresh(false);
      return;
    }
    if (result.code === "conversation_full") {
      setStartFresh(true);
      setError("This conversation is full. Send again to start a new one.");
      return;
    }
    setError(result.message);
  }

  const messages = conversation?.messages ?? [];

  return (
    <>
      <Button
        type="button"
        variant="primary"
        className="fixed bottom-6 right-6 z-20 rounded-full shadow-lg"
        aria-label="Ask the Injishi assistant"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-4 w-4" aria-hidden />
        <span>Assistant</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-narrow">
          <SheetHeader className="gap-2 border-b border-border p-5">
            <SheetTitle className="font-display text-xl font-bold">Assistant</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              How Injishi works and the steps for console tasks. It reads no business&apos;s records and never
              changes anything for you.
            </SheetDescription>
          </SheetHeader>

          <div className="scrollbar flex-1 overflow-y-auto p-5" aria-live="polite">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Try: how does a listing get approved, what does a suspended business see, or how do payouts work.
              </p>
            ) : (
              <ol className="flex flex-col gap-4">
                {messages.map((m) => (
                  <li key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                    <p
                      className={cn(
                        "whitespace-pre-line rounded-card px-4 py-3 text-sm",
                        m.role === "user" ? "bg-muted" : "border border-border bg-card",
                      )}
                    >
                      {m.text}
                    </p>
                    {m.role === "assistant" && m.escalation ? <EscalationButton topic={m.escalation.topic} /> : null}
                    {m.role === "assistant" ? <FeedbackRow message={m} /> : null}
                    {m.sources.length > 0 ? (
                      <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {m.sources.map((s) => (
                          <li key={s.id}>{s.title}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            {pending ? <p className="mt-4 text-sm text-muted-foreground">Checking…</p> : null}
            <div ref={endRef} />
          </div>

          <form
            className="flex flex-col gap-3 border-t border-border p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <label htmlFor="admin-assistant-message" className="sr-only">
              Your question
            </label>
            <Textarea
              id="admin-assistant-message"
              value={draft}
              maxLength={ASSISTANT_MESSAGE_MAX}
              placeholder="Ask about Injishi"
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={messages.length === 0 || pending}
                onClick={() => {
                  setConversation(null);
                  setStartFresh(true);
                  setError(null);
                }}
              >
                New conversation
              </Button>
              <Button type="submit" size="sm" pending={pending} disabled={!draft.trim()}>
                {pending ? "Sending" : "Send"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Helpful or not, once per answer (ADR-061 D-m). */
function FeedbackRow({ message }: { message: AssistantMessage }) {
  const [helpful, setHelpful] = useState<boolean | null>(message.helpful);
  const [sending, setSending] = useState(false);
  if (helpful !== null) return <p className="text-xs text-muted-foreground">Thanks for telling us.</p>;
  async function send(value: boolean) {
    setSending(true);
    const result = await sendAdminAssistantFeedback(message.id, value);
    setSending(false);
    if (result.ok) setHelpful(result.data.helpful);
  }
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Did this help?</span>
      <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => void send(true)}>
        Yes
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => void send(false)}>
        No
      </Button>
    </div>
  );
}

/**
 * Send the conversation to Injishi support (ADR-061 D-l). The staffer presses
 * it; the assistant only offered. The reply goes to the account's own address.
 */
function EscalationButton({ topic }: { topic: SupportTopic }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "sent") return <p className="text-sm">Sent to Injishi support. A person will reply by email.</p>;
  async function send() {
    setState("sending");
    setError(null);
    const result = await sendAdminAssistantEscalation(topic);
    if (result.ok) setState("sent");
    else {
      setState("idle");
      setError(result.message);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="sm" pending={state === "sending"} onClick={() => void send()}>
        Send to Injishi support
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
