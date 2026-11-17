"use client";

import { Button, Card } from "@heroui/react";
import { useEffect, useState } from "react";
import type { PosVenue, PosVenueTemplatePlan, TemplateMark } from "@/server/pos";
import { applyTemplateAction, templatesAction } from "./actions";
import { PosDialog, StatusChip, usePosAction } from "./shared";

const MARK: Record<TemplateMark, string> = { new: "Will be added", exists: "Already here", archived: "Archived here" };

/**
 * Starter templates: a whole floor, its stations and registers in one step. The API measures each template against
 * this outlet, so the preview says exactly what will be added and what is skipped because the name is already used
 * (applying only ever adds; nothing existing is changed, and the menu, orders and team are not touched).
 */
export function TemplatesCard({
  outletId,
  venue,
  onVenue,
}: {
  outletId: string;
  venue: PosVenue;
  onVenue: (v: PosVenue) => void;
}) {
  const [plans, setPlans] = useState<PosVenueTemplatePlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<PosVenueTemplatePlan | null>(null);
  const { run, pending } = usePosAction();

  // Measured again whenever the floor changes, so a preview never offers what was just created.
  // biome-ignore lint/correctness/useExhaustiveDependencies: venue is the trigger, not an input
  useEffect(() => {
    let live = true;
    templatesAction(outletId).then((r) => {
      if (!live) return;
      if (r.ok) {
        setPlans(r.value);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [outletId, venue]);

  const empty = venue.areas.length === 0 && venue.stations.length === 0 && venue.registers.length === 0;

  return (
    <Card className="gap-3 rounded-[18px] p-5" aria-label="Starter templates" data-ui="templates">
      <div>
        <h2 className="text-[16px] leading-6 font-semibold">Start from a template</h2>
        <p className="text-[13px] text-muted">
          {empty
            ? "Set up a whole floor, its stations and tills in one step, then rename or adjust anything."
            : "Adds only what is missing: names already used here are skipped and nothing existing is changed."}
        </p>
      </div>
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      {!plans && !error ? <p className="text-[13px] text-muted">Loading templates…</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {plans?.map((p) => (
          <div key={p.key} className="flex flex-col gap-2 rounded-xl border border-separator p-3" data-ui="template">
            <p className="text-[14px] font-semibold">{p.label}</p>
            <p className="flex-1 text-[12px] text-muted">{p.description}</p>
            <p className="text-[12px]">
              {p.creates ? (
                <span className="font-medium text-foreground">{p.creates} to add</span>
              ) : (
                <span className="text-muted">Everything is already here</span>
              )}
              {p.skips ? <span className="text-muted"> · {p.skips} already here</span> : null}
            </p>
            <Button size="sm" variant="secondary" onPress={() => setOpen(p)} aria-label={`Preview ${p.label}`}>
              Preview
            </Button>
          </div>
        ))}
      </div>

      <PosDialog
        isOpen={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `Template: ${open.label}` : "Template"}
        subtitle={open ? `${open.creates} to add, ${open.skips} already here (skipped).` : undefined}
        wide
        footer={
          <>
            <Button variant="ghost" onPress={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-ui="apply-template"
              isDisabled={!open?.creates || pending}
              onPress={() =>
                open &&
                run(
                  () => applyTemplateAction(outletId, open.key),
                  (r) =>
                    r.created
                      ? `${open.label}: ${r.created} added${r.skipped ? `, ${r.skipped} already here` : ""}.`
                      : "Nothing to add: everything is already here.",
                  (r) => {
                    onVenue(r.venue);
                    setOpen(null);
                  },
                )
              }
            >
              Add {open?.creates ?? 0}
            </Button>
          </>
        }
      >
        {open ? (
          <div className="flex flex-col gap-3 text-[13px]" data-ui="template-preview">
            {open.areas.map((a) => (
              <div key={a.name} className="rounded-xl border border-separator p-3">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {a.name} <Mark m={a.mark} />
                  <span className="text-[12px] font-normal text-muted">
                    {a.tables.length} tables of {a.tables[0]?.seats ?? 0}
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {a.tables.map((t, i) => (
                    <span key={t.label} className={t.mark === "new" ? "text-foreground" : "line-through"}>
                      {i ? ", " : ""}
                      {t.label}
                    </span>
                  ))}
                </p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {open.stations.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 rounded-full border border-separator px-3 py-1">
                  {s.name} ({s.kind === "bar" ? "bar" : "kitchen"}) <Mark m={s.mark} />
                </span>
              ))}
              {open.registers.map((r) => (
                <span key={r.name} className="flex items-center gap-1.5 rounded-full border border-separator px-3 py-1">
                  Register {r.name} <Mark m={r.mark} />
                </span>
              ))}
            </div>
            <p className="text-[12px] text-muted">
              Crossed-out labels are already used at this outlet and are skipped. Your menu, orders and team are not
              touched.
            </p>
          </div>
        ) : null}
      </PosDialog>
    </Card>
  );
}

function Mark({ m }: { m: TemplateMark }) {
  return <StatusChip color={m === "new" ? "success" : m === "archived" ? "warning" : "default"}>{MARK[m]}</StatusChip>;
}
