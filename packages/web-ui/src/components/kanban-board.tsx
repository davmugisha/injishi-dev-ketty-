"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@injishi/utils";
import { GripVerticalIcon, MoveRightIcon } from "lucide-react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/** A column of the board: a stage's key and the words for it. */
export interface KanbanStage {
  readonly key: string;
  readonly label: string;
}

export interface KanbanBoardProps<Row> {
  /** The columns, in board order: the stage field's enum values, or `ListPage.stages` for a ref. */
  readonly stages: readonly KanbanStage[];
  readonly rows: readonly Row[];
  readonly getRowId: (row: Row) => string;
  readonly stageOf: (row: Row) => string;
  /** A name for the card, read out when it is picked up and dropped. */
  readonly labelOf: (row: Row) => string;
  readonly renderCard: (row: Row) => React.ReactNode;
  /**
   * The module's own move command. Resolve once the page has been read again,
   * so the card never flickers back to its old column between the answer and
   * the refetch. Reject with the server's message, and the card goes back
   * where it was with that message on screen (AC-LF8).
   */
  readonly onMove: (row: Row, stage: string) => Promise<void>;
  /** Whether this card may move at all (a decided request may not). */
  readonly canMove?: (row: Row) => boolean;
  /** The board loads at most this many cards; past it, it says so (AC-LF14). */
  readonly total?: number;
  readonly className?: string;
}

/** A small move before a press becomes a drag, so a card's own links still click. */
const ACTIVATION_DISTANCE_PX = 6;

/**
 * Arrow keys move a picked up card a whole column at a time, left or right,
 * rather than by pixels: with columns as the only drop targets, a pixel step
 * would take a dozen presses to cross one.
 */
const columnCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  const { collisionRect, droppableRects } = context;
  if (step === 0 || !collisionRect) return undefined;
  event.preventDefault();
  const centre = collisionRect.left + collisionRect.width / 2;
  const target = [...droppableRects.values()]
    .filter((rect) => (step > 0 ? rect.left > centre : rect.right < centre))
    .sort((a, b) => (step > 0 ? a.left - b.left : b.left - a.left))[0];
  if (!target) return currentCoordinates;
  return { x: target.left + (target.width - collisionRect.width) / 2, y: currentCoordinates.y };
};

/** The pointer decides where a card lands; a keyboard drag has no pointer, so the nearest column does. */
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

