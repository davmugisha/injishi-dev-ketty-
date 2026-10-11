"use client";

import {
  ASSISTANT_MESSAGE_MAX,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantSource,
  type AssistantSuggestion,
  type SupportTopic,
} from "@injishi/contracts";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Textarea } from "@injishi/ui";
import { cn } from "@injishi/utils";
import {
  ArrowUp,
  BedDouble,
  BookOpen,
  Building2,
  ListChecks,
  MapPin,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import { WEB_URL } from "@/lib/sign-in-url";
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
 * Mounted by `AdminAssistant`, which reads the open conversation, the greeting
 * and the starter questions on the server and draws nothing when the assistant
 * is off. Nothing here fetches on mount. It never acts.
 *
 * A new conversation opens with the API's greeting and the questions asked
 * most, each sent with one tap; after every answer the API offers the next
 * questions (D-q).
 */
export function AssistantPanel({
  initialConversation,
  greeting,
  starters,
}: {
  initialConversation: AssistantConversation | null;
  greeting: string;
  starters: AssistantSuggestion[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<AssistantConversation | null>(initialConversation);
  const [draft, setDraft] = useState("");
  // The message on its way, drawn at once as the staffer's own bubble.
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startFresh, setStartFresh] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation, pending, open]);

  /** Sends the draft, or a tapped suggestion's message exactly as if typed. */
  async function send(text?: string) {
    const message = (text ?? draft).trim();
    if (!message || pending !== null) return;
    setPending(message);
    setError(null);
    if (text === undefined) setDraft("");
    const result = await sendAdminAssistantMessage({
      message,
      pagePath: pathname || undefined,
      ...(startFresh ? { startNew: true } : {}),
    });
    setPending(null);
    if (result.ok) {
      setConversation(result.data.conversation);
      setStartFresh(false);
      return;
    }
    // Not sent: give the staffer their words back.
    if (text === undefined) setDraft(message);
    if (result.code === "conversation_full") {
      setStartFresh(true);
      setError("This conversation is full. Send again to start a new one.");
      return;
    }
    setError(result.message);
  }

  function startOver() {
    setConversation(null);
    setStartFresh(true);
    setError(null);
  }

  const messages = conversation?.messages ?? [];
  const lastIsAnswer = messages.at(-1)?.role === "assistant";
  const followUps = lastIsAnswer && pending === null ? (conversation?.suggestions ?? []) : [];

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
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-narrow">
          <SheetHeader className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <AssistantAvatar />
              <div className="min-w-0 text-left">
                <SheetTitle className="font-display text-lg font-bold">Assistant</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  How Injishi works and the steps for console tasks. It reads no business&apos;s records and never
                  changes anything for you.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="scrollbar flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
            <ol className="flex flex-col gap-5">
              {messages.length === 0 && greeting ? (
                <li className="flex flex-col gap-3">
                  <AssistantBubble>{greeting}</AssistantBubble>
                  <div className="pl-9">
                    <SuggestionChips suggestions={starters} disabled={pending !== null} onPick={(m) => void send(m)} />
                  </div>
                </li>
              ) : null}
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
              {pending !== null ? (
                <>
                  <UserBubble>{pending}</UserBubble>
                  <li className="flex items-end gap-2">
                    <AssistantAvatar small />
                    <TypingDots />
                  </li>
                </>
              ) : null}
              {followUps.length > 0 ? (
                <li className="pl-9">
                  <SuggestionChips suggestions={followUps} disabled={pending !== null} onPick={(m) => void send(m)} />
                </li>
              ) : null}
            </ol>
            <div ref={endRef} />
          </div>

          <form
            className="flex flex-col gap-2 border-t border-border bg-background px-4 py-3"
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
            <div className="flex items-end gap-2 rounded-card border border-border bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
              <Textarea
                id="admin-assistant-message"
                value={draft}
                maxLength={ASSISTANT_MESSAGE_MAX}
                placeholder="Ask about Injishi"
                rows={1}
                className="max-h-32 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                type="submit"
                size="sm"
                className="size-9 shrink-0 rounded-full p-0"
                aria-label="Send"
                pending={pending !== null}
                disabled={!draft.trim()}
              >
                <ArrowUp aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={messages.length === 0 || pending !== null}
                onClick={startOver}
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                New conversation
              </Button>
              <span className="text-2xs text-muted-foreground">Enter to send, Shift+Enter for a new line</span>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AssistantAvatar({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground",
        small ? "size-7" : "size-10",
      )}
    >
      <Sparkles className={small ? "size-3.5" : "size-5"} />
    </span>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <AssistantAvatar small />
      <p className="max-w-[85%] whitespace-pre-line rounded-card border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground">
        {children}
      </p>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-line rounded-card bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
        {children}
      </p>
    </li>
  );
}

