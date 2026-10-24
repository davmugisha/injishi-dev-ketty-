"use client";

import {
  ASSISTANT_MESSAGE_MAX,
  SUPPORT_EMAIL_MAX,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantSource,
  type AssistantSuggestion,
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
import {
  ArrowUp,
  BedDouble,
  BookOpen,
  Building2,
  ListChecks,
  MapPin,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
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
 * A new conversation opens with the API's greeting and the questions asked
 * most, each sent with one tap; after every answer the API offers the next
 * questions. Both come from the API, which offers only what this caller may
 * ask and answers each without the model (D-q).
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
  const [greeting, setGreeting] = useState("");
  const [starters, setStarters] = useState<AssistantSuggestion[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
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
      setGreeting(result.data.greeting);
      setStarters(result.data.suggestions);
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
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [conversation, pending, open]);

  // The PSF pages are PSF's, with their own chrome (the `(partner)` group), and
  // "Ask Injishi" does not belong on them. The widget is mounted by the root
  // layout, so it is the one that has to stay away.
  const onPartnerPage = pathname === "/psf" || pathname?.startsWith("/psf/");
  if (!enabled || onPartnerPage) return null;

  async function send(text?: string) {
    const message = (text ?? draft).trim();
    if (!message || pending) return;
    setPending(message);
    setError(null);
    if (text === undefined) setDraft("");
    const result = await sendAssistantMessage({
      message,
      surface: "web",
      pagePath: pathname || undefined,
      ...(startFresh ? { startNew: true } : {}),
    });
    setPending(null);
    if (result.status === "ok") {
      setConversation(result.data.conversation);
      setStartFresh(false);
      return;
    }
    // Not sent: give the person their words back.
    if (text === undefined) setDraft(message);
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
  const lastIsAnswer = messages.at(-1)?.role === "assistant";
  const followUps = lastIsAnswer && !pending ? (conversation?.suggestions ?? []) : [];

  return (
    <>
      <Button
        type="button"
        variant="primary"
        className="fixed bottom-36 right-4 z-20 rounded-full px-5 shadow-lg transition-transform hover:-translate-y-0.5 lg:bottom-6"
        aria-label="Ask the Injishi assistant"
        onClick={() => setOpen(true)}
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        <span>Ask Injishi</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-tile">
          <SheetHeader className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <AssistantAvatar />
              <div className="min-w-0 text-left">
                <SheetTitle className="text-base">Injishi assistant</SheetTitle>
                <SheetDescription className="text-xs">
                  {/* From the conversation's own owner, so it cannot say "signed
                      out" to someone who is signed in (found in the browser walk). */}
                  {conversation === null || conversation.anonymous
                    ? "Answers from Injishi's own data. Signed out, this chat stays on this browser for 7 days."
                    : "Answers from Injishi's own data and your bookings. Kept with your account for 90 days."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto bg-surface-tint/40 px-5 py-5" aria-live="polite">
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

            <ol className="flex flex-col gap-5">
              {messages.length === 0 && greeting ? (
                <li className="flex flex-col gap-3">
                  <AssistantBubble>{greeting}</AssistantBubble>
                  <SuggestionChips suggestions={starters} disabled={pending !== null} onPick={(m) => void send(m)} />
                </li>
              ) : null}
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} anonymous={conversation?.anonymous ?? true} />
              ))}
              {pending ? (
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
            className="flex flex-col gap-2 border-t border-border bg-canvas px-4 py-3"
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
            <div className="flex items-end gap-2 rounded-card border border-border bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
              <Textarea
                id="assistant-message"
                value={draft}
                maxLength={ASSISTANT_MESSAGE_MAX}
                placeholder="Ask about stays, prices, bookings or hosting"
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
            <div className="flex items-center justify-between">
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
      <p className="max-w-[85%] whitespace-pre-line rounded-card rounded-bl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm">
        {children}
      </p>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-line rounded-card rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
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
      className="flex items-center gap-1 rounded-card rounded-bl-sm border border-border bg-card px-4 py-3.5 shadow-sm"
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
            className="rounded-full border border-border bg-canvas px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {s.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function MessageRow({ message, anonymous }: { message: AssistantMessage; anonymous: boolean }) {
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
        <ul className="flex flex-wrap gap-2 pl-9 text-xs">
          {others.map((s) => (
            <li key={s.id}>
              <SourceLink source={s} />
            </li>
          ))}
        </ul>
      ) : null}
      {message.escalation ? (
        <div className="pl-9">
          <EscalationBox topic={message.escalation.topic} anonymous={anonymous} />
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
 * rate is the base rate; the property page shows the price for the dates.
 */
function ListingCard({ source }: { source: AssistantSource }) {
  const l = source.listing!;
  const body = (
    <>
      <div className="relative size-20 shrink-0 overflow-hidden rounded bg-surface-tint">
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
  const className =
    "flex items-center gap-3 rounded-card border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md";
  return (
    <li>
      {source.href ? (
        <Link href={source.href} className={cn(className, "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring")}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

function SourceLink({ source }: { source: AssistantSource }) {
  const Icon = source.kind === "task" ? ListChecks : source.kind === "listing" ? Building2 : BookOpen;
  const inner = (
    <>
      <Icon aria-hidden="true" className="size-3" />
      {source.title}
    </>
  );
  const className = "inline-flex items-center gap-1.5 rounded-full border border-border bg-canvas px-2.5 py-1";
  return source.href ? (
    <Link href={source.href} className={cn(className, "text-accent-text hover:underline")}>
      {inner}
    </Link>
  ) : (
    <span className={cn(className, "text-muted-foreground")}>{inner}</span>
  );
}

/** Helpful or not, once per answer (ADR-061 D-m). */
function FeedbackRow({ message }: { message: AssistantMessage }) {
  const [helpful, setHelpful] = useState<boolean | null>(message.helpful);
  const [sending, setSending] = useState(false);
  if (helpful !== null) {
    return <p className="text-2xs text-muted-foreground">Thanks for telling us.</p>;
  }
  async function send(value: boolean) {
    setSending(true);
    const result = await sendAssistantFeedback(message.id, value);
    setSending(false);
    if (result.status === "ok") setHelpful(result.data.helpful);
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
