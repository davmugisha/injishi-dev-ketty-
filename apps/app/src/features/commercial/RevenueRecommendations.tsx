"use client";

import { Lock, PaperPlane } from "@gravity-ui/icons";
import { Button, Card, Chip, Description, Input, Label, Table, TextArea, TextField } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import type { RevenueRecommendation, RevenueScenarioId } from "@injishi/data/fixtures/commercial";
import { GateChip, toneColor } from "@injishi/ui";
import { useState, useTransition } from "react";
import { sendRevenueChanges } from "./RevenueActions";
import { REVENUE_OVERRIDE_REASONS, revenueDelta, revenueRecommendationIn, revenueRwf } from "./RevenueModel";

/** Decisions taken on this screen and not persisted yet (accepted/overridden) or sent during this visit. */
type RevenueDecision = "accepted" | "overridden" | "sent" | "sent-override";

interface RevenueOverride {
  rate: number;
  reason: string;
  note: string;
}

/** Rate recommendations with evidence, decisions, the override form and "Send to owner for approval". */
export function RevenueRecommendations({
  recommendations,
  scenario,
}: {
  recommendations: RevenueRecommendation[];
  scenario: RevenueScenarioId;
}) {
  const [decisions, setDecisions] = useState<Partial<Record<string, RevenueDecision>>>({});
  const [overrides, setOverrides] = useState<Partial<Record<string, RevenueOverride>>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, startSending] = useTransition();

  const editingRec = recommendations.find((r) => r.id === editing && r.scenario === null);
  const editingRate = editingRec ? revenueRecommendationIn(editingRec, scenario).recommended : 0;
  const ready = recommendations.filter(
    (r) =>
      r.scenario === null &&
      r.status === "open" &&
      (decisions[r.id] === "accepted" || decisions[r.id] === "overridden"),
  );

  const decide = (id: string, decision: RevenueDecision | null) => {
    setDecisions((d) => {
      const next = { ...d };
      if (decision) next[id] = decision;
      else delete next[id];
      return next;
    });
  };

  const openOverride = (rec: RevenueRecommendation) => {
    setEditing(rec.id);
    setRate(String(revenueRecommendationIn(rec, scenario).recommended));
    setReason(null);
    setNote("");
  };

  const saveOverride = () => {
    if (!editingRec || !reason) return;
    const typed = Number(rate.replace(/[^0-9]/g, ""));
    setOverrides((o) => ({ ...o, [editingRec.id]: { rate: typed || editingRate, reason, note } }));
    decide(editingRec.id, "overridden");
    setEditing(null);
  };

  const sendAll = () => {
    const items = ready.map((r) => ({
      id: r.id,
      override: decisions[r.id] === "overridden" ? overrides[r.id] : undefined,
    }));
    setDecisions((d) => {
      const next = { ...d };
      for (const item of items) next[item.id] = item.override ? "sent-override" : "sent";
      return next;
    });
    startSending(async () => {
      await sendRevenueChanges(items);
    });
  };

  return (
    <section aria-labelledby="rec-h">
      <Card className="gap-[14px] p-[18px]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Card.Header>
            <Card.Title id="rec-h" className="text-[15px] font-semibold">
              Rate Recommendations
            </Card.Title>
            <Card.Description>
              Suggestions with their evidence. Accepting does not change any rate; the owner approves before publishing.
            </Card.Description>
          </Card.Header>
          <GateChip icon={<Lock className="size-3" />}>Publishing needs owner approval</GateChip>
        </div>

        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Rate recommendations">
              <Table.Header>
                <Table.Column isRowHeader>Dates</Table.Column>
                <Table.Column>Room type</Table.Column>
                <Table.Column className="text-right">Current</Table.Column>
                <Table.Column className="text-right">Recommended</Table.Column>
                <Table.Column>Reason and evidence</Table.Column>
                <Table.Column>Confidence</Table.Column>
                <Table.Column>Decision</Table.Column>
              </Table.Header>
              <Table.Body>
                {recommendations.map((r) => {
                  const shown = revenueRecommendationIn(r, scenario);
                  const local = decisions[r.id];
                  const override = overrides[r.id];
                  const state =
                    r.scenario !== null
                      ? "scenario"
                      : local === "sent" || local === "sent-override" || r.status === "pending"
                        ? "pending"
                        : (local ?? "open");
                  const pendingNote =
                    local === "sent-override" && override
                      ? `Override ${revenueRwf(override.rate)} · sent just now`
                      : local === "sent"
                        ? "Sent just now"
                        : (r.sentNote ?? "Sent just now");
                  return (
                    <Table.Row key={r.id} id={r.id} className={editing === r.id ? "bg-accent-soft" : undefined}>
                      <Table.Cell className="font-medium whitespace-nowrap tabular">{r.dates}</Table.Cell>
                      <Table.Cell>{r.room}</Table.Cell>
                      <Table.Cell className="text-right tabular">{revenueRwf(r.current)}</Table.Cell>
                      <Table.Cell className="text-right tabular">
                        <span className="flex flex-col items-end">
                          <span className="font-semibold">{revenueRwf(shown.recommended)}</span>
                          <span className="text-xs text-muted">{revenueDelta(r.current, shown.recommended)}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="min-w-[min(280px,100%)] text-[13px] leading-[18px] whitespace-normal">
                        {shown.reason}
                      </Table.Cell>
                      <Table.Cell>
                        <span className="flex flex-col items-start gap-0.5">
                          <Chip size="sm" variant="soft" color={toneColor(r.confidenceTone)}>
                            {r.confidence}
                          </Chip>
                          <span className="text-[11px] leading-[14px] text-muted">{r.confidenceNote}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="min-w-[min(210px,100%)]">
                        {state === "open" ? (
                          <span className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={`Accept ${r.room}, ${r.dates}`}
                              onPress={() => {
                                decide(r.id, "accepted");
                                setEditing(null);
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Override ${r.room}, ${r.dates}`}
                              onPress={() => openOverride(r)}
                            >
                              Override
                            </Button>
                          </span>
                        ) : null}
                        {state === "accepted" || state === "overridden" ? (
                          <span className="flex items-center gap-1.5">
                            <Chip size="sm" variant="soft" color="accent">
                              {state === "overridden" && override
                                ? `Override ${revenueRwf(override.rate)} · ${override.reason}`
                                : "Accepted · not sent"}
                            </Chip>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Undo decision on ${r.room}, ${r.dates}`}
                              onPress={() => decide(r.id, null)}
                            >
                              Undo
                            </Button>
                          </span>
                        ) : null}
                        {state === "pending" ? (
                          <span className="flex flex-col items-start gap-0.5">
                            <Chip size="sm" variant="soft" color="warning">
                              Waiting for owner
                            </Chip>
                            <span className="text-xs text-muted">{pendingNote}</span>
                          </span>
                        ) : null}
                        {state === "scenario" ? (
                          <span className="flex flex-col items-start gap-0.5">
                            <Chip size="sm" variant="soft">
                              Scenario only
                            </Chip>
                            <span className="text-xs text-muted">Cannot be sent until the summit is contracted</span>
                          </span>
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>

        {editingRec ? (
          <Card variant="secondary" className="gap-3 p-4" role="group" aria-labelledby="ov-h">
            <h3 id="ov-h" className="text-[15px] leading-[22px] font-semibold">
              Override · {editingRec.room}, {editingRec.dates}
            </h3>
            <div className="grid items-start gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
              <TextField value={rate} onChange={setRate} fullWidth className="flex flex-col gap-1">
                <Label>Your rate (RWF)</Label>
                <Input className="tabular" inputMode="numeric" />
                <Description>Recommended {revenueRwf(editingRate)}</Description>
              </TextField>
              <div className="flex flex-col gap-1.5">
                <span id="ov-reason" className="text-sm font-medium">
                  Reason (required)
                </span>
                <Segment
                  aria-labelledby="ov-reason"
                  selectedKey={reason ?? ""}
                  onSelectionChange={(k) => setReason(String(k))}
                  className="self-start"
                >
                  {REVENUE_OVERRIDE_REASONS.map((label) => (
                    <Segment.Item key={label} id={label}>
                      {label}
                    </Segment.Item>
                  ))}
                </Segment>
                <TextField value={note} onChange={setNote} fullWidth className="mt-1 flex flex-col gap-1">
                  <Label>Note for the owner</Label>
                  <TextArea rows={2} placeholder="What do you know that the model does not?" />
                </TextField>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onPress={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" isDisabled={!reason} onPress={saveOverride}>
                Save override
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-separator pt-1">
          <p className="flex-[1_1_360px] pt-[10px] text-xs leading-4 text-muted">
            Every recommendation, decision and reason is logged with the model version. Approved rates publish to Rates
            &amp; inventory and every connected channel; until then the current rates stay live.
          </p>
          <div className="flex items-center gap-[10px] pt-[10px]">
            <span className="text-[13px] text-muted" aria-live="polite">
              {ready.length
                ? `${ready.length} ${ready.length === 1 ? "change ready" : "changes ready"}`
                : "Nothing ready to send"}
            </span>
            <Button variant="primary" isDisabled={ready.length === 0} isPending={sending} onPress={sendAll}>
              <PaperPlane className="size-4" />
              Send to owner for approval
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
