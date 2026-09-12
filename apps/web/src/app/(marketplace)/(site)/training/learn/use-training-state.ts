"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_TRAINING,
  readTraining,
  subscribeTraining,
  trainingProgress,
  type TrainingProgress,
  type TrainingState,
} from "@/lib/training-store";

/**
 * The demo's training state, read the one way every screen under `/training/learn`
 * reads it.
 *
 * `lib/training-store.ts` deliberately exports no hook — a hook would force
 * `"use client"` onto the store, and `/training` is a Server Component that
 * imports the course through it. So the hook lives here instead, in the one
 * route group that is entirely client-side, and the store keeps its four lines
 * of `subscribeTraining` contract.
 *
 * WHY `ready` EXISTS, and why it is not the same question as "is the state
 * empty". `readTraining()` answers `EMPTY_TRAINING` on the server AND for a
 * learner who genuinely has not started, and those two need different screens:
 * the first must not render a "Start the course" button that flips to
 * "Continue" a frame later, and the second must render exactly that button.
 * Rendering `EMPTY_TRAINING` on both the server and the first client pass is
 * what keeps hydration honest; `ready` is what lets the panel wait one frame
 * instead of guessing.
 */
export interface TrainingSnapshot {
  state: TrainingState;
  progress: TrainingProgress;
  /** False until the first read after mount, and on every server render. */
  ready: boolean;
  /** Re-read now. For a caller that has just written. */
  refresh: () => void;
}

export function useTrainingState(): TrainingSnapshot {
  const [state, setState] = useState<TrainingState>(EMPTY_TRAINING);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setState(readTraining());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeTraining(refresh);
  }, [refresh]);

  /**
   * `refresh` is returned rather than kept private even though every writer in
   * the store dispatches `TRAINING_CHANGE_EVENT` and this hook is subscribed to
   * it. The store's `write()` returns EARLY, without dispatching, when the
   * browser refuses `localStorage` — a private window, or site data blocked —
   * and in that case the only signal a write happened is the caller knowing it
   * made one. A quiz that marks itself and then shows a stale best mark is the
   * failure this avoids, and it costs one call in the answer handler.
   */
  return { state, progress: trainingProgress(state), ready, refresh };
}
