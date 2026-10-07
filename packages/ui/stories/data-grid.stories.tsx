import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../src/components/badge";
import { DataGrid, type DataGridColumn } from "../src/components/data-grid";
import { EmptyState } from "../src/components/empty-state";
import { RwfAmount } from "../src/components/number-value";

/**
 * HeroUI Pro's DataGrid: one column definition per field, so every row shares
 * the same columns. The operator app's Reservations list is the reference use;
 * its hand built grid let Dates and Status drift row to row. Sample rows only;
 * the names are the demo's own personas.
 */
type Booking = {
  id: string;
  guest: string;
  dates: string;
  nights: number;
  room: string | null;
  status: "request" | "reserved" | "arrives" | "in-house";
  total: number;
};

const ROWS: Booking[] = [
  { id: "BK-DEMO-002", guest: "Grace Kwizera", dates: "04 Oct – 06 Oct", nights: 2, room: null, status: "request", total: 315000 },
  { id: "BK-DEMO-001", guest: "Rayan Iraguha", dates: "06 Oct – 09 Oct", nights: 3, room: null, status: "request", total: 472500 },
  { id: "BK-2K8T-7DD5", guest: "Sarah Mitchell", dates: "05 Oct – 08 Oct", nights: 3, room: "103", status: "arrives", total: 225000 },
  { id: "BK-D5MY-RWVN", guest: "Moses Kalisa", dates: "05 Oct – 07 Oct", nights: 2, room: "108", status: "arrives", total: 180000 },
  { id: "BK-1FW4-GC2R", guest: "Claude Rukundo", dates: "04 Oct – 06 Oct", nights: 2, room: "104", status: "in-house", total: 150000 },
];

const STATUS: Record<Booking["status"], { label: string; variant: "warning" | "subtle" | "success" | "accent" }> = {
  request: { label: "Request", variant: "warning" },
  reserved: { label: "Reserved", variant: "subtle" },
  arrives: { label: "Arrives today", variant: "success" },
  "in-house": { label: "In house", variant: "accent" },
};

const COLUMNS: DataGridColumn<Booking>[] = [
  {
    id: "guest",
    header: "Guest",
    isRowHeader: true,
    allowsSorting: true,
    accessorKey: "guest",
    cell: (b) => (
      <span className="flex flex-col">
        <span className="font-medium text-foreground">{b.guest}</span>
        <span className="text-xs text-muted-foreground">{b.id}</span>
      </span>
    ),
  },
  { id: "dates", header: "Dates", accessorKey: "dates" },
  { id: "room", header: "Room", cell: (b) => b.room ?? <Badge variant="outline">Not assigned</Badge> },
  {
    id: "status",
    header: "Status",
    cell: (b) => <Badge variant={STATUS[b.status].variant}>{STATUS[b.status].label}</Badge>,
  },
  {
    id: "total",
    header: "Total",
    align: "end",
    allowsSorting: true,
    accessorKey: "total",
    sortFn: (a, b) => a.total - b.total,
    cell: (b) => <RwfAmount value={b.total} />,
  },
];

const meta = {
  title: "Pro/DataGrid",
  component: DataGrid,
} satisfies Meta;

// A compound component whose children ARE the story, so these stories take no
// args and say so (the Card story uses the same idiom).
export default meta;
type Story = StoryObj;

/** Reservations: aligned columns, sortable guest and total, a room chip. */
export const Reservations: Story = {
  render: () => (
    <div className="max-w-page">
      <DataGrid aria-label="Reservations" columns={COLUMNS} data={ROWS} getRowId={(b) => b.id} />
    </div>
  ),
};

/** Selection for a bulk action, such as assigning rooms to several bookings. */
export const Selectable: Story = {
  render: () => (
    <div className="max-w-page">
      <DataGrid
        aria-label="Reservations to assign"
        columns={COLUMNS}
        data={ROWS}
        getRowId={(b) => b.id}
        selectionMode="multiple"
        showSelectionCheckboxes
      />
    </div>
  ),
};

/** No rows: the grid hands its body to an empty state. */
export const Empty: Story = {
  render: () => (
    <div className="max-w-page">
      <DataGrid
        aria-label="Reservations"
        columns={COLUMNS}
        data={[]}
        getRowId={(b) => b.id}
        renderEmptyState={() => (
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Title>No reservations match</EmptyState.Title>
              <EmptyState.Description>Clear the search or pick another status.</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        )}
      />
    </div>
  ),
};
