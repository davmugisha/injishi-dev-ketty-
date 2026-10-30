"use client";

import { Description, FieldError, Input, Label, TextArea, TextField, toast } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import type { Severity, WorkOrder } from "@injishi/data/fixtures/operations";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  FormDialog,
  Icon,
  IconAction,
  PageContent,
  RowActions,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { addWorkOrderNoteAction, createWorkOrderAction } from "@/features/pms/operations-actions";

const SEVERITY: Record<Severity, { tone: StatusTone; rank: number }> = {
  Critical: { tone: "danger", rank: 0 },
  High: { tone: "warning", rank: 1 },
  Normal: { tone: "info", rank: 2 },
  Low: { tone: "default", rank: 3 },
};

const SEVERITIES: { id: Severity; hint: string }[] = [
  { id: "Critical", hint: "Unsafe or no water, power" },
  { id: "High", hint: "Today" },
  { id: "Normal", hint: "This week" },
  { id: "Low", hint: "When there is time" },
];

type Dialog = { kind: "new" } | { kind: "note"; order: WorkOrder } | null;

/**
 * Maintenance at a stay business (2026-10-30): every work order in one table with a priority and a status
 * filter and a search. Report a repair, or add a note to one.
 */
export function StayMaintenanceView({ orders }: { orders: WorkOrder[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [where, setWhere] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setWhere("");
    setTitle("");
    setDetails("");
    setSeverity(null);
    setErrors({});
  };

  const save = () => {
    if (!dialog) return;
    if (dialog.kind === "note") {
      if (!details.trim()) return setErrors({ details: "Write the note." });
      const ref = dialog.order.id;
      return start(async () => {
        const r = await addWorkOrderNoteAction(ref, details);
        if (!r.ok) return void toast.danger(r.error);
        toast.success("Note added");
        setDialog(null);
        router.refresh();
      });
    }
    const problems: Record<string, string> = {};
    if (!where.trim()) problems.where = "Say where.";
    if (!title.trim()) problems.title = "Say what is wrong.";
    if (!severity) problems.severity = "Choose how urgent.";
    setErrors(problems);
    if (Object.keys(problems).length > 0 || !severity) return;
    start(async () => {
      const r = await createWorkOrderAction({
        asset: where,
        title,
        details,
        severity,
        owner: null,
        requestBlock: false,
      });
      if (!r.ok) return void toast.danger(r.error);
      toast.success("Repair reported");
      setDialog(null);
      router.refresh();
    });
  };

  const columns: DataColumn<WorkOrder>[] = [
    {
      id: "what",
      header: "Repair",
      isRowHeader: true,
      sortValue: (o) => o.title,
      cell: (o) => (
        <span className="flex flex-col">
          <span className="font-medium">{o.title}</span>
          <span className="text-xs text-muted">{[o.id, o.asset].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      sortValue: (o) => SEVERITY[o.severity].rank,
      cell: (o) => <StatusChip tone={SEVERITY[o.severity].tone}>{o.severity}</StatusChip>,
    },
    {
      id: "owner",
      header: "Who fixes",
      sortValue: (o) => o.owner ?? "",
      cell: (o) => o.owner ?? <span className="text-muted">Nobody yet</span>,
    },
    { id: "status", header: "Status", sortValue: (o) => o.status, cell: (o) => o.status },
    { id: "reported", header: "Reported", hideBelow: "lg", cell: (o) => o.reported },
  ];
  const statuses = [...new Set(orders.map((o) => o.status))];
  const newButton = (
    <ActionButton
      icon="Plus"
      intent="primary"
      onPress={() => {
        reset();
        setDialog({ kind: "new" });
      }}
    >
      Report a repair
    </ActionButton>
  );

  return (
    <PageContent>
      <AreaHeader actions={newButton} />
      <DataTable
        label="Repairs"
        noun={{ one: "repair", many: "repairs" }}
        rows={orders}
        rowKey={(o) => o.id}
        columns={columns}
        defaultSort={{ column: "priority", direction: "ascending" }}
        search={{ placeholder: "Repair, room or reference", text: (o) => `${o.title} ${o.asset} ${o.id}` }}
        filters={[
          {
            id: "priority",
            name: "Priority",
            options: [{ id: "all", label: "All" }, ...SEVERITIES.map((s) => ({ id: s.id, label: s.id }))],
            match: (o, v) => o.severity === v,
          },
          ...(statuses.length > 1
            ? [
                {
                  id: "status",
                  name: "Status",
                  options: [{ id: "all", label: "All" }, ...statuses.map((s) => ({ id: s, label: s }))],
                  match: (o: WorkOrder, v: string) => o.status === v,
                },
              ]
            : []),
        ]}
        rowActions={(o) => (
          <RowActions>
            <IconAction
              icon="PencilToSquare"
              label="Add a note"
              onPress={() => {
                reset();
                setDialog({ kind: "note", order: o });
              }}
            />
          </RowActions>
        )}
        mobile={{
          title: (o) => o.title,
          description: (o) => [o.asset, o.owner, o.status].filter(Boolean).join(" · "),
          trailing: (o) => <StatusChip tone={SEVERITY[o.severity].tone}>{o.severity}</StatusChip>,
        }}
        empty={<EmptyBlock icon="Wrench" title="No repairs" action={newButton} />}
      />

      <FormDialog
        isOpen={dialog !== null}
        onOpenChange={(o) => (o ? undefined : setDialog(null))}
        title={dialog?.kind === "note" ? `Note on ${dialog.order.title}` : "Report a repair"}
        submitLabel={dialog?.kind === "note" ? "Add note" : "Report"}
        isPending={pending}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {dialog?.kind === "new" ? (
          <>
            <TextField value={where} onChange={setWhere} isInvalid={Boolean(errors.where)} className="gap-1">
              <Label>Where</Label>
              <Input placeholder="Room 3, kitchen" />
              <FieldError>{errors.where}</FieldError>
            </TextField>
            <TextField value={title} onChange={setTitle} isInvalid={Boolean(errors.title)} className="gap-1">
              <Label>What is wrong</Label>
              <Input />
              <FieldError>{errors.title}</FieldError>
            </TextField>
            <div className="flex flex-col gap-2">
              <Label>How urgent</Label>
              <RadioButtonGroup
                aria-label="How urgent"
                layout="grid"
                value={severity ?? ""}
                onChange={(v) => setSeverity(v as Severity)}
                className="grid-cols-2 gap-2"
              >
                {SEVERITIES.map((s) => (
                  <RadioButtonGroup.Item key={s.id} value={s.id} className="gap-1 px-3.5 py-3">
                    <RadioButtonGroup.Indicator>
                      <Icon name="CircleCheckFill" />
                    </RadioButtonGroup.Indicator>
                    <RadioButtonGroup.ItemContent>
                      <Label className="font-semibold">{s.id}</Label>
                      <Description className="text-xs">{s.hint}</Description>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>
              {errors.severity ? <p className="text-xs text-danger">{errors.severity}</p> : null}
            </div>
          </>
        ) : null}
        <TextField value={details} onChange={setDetails} isInvalid={Boolean(errors.details)} className="gap-1">
          <Label>{dialog?.kind === "note" ? "Note" : "Details (optional)"}</Label>
          <TextArea rows={3} />
          <FieldError>{errors.details}</FieldError>
        </TextField>
      </FormDialog>
    </PageContent>
  );
}
