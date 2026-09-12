"use client";

import { useState, type KeyboardEvent } from "react";
import { Button, Textarea } from "@injishi/ui";

import { sendGuestMessage, type Department } from "@/lib/order-store";
import { Icon } from "@/components/app/icon";
import { DEPARTMENT_OPENER } from "./department-desk";

/**
 * Where the guest says something.
 *
 * ENTER SENDS, SHIFT+ENTER BREAKS THE LINE. It is a `<textarea>` rather than an
 * `<input>` so a guest describing a fault can write two sentences, and the key
 * handling is what stops that choice from turning every message into a draft
 * nobody sends.
 *
 * The send is `sendGuestMessage` and nothing else — no local list of "my
 * messages" beside the store. The screen re-reads on the store's own change
 * event, so a message appears here by the same path an order state change from
 * the operator side appears, and there is no second code path to keep in step.
 *
 * THERE IS NO FAKE REPLY. It would be easy to have a desk answer two seconds
 * later and the demo would look livelier for it; it would also be the one thing
 * the handbook forbids outright, because an invented reply from a named person
 * at a named hotel is not a simulation, it is a fabrication presented as an
 * event. The operator side of this thread is `apps/app`, and that is where a
 * reply comes from.
 */
export function Composer({
  threadId,
  department,
  leadName,
  showOpeners,
}: {
  threadId: string;
  department: Department;
  leadName: string;
  /** Openers are for a thread the guest has not written in yet. */
  showOpeners: boolean;
}) {
  const [draft, setDraft] = useState("");

  function send(body: string) {
    if (sendGuestMessage(threadId, body) !== null) setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    send(draft);
  }

  return (
    <div className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
      {showOpeners ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {DEPARTMENT_OPENER[department].map((opener) => (
            <Button
              key={opener}
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal py-2 text-left text-xs"
              onClick={() => send(opener)}
            >
              {opener}
            </Button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <label className="sr-only" htmlFor="inbox-composer">
          Message {leadName}
        </label>
        <Textarea
          id="inbox-composer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={`Message ${leadName}…`}
          className="min-h-11 grow resize-none rounded-card text-sm"
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          disabled={draft.trim().length === 0}
          aria-label="Send message"
        >
          <Icon name="arrow-up-right" className="h-4 w-4" />
        </Button>
      </form>
      <p className="mt-2 text-2xs text-muted-foreground">
        Enter sends · Shift + Enter starts a new line
      </p>
    </div>
  );
}
