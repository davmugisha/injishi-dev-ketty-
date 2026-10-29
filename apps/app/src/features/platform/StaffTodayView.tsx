"use client";

import { Check, CircleCheckFill, Clock, CloudSlash, ListCheck, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, ProgressBar, Toast, toast } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import type { HousekeepingDone, HousekeepingTask, Persona } from "@injishi/product-pms";
import { useBoardHref, usePmsActions } from "@injishi/product-pms/web";
import { LinkButton, PhoneBody, PhoneTop, toneColor } from "@injishi/ui";
import { useOptimistic, useTransition } from "react";

/** "Monday 12 October": today in Kigali. */
const todayLong = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

/** Rooms assigned today = waiting/active tasks + rooms already done (artifact: 3 of 7). */
export function StaffTodayView({
  persona,
  tasks,
  done,
  offline = false,
}: {
  persona: Persona;
  tasks: HousekeepingTask[];
  done: HousekeepingDone[];
  offline?: boolean;
}) {
  const screenHref = useBoardHref();
  const { setHousekeepingTaskStatus } = usePmsActions();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    tasks,
    (state, { id, status }: { id: string; status: HousekeepingTask["status"] }) =>
      status === "done" ? state.filter((t) => t.id !== id) : state.map((t) => (t.id === id ? { ...t, status } : t)),
  );
  const finishedNow = tasks.length - optimistic.length;
  const doneCount = done.length + finishedNow;
  const total = tasks.length + done.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  // A refused move comes back as words; the optimistic change falls away with the transition, so the card
  // shows the room as the API holds it.
  const update = (id: string, status: "active" | "done") =>
    startTransition(async () => {
      setOptimistic({ id, status });
      const result = await setHousekeepingTaskStatus(id, status);
      if (!result.ok) toast.danger(result.error);
    });

  return (
    <>
      <Toast.Provider placement="top" />
      <PhoneTop>
        <Avatar size="sm" variant="soft" color="accent">
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] leading-[18px] font-semibold">{persona.name}</span>
          {/* The role only: the floor and branch of today's sheet are not in what this screen reads. */}
          <span className="text-xs leading-4 text-muted">{persona.role}</span>
        </div>
        <LinkButton
          href={screenHref("StaffReport")}
          variant="ghost"
          isIconOnly
          aria-label="Report a problem"
          title="Report a problem"
        >
          <TriangleExclamation className="size-4" />
        </LinkButton>
      </PhoneTop>

      <PhoneBody>
        {offline ? (
          <Alert status="warning" role="status">
            <Alert.Indicator>
              <CloudSlash />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No connection</Alert.Title>
              <Alert.Description>
                Rooms cannot be started or marked clean until you are back online. Nothing is saved on this phone.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {/* No clock-in time or shift hours here: the board reads the rooms, not the person's attendance or
            roster, and printing the prototype's 07:02 and 07:00 – 15:00 would state facts about her that
            nothing measured. */}
        <Card className="gap-3 p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted">{todayLong()}</span>
            <span className="text-xl leading-[26px] font-semibold">
              {doneCount} of {total} rooms done
            </span>
          </div>
          <ProgressBar value={pct} aria-label="Rooms done today">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </Card>

        <section className="flex flex-col gap-2.5" aria-labelledby="next-h">
          <h2 id="next-h" className="text-[15px] leading-[22px] font-semibold">
            Next
          </h2>
          {optimistic.map((t) => (
            <Card key={t.id} className="gap-2.5 px-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-[26px] font-semibold tabular">{t.room}</span>
                    <Chip variant="soft" color={toneColor(t.kindTone)}>
                      {t.kind}
                    </Chip>
                  </div>
                  <span className="text-[13px] leading-[18px] text-muted">{t.note}</span>
                </div>
                {t.flag ? (
                  <Chip color="warning" variant="soft">
                    <Clock className="size-3" />
                    <Chip.Label>{t.flag}</Chip.Label>
                  </Chip>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {t.status === "active" ? (
                  <Button
                    size="lg"
                    className="min-h-14 flex-1"
                    onPress={() => update(t.id, "done")}
                    isDisabled={pending || offline}
                  >
                    <Check className="size-4" />
                    Mark clean
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="min-h-14 flex-1"
                    onPress={() => update(t.id, "active")}
                    isDisabled={pending || offline}
                  >
                    Start cleaning
                  </Button>
                )}
                <LinkButton
                  href={screenHref("StaffTask")}
                  variant="secondary"
                  size="lg"
                  isIconOnly
                  className="min-h-14 w-14"
                  aria-label={`Open room ${t.room} checklist`}
                  title={`Open room ${t.room} checklist`}
                >
                  <ListCheck className="size-5" />
                </LinkButton>
              </div>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="done-h">
          <h2 id="done-h" className="text-[15px] leading-[22px] font-semibold">
            Done today
          </h2>
          <ListView aria-label="Done today" items={done}>
            {(d) => (
              <ListView.Item id={d.id} textValue={`Room ${d.room}`}>
                <ListView.ItemContent>
                  <CircleCheckFill className="size-4 text-success" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="tabular">
                      Room {d.room} · {d.kind}
                    </ListView.Title>
                    <ListView.Description>{d.when}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Chip variant="soft" color={toneColor(d.stateTone)}>
                    {d.state}
                  </Chip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </section>
      </PhoneBody>
    </>
  );
}
