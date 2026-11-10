"use client";

import { Check, Plus, Star } from "@gravity-ui/icons";
import { Button, Card, Chip, Input, Pagination, TextField } from "@heroui/react";
import { Rating, Segment } from "@heroui-pro/react";
import { useState } from "react";
import type { Done } from "../../model/commands.ts";
import type { TalentReview, TalentReviewCycle } from "../../model/talent.ts";
import { useHrActions } from "../mount.tsx";
import { Hint, Person } from "../people/parts";

const PAGE = 12;

type Show = "todo" | "done";

/** Where one review stands: its next step, said in plain words. A review is done once it is rated. */
function stepOf(r: TalentReview): { label: string; patch?: { selfDone: true } | { managerDone: true } } {
  if (r.rating !== null) return { label: "Done" };
  if (!r.selfDone) return { label: "Waiting for their own review", patch: { selfDone: true } };
  if (!r.managerDone) return { label: "Waiting for their manager", patch: { managerDone: true } };
  return { label: "Ready to rate" };
}

const dm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/**
 * The review cycle, one step at a time: each person shows only what is next (their own review,
 * their manager's, then a rating) and the one button that moves it on. One bar says how far the
 * cycle has come; To do and Done split the list, twelve to a page.
 */
export function ReviewsPanel({
  cycle,
  today,
  pending,
  run,
}: {
  cycle: TalentReviewCycle | null;
  today: string;
  pending: boolean;
  run: (task: () => Promise<Done>, done: string) => void;
}) {
  const { closeReviewCycleAction, openReviewCycleAction, updateReviewAction } = useHrActions();
  const [show, setShow] = useState<Show>("todo");
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(() => {
    const ends = new Date(`${today}T00:00:00Z`);
    ends.setUTCDate(ends.getUTCDate() + 30);
    return {
      name: `Reviews · ${Number(today.slice(5, 7)) <= 6 ? "H1" : "H2"} ${today.slice(0, 4)}`,
      startsOn: today,
      endsOn: ends.toISOString().slice(0, 10),
    };
  });

  const open = cycle?.status === "open";
  const reviews = cycle?.reviews ?? [];
  const done = reviews.filter((r) => r.rating !== null);
  const todo = reviews.filter((r) => r.rating === null);
  const list = show === "todo" ? todo : done;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages);
  const share = reviews.length ? done.length / reviews.length : 0;

  return (
    <Card aria-labelledby="perf-h" className="gap-4 p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="perf-h" className="flex items-center gap-2 text-base font-semibold">
          <Star className="size-4 text-accent" aria-hidden="true" />
          {cycle ? cycle.name : "Reviews"}
        </h2>
        {cycle ? (
          <span className="flex items-center gap-1.5">
            <Chip size="sm" variant="soft">
              {dm(cycle.startsOn)} – {dm(cycle.endsOn)}
              {open ? "" : " · closed"}
            </Chip>
            {open ? (
              <Button
                size="sm"
                variant="ghost"
                isPending={pending}
                onPress={() => run(() => closeReviewCycleAction(cycle.id), "Review cycle closed.")}
              >
                Close the cycle
              </Button>
            ) : null}
          </span>
        ) : null}
      </div>

      {!open ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-surface-secondary p-3">
          <TextField
            value={next.name}
            onChange={(v) => setNext((c) => ({ ...c, name: v }))}
            className="flex flex-col gap-1"
          >
            <span className="text-xs font-medium text-muted">Name</span>
            <Input className="w-[200px]" aria-label="Cycle name" />
          </TextField>
          <TextField
            value={next.startsOn}
            onChange={(v) => setNext((c) => ({ ...c, startsOn: v }))}
            className="flex flex-col gap-1"
          >
            <span className="text-xs font-medium text-muted">From</span>
            <Input type="date" aria-label="From" />
          </TextField>
          <TextField
            value={next.endsOn}
            onChange={(v) => setNext((c) => ({ ...c, endsOn: v }))}
            className="flex flex-col gap-1"
          >
            <span className="text-xs font-medium text-muted">To</span>
            <Input type="date" aria-label="To" />
          </TextField>
          <Button
            isPending={pending}
            isDisabled={next.name.trim().length < 2 || !next.startsOn || !next.endsOn}
            onPress={() =>
              run(() => openReviewCycleAction(next.name, next.startsOn, next.endsOn), "Review cycle open for everyone.")
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Start a review cycle
          </Button>
        </div>
      ) : null}

      {cycle && reviews.length ? (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>
                <span className="text-lg font-bold tabular">{done.length}</span>
                <span className="text-muted tabular"> of {reviews.length} done</span>
              </span>
              <span className="text-xs text-muted tabular">{todo.length} to go</span>
            </div>
            <div
              role="img"
              aria-label={`${done.length} of ${reviews.length} reviews done`}
              className="h-2 overflow-hidden rounded-full bg-default"
            >
              <span className="block h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
            </div>
          </div>

          <Segment
            aria-label="Show reviews"
            size="sm"
            selectedKey={show}
            onSelectionChange={(k) => {
              setShow(k as Show);
              setPage(1);
            }}
            className="self-start"
          >
            <Segment.Item id="todo">To do {todo.length}</Segment.Item>
            <Segment.Item id="done">
              <Segment.Separator />
              Done {done.length}
            </Segment.Item>
          </Segment>

          {list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              {show === "todo" ? "Everyone is reviewed." : "Nobody rated yet."}
            </p>
          ) : (
            <ul aria-label={show === "todo" ? "Reviews to do" : "Reviews done"} className="flex flex-col">
              {list.slice((at - 1) * PAGE, at * PAGE).map((r) => {
                const step = stepOf(r);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-separator py-2.5 first:border-t-0"
                  >
                    <span className="flex min-w-0 flex-[1_1_200px] items-center gap-1">
                      <Person name={r.employee.displayName} sub={r.employee.jobPositionTitle ?? undefined} />
                      {r.note ? <Hint label={`What ${r.employee.displayName} wrote`}>{r.note}</Hint> : null}
                    </span>
                    <span className="flex flex-[0_1_auto] items-center justify-end gap-3">
                      {step.label === "Done" ? null : <span className="text-xs text-muted">{step.label}</span>}
                      {step.patch ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs"
                          isDisabled={pending || !open}
                          onPress={() => run(() => updateReviewAction(r.id, step.patch ?? {}), "Marked done.")}
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                          Mark done
                        </Button>
                      ) : (
                        <Rating
                          value={r.rating ?? 0}
                          size="sm"
                          isReadOnly={!open}
                          onValueChange={(v) => run(() => updateReviewAction(r.id, { rating: v }), `Rated ${v} of 5.`)}
                          aria-label={`Rating of ${r.employee.displayName}`}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Rating.Item key={n} value={n} />
                          ))}
                        </Rating>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {pages > 1 ? (
            <Pagination size="sm" className="self-center">
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous aria-label="Previous page" isDisabled={at === 1} onPress={() => setPage(at - 1)}>
                    <Pagination.PreviousIcon />
                  </Pagination.Previous>
                </Pagination.Item>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <Pagination.Item key={n}>
                    <Pagination.Link
                      isActive={n === at}
                      aria-label={`Page ${n}`}
                      aria-current={n === at ? "page" : undefined}
                      onPress={() => setPage(n)}
                    >
                      {n}
                    </Pagination.Link>
                  </Pagination.Item>
                ))}
                <Pagination.Item>
                  <Pagination.Next aria-label="Next page" isDisabled={at === pages} onPress={() => setPage(at + 1)}>
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
