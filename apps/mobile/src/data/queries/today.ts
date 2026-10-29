// The shift card's read (`GET /me/work/:employeeId/today`, mobile spec 0003, D-u), kept on the phone,
// with the day guard (D-i) and the phone's own punches laid over it (cross child contract 3).

import { MyWorkToday } from "@injishi/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { clockOffsetMs, serverNow } from "@/lib/clock";
import { addDays, kigaliDate } from "@/lib/kigali";
import { useSession } from "@/lib/session";
import { getParsed } from "../fetch";
import { useOutboxRows } from "../outbox";
import { applyPendingToday, type TodayView } from "../outbox/overlay";

/**
 * A copy from an earlier Kigali day is not today's (D-i, AC-11), unless it holds the shift still open:
 * a night shift that crossed midnight keeps its card.
 */
export function isCurrent(today: MyWorkToday, kigaliToday: string): boolean {
  if (today.workDate === kigaliToday) return true;
  return today.openRecord !== null && today.openRecord.workDate >= addDays(kigaliToday, -1);
}

export function useToday(employeeId: string | null | undefined) {
  const { account } = useSession();
  const rows = useOutboxRows(account?.userId);
  const query = useQuery({
    queryKey: ["u", account?.userId, "today", employeeId],
    queryFn: () => getParsed(MyWorkToday, `/api/v1/me/work/${employeeId}/today`),
    enabled: !!account && !!employeeId,
    meta: { persist: true },
  });
  const day = kigaliDate(serverNow());
  const view = useMemo<TodayView | undefined>(() => {
    if (!query.data || !isCurrent(query.data, day)) return undefined;
    return applyPendingToday(query.data, rows, clockOffsetMs());
  }, [query.data, rows, day]);
  /** There is a kept copy, but it is from an earlier day: the screen asks to connect instead. */
  const outOfDate = !!query.data && !view;
  return { query, view, outOfDate };
}
