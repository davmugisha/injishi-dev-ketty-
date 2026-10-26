"use client";

import { Check, ChevronDown, ChevronRight, CircleCheck, Minus, Pencil, ShieldKeyhole } from "@gravity-ui/icons";
import { Alert, Button, Chip, Table, ToggleButton } from "@heroui/react";
import type { TeamRolesPermissionArea, TeamRolesRole, TeamRolesRoleId } from "@injishi/data/fixtures/owner";
import type { ReactNode } from "react";

type Cell = { kind: "count"; n: number; of: number } | { kind: "mark"; on: boolean } | { kind: "toggle"; on: boolean };

interface MatrixRow {
  id: string;
  kind: "area" | "permission" | "split" | "total";
  label: string;
  description?: string;
  areaId?: string;
  open?: boolean;
  cells: { role: TeamRolesRole; cell: Cell }[];
}

/** Role presets and permissions tab: the permission matrix, optionally in customise mode. */
export function TeamRolesPresets({
  areas,
  roles,
  has,
  countFor,
  open,
  onToggleArea,
  customise,
  changes,
  saved,
  onStartCustomise,
  onDiscard,
  onSave,
  onToggle,
}: {
  areas: TeamRolesPermissionArea[];
  roles: TeamRolesRole[];
  has: (role: TeamRolesRoleId, permission: string) => boolean;
  countFor: (role: TeamRolesRole) => number;
  open: Record<string, boolean>;
  onToggleArea: (areaId: string) => void;
  customise: boolean;
  changes: number;
  saved: boolean;
  onStartCustomise: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onToggle: (role: TeamRolesRoleId, permission: string, on: boolean) => void;
}) {
  const cols = roles.filter((r) => r.inMatrix);
  const total = areas.reduce((n, a) => n + a.permissions.length, 0);

  const rows: MatrixRow[] = [];
  for (const a of areas) {
    const isOpen = !!open[a.id];
    rows.push({
      id: `area-${a.id}`,
      kind: "area",
      label: a.label,
      description: `${a.permissions.length} permissions`,
      areaId: a.id,
      open: isOpen,
      cells: cols.map((role) => ({
        role,
        cell: { kind: "count", n: a.permissions.filter((p) => has(role.id, p.key)).length, of: a.permissions.length },
      })),
    });
    if (!isOpen) continue;
    for (const p of a.permissions) {
      rows.push({
        id: `perm-${p.key}`,
        kind: "permission",
        label: p.key,
        description: p.description,
        cells: cols.map((role) => {
          const on = has(role.id, p.key);
          return { role, cell: customise && role.id !== "owner" ? { kind: "toggle", on } : { kind: "mark", on } };
        }),
      });
    }
    for (const sp of a.proposedSplit) {
      rows.push({
        id: `split-${sp.key}`,
        kind: "split",
        label: sp.key,
        description: sp.description,
        cells: cols.map((role) => ({ role, cell: { kind: "mark", on: sp.roles.includes(role.id) } })),
      });
    }
  }
  rows.push({
    id: "total",
    kind: "total",
    label: `Total of ${total} permissions`,
    cells: cols.map((role) => ({ role, cell: { kind: "count", n: countFor(role), of: 0 } })),
  });

  const renderCell = (row: MatrixRow, role: TeamRolesRole, cell: Cell): ReactNode => {
    if (cell.kind === "count") {
      return (
        <span className={`font-semibold tabular ${cell.n || row.kind === "total" ? "" : "text-muted"}`}>
          {row.kind === "total" ? cell.n : `${cell.n}/${cell.of}`}
        </span>
      );
    }
    if (cell.kind === "toggle") {
      const label = `${cell.on ? "Remove" : "Add"} ${row.label} for ${role.name}`;
      return (
        <ToggleButton
          size="sm"
          variant="ghost"
          isIconOnly
          isSelected={cell.on}
          onChange={() => onToggle(role.id, row.label, !cell.on)}
          aria-label={label}
          className="mx-auto"
        >
          {cell.on ? (
            <Check className="size-4 text-success" aria-hidden="true" />
          ) : (
            <Minus className="size-4 text-muted" aria-hidden="true" />
          )}
        </ToggleButton>
      );
    }
    return cell.on ? (
      <span className="inline-flex text-success">
        <Check className="size-4" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    ) : (
      <span className="text-muted">—</span>
    );
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pre-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="pre-h" className="text-[15px] leading-[22px] font-semibold">
            Role Presets
          </h2>
          <p className="text-[13px] text-muted">
            You can change which permissions a preset includes. You cannot create new role names.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {customise ? (
            <>
              <Chip variant="soft" color="accent">
                {changes} changes
              </Chip>
              <Button variant="ghost" onPress={onDiscard}>
                Discard
              </Button>
              <Button isDisabled={changes === 0} onPress={onSave}>
                <ShieldKeyhole className="size-4" aria-hidden="true" />
                Save presets
              </Button>
            </>
          ) : (
            <Button variant="secondary" onPress={onStartCustomise}>
              <Pencil className="size-4" aria-hidden="true" />
              Customise presets
            </Button>
          )}
        </div>
      </div>

      {saved ? (
        <Alert status="success" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Presets saved</Alert.Title>
            <Alert.Description>
              Changes apply to members on their next action; anyone losing a permission is signed out of that area at
              once. Recorded in the audit log.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Role presets and permissions">
            <Table.Header>
              <Table.Column isRowHeader className="min-w-[280px]">
                Permission
              </Table.Column>
              {cols.map((r) => (
                <Table.Column key={r.id} id={r.id} className="text-center">
                  <span className="flex flex-col items-center gap-0.5">
                    <span>{r.name}</span>
                    {r.proposed ? (
                      <Chip size="sm" variant="soft" color="warning">
                        Proposed
                      </Chip>
                    ) : null}
                  </span>
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row
                  key={row.id}
                  id={row.id}
                  className={row.kind === "area" || row.kind === "total" ? "bg-surface-secondary" : undefined}
                >
                  <Table.Cell className={row.kind === "permission" ? "pl-9" : row.kind === "split" ? "pl-14" : "pl-4"}>
                    {row.kind === "area" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={row.open}
                        onPress={() => row.areaId && onToggleArea(row.areaId)}
                        className="-ml-2 h-auto gap-1.5 px-2 py-1 font-semibold"
                      >
                        {row.open ? (
                          <ChevronDown className="size-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-4" aria-hidden="true" />
                        )}
                        {row.label}
                        <span className="font-normal text-muted">{row.description}</span>
                      </Button>
                    ) : row.kind === "total" ? (
                      <span className="font-semibold">{row.label}</span>
                    ) : (
                      <span className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          <code className="text-xs">{row.label}</code>
                          {row.kind === "split" ? (
                            <Chip size="sm" variant="soft" color="warning">
                              Proposed
                            </Chip>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted">{row.description}</span>
                      </span>
                    )}
                  </Table.Cell>
                  {row.cells.map(({ role, cell }) => (
                    <Table.Cell key={role.id} className="text-center">
                      {renderCell(row, role, cell)}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <p className="text-xs leading-[17px] text-muted">
        Today one permission, payroll.run, both prepares and confirms a pay run. The proposed split separates preparing,
        confirming and releasing the payment file; whoever prepares a run can never confirm it, and confirming never
        pays anyone by itself. Storekeeper permissions are still being defined. Every preset is limited to the
        properties and branches in each member’s scope.
      </p>
    </section>
  );
}
