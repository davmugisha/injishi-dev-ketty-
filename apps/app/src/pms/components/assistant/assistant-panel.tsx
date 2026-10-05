"use client";

import {
  ASSISTANT_MESSAGE_MAX,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantProposal,
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
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useWorkspaceId } from "../../data/capability";
import {
  decideAssistantProposal,
  getAssistantConversation,
  sendAssistantEscalation,
  sendAssistantFeedback,
  sendAssistantMessage,
} from "../../data/assistant";
import { Icon } from "../icon";

/**
 * The support assistant in the operator app (ADR-061 slice D).
 *
 * It asks about the workspace in view: the API resolves the grant and branch
 * scope from the same headers the screens send, so it can read what this
 * person could open and nothing more. It draws nothing when the API has the
 * assistant off, or when there is no workspace in view.
 *
 * It never acts. It can PREPARE a change, drawn as a card the person approves
 * or rejects with their own click (slice E).
 *
 * A new conversation opens with the API's greeting and the questions asked
 * most, each sent with one tap; after every answer the API offers the next
 * questions. Both come from the API, which offers only what this person may
 * ask (D-q).
 *
 * Opened from `AssistantLauncher` in the top bar, not a floating button: a
 * floating button sat under the demo guide and over table rows (found in the
 * browser walk). The two share the one open flag below.
 */
interface AssistantUi {
  open: boolean;
  enabled: boolean;
}

let assistantUi: AssistantUi = { open: false, enabled: false };
const listeners = new Set<() => void>();

function setAssistantUi(next: Partial<AssistantUi>): void {
  assistantUi = { ...assistantUi, ...next };
  for (const listener of listeners) listener();
}

function useAssistantUi(): AssistantUi {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => assistantUi,
    () => assistantUi,
  );
}

/** The top bar button. Draws nothing while the API has the assistant off. */
export function AssistantLauncher() {
  const { enabled } = useAssistantUi();
  if (!enabled) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      shape="rounded"
      className="shrink-0"
      aria-label="Ask the Injishi assistant"
      onClick={() => setAssistantUi({ open: true })}
    >
      <Icon name="message-square" size={18} />
    </Button>
  );
}

export function AssistantPanel() {
  const workspaceId = useWorkspaceId();
  const pathname = usePathname();
  const { enabled, open } = useAssistantUi();
  const setEnabled = (value: boolean): void => setAssistantUi({ enabled: value });
  const setOpen = (value: boolean): void => setAssistantUi({ open: value });
  const [conversation, setConversation] = useState<AssistantConversation | null>(null);
  const [greeting, setGreeting] = useState("");
  const [starters, setStarters] = useState<AssistantSuggestion[]>([]);
  const [draft, setDraft] = useState("");
  // The message on its way, drawn at once as the person's own bubble.
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startFresh, setStartFresh] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceId) {
      setAssistantUi({ enabled: false, open: false });
      return;
    }
    let live = true;
    void getAssistantConversation(workspaceId).then((result) => {
      if (!live || !result.ok) return;
      setAssistantUi({ enabled: result.data.enabled });
      setConversation(result.data.conversation);
      setGreeting(result.data.greeting);
      setStarters(result.data.suggestions);
    });
    return () => {
      live = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation, pending, open]);

  if (!enabled || !workspaceId) return null;

  /** Sends the draft, or a tapped suggestion's message exactly as if typed. */
  async function send(text?: string) {
    const message = (text ?? draft).trim();
    if (!message || pending !== null || !workspaceId) return;
    setPending(message);
    setError(null);
    if (text === undefined) setDraft("");
    const result = await sendAssistantMessage(workspaceId, {
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
    // Not sent: give the person their words back.
    if (text === undefined) setDraft(message);
    if (result.code === "conversation_full") {
      setStartFresh(true);
      setError("This conversation is full. Send again to start a new one.");
      return;
    }
    if (result.code === "assistant_off") {
      setEnabled(false);
      return;
    }
    setError(result.message);
  }

  function startOver() {
    setConversation(null);
    setStartFresh(true);
    setError(null);
  }

  function replaceProposal(next: AssistantProposal) {
    setConversation(
      (c) =>
        c && {
          ...c,
          messages: c.messages.map((msg) => ({
            ...msg,
            proposals: msg.proposals.map((q) => (q.id === next.id ? next : q)),
          })),
        },
    );
  }

  const messages = conversation?.messages ?? [];
  const lastIsAnswer = messages.at(-1)?.role === "assistant";
  const followUps = lastIsAnswer && pending === null ? (conversation?.suggestions ?? []) : [];

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 border-panel-bd bg-panel p-0 sm:max-w-narrow">
          <SheetHeader className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-3">
              <AssistantAvatar />
              <div className="min-w-0 text-left">
                <SheetTitle className="pms-display text-lg font-bold text-ink">Assistant</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Answers from this business within what your account can see. It never changes anything for you.
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
                <MessageRow key={m.id} message={m} workspaceId={workspaceId} onDecided={replaceProposal} />
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
            className="flex flex-col gap-2 border-t border-line px-4 py-3"
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
            <label htmlFor="pms-assistant-message" className="sr-only">
              Your question
            </label>
            <div className="flex items-end gap-2 rounded-card border border-line2 bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
              <Textarea
                id="pms-assistant-message"
                value={draft}
                maxLength={ASSISTANT_MESSAGE_MAX}
                placeholder="Ask about this business"
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
      <p className="max-w-[85%] whitespace-pre-line rounded-card border border-line bg-card px-4 py-3 text-sm leading-relaxed text-foreground">
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
      className="flex items-center gap-1 rounded-card border border-line bg-card px-4 py-3.5"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-ink2 motion-safe:animate-bounce"
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
            className="rounded-full border border-line2 bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {s.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function MessageRow({
  message,
  workspaceId,
  onDecided,
}: {
  message: AssistantMessage;
  workspaceId: string;
  onDecided: (next: AssistantProposal) => void;
}) {
  if (message.role === "user") return <UserBubble>{message.text}</UserBubble>;
  const listings = message.sources.filter((s) => s.kind === "listing" && s.listing);
  const others = message.sources.filter((s) => !(s.kind === "listing" && s.listing));
  return (
    <li className="flex flex-col gap-2">
      <AssistantBubble>{message.text}</AssistantBubble>
      {message.proposals.length > 0 ? (
        <div className="flex flex-col gap-2 pl-9">
          {message.proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} workspaceId={workspaceId} onDecided={onDecided} />
          ))}
        </div>
      ) : null}
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
          <EscalationButton workspaceId={workspaceId} topic={message.escalation.topic} />
        </div>
      ) : null}
      <div className="pl-9">
        <FeedbackRow workspaceId={workspaceId} message={message} />
      </div>
    </li>
  );
}

