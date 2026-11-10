"use client";

import { Xmark } from "@gravity-ui/icons";
import { Button, Drawer, Input, Label, NumberField, TextField, toast } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { useState, useTransition } from "react";
import type { ShiftLetter } from "../../model/commands.ts";
import { useHrActions } from "../mount.tsx";

const STEPS: { code: ShiftLetter; name: string; tile: string }[] = [
  { code: "M", name: "Morning", tile: "bg-accent text-accent-foreground" },
  { code: "E", name: "Evening", tile: "bg-[var(--chart-4)] text-[var(--eclipse)]" },
  { code: "N", name: "Night", tile: "bg-foreground text-background" },
  { code: "O", name: "Off", tile: "border border-dashed border-muted/50 text-muted" },
];
const tileOf = (code: ShiftLetter) => STEPS.find((s) => s.code === code);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Rule = "every_n_days" | "weekly" | "monthly";

/** A new rotation: its name, its steps in order, and when a person moves to the next step. */
export function NewRotationDrawer({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createRotation } = useHrActions();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<ShiftLetter[]>([]);
  const [rule, setRule] = useState<Rule>("every_n_days");
  const [value, setValue] = useState(1);

  const hasShift = steps.some((s) => s !== "O");
  const ready = name.trim().length > 0 && steps.length >= 2 && hasShift;

  const close = (open: boolean) => {
    if (!open) {
      setName("");
      setSteps([]);
      setRule("every_n_days");
      setValue(1);
    }
    onOpenChange(open);
  };

  const changeRule = (next: Rule) => {
    setRule(next);
    setValue(1);
  };

  const save = () =>
    start(async () => {
      const r = await createRotation({ name: name.trim(), steps, rule, ruleValue: value });
      if (r.ok) {
        toast.success(`Rotation ${name.trim()} created`);
        close(false);
      } else toast.danger(r.error);
    });

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={close}>
      <Drawer.Content placement="right">
        <Drawer.Dialog aria-labelledby="new-rot-h" className="w-full max-w-[460px]">
          <Drawer.CloseTrigger aria-label="Close" />
          <Drawer.Header className="pr-12">
            <Drawer.Heading id="new-rot-h" className="text-[17px] leading-[22px] font-semibold">
              New rotation
            </Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-5">
            <TextField value={name} onChange={setName} maxLength={40} className="flex flex-col gap-1">
              <Label>Name</Label>
              <Input placeholder="Mornings, then nights" fullWidth />
            </TextField>

            <section className="flex flex-col gap-2" aria-label="Steps">
              <h3 className="text-sm font-semibold">Steps</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {STEPS.map((s) => (
                  <Button
                    key={s.code}
                    size="sm"
                    variant="secondary"
                    fullWidth
                    isDisabled={steps.length >= 28}
                    onPress={() => setSteps((cur) => [...cur, s.code])}
                  >
                    + {s.name}
                  </Button>
                ))}
              </div>
              {steps.length === 0 ? (
                <p className="rounded-xl bg-surface-secondary p-3 text-sm text-muted">Add at least two steps.</p>
              ) : (
                <ol className="m-0 flex list-none flex-wrap gap-1.5 rounded-xl bg-surface-secondary p-3">
                  {steps.map((code, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a step is its place in the cycle.
                    <li key={i}>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove step ${i + 1}, ${tileOf(code)?.name}`}
                        className={`h-9 min-w-9 gap-1 rounded-lg px-2 text-xs font-bold ${tileOf(code)?.tile ?? ""}`}
                        onPress={() => setSteps((cur) => cur.filter((_, j) => j !== i))}
                      >
                        {code === "O" ? "–" : code}
                        <Xmark className="size-3" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="flex flex-col gap-3" aria-label="When a person moves on">
              <NativeSelect fullWidth className="flex flex-col gap-1">
                <Label htmlFor="new-rot-rule">Moves to the next step</Label>
                <NativeSelect.Trigger
                  id="new-rot-rule"
                  value={rule}
                  onChange={(e) => changeRule(e.target.value as Rule)}
                >
                  <NativeSelect.Option value="every_n_days">Every few days</NativeSelect.Option>
                  <NativeSelect.Option value="weekly">Every week</NativeSelect.Option>
                  <NativeSelect.Option value="monthly">Every month</NativeSelect.Option>
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
              {rule === "weekly" ? (
                <NativeSelect fullWidth className="flex flex-col gap-1">
                  <Label htmlFor="new-rot-day">On</Label>
                  <NativeSelect.Trigger
                    id="new-rot-day"
                    value={String(value)}
                    onChange={(e) => setValue(Number(e.target.value))}
                  >
                    {WEEKDAYS.map((d, i) => (
                      <NativeSelect.Option key={d} value={String(i)}>
                        {d}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              ) : (
                <NumberField
                  variant="secondary"
                  minValue={1}
                  maxValue={28}
                  value={value}
                  onChange={(v) => setValue(Math.min(28, Math.max(1, Math.round(Number.isFinite(v) ? v : 1))))}
                  className="flex flex-col gap-1"
                >
                  <Label>{rule === "monthly" ? "On day of the month" : "Days on each step"}</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input className="text-center tabular" />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              )}
            </section>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2 border-t border-separator">
            <Button variant="ghost" onPress={() => close(false)}>
              Cancel
            </Button>
            <Button isPending={pending} isDisabled={!ready} onPress={save}>
              Create
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
