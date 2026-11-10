"use client";

import { Check, Clock, Xmark } from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip, Label, TextArea, TextField, toast } from "@heroui/react";
import type { AccessRequestView } from "@injishi/data/fixtures/people";
import { useState, useTransition } from "react";
import { decideAccess } from "./TeamRolesActions";

/**
 * Logins HR asked for while putting people on file, waiting for the owner (HR onboarding). HR gives
 * front-line logins itself; these reach money, staff files, payroll or prices, so the owner decides.
 * Approving sends the invitation at once; declining needs a reason, which HR reads on the file.
 */
export function TeamRolesAccessRequests({ requests }: { requests: AccessRequestView[] }) {
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const waiting = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending").slice(0, 4);
  if (requests.length === 0) return null;

  const decide = (r: AccessRequestView, decision: "approve" | "decline") => {
    setBusy(r.id);
    startTransition(async () => {
      const result = await decideAccess(r.id, decision, decision === "decline" ? reason : "");
      setBusy(null);
      if (!result.ok) {
        toast.danger(result.message);
        return;
      }
      setDeclining(null);
      setReason("");
      toast.success(
        decision === "approve"
          ? `Approved. ${r.name}'s invitation is on its way to ${r.email}.`
          : "Declined. HR sees your reason on the file.",
      );
    });
  };

  return (
    <section aria-labelledby="ar-h" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ar-h" className="text-[15px] leading-[22px] font-semibold">
          Login requests from HR
        </h2>
        {waiting.length > 0 ? (
          <Chip size="sm" variant="soft" color="warning" className="tabular">
            {waiting.length} waiting
          </Chip>
        ) : null}
      </div>

      {waiting.length > 0 ? (
        <Card className="gap-0 divide-y divide-separator p-0">
          {waiting.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 px-[18px] py-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar size="sm" variant="soft" color="accent">
                  <Avatar.Fallback>{r.initials}</Avatar.Fallback>
                </Avatar>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs text-muted">{r.job}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
                    <Chip size="sm" variant="soft" color="accent">
                      {r.role}
                    </Chip>
                    <span className="text-muted">{r.branches}</span>
                    <span className="text-muted">·</span>
                    <span className="text-muted">{r.email}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {r.asked}
                  </span>
                  {r.note ? (
                    <blockquote className="mt-1 border-l-2 border-separator pl-2.5 text-[13px] leading-[18px] text-muted">
                      {r.note}
                    </blockquote>
                  ) : null}
                </div>
                {declining === r.id ? null : (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      isDisabled={busy !== null}
                      onPress={() => {
                        setDeclining(r.id);
                        setReason("");
                      }}
                    >
                      <Xmark className="size-4" aria-hidden="true" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      isPending={busy === r.id}
                      isDisabled={busy !== null && busy !== r.id}
                      onPress={() => decide(r, "approve")}
                    >
                      <Check className="size-4" aria-hidden="true" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
              {declining === r.id ? (
                <div className="flex flex-col gap-2 rounded-xl bg-default p-3">
                  <TextField value={reason} onChange={setReason} className="flex flex-col gap-1">
                    <Label>Why are you declining?</Label>
                    <TextArea rows={2} placeholder="Grace keeps supplier payments until December; ask again then." />
                  </TextField>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onPress={() => setDeclining(null)}>
                      Keep it
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      isPending={busy === r.id}
                      isDisabled={reason.trim().length < 3}
                      onPress={() => decide(r, "decline")}
                    >
                      Decline request
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-[13px] text-muted">Nothing is waiting for you.</p>
      )}

      {decided.length > 0 ? (
        <ul className="flex flex-col gap-1.5 pt-1" aria-label="Recently decided">
          {decided.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-medium text-foreground">{r.name}</span>
              <span>{r.role}</span>
              <span>·</span>
              <span>{r.outcome}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
