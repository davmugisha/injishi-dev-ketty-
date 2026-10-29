"use client";

import { holdsIdNumber, type RegistrationDraft } from "@injishi/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { saveRegistrationDraft } from "@/data/registration";
import { useOnline } from "@/hooks/use-online";
import { apiResultMessage } from "@/lib/api";
import { writeDeviceCopy } from "@/lib/register-device-copy";

import {
  SAVE_DEBOUNCE_MS,
  SAVE_MAX_WAIT_MS,
  SAVE_RETRY_MS,
  saveStateAfter,
  saveStateWhileTyping,
  type SaveState,
} from "./register-draft";

const ID_NUMBER_TYPED = "A saved registration never keeps an ID number. Take out the 16 digit number you typed.";

/**
 * Save as you type (ADR-075 S9, AC-9 and AC-10).
 *
 * Every change is written to this browser's copy at once, then sent to the
 * server after a short pause in the typing (`SAVE_DEBOUNCE_MS`, and at least
 * every `SAVE_MAX_WAIT_MS` while someone types on). One save is in flight at a
 * time; whatever changed meanwhile goes in the next. With no network the copy
 * holds the answers and the send waits for the connection; an unreachable or
 * busy server is asked again on its own; a refusal waits for a change or a
 * press of Retry. The header's status is read from the last result and
 * `navigator.onLine`, so it is always true.
 *
 * `draft` is the answers as they stand, or null while nothing should be saved
 * (still loading, or the registration already exists). `start` arrives once,
 * when the wizard has opened on its answers: when the server last saved them,
 * and whether this browser holds a copy the server has not had yet, which is
 * sent at once.
 */
