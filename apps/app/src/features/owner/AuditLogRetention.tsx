"use client";

import { ChevronDown, ShieldExclamation, ShieldKeyhole } from "@gravity-ui/icons";
import { Button, Card, ListBox } from "@heroui/react";
import { CellSelect, CellSwitch } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { AuditLogRetentionRule } from "@injishi/data/fixtures/owner";
import { GateChip, SectionHeader, TextLink } from "@injishi/ui";

/** Retention settings being edited and the baseline they started from (nothing is saved yet). */
export interface AuditLogRetentionState {
  values: Record<string, string>;
  hold: boolean;
  saved: { values: Record<string, string>; hold: boolean };
}

export function auditLogRetentionInitial(rules: AuditLogRetentionRule[]): AuditLogRetentionState {
  const values = Object.fromEntries(rules.map((r) => [r.id, r.value]));
  return { values, hold: false, saved: { values, hold: false } };
}

function auditLogRetentionDirty(rules: AuditLogRetentionRule[], s: AuditLogRetentionState): boolean {
  return s.hold !== s.saved.hold || rules.some((r) => s.values[r.id] !== s.saved.values[r.id]);
}

/**
 * "Retention policy" tab: how long each kind of record is kept, the legal hold, and what happens when
 * a period ends. Saving is not available yet (no route stores retention rules): edits stay unsaved on screen.
 */
export function AuditLogRetention({
  rules,
  state,
  onChange,
  onSave,
}: {
  rules: AuditLogRetentionRule[];
  state: AuditLogRetentionState;
  onChange: (next: AuditLogRetentionState) => void;
  onSave: () => void;
}) {
  const dirty = auditLogRetentionDirty(rules, state);
  const setValue = (id: string, value: string) => onChange({ ...state, values: { ...state.values, [id]: value } });

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section className="min-w-0 flex-[1_1_520px]" aria-labelledby="ret-h">
        <Card className="gap-2.5 p-[18px]">
          <Card.Header>
            <h2 id="ret-h" className="text-[15px] leading-[22px] font-semibold">
              How Long Records Are Kept
            </h2>
            <Card.Description>
              Your configuration. Injishi does not certify these periods; confirm them with your adviser.
            </Card.Description>
          </Card.Header>

          {rules.map((r) => (
            <div key={r.id} className="flex flex-col gap-[3px]">
              <CellSelect
                variant="secondary"
                aria-label={r.label}
                value={state.values[r.id] ?? r.value}
                onChange={(v) => {
                  if (typeof v === "string") setValue(r.id, v);
                }}
                className="w-full"
              >
                <CellSelect.Trigger>
                  <CellSelect.Label>{r.label}</CellSelect.Label>
                  <CellSelect.Value />
                  <CellSelect.Indicator>
                    <ChevronDown className="size-4" />
                  </CellSelect.Indicator>
                </CellSelect.Trigger>
                <CellSelect.Popover>
                  <ListBox aria-label={r.label}>
                    {r.options.map((o) => (
                      <ListBox.Item key={o} id={o} textValue={o}>
                        {o}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </CellSelect.Popover>
              </CellSelect>
              <span className="flex flex-wrap items-center gap-2 px-3">
                <span className="text-xs text-muted">{r.note}</span>
                {r.unverified ? (
                  <GateChip icon={<ShieldExclamation className="size-3" />}>Configured · unverified</GateChip>
                ) : null}
              </span>
            </div>
          ))}

          <CellSwitch
            variant="secondary"
            isSelected={state.hold}
            onChange={(on) => onChange({ ...state, hold: on })}
            className="w-full"
          >
            <CellSwitch.Trigger>
              <CellSwitch.Label>Legal hold: pause all deletion and anonymising</CellSwitch.Label>
              <CellSwitch.Control />
            </CellSwitch.Trigger>
          </CellSwitch>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty ? <span className="text-xs text-muted">Unsaved changes</span> : null}
            <Button isDisabled={!dirty} onPress={onSave}>
              <ShieldKeyhole className="size-4" />
              Save with step-up
            </Button>
          </div>
        </Card>
      </section>

      <section className="min-w-0 flex-[1_1_300px]" aria-labelledby="how-h">
        <Card variant="secondary" className="gap-2.5 p-[18px]">
          <SectionHeader id="how-h" title="What Happens When a Period Ends" />
          <ul className="flex flex-col gap-2 text-[13px] leading-[19px]">
            <li>Before a period ends, deletion is blocked, even for the owner.</li>
            <li>
              When it ends, names, contacts and ID numbers are anonymised. Totals, fiscal receipts and ledger entries
              stay.
            </li>
            <li>Anonymising is itself an audit entry, so the chain stays complete.</li>
            <li>
              A data subject request can only erase what no rule requires you to keep.{" "}
              <TextLink href={`${screenHref("Compliance")}?tab=privacy`} className="text-[13px]">
                Requests in Compliance
              </TextLink>
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
