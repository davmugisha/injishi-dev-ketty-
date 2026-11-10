"use client";

import { Check, ChevronRight, Hourglass } from "@gravity-ui/icons";
import { Alert, Button, Chip, Drawer, FieldError, Label, Table, TextArea, TextField, toast } from "@heroui/react";
import { KeyValueList } from "@injishi/ui";
import { useOptimistic, useState, useTransition } from "react";
import type { ExtraDaysAsk } from "../../model/people.ts";
import { useHrActions } from "../mount.tsx";
import { firstName, Hint, Pager, PanelCard, Person, pageOf } from "./parts";

const STATE = {
  pending: { label: "Waiting", color: "warning" },
  approved: { label: "Approved", color: "success" },
  declined: { label: "Declined", color: "danger" },
} as const;

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

type Decision = { id: string; state: "approved" | "declined" };

/**
 * Days people asked for on top of what a kind of leave gives. What waits comes first; approving adds the
 * days to the person's balance, and a decline says why. The person reads the answer on Me.
 */
export function LeaveExtraDays({ asks }: { asks: ExtraDaysAsk[] }) {
  const { decideExtraDays } = useHrActions();
  const [rows, decideOptimistic] = useOptimistic(asks, (state, d: Decision) =>
    state.map((a) => (a.id === d.id ? { ...a, state: d.state } : a)),
  );
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const [whyErr, setWhyErr] = useState(false);
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) return null;

  const ordered = [...rows].sort((a, b) => Number(b.state === "pending") - Number(a.state === "pending"));
  const waiting = rows.filter((a) => a.state === "pending").length;
  const cur = rows.find((a) => a.id === openId) ?? null;

  const open = (id: string) => {
    setOpenId(id);
    setDeclining(false);
    setWhy("");
    setWhyErr(false);
  };
  const decide = (a: ExtraDaysAsk, state: "approved" | "declined", reason?: string) => {
    setOpenId(null);
    startTransition(async () => {
      decideOptimistic({ id: a.id, state });
      const result = await decideExtraDays(a.id, state, reason);
      if (!result.ok) toast.danger(result.error);
      else toast.success(state === "approved" ? `${days(a.days)} added for ${firstName(a.name)}` : "Declined");
    });
  };
  const decline = () => {
    if (!cur) return;
    if (!declining) {
      setDeclining(true);
      return;
    }
    if (!why.trim()) {
      setWhyErr(true);
      return;
    }
    decide(cur, "declined", why.trim());
  };

  return (
    <div id="extra-days" className="scroll-mt-4">
      <PanelCard
        id="xd-h"
        title={
          <span className="flex items-center gap-2">
            Extra days
            {waiting ? (
              <Chip size="sm" variant="soft" color="warning">
                {waiting}
              </Chip>
            ) : null}
            <Hint label="About extra days">Days on top of what a kind of leave gives. Approving adds them.</Hint>
          </span>
        }
        className="gap-3"
      >
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Extra days asked for"
              className="min-w-[520px]"
              onRowAction={(k) => open(String(k))}
            >
              <Table.Header>
                <Table.Column isRowHeader>Employee</Table.Column>
                <Table.Column>Asked for</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column className="w-[44px]">
                  <span className="sr-only">Open</span>
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {pageOf(ordered, page).map((a) => (
                  <Table.Row key={a.id} id={a.id} className="cursor-pointer">
                    <Table.Cell className="py-2">
                      <Person name={a.name} sub={a.dept} />
                    </Table.Cell>
                    <Table.Cell className="py-2">
                      <span className="flex flex-col">
                        <span className="tabular">
                          {days(a.days)} of {a.leaveType}
                        </span>
                        <span className="text-xs text-muted">
                          {a.kind} · {a.asked}
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="py-2">
                      <Chip size="sm" variant="soft" color={STATE[a.state].color} className="whitespace-nowrap">
                        {STATE[a.state].label}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="py-2 text-muted">
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <Pager page={page} total={ordered.length} onPage={setPage} />
      </PanelCard>

      <Drawer.Backdrop isOpen={cur !== null} onOpenChange={(o) => (o ? undefined : setOpenId(null))}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="xd-drawer-h" className="w-full max-w-[480px]">
            <Drawer.CloseTrigger aria-label="Close" />
            {cur ? (
              <>
                <Drawer.Header className="flex flex-col items-start gap-1 pr-12">
                  <Drawer.Heading id="xd-drawer-h" className="text-[18px] leading-6 font-semibold">
                    {cur.name}
                  </Drawer.Heading>
                  <span className="text-sm text-muted">
                    {days(cur.days)} of {cur.leaveType}
                  </span>
                </Drawer.Header>
                <Drawer.Body className="flex flex-col gap-3.5 [&>*]:shrink-0">
                  <KeyValueList
                    items={[
                      { label: "Kind", value: cur.kind },
                      { label: "Team", value: cur.dept },
                      { label: "Asked on", value: cur.asked },
                      { label: "Why", value: cur.reason },
                    ]}
                  />
                  {cur.outcome ? (
                    <Alert status={cur.state === "approved" ? "success" : "default"}>
                      <Alert.Content>
                        <Alert.Title>{STATE[cur.state].label}</Alert.Title>
                        <Alert.Description>{cur.outcome}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                  {cur.state === "pending" && cur.blockedWhy ? (
                    <Alert>
                      <Alert.Indicator>
                        <Hourglass />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>{cur.blockedWhy}</Alert.Title>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                  {cur.state === "pending" && !cur.blockedWhy ? (
                    <div className="flex flex-col gap-2">
                      {declining ? (
                        <TextField
                          value={why}
                          onChange={(v) => {
                            setWhy(v);
                            setWhyErr(false);
                          }}
                          isInvalid={whyErr}
                          className="flex flex-col gap-1"
                        >
                          <Label>Reason for declining</Label>
                          <TextArea rows={2} placeholder={`${firstName(cur.name)} reads this`} />
                          <FieldError>Add a reason.</FieldError>
                        </TextField>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <Button className="flex-1" onPress={() => decide(cur, "approved")} isDisabled={pending}>
                          <Check className="size-4" />
                          Approve
                        </Button>
                        <Button variant="secondary" onPress={decline} isDisabled={pending}>
                          {declining ? "Confirm decline" : "Decline"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Drawer.Body>
              </>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </div>
  );
}