export function useDraftAutosave({
  userId,
  draft,
  start,
}: {
  userId: string | null;
  draft: RegistrationDraft | null;
  start: { savedAt: string | null; push: boolean } | null;
}): {
  state: SaveState;
  savedAt: string | null;
  message: string | null;
  retry: () => void;
  flush: () => Promise<void>;
  /** A fresh registration: nothing is saved behind it, and what it opens on is where saving starts. */
  reset: () => void;
} {
  const online = useOnline();
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const json = draft ? JSON.stringify(draft) : null;
  const latest = useRef<string | null>(null);
  /** What the server last acknowledged, and its `savedAt`. */
  const sent = useRef<string | null>(null);
  const basedOn = useRef<string | null>(null);
  const deviceKept = useRef(false);
  /** Saving has started from the answers the wizard opened on. */
  const begun = useRef(false);
  /** The next answers seen are the new starting point, not a change (after `reset`). */
  const rebase = useRef(false);
  /** The server refused the last send: wait for a change or Retry, never loop. */
  const refused = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstUnsentAt = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /** The send a timer runs: always the current one. */
  const sendNow = useRef<() => Promise<void>>(() => Promise.resolve());
  const schedule = useCallback(
    (ms: number) => {
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        void sendNow.current();
      }, ms);
    },
    [clearTimer],
  );

  const keepCopy = useCallback(
    (body: string, pending: boolean): boolean => {
      deviceKept.current =
        userId !== null &&
        writeDeviceCopy(userId, { draft: JSON.parse(body) as RegistrationDraft, pending, basedOn: basedOn.current });
      return deviceKept.current;
    },
    [userId],
  );

  const send = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const body = latest.current;
    if (body === null || body === sent.current) return Promise.resolve();
    clearTimer();
    firstUnsentAt.current = null;
    refused.current = false;
    const run = (async () => {
      const res = await saveRegistrationDraft(JSON.parse(body) as RegistrationDraft);
      if (res.status === "ok") {
        sent.current = body;
        basedOn.current = res.data.savedAt;
        setSavedAt(res.data.savedAt);
        setMessage(null);
        if (latest.current === body) {
          keepCopy(body, false);
          setState("saved");
        }
        return;
      }
      if (res.status === "failed" || (res.status === "refused" && res.httpStatus === 429)) {
        // Unreachable, or asked too often: the copy holds it, and the server is asked again without a press.
        setState(res.status === "failed" ? saveStateAfter("unreachable", deviceKept.current) : "saving");
        schedule(SAVE_RETRY_MS);
        return;
      }
      refused.current = true;
      setState(saveStateAfter("refused", deviceKept.current));
      setMessage(apiResultMessage(res));
    })().finally(() => {
      inFlight.current = null;
      // Anything typed while this one was out goes next.
      if (!refused.current && !timer.current && latest.current !== null && latest.current !== sent.current) {
        schedule(SAVE_DEBOUNCE_MS);
      }
    });
    inFlight.current = run;
    return run;
  }, [keepCopy, clearTimer, schedule]);

  useEffect(() => {
    sendNow.current = send;
    latest.current = json;
  }, [send, json]);

  // The answers the wizard opened on are where saving starts from.
  useEffect(() => {
    if (begun.current || !start || json === null) return;
    begun.current = true;
    basedOn.current = start.savedAt;
    setSavedAt(start.savedAt);
    if (start.push) {
      // A copy the server has not had: it is the answers on screen, and it goes now.
      deviceKept.current = true;
      setState(saveStateWhileTyping(navigator.onLine, true));
      if (navigator.onLine) void send();
    } else {
      sent.current = json;
      setState(start.savedAt ? "saved" : "idle");
    }
  }, [start, json, send]);

  // Every change: kept here at once, sent after the pause.
  useEffect(() => {
    if (!begun.current || json === null) return;
    if (rebase.current) {
      rebase.current = false;
      sent.current = json;
      return;
    }
    if (json === sent.current) {
      // Typed and put back: the server already holds this, and so does the copy again.
      clearTimer();
      if (!inFlight.current) {
        keepCopy(json, false);
        setState(basedOn.current ? "saved" : "idle");
        setMessage(null);
      }
      return;
    }
    if (holdsIdNumber(JSON.parse(json))) {
      // Refused here and on the server alike: say what to change rather than send it.
      clearTimer();
      setState("failed");
      setMessage(ID_NUMBER_TYPED);
      return;
    }
    refused.current = false;
    setMessage(null);
    const kept = keepCopy(json, true);
    setState(saveStateWhileTyping(navigator.onLine, kept));
    if (!navigator.onLine) return;
    const now = Date.now();
    firstUnsentAt.current ??= now;
    schedule(Math.max(0, Math.min(SAVE_DEBOUNCE_MS, firstUnsentAt.current + SAVE_MAX_WAIT_MS - now)));
  }, [json, keepCopy, clearTimer, schedule]);

  // Back online: send what the copy holds. Gone offline: say the copy holds it.
  useEffect(() => {
    if (!begun.current || latest.current === null || latest.current === sent.current) return;
    if (online) {
      if (!refused.current) void send();
    } else {
      setState(saveStateAfter("unreachable", deviceKept.current));
    }
  }, [online, send]);

  // Leaving the page: send at once rather than after the pause. The copy covers a send the browser cuts short.
  useEffect(() => {
    const leave = () => {
      if (document.visibilityState === "hidden" && !refused.current && latest.current !== sent.current) void send();
    };
    document.addEventListener("visibilitychange", leave);
    return () => document.removeEventListener("visibilitychange", leave);
  }, [send]);

  useEffect(() => clearTimer, [clearTimer]);

  const retry = useCallback(() => {
    clearTimer();
    const body = latest.current;
    if (body === null || body === sent.current) return;
    if (holdsIdNumber(JSON.parse(body))) {
      setMessage(ID_NUMBER_TYPED);
      return;
    }
    setMessage(null);
    setState(saveStateWhileTyping(navigator.onLine, deviceKept.current));
    refused.current = false;
    void send();
  }, [send, clearTimer]);

  const flush = useCallback(async () => {
    clearTimer();
    if (inFlight.current) await inFlight.current;
    if (!refused.current) await send();
  }, [send, clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    rebase.current = true;
    refused.current = false;
    sent.current = null;
    basedOn.current = null;
    firstUnsentAt.current = null;
    setSavedAt(null);
    setMessage(null);
    setState("idle");
  }, [clearTimer]);

  return { state, savedAt, message, retry, flush, reset };
}
