"use client";

import { Button, Chip, Input, Label, Modal, TextArea, TextField, toast } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import type { ShiftChoices, SwapAsk, SwapColleague } from "@injishi/product-hr";
import { useState, useTransition } from "react";
import { answerSwap, askRotation, askShiftChange, askSwap } from "./actions";

type Mode = "swap" | "change" | "rotation";
const TITLE: Record<Mode, string> = {
  swap: "Ask a colleague to swap",
  change: "Ask for a different shift",
  rotation: "Ask for a rotation",
};

/** A short picker, as the rest of Me uses. */
function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <NativeSelect fullWidth className="flex flex-col gap-1">
      <Label htmlFor="ask-pick">{label}</Label>
      <NativeSelect.Trigger id="ask-pick" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <NativeSelect.Option key={o.id} value={o.id}>
            {o.name}
          </NativeSelect.Option>
        ))}
        <NativeSelect.Indicator />
      </NativeSelect.Trigger>
    </NativeSelect>
  );
}

/**
 * The desk's way to ask for a swap, a different shift or a rotation, and to answer a colleague's swap.
 * The phone's schedule does the same; this is for everyone who works from a computer.
 */
export function ShiftAsks({
  employeeId,
  today,
  asks,
  colleagues,
  choices,
}: {
  employeeId: string;
  today: string;
  asks: SwapAsk[];
  colleagues: SwapColleague[];
  choices: ShiftChoices;
}) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode | null>(null);
  const [day, setDay] = useState("");
  const [choice, setChoice] = useState("");
  const [note, setNote] = useState("");

  const open = (next: Mode) => {
    setMode(next);
    setDay("");
    setNote("");
    setChoice(
      next === "swap"
        ? (colleagues[0]?.id ?? "")
        : next === "change"
          ? (choices.shifts[0]?.id ?? "")
          : (choices.rotations[0]?.id ?? ""),
    );
  };

  const send = () =>
    start(async () => {
      const result =
        mode === "swap"
          ? await askSwap(employeeId, day, choice)
          : mode === "change"
            ? await askShiftChange(employeeId, day, choice, note)
            : await askRotation(employeeId, choice, day, note);
      if (result.ok) {
        toast.success(mode === "swap" ? "Sent to your colleague." : "Sent to your manager.");
        setMode(null);
      } else toast.danger(result.error);
    });

  const answer = (ask: SwapAsk, reply: "accept" | "decline") =>
    start(async () => {
      const result = await answerSwap(employeeId, ask.id, reply);
      if (result.ok) toast.success(reply === "accept" ? "You said yes." : "You said no.");
      else toast.danger(result.error);
    });

  return (
    <div className="flex flex-col gap-3 border-t border-separator pt-3">
      {asks.map((ask) => (
        <div key={ask.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-secondary p-3">
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{ask.from}</span> asks to swap {ask.when}
            {ask.note ? <span className="block text-xs text-muted">“{ask.note}”</span> : null}
          </span>
          <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => answer(ask, "decline")}>
            No
          </Button>
          <Button size="sm" isDisabled={pending} onPress={() => answer(ask, "accept")}>
            Yes, swap
          </Button>
        </div>
      ))}

      {choices.answered.slice(0, 3).map((a) => (
        <div key={a.id} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            Swap for {a.from} · {a.when}
          </span>
          <Chip
            size="sm"
            variant="soft"
            color={a.status === "approved" ? "success" : a.status === "declined" ? "danger" : "warning"}
          >
            {a.status === "approved" ? "Approved" : a.status === "declined" ? "Declined" : "With your manager"}
          </Chip>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        {choices.current ? (
          <span className="mr-auto text-sm">
            <span className="text-muted">Rotation:</span> <span className="font-semibold">{choices.current.name}</span>
          </span>
        ) : (
          <span className="mr-auto text-sm text-muted">Not on a rotation</span>
        )}
        <Button size="sm" variant="secondary" isDisabled={colleagues.length === 0} onPress={() => open("swap")}>
          Swap
        </Button>
        <Button size="sm" variant="secondary" isDisabled={choices.shifts.length === 0} onPress={() => open("change")}>
          Different shift
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={choices.rotations.length === 0}
          onPress={() => open("rotation")}
        >
          Rotation
        </Button>
      </div>

      <Modal.Backdrop isOpen={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <Modal.Container>
          <Modal.Dialog aria-labelledby="ask-shift-h" className="sm:max-w-[440px]">
            <Modal.Header>
              <Modal.Heading id="ask-shift-h" className="text-lg leading-6 font-semibold">
                {mode ? TITLE[mode] : ""}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <TextField value={day} onChange={setDay} fullWidth className="flex flex-col gap-1">
                <Label>{mode === "rotation" ? "Start on" : "Day"}</Label>
                <Input type="date" min={today} />
              </TextField>
              {mode === "swap" ? (
                <Pick
                  label="Colleague"
                  value={choice}
                  onChange={setChoice}
                  options={colleagues.map((c) => ({ id: c.id, name: c.name }))}
                />
              ) : null}
              {mode === "change" ? (
                <Pick
                  label="Shift"
                  value={choice}
                  onChange={setChoice}
                  options={choices.shifts.map((s) => ({ id: s.id, name: `${s.name} · ${s.hours}` }))}
                />
              ) : null}
              {mode === "rotation" ? (
                <Pick
                  label="Rotation"
                  value={choice}
                  onChange={setChoice}
                  options={choices.rotations.map((r) => ({ id: r.id, name: r.name }))}
                />
              ) : null}
              {mode !== "swap" ? (
                <TextField value={note} onChange={setNote} fullWidth className="flex flex-col gap-1">
                  <Label>Note (optional)</Label>
                  <TextArea rows={2} />
                </TextField>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="ghost">
                Cancel
              </Button>
              <Button isPending={pending} isDisabled={!day || !choice} onPress={send}>
                Send
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