/**
 * A published place, as the search returned it: the photo, where it is, the
 * lowest base nightly rate, how many it sleeps and how many room types. The
 * rate is the base rate, before any date specific price.
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
  const className = "flex items-center gap-3 rounded-card border border-line bg-card p-2.5 transition-colors";
  return (
    <li>
      {source.href ? (
        <a
          href={source.href}
          className={cn(className, "hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        >
          {body}
        </a>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

/*
 * Source links are public site paths ("/how-it-works", "/property/<slug>").
 * The operator app is served under the site's own domain, so a plain <a>
 * reaches the site page; next/link would route inside the app and 404.
 */
function SourceLink({ source }: { source: AssistantSource }) {
  const SourceIcon = source.kind === "task" ? ListChecks : source.kind === "listing" ? Building2 : BookOpen;
  const inner = (
    <>
      <SourceIcon aria-hidden="true" className="size-3" />
      {source.title}
    </>
  );
  const className = "inline-flex items-center gap-1.5 rounded-full border border-line2 bg-card px-2.5 py-1";
  return source.href ? (
    <a href={source.href} className={cn(className, "text-accent-text hover:underline")}>
      {inner}
    </a>
  ) : (
    <span className={cn(className, "text-ink2")}>{inner}</span>
  );
}

const STATE_WORDS: Record<AssistantProposal["state"], string> = {
  proposed: "Waiting for your approval",
  approved: "Being made…",
  executed: "Done",
  failed: "Not made",
  rejected: "Rejected",
  expired: "Expired. Ask again to prepare it.",
};

/**
 * The approval card for one prepared change (ADR-061 D-k). Everything on it
 * comes from the stored proposal the API returned, never from the answer's
 * words, so what is approved is exactly what runs. Approve sends the person's
 * own request; the key is minted once per press.
 */
function ProposalCard({
  proposal,
  workspaceId,
  onDecided,
}: {
  proposal: AssistantProposal;
  workspaceId: string;
  onDecided: (next: AssistantProposal) => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setError(null);
    const result = await decideAssistantProposal(workspaceId, proposal.id, decision, crypto.randomUUID());
    setBusy(null);
    if (result.ok) onDecided(result.data.proposal);
    else setError(result.message);
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-card border border-line2 bg-card p-4" data-proposal-state={proposal.state}>
      <p className="text-sm font-semibold text-ink">{proposal.title}</p>
      <dl className="grid grid-cols-2 gap-1 text-sm">
        <dt className="text-muted-foreground">Current</dt>
        <dd className="text-ink">{proposal.current}</dd>
        <dt className="text-muted-foreground">New</dt>
        <dd className="font-semibold text-ink">{proposal.proposed}</dd>
      </dl>
      {proposal.state === "proposed" ? (
        <div className="flex gap-3">
          <Button type="button" size="sm" pending={busy === "approve"} disabled={busy !== null} onClick={() => void decide("approve")}>
            Approve change
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void decide("reject")}>
            Reject
          </Button>
        </div>
      ) : (
        <p className="text-xs text-ink2">{STATE_WORDS[proposal.state]}</p>
      )}
      {proposal.error || error ? (
        <p role="alert" className="text-xs text-destructive">
          {error ?? proposal.error}
        </p>
      ) : null}
    </div>
  );
}

/** Helpful or not, once per answer (ADR-061 D-m). */
function FeedbackRow({ workspaceId, message }: { workspaceId: string; message: AssistantMessage }) {
  const [helpful, setHelpful] = useState<boolean | null>(message.helpful);
  const [sending, setSending] = useState(false);
  if (helpful !== null) return <p className="text-2xs text-ink2">Thanks for telling us.</p>;
  async function send(value: boolean) {
    setSending(true);
    const result = await sendAssistantFeedback(workspaceId, message.id, value);
    setSending(false);
    if (result.ok) setHelpful(result.data.helpful);
  }
  return (
    <div className="flex items-center gap-1 text-2xs text-ink2">
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
 * person presses it; the assistant only offered. The reply goes to the
 * account's own address.
 */
function EscalationButton({ workspaceId, topic }: { workspaceId: string; topic: SupportTopic }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "sent") return <p className="text-sm text-ink">Sent to Injishi support. A person will reply by email.</p>;
  async function send() {
    setState("sending");
    setError(null);
    const result = await sendAssistantEscalation(workspaceId, topic);
    if (result.ok) setState("sent");
    else {
      setState("idle");
      setError(result.message);
    }
  }
  return (
    <div className="flex w-full flex-col gap-2 rounded-card border border-line bg-card p-4">
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
