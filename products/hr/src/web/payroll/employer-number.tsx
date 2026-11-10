"use client";

import { ShieldCheck } from "@gravity-ui/icons";
import { Alert, Button, Card, Input, Label, Skeleton, TextField, toast } from "@heroui/react";
import { useEffect, useState, useTransition } from "react";
import type { PayrollSettingsView } from "../../model/payroll.ts";
import { useHrActions } from "../mount.tsx";

/** The business's RSSB employer number, typed and saved (`PATCH /ops/hr/settings`, `payroll.run`). */
export function EmployerNumberForm({ initial = "", onSaved }: { initial?: string; onSaved?: (value: string) => void }) {
  const { saveRssbEmployerNumber } = useHrActions();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const typed = value.trim();
  const save = () =>
    start(async () => {
      const r = await saveRssbEmployerNumber(typed);
      if (r.ok) {
        toast.success("RSSB employer number saved.");
        onSaved?.(typed);
      } else toast.danger(r.error);
    });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <TextField value={value} onChange={setValue} className="flex min-w-[180px] flex-1 flex-col gap-1">
        <Label className="text-xs">RSSB employer number</Label>
        <Input className="tabular" placeholder="From your RSSB registration" />
      </TextField>
      <Button size="sm" isPending={pending} isDisabled={typed.length < 3 || typed === initial} onPress={save}>
        Save
      </Button>
    </div>
  );
}

/** Payroll rules: the number payslips and declarations print, without which no month can be confirmed. */
export function EmployerNumberCard() {
  const { loadPayrollSettings } = useHrActions();
  const [settings, setSettings] = useState<PayrollSettingsView | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadPayrollSettings()
      .then((r) => {
        if (!live) return;
        if (r.ok) setSettings(r.settings);
        else setFailure(r.error);
      })
      .catch(() => {
        if (live) setFailure("Try again in a moment.");
      });
    return () => {
      live = false;
    };
  }, [loadPayrollSettings]);

  if (failure) {
    return (
      <Alert status="danger">
        <Alert.Content>
          <Alert.Title>Could not load the RSSB employer number</Alert.Title>
          <Alert.Description>{failure}</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  if (!settings) return <Skeleton className="h-24 w-full rounded-2xl" />;

  const number = settings.rssbEmployerNumber;
  return (
    <Card aria-labelledby="employer-h" className="gap-3 p-[18px]">
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground [&>svg]:size-5"
          aria-hidden="true"
        >
          <ShieldCheck />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="employer-h" className="text-[15px] leading-[22px] font-semibold">
            RSSB employer number
          </h2>
          <span className="text-xs leading-4 text-muted">
            On payslips and declarations. A month cannot be confirmed without it.
          </span>
        </div>
      </div>
      {settings.canEdit ? (
        <EmployerNumberForm
          key={number ?? "none"}
          initial={number ?? ""}
          onSaved={(value) => setSettings({ ...settings, rssbEmployerNumber: value })}
        />
      ) : (
        <p className="text-sm font-medium tabular">{number ?? "Not added yet. Only the owner can add it."}</p>
      )}
    </Card>
  );
}