/** Three dots while the answer is on its way; still under reduced motion. */
function TypingDots() {
  return (
    <span
      role="status"
      aria-label="Finding a verified answer"
      className="flex items-center gap-1 rounded-card border border-border bg-card px-4 py-3.5"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

/** Questions sent with one tap, exactly as if typed. */
function SuggestionChips({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: AssistantSuggestion[];
  disabled: boolean;
  onPick: (message: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Suggested questions">
      {suggestions.map((s) => (
        <li key={s.message}>
          <button
            type="button"
            disabled={disabled}
            title={s.message}
            onClick={() => onPick(s.message)}
            className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-field focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {s.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function MessageRow({ message }: { message: AssistantMessage }) {
  if (message.role === "user") return <UserBubble>{message.text}</UserBubble>;
  const listings = message.sources.filter((s) => s.kind === "listing" && s.listing);
  const others = message.sources.filter((s) => !(s.kind === "listing" && s.listing));
  return (
    <li className="flex flex-col gap-2">
      <AssistantBubble>{message.text}</AssistantBubble>
      {listings.length > 0 ? (
        <ul className="flex flex-col gap-2 pl-9" aria-label="Places mentioned">
          {listings.map((s) => (
            <ListingCard key={s.id} source={s} />
          ))}
        </ul>
      ) : null}
      {others.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pl-9 text-xs" aria-label="Sources">
          {others.map((s) => (
            <li key={s.id}>
              <SourceLink source={s} />
            </li>
          ))}
        </ul>
      ) : null}
      {message.escalation ? (
        <div className="pl-9">
          <EscalationButton topic={message.escalation.topic} />
        </div>
      ) : null}
      <div className="pl-9">
        <FeedbackRow message={message} />
      </div>
    </li>
  );
}

/**
 * A published place, as the search returned it: the photo, where it is, the
 * lowest base nightly rate, how many it sleeps and how many room types. The
 * rate is the base rate, before any date specific price. The console will
 * rarely see one, since its assistant answers from knowledge and guides.
 */
function ListingCard({ source }: { source: AssistantSource }) {
  const l = source.listing!;
  const body = (
    <>
      <div className="relative size-16 shrink-0 overflow-hidden rounded bg-field">
        {l.photoUrl ? (
          // A photo route URL from the API; next/image would need its host configured.
          <img src={l.photoUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <Building2 aria-hidden="true" className="size-6" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-semibold text-foreground">{source.title}</p>
        {l.district ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3" />
            {l.district}
          </p>
        ) : null}
        <p className="text-sm text-foreground">
          {l.fromNightlyRateRwf !== null ? (
            <>
              <span className="text-xs text-muted-foreground">from </span>
              <span className="font-semibold">RWF {l.fromNightlyRateRwf.toLocaleString("en-RW")}</span>
              <span className="text-xs text-muted-foreground"> / night</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Price on request</span>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-muted-foreground">
          {l.maxGuests ? (
            <span className="flex items-center gap-1">
              <Users aria-hidden="true" className="size-3" />
              Sleeps {l.maxGuests}
            </span>
          ) : null}
          {l.roomTypes > 0 ? (
            <span className="flex items-center gap-1">
              <BedDouble aria-hidden="true" className="size-3" />
              {l.roomTypes} room type{l.roomTypes === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
      </div>
    </>
  );
  const className = "flex items-center gap-3 rounded-card border border-border bg-card p-2.5 transition-colors";
  return (
    <li>
      {source.href ? (
        <a
          href={onSite(source.href)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(className, "hover:bg-field focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        >
          {body}
        </a>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

/**
 * Source links are public site paths ("/how-it-works"); the console runs on
 * its own origin, so they open on the public site, in a new tab. A full URL
 * (a recorded tutorial) is kept as it is.
 */
function onSite(href: string): string {
  return href.startsWith("/") ? `${WEB_URL}${href}` : href;
}

function SourceLink({ source }: { source: AssistantSource }) {
  const SourceIcon = source.kind === "task" ? ListChecks : source.kind === "listing" ? Building2 : BookOpen;
  const inner = (
    <>
      <SourceIcon aria-hidden="true" className="size-3" />
      {source.title}
    </>
  );
  const className = "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1";
  return source.href ? (
    <a href={onSite(source.href)} target="_blank" rel="noopener noreferrer" className={cn(className, "text-accent-text hover:underline")}>
      {inner}
    </a>
  ) : (
    <span className={cn(className, "text-muted-foreground")}>{inner}</span>
  );
}

/** Helpful or not, once per answer (ADR-061 D-m). */
function FeedbackRow({ message }: { message: AssistantMessage }) {
  const [helpful, setHelpful] = useState<boolean | null>(message.helpful);
  const [sending, setSending] = useState(false);
  if (helpful !== null) return <p className="text-2xs text-muted-foreground">Thanks for telling us.</p>;
  async function send(value: boolean) {
    setSending(true);
    const result = await sendAdminAssistantFeedback(message.id, value);
    setSending(false);
    if (result.ok) setHelpful(result.data.helpful);
  }
  return (
    <div className="flex items-center gap-1 text-2xs text-muted-foreground">
      <span>Did this help?</span>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-2xs" disabled={sending} onClick={() => void send(true)}>
        Yes
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-2xs" disabled={sending} onClick={() => void send(false)}>
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
    <div className="flex w-full flex-col gap-2 rounded-card border border-border bg-card p-4">
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
