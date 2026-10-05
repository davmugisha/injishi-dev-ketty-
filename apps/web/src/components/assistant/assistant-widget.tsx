"use client";

import {
  ASSISTANT_MESSAGE_MAX,
  SUPPORT_EMAIL_MAX,
  type AssistantConversation,
  type AssistantMessage,
  type SupportTopic,
} from "@injishi/contracts";
import {
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@injishi/ui";
import { cn } from "@injishi/utils";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  claimAssistantConversation,
  getAssistantConversation,
  sendAssistantEscalation,
  sendAssistantFeedback,
  sendAssistantMessage,
} from "@/data/assistant";

/**
 * The support assistant on the public site (ADR-061 slice A).
 *
 * A launcher in the corner opens a side sheet. It asks the API first whether
 * the assistant is on at all, and draws nothing when it is not, so a process
 * running with the assistant off shows no dead button (D-b).
 *
 * The conversation is the API's: it comes back on every open and after every
 * answer, rides on an `HttpOnly` cookie this component never touches, and is
 * never kept in local storage. Sources are drawn only from what the API
 * returned on the message, which it has already checked against the tool
 * results of that turn (D-i).
 */
export function AssistantWidget() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<AssistantConversation | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startFresh, setStartFresh] = useState(false);
  const [claimOffered, setClaimOffered] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void getAssistantConversation("web").then(async (result) => {
      if (!live || result.status !== "ok") return;
      setEnabled(result.data.enabled);
      setConversation(result.data.conversation);
      // Signing in is a full page load from the other root layout, so this
      // runs on the way back. The person is ASKED before the chat started
      // signed out joins their account: the cookie proves a browser, not a
      // person, and on a shared device it may be somebody else's.
      setClaimOffered(result.data.claimable);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation, pending, open]);

  if (!enabled) return null;

  async function send(startNew = false) {
    const message = draft.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    const result = await sendAssistantMessage({
      message,
      surface: "web",
      pagePath: pathname || undefined,
      ...(startNew || startFresh ? { startNew: true } : {}),
    });
    setPending(false);
    if (result.status === "ok") {
      setConversation(result.data.conversation);
      setDraft("");
      setStartFresh(false);
      return;
    }
    if (result.status === "refused" && result.code === "conversation_full") {
      setStartFresh(true);
      setError("This conversation is full. Send again to start a new one.");
      return;
    }
    if (result.status === "refused" && result.code === "assistant_off") {
      setEnabled(false);
      return;
    }
    setError(
      result.status === "refused"
        ? result.message
        : "The assistant couldn't be reached. Your question wasn't sent; try again in a moment.",
    );
  }

  async function answerClaim(keep: boolean) {
    setClaimOffered(false);
    const result = await claimAssistantConversation("web", !keep);
    if (result.status === "ok" && result.data.conversation) setConversation(result.data.conversation);
  }

  function startOver() {
    setConversation(null);
    setStartFresh(true);
    setError(null);
  }

  const messages = conversation?.messages ?? [];

  return (
    <>
      <Button
        type="button"
        variant="primary"
        className="fixed bottom-36 right-4 z-20 rounded-full shadow-lg lg:bottom-6"
        aria-label="Ask the Injishi assistant"
        onClick={() => setOpen(true)}
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        <span>Ask Injishi</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-tile">
          <SheetHeader className="border-b border-border p-5">
            <SheetTitle>Injishi assistant</SheetTitle>
            <SheetDescription>
              {/* From the conversation's own owner, so it cannot say "signed
                  out" to someone who is signed in (found in the browser walk). */}
              {conversation === null
                ? "Answers come from Injishi's help articles and, when you are signed in, your own bookings."
                : conversation.anonymous
                  ? "Answers come from Injishi's help articles. Signed out, this chat stays on this browser for 7 days."
                  : "Answers come from Injishi's help articles and your own bookings. This chat is kept with your account for 90 days."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-5" aria-live="polite">
            {claimOffered ? (
              <div className="mb-4 flex flex-col gap-3 rounded-card border border-border bg-card p-4">
                <p className="text-sm text-foreground">
                  You started a conversation on this browser before signing in. Keep it with your
                  account?
                </p>
                <div className="flex gap-3">
                  <Button type="button" size="sm" onClick={() => void answerClaim(true)}>
                    Keep it
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void answerClaim(false)}>
                    Not mine
                  </Button>
                </div>
              </div>
            ) : null}
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask how Injishi works: listing a property, fees, payouts, verification or support.
              </p>
            ) : (
              <ol className="flex flex-col gap-4">
                {messages.map((m) => (
                  <MessageRow key={m.id} message={m} anonymous={conversation?.anonymous ?? true} />
                ))}
              </ol>
            )}
            {pending ? (
              <p className="mt-4 text-sm text-muted-foreground">Finding a verified answer…</p>
            ) : null}
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
            <label htmlFor="assistant-message" className="sr-only">
              Your question
            </label>
            <Textarea
              id="assistant-message"
              value={draft}
              maxLength={ASSISTANT_MESSAGE_MAX}
              placeholder="Type your question"
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
                onClick={startOver}
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

