"use client";

import { Description, Label, toast } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import type { CleaningTask, HousekeepingRoom, HousekeepingStaff, RoomStatus } from "@injishi/data/fixtures/operations";
import {
  type DataColumn,
  DataTable,
  EmptyBlock,
  FormDialog,
  Icon,
  IconAction,
  PageContent,
  RowActions,
  SelectField,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { addCleaningTaskAction, inspectCleaningTaskAction } from "@/features/pms/operations-actions";

const STATUS: Record<RoomStatus, { label: string; tone: StatusTone }> = {
  dirty: { label: "Needs cleaning", tone: "warning" },
  clean: { label: "Cleaned, to check", tone: "info" },
  inspected: { label: "Ready", tone: "success" },
  occupied: { label: "Guest in", tone: "default" },
  ooo: { label: "Out of order", tone: "danger" },
};

const TASK_WORD: Record<CleaningTask["column"], string> = {
  todo: "To do",
  doing: "Being cleaned",
  clean: "Done, to check",
  insp: "Checked",
};

type NewKind = Exclude<CleaningTask["kind"], "Re-clean">;
const KINDS: { id: NewKind; label: string; hint: string }[] = [
  { id: "Checkout", label: "After a stay", hint: "Full turn of the room" },
  { id: "Stayover", label: "Guest staying", hint: "Tidy and towels" },
  { id: "Deep clean", label: "Deep clean", hint: "Everything" },
  { id: "Turndown", label: "Turndown", hint: "Evening" },
];

interface Row {
  room: HousekeepingRoom;
  task: CleaningTask | null;
}

/**
 * Cleaning at a stay business (2026-10-30): every room with where it stands and its cleaning, in one table
 * with a status filter and a search. Add a cleaning to a room; check a cleaned room to make it ready.
 */
export function StayCleaningView({
  rooms,
  tasks,
  staff,
}: {
  rooms: HousekeepingRoom[];
  tasks: CleaningTask[];
  staff: HousekeepingStaff[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<HousekeepingRoom | null>(null);
  const [kind, setKind] = useState<NewKind | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [kindError, setKindError] = useState<string | null>(null);

  const rows: Row[] = rooms.map((room) => ({
    room,
    task: tasks.find((t) => t.room === room.id && t.column !== "insp") ?? null,
  }));

  const inspect = (task: CleaningTask, result: "pass" | "fail") =>
    start(async () => {
      const r = await inspectCleaningTaskAction(task.id, result, result === "fail" ? "Not clean enough" : undefined);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(result === "pass" ? `Room ${task.room} is ready` : `Room ${task.room} sent back`);
      router.refresh();
    });

  const columns: DataColumn<Row>[] = [
    {
      id: "room",
      header: "Room",
      isRowHeader: true,
      sortValue: (r) => r.room.id,
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.room.id}</span>
          <span className="text-xs text-muted">{r.room.type}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (r) => r.room.status,
      cell: (r) => <StatusChip tone={STATUS[r.room.status].tone}>{STATUS[r.room.status].label}</StatusChip>,
    },
    {
      id: "cleaning",
      header: "Cleaning",
      sortValue: (r) => r.task?.column ?? "",
      cell: (r) =>
        r.task ? (
          <span className="flex flex-col">
            <span>{TASK_WORD[r.task.column]}</span>
            <span className="text-xs text-muted">
              {[r.task.kind, staff.find((s) => s.id === r.task?.assignee)?.name].filter(Boolean).join(" · ")}
            </span>
          </span>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
    {
      id: "note",
      header: "Note",
      hideBelow: "lg",
      cell: (r) => (r.room.hold ?? r.room.note) || <span className="text-muted">-</span>,
    },
  ];

  const count = (s: RoomStatus) => rooms.filter((r) => r.status === s).length;
  const housekeepers = staff.filter((s) => s.role === "housekeeper");

  return (
    <PageContent>
      <AreaHeader />
      <DataTable
        label="Rooms to clean"
        noun={{ one: "room", many: "rooms" }}
        rows={rows}
        rowKey={(r) => r.room.id}
        columns={columns}
        defaultSort={{ column: "room", direction: "ascending" }}
        search={{ placeholder: "Room or type", text: (r) => `${r.room.id} ${r.room.type}` }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All", count: rooms.length },
              ...(Object.keys(STATUS) as RoomStatus[])
                .filter((s) => count(s) > 0)
                .map((s) => ({ id: s, label: STATUS[s].label, count: count(s) })),
            ],
            match: (r, v) => r.room.status === v,
          },
        ]}
        rowActions={(r) => (
          <RowActions>
            {r.task?.column === "clean" ? (
              <>
                <IconAction
                  icon="CircleCheck"
                  label={`Room ${r.room.id} is ready`}
                  isDisabled={pending}
                  onPress={() => r.task && inspect(r.task, "pass")}
                />
                <IconAction
                  icon="ArrowRotateLeft"
                  label="Send back to clean again"
                  isDisabled={pending}
                  onPress={() => r.task && inspect(r.task, "fail")}
                />
              </>
            ) : null}
            {!r.task && r.room.status !== "ooo" ? (
              <IconAction
                icon="Plus"
                label={`Add a cleaning to room ${r.room.id}`}
                onPress={() => {
                  setKind(null);
                  setAssignee(null);
                  setKindError(null);
                  setAdding(r.room);
                }}
              />
            ) : null}
          </RowActions>
        )}
        mobile={{
          title: (r) => `Room ${r.room.id}`,
          description: (r) => [r.room.type, r.task ? TASK_WORD[r.task.column] : null].filter(Boolean).join(" · "),
          trailing: (r) => <StatusChip tone={STATUS[r.room.status].tone}>{STATUS[r.room.status].label}</StatusChip>,
        }}
        empty={<EmptyBlock icon="BroomMotion" title="No rooms yet" />}
      />

      <FormDialog
        isOpen={adding !== null}
        onOpenChange={(o) => (o ? undefined : setAdding(null))}
        title={`Clean room ${adding?.id ?? ""}`}
        submitLabel="Add cleaning"
        isPending={pending}
        onSubmit={(e) => {
          e.preventDefault();
          if (!adding) return;
          if (!kind) {
            setKindError("Choose what to do.");
            return;
          }
          const room = adding.id;
          start(async () => {
            const r = await addCleaningTaskAction({ room, kind, assignee, due: "" }, crypto.randomUUID());
            if (!r.ok) {
              toast.danger(r.error);
              return;
            }
            toast.success(`Cleaning added to room ${room}`);
            setAdding(null);
            router.refresh();
          });
        }}
      >
        <div className="flex flex-col gap-2">
          <RadioButtonGroup
            aria-label="What to do"
            layout="grid"
            value={kind ?? ""}
            onChange={(v) => {
              setKind(v as NewKind);
              setKindError(null);
            }}
            className="grid-cols-2 gap-2"
          >
            {KINDS.map((k) => (
              <RadioButtonGroup.Item key={k.id} value={k.id} className="gap-1 px-3.5 py-3">
                <RadioButtonGroup.Indicator>
                  <Icon name="CircleCheckFill" />
                </RadioButtonGroup.Indicator>
                <RadioButtonGroup.ItemContent>
                  <Label className="font-semibold">{k.label}</Label>
                  <Description className="text-xs">{k.hint}</Description>
                </RadioButtonGroup.ItemContent>
              </RadioButtonGroup.Item>
            ))}
          </RadioButtonGroup>
          {kindError ? <p className="text-xs text-danger">{kindError}</p> : null}
        </div>
        {housekeepers.length > 0 ? (
          <SelectField
            label="Who cleans"
            placeholder="Anyone"
            options={housekeepers.map((s) => ({ id: s.id, label: s.name }))}
            value={assignee}
            onChange={setAssignee}
          />
        ) : null}
      </FormDialog>
    </PageContent>
  );
}
