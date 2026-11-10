"use client";

import { Button, Drawer, Label, NumberField, toast } from "@heroui/react";
import { useEffect, useState, useTransition } from "react";
import type { RosterGroup, ShiftCode } from "../../model/people.ts";
import { useHrActions } from "../mount.tsx";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFTS: { code: ShiftCode; name: string }[] = [
  { code: "M", name: "Morning" },
  { code: "E", name: "Evening" },
  { code: "N", name: "Night" },
];

/** A team's minimum cover: which shifts count, and the fewest people per weekday. */
export function CoverDrawer({
  group,
  shiftTimes,
  onOpenChange,
}: {
  group: RosterGroup | null;
  shiftTimes?: Partial<Record<"M" | "E" | "N", string>>;
  onOpenChange: (open: boolean) => void;
}) {
  const { saveRosterCover } = useHrActions();
  const [pending, start] = useTransition();
  const [mins, setMins] = useState<number[]>(() => Array.from({ length: 7 }, () => 0));
  const [shifts, setShifts] = useState<ShiftCode[]>([]);

  // Each team opens on its own figures.
  useEffect(() => {
    if (!group) return;
    setMins(group.minByWeekday ?? Array.from({ length: 7 }, () => 0));
    setShifts(group.shifts);
  }, [group]);

  const toggle = (code: ShiftCode) =>
    setShifts((cur) => (cur.includes(code) ? cur.filter((s) => s !== code) : [...cur, code]));

  const save = () =>
    start(async () => {
      if (!group) return;
      const counted = shifts.filter((s): s is "M" | "E" | "N" => s === "M" || s === "E" || s === "N");
      const r = await saveRosterCover({ teamId: group.id, shifts: counted, minByWeekday: mins });
      if (r.ok) {
        toast.success(`Minimum cover saved for ${group.name}`);
        onOpenChange(false);
      } else toast.danger(r.error);
    });

  return (
    <Drawer.Backdrop isOpen={group !== null} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog aria-labelledby="cover-drawer-h" className="w-full max-w-[420px]">
          <Drawer.CloseTrigger aria-label="Close" />
          {group ? (
            <>
              <Drawer.Header className="pr-12">
                <Drawer.Heading id="cover-drawer-h" className="text-[17px] leading-[22px] font-semibold">
                  Minimum cover · {group.name}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-5">
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 text-sm font-semibold">Shifts that count</legend>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SHIFTS.map(({ code, name }) => (
                      <Button
                        key={code}
                        size="sm"
                        variant={shifts.includes(code) ? "primary" : "secondary"}
                        aria-pressed={shifts.includes(code)}
                        fullWidth
                        className="h-auto flex-col gap-0.5 py-2"
                        onPress={() => toggle(code)}
                      >
                        {name}
                        {shiftTimes?.[code as "M" | "E" | "N"] ? (
                          <span className="text-[11px] font-normal opacity-80 tabular">
                            {shiftTimes[code as "M" | "E" | "N"]}
                          </span>
                        ) : null}
                      </Button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 text-sm font-semibold">Fewest people each day</legend>
                  {WEEKDAYS.map((day, i) => (
                    <NumberField
                      key={day}
                      variant="secondary"
                      minValue={0}
                      maxValue={99}
                      value={mins[i] ?? 0}
                      onChange={(v) =>
                        setMins((cur) =>
                          cur.map((n, j) => (j === i ? Math.max(0, Math.round(Number.isFinite(v) ? v : 0)) : n)),
                        )
                      }
                      className="flex items-center justify-between gap-3"
                    >
                      <Label className="text-sm font-medium">{day}</Label>
                      <NumberField.Group className="w-[132px]">
                        <NumberField.DecrementButton />
                        <NumberField.Input className="text-center font-semibold tabular" />
                        <NumberField.IncrementButton />
                      </NumberField.Group>
                    </NumberField>
                  ))}
                </fieldset>
              </Drawer.Body>
              <Drawer.Footer className="flex items-center justify-end gap-2 border-t border-separator">
                <Button variant="ghost" onPress={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button isPending={pending} isDisabled={shifts.length === 0} onPress={save}>
                  Save
                </Button>
              </Drawer.Footer>
            </>
          ) : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