function MessageRow({ message, anonymous }: { message: AssistantMessage; anonymous: boolean }) {
  const mine = message.role === "user";
  return (
    <li className={cn("flex flex-col gap-2", mine ? "items-end" : "items-start")}>
      <p
        className={cn(
          "whitespace-pre-line rounded-card px-4 py-3 text-sm",
          mine ? "bg-secondary text-foreground" : "border border-border bg-card text-foreground",
        )}
      >
        {message.text}
      </p>
      {message.sources.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-xs">
          {message.sources.map((s) =>
            s.href ? (
              <li key={s.id}>
                <Link href={s.href} className="text-accent-text underline">
                  {s.title}
                </Link>
              </li>
            ) : (
              <li key={s.id} className="text-muted-foreground">
                {s.title}
              </li>
            ),
          )}
        </ul>
      ) : null}
      {!mine && message.escalation ? <EscalationBox topic={message.escalation.topic} anonymous={anonymous} /> : null}
      {!mine ? <FeedbackRow message={message} /> : null}
    </li>
  );
}

/** Helpful or not, once per answer (ADR-061 D-m). */
function FeedbackRow({ message }: { message: AssistantMessage }) {
  const [helpful, setHelpful] = useState<boolean | null>(message.helpful);
  const [sending, setSending] = useState(false);
  if (helpful !== null) {
    return <p className="text-xs text-muted-foreground">Thanks for telling us.</p>;
  }
  async function send(value: boolean) {
    setSending(true);
    const result = await sendAssistantFeedback(message.id, value);
    setSending(false);
    if (result.status === "ok") setHelpful(result.data.helpful);
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
 * Send the conversation to a person at Injishi support (ADR-061 D-l). The
 * person presses it; the assistant only offered. Signed out, they type the
 * address the answer should go to, because nobody else has it.
 */
function EscalationBox({ topic, anonymous }: { topic: SupportTopic; anonymous: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "sent") {
    return <p className="text-sm text-foreground">Sent to Injishi support. A person will reply by email.</p>;
  }
  async function send() {
    setState("sending");
    setError(null);
    const result = await sendAssistantEscalation({
      surface: "web",
      topic,
      ...(anonymous ? { email: email.trim() } : {}),
    });
    if (result.status === "ok") {
      setState("sent");
      return;
    }
    setState("idle");
    setError(result.status === "refused" ? result.message : "It couldn't be sent. Try again in a moment.");
  }
  return (
    <div className="flex w-full flex-col gap-2 rounded-card border border-border bg-card p-4">
      {anonymous ? (
        <>
          <label htmlFor="assistant-escalation-email" className="text-sm text-foreground">
            Your email, for the reply
          </label>
          <Input
            id="assistant-escalation-email"
            type="email"
            value={email}
            maxLength={SUPPORT_EMAIL_MAX}
            onChange={(e) => setEmail(e.target.value)}
          />
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        pending={state === "sending"}
        disabled={anonymous && !email.trim()}
        onClick={() => void send()}
      >
        Send to Injishi support
      </Button>
    </div>
  );
}
