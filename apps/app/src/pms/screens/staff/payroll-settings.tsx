"use client";

/**
 * Payroll · Settings (058-payroll AC-PY14): the day of the month the draft run
 * is made by itself, and the business's RSSB employer number.
 *
 * On the draft day, the daily job drafts the run of the month that day falls
 * in when the month has none, so the 25th of March drafts March. It is 1 to 28,
 * so no month skips it. The employer number is printed on every payslip and
 * declaration, and a run cannot be confirmed without it.
 */

import { Input } from "@injishi/ui";
import { useEffect, useState } from "react";

import { ActionButton, LoadFailed, SectionHeading, Skeleton } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useHrSettings, useUpdateHrSettings } from "../../data/people-file";
import { usePms } from "../../store";
import { Field, FormError, inputClass } from "./staff-ui";

export function PaySettings() {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const settings = useHrSettings(workspaceId);
  const save = useUpdateHrSettings(workspaceId);
  const [day, setDay] = useState("");
  const [employer, setEmployer] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    setDay(settings.data.payRunAutoDraftDay === null ? "" : String(settings.data.payRunAutoDraftDay));
    setEmployer(settings.data.rssbEmployerNumber ?? "");
  }, [settings.data]);

  if (settings.isPending) return <Skeleton height={200} />;
  if (settings.isError) {
    return (
      <LoadFailed onRetry={() => void settings.refetch()} retrying={settings.isFetching}>
        We couldn&apos;t read the payroll settings. Nothing has changed.
      </LoadFailed>
    );
  }

  return (
    <form
      className="pms-enter flex max-w-page flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        save.mutate(
          { payRunAutoDraftDay: day.trim() === "" ? null : Number(day), rssbEmployerNumber: employer.trim() || null },
          { onSuccess: () => toast("Payroll settings saved", "ok") },
        );
      }}
    >
      <SectionHeading>Payroll settings</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Draft the run by itself on day" hint="1 to 28. Empty to draft each month by hand." htmlFor="draft-day">
          <Input id="draft-day" type="number" min={1} max={28} step={1} value={day} onChange={(e) => setDay(e.target.value)} className={inputClass} />
        </Field>
        <Field label="RSSB employer number" hint="Printed on payslips and declarations. A run needs it to confirm." htmlFor="rssb-employer">
          <Input id="rssb-employer" maxLength={30} value={employer} onChange={(e) => setEmployer(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <FormError error={save.error} />
      <div className="flex justify-end">
        <ActionButton variant="primary" type="submit" pending={save.isPending}>
          Save
        </ActionButton>
      </div>
    </form>
  );
}
