"use client";

import {
  ASSISTANT_MESSAGE_MAX,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantProposal,
  type SupportTopic,
} from "@injishi/contracts";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Textarea } from "@injishi/ui";
import { cn } from "@injishi/utils";
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
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
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
    });
    return () => {
      live = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation, pending, open]);

  if (!enabled || !workspaceId) return null;

  async function send() {
    const message = draft.trim();
    if (!message || pending || !workspaceId) return;
    setPending(true);
    setError(null);
    const result = await sendAssistantMessage(workspaceId, {
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
    if (result.code === "assistant_off") {
      setEnabled(false);
      return;
    }
    setError(result.message);
  }

  const messages = conversation?.messages ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 border-panel-bd bg-panel p-0 sm:max-w-narrow">
          <SheetHeader className="gap-2 border-b border-line p-5">
            <SheetTitle className="pms-display text-xl font-bold text-ink">Assistant</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Steps for your tasks, and answers from this business within what your account can see. It never
              changes anything for you.
            </SheetDescription>
          </SheetHeader>

          <div className="scrollbar flex-1 overflow-y-auto p-5" aria-live="polite">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Try: which rooms are free tomorrow, how do I check a guest in, or why can&apos;t I publish my property.
              </p>
            ) : (
              <ol className="flex flex-col gap-4">
                {messages.map((m) => (
                  <li key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                    <p
                      className={cn(
                        "whitespace-pre-line rounded-card px-4 py-3 text-sm text-ink",
                        m.role === "user" ? "bg-accent-soft" : "border border-line bg-card",
                      )}
                    >
                      {m.text}
                    </p>
                    {m.proposals.map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        workspaceId={workspaceId}
                        onDecided={(next) =>
                          setConversation((c) =>
                            c && {
                              ...c,
                              messages: c.messages.map((msg) => ({
                                ...msg,
                                proposals: msg.proposals.map((q) => (q.id === next.id ? next : q)),
                              })),
                            },
                          )
                        }
                      />
                    ))}
                    {m.role === "assistant" && m.escalation ? (
                      <EscalationButton workspaceId={workspaceId} topic={m.escalation.topic} />
                    ) : null}
                    {m.role === "assistant" ? <FeedbackRow workspaceId={workspaceId} message={m} /> : null}
                    {m.sources.length > 0 ? (
                      <ul className="flex flex-wrap gap-2 text-xs text-ink2">
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
            className="flex flex-col gap-3 border-t border-line p-5"
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
            <Textarea
              id="pms-assistant-message"
              value={draft}
              maxLength={ASSISTANT_MESSAGE_MAX}
              placeholder="Ask about this business"
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
  if (helpful !== null) return <p className="text-xs text-ink2">Thanks for telling us.</p>;
  async function send(value: boolean) {
    setSending(true);
    const result = await sendAssistantFeedback(workspaceId, message.id, value);
    setSending(false);
    if (result.ok) setHelpful(result.data.helpful);
  }
  return (
    <div className="flex items-center gap-2 text-xs text-ink2">
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