function Column({
  stage,
  count,
  children,
}: {
  stage: KanbanStage;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.label}, ${count}`}
      data-over={isOver ? "true" : undefined}
      className="flex w-72 shrink-0 flex-col gap-2 rounded-card border border-border bg-secondary p-2 transition-colors duration-quick data-[over=true]:border-ring"
    >
      <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
        {stage.label}
        <span className="font-normal tabular-nums text-muted-foreground">{count}</span>
      </h3>
      <ul className="flex min-h-16 flex-col gap-2">{children}</ul>
    </section>
  );
}

function Card<Row>({
  row,
  id,
  label,
  stages,
  current,
  movable,
  onMoveTo,
  children,
}: {
  row: Row;
  id: string;
  label: string;
  stages: readonly KanbanStage[];
  current: string;
  movable: boolean;
  onMoveTo: (row: Row, stage: string) => void;
  children: React.ReactNode;
}) {
  // The grip starts a drag and the card does not: a card whose whole body were
  // a drag button could hold no link and no menu of its own (nested controls).
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !movable,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "flex items-start gap-1 rounded-card border border-border bg-card p-2 text-card-foreground",
        isDragging && "opacity-40",
      )}
    >
      {movable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${label}`}
          className="cursor-grab rounded p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVerticalIcon aria-hidden className="size-4" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1 p-1">{children}</div>
      {movable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${label} to another column`}>
              <MoveRightIcon aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {stages
              .filter((s) => s.key !== current)
              .map((s) => (
                <DropdownMenuItem key={s.key} onSelect={() => onMoveTo(row, s.key)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

/**
 * The board view of `DataView` (058-list-framework AC-LF8, AC-LF14).
 *
 * One column per stage. A card moves by its grip (pointer drag, or keyboard:
 * focus the grip, Space to pick up, arrows to cross columns, Space to drop,
 * Escape to cancel) or by its Move to menu, the path for anyone who does not
 * drag. A move calls
 * the module's own command; the card shows in its new column at once, and if
 * the command refuses it goes back with the server's words above the board.
 *
 * Columns are the only drop targets, and order inside a column is the server's
 * sort, so nothing here reorders cards. The drag preview renders in a portal:
 * the board scrolls sideways, and a card dragged inside a scroller is clipped.
 */
function KanbanBoard<Row>({
  stages,
  rows,
  getRowId,
  stageOf,
  labelOf,
  renderCard,
  onMove,
  canMove = () => true,
  total,
  className,
}: KanbanBoardProps<Row>) {
  // Moves still waiting on the server, shown in their new column meanwhile.
  const [moved, setMoved] = React.useState<ReadonlyMap<string, string>>(new Map());
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ACTIVATION_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );

  const byId = React.useMemo(() => new Map(rows.map((row) => [getRowId(row), row])), [rows, getRowId]);
  const stageNow = (row: Row) => moved.get(getRowId(row)) ?? stageOf(row);
  const labelOfStage = (key: string) => stages.find((s) => s.key === key)?.label ?? key;

  const move = async (row: Row, stage: string) => {
    const id = getRowId(row);
    if (stageNow(row) === stage) return;
    setRefusal(null);
    setMoved((m) => new Map(m).set(id, stage));
    try {
      await onMove(row, stage);
    } catch (failure) {
      setRefusal(
        `${labelOf(row)} stays in ${labelOfStage(stageOf(row))}: ${
          failure instanceof Error ? failure.message : "the move was refused."
        }`,
      );
    } finally {
      // The refetched page is the truth from here on, refused or not.
      setMoved((m) => {
        const next = new Map(m);
        next.delete(id);
        return next;
      });
    }
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const row = byId.get(String(active.id));
      return row ? `Picked up ${labelOf(row)} in ${labelOfStage(stageNow(row))}.` : "";
    },
    onDragOver: ({ active, over }) => {
      const row = byId.get(String(active.id));
      if (!row) return "";
      return over ? `${labelOf(row)} is over ${labelOfStage(String(over.id))}.` : `${labelOf(row)} is over no column.`;
    },
    onDragEnd: ({ active, over }) => {
      const row = byId.get(String(active.id));
      if (!row) return "";
      return over ? `${labelOf(row)} dropped in ${labelOfStage(String(over.id))}.` : `${labelOf(row)} was not moved.`;
    },
    onDragCancel: ({ active }) => {
      const row = byId.get(String(active.id));
      return row ? `Cancelled. ${labelOf(row)} stays in ${labelOfStage(stageNow(row))}.` : "";
    },
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const row = byId.get(String(active.id));
    if (row && over) void move(row, String(over.id));
  };
  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {refusal ? (
        <p role="alert" className="rounded-card border border-destructive p-3 text-sm text-foreground">
          {refusal}
        </p>
      ) : null}
      {total !== undefined && total > rows.length ? (
        <p className="text-sm text-muted-foreground">
          The board shows {rows.length} of {total} cards. Narrow the filter, or use the list view to see them all.
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        accessibility={{ announcements }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {stages.map((stage) => {
            const cards = rows.filter((row) => stageNow(row) === stage.key);
            return (
              <Column key={stage.key} stage={stage} count={cards.length}>
                {cards.map((row) => {
                  const id = getRowId(row);
                  return (
                    <Card
                      key={id}
                      row={row}
                      id={id}
                      label={labelOf(row)}
                      stages={stages}
                      current={stage.key}
                      movable={canMove(row)}
                      onMoveTo={(r, s) => void move(r, s)}
                    >
                      {renderCard(row)}
                    </Card>
                  );
                })}
              </Column>
            );
          })}
        </div>
        {mounted
          ? createPortal(
              <DragOverlay>
                {active ? (
                  <div className="w-72 rounded-card border border-ring bg-card p-3 text-card-foreground shadow-lg">
                    {renderCard(active)}
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )
          : null}
      </DndContext>
    </div>
  );
}

export { KanbanBoard };
