"use client";

import { Button, Card, Input, Label, TextField, Toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createFirstOutletAction } from "./actions";
import { usePosAction } from "./shared";

/**
 * The first step for a business that has just registered as a Bar & Restaurant: it has an owner, a head-office
 * branch and its departments, but no outlet, and the till, the menu and the floor all hang off an outlet. This
 * creates it (through the existing outlets API), then carries on to the venue setup checklist. Nothing else is
 * asked here on purpose: tables, stations, the menu and the team all come next, in their own time.
 */
export function PosFirstOutlet() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"restaurant" | "bar">("restaurant");
  const { run, pending } = usePosAction();
  const valid = name.trim().length > 0;

  const create = () =>
    run(
      () => createFirstOutletAction({ name, kind }),
      "Your venue is created. Let's set it up.",
      (v) => router.push(`/pos/setup?outlet=${v.outletId}`),
    );

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-background p-4">
      <Card className="w-full max-w-lg p-6">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !pending) create();
          }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              Welcome to Bar &amp; Restaurant
            </p>
            <h1 className="text-[22px] leading-7 font-semibold">Set up your venue</h1>
            <p className="text-[14px] text-muted">
              Your business is registered. Give your first restaurant or bar a name and you can start adding tables, a
              menu, a kitchen and your team. You can open every screen at any time, and add more outlets later.
            </p>
          </div>
          <TextField value={name} onChange={setName} fullWidth isRequired autoFocus>
            <Label>Name of your restaurant or bar</Label>
            <Input placeholder="Mama Rosa Bistro" maxLength={120} />
          </TextField>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-medium">What is it?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["restaurant", "Restaurant", "Food is served at tables"],
                  ["bar", "Bar", "Mostly drinks, at the counter or tables"],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 ${kind === value ? "border-accent bg-accent-soft" : "border-separator"}`}
                >
                  <span className="flex items-center gap-2 text-[14px] font-medium">
                    <input type="radio" name="kind" checked={kind === value} onChange={() => setKind(value)} />
                    {label}
                  </span>
                  <span className="pl-6 text-[12px] text-muted">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center justify-end gap-2">
            <Button type="submit" variant="primary" isDisabled={!valid || pending}>
              Create my venue
            </Button>
          </div>
        </form>
      </Card>
      <Toast.Provider placement="bottom" />
    </div>
  );
}
