"use client";

/**
 * Departments (F-P01) — which departments this property runs.
 *
 * **On real data** (ADR-035, D-f wave 2). Reads `GET /api/v1/ops/departments`
 * and commands `PATCH /ops/departments/:id` behind `department.manage`. It
 * replaces a `Placeholder`, so there was no fixture here to remove.
 *
 * **THIS SCREEN AND THE NAV READ THE SAME ROWS**, which is the point of it.
 * `navFor` decides whether a Services door or a Maintenance leaf exists from
 * the USALI categories on the grant (D-a), and those come from this table. So
 * retiring Food and Beverage here closes the Services section, and the
 * mutation invalidates `me.workspaces` to make that land without a reload. A
 * screen that edited departments while the nav read a fixture would have been
 * two answers to one question.
 *
 * **THE CATEGORY IS NOT EDITABLE, AND THAT IS DELIBERATE.**
 * `UpdateDepartmentRequest` omits it: the category decides which revenue
 * account a charge posts to, so changing it would silently re-attribute every
 * shilling already booked against the department. The name is editable, the
 * accounting category is not — which is exactly the split `code-standards`
 * calls "an editable catalog over a stable vocabulary" (D14).
 *
 * **There is no "Add a department" here yet.** `CreateDepartmentRequest`
 * requires a `propertyId`, and nothing on a workspace grant yet says which
 * property is in view; a workspace can hold several. That is the same blocker
 * Amenities has, recorded in ADR-035 rather than worked around with a guess at
 * the first property.
 */

import { Input } from "@injishi/ui";
import { cn } from "@/lib/utils";
import type { OperatorDepartment } from "@injishi/contracts";
import { useState } from "react";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useDepartments, useUpdateDepartment } from "../data/ops";
import { usePms } from "../store";

/**
 * What each USALI category is for, in a sentence an operator recognises.
 *
 * The category is the stable vocabulary; the NAME beside it is whatever this
 * property calls the department. Showing both is what makes the un-editable
 * half legible rather than mysterious.
 */
const CATEGORY_NOTE: Record<string, string> = {
  rooms: "Room revenue. Every room charge posts here.",
  fnb: "Food and beverage. Opens the Services section.",
  spa_recreation: "Spa and recreation. Opens the Services section.",
  other_operated: "Other operated departments that earn.",
  misc_income: "Miscellaneous income.",
  admin_general: "Administrative and general. A cost centre.",
  sales_marketing: "Sales and marketing. A cost centre.",
  it: "Information and telecommunications. A cost centre.",
  engineering: "Engineering and maintenance. Opens the Maintenance leaf.",
  utilities: "Utilities. A cost centre.",
  hr: "Human resources. A cost centre.",
};

const COLS = "minmax(190px,1.6fr) minmax(150px,1.4fr) minmax(120px,.9fr) auto";

export function Departments() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useDepartments(workspaceId);
  const update = useUpdateDepartment(workspaceId);

  /** The row being renamed, and what has been typed. */
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");

  const mayManage = can("department.manage");
  const denied = mayManage ? undefined : reasonFor("department.manage");

  function rename(d: OperatorDepartment) {
    const next = name.trim();
    // The server refuses an empty name and an unchanged one is not a command.
    if (!next || next === d.name) {
      setEditing(null);
      return;
    }
    update.mutate(
      { departmentId: d.id, name: next },
      {
        onSuccess: () => {
          setEditing(null);
          toast(`Renamed to ${next}`, "ok");
        },
        onError: toastError,
      },
    );
  }

  function setStatus(d: OperatorDepartment, status: "active" | "archived") {
    update.mutate(
      { departmentId: d.id, status },
      {
        onSuccess: () =>
          toast(
            status === "archived"
              ? `${d.name} retired — its revenue history stays`
              : `${d.name} is running again`,
            "ok",
          ),
        onError: toastError,
      },
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={260} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    /* An unreachable API is not a property with no departments. Told that, an
       operator would think their charges have nowhere to post. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your departments. They are all still set up — this is on our
        side, not an empty property.
      </LoadFailed>
    );
  }

  const all = query.data?.departments ?? [];
  const running = all.filter((d) => d.status === "active");
  const retired = all.filter((d) => d.status !== "active");

  const row = (d: OperatorDepartment, i: number, live: boolean) => {
    const open = editing === d.id;
    // This department, not the whole list.
    const busy = update.isPending && update.variables?.departmentId === d.id;
    return (
      <div
        key={d.id}
        className={cn(
          "grid items-center gap-2.5 px-[18px] py-3",
          i === 0 ? "border-t border-transparent" : "border-t border-line",
        )}
        style={{ gridTemplateColumns: COLS }}
      >
        <span className="min-w-0">
          {open ? (
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename(d);
                if (e.key === "Escape") setEditing(null);
              }}
              aria-label={`Rename ${d.name}`}
              maxLength={120}
              className="h-9 rounded border-line2 bg-card text-sm"
            />
          ) : (
            <span className="block truncate text-sm font-semibold text-ink">{d.name}</span>
          )}
        </span>

        <span className="min-w-0 text-2xs text-muted-foreground">
          {CATEGORY_NOTE[d.departmentCategory] ?? d.departmentCategory}
        </span>

        <span className="flex flex-wrap gap-1.5">
          <Badge intent={d.departmentType === "operated" ? "ok" : "neutral"}>
            {d.departmentType === "operated" ? "Earns" : "Costs"}
          </Badge>
          {d.guestRequestable && <Badge intent="info">Guests can ask</Badge>}
        </span>

        <span className="flex justify-end gap-2">
          {live && !open && (
            <ActionButton
              disabled={Boolean(denied) || busy}
              title={denied}
              onClick={() => {
                setEditing(d.id);
                setName(d.name);
              }}
            >
              Rename
            </ActionButton>
          )}
          {open && (
            <>
              <ActionButton onClick={() => setEditing(null)}>Cancel</ActionButton>
              <ActionButton variant="primary" pending={busy} onClick={() => rename(d)}>
                {busy ? "Saving" : "Save"}
              </ActionButton>
            </>
          )}
          {!open && (
            <ActionButton
              disabled={Boolean(denied) || busy}
              title={denied}
              onClick={() => setStatus(d, live ? "archived" : "active")}
            >
              {live ? "Retire" : "Restore"}
            </ActionButton>
          )}
        </span>
      </div>
    );
  };

  return (
    <div className="pms-enter flex flex-col gap-4">
      <span className="text-xs text-muted-foreground">
        A department decides where revenue is reported and where an order routes. Retiring
        one closes the section of the nav it opens — its history is kept either way.
      </span>

      <section>
        <SectionHeading n={running.length}>Running</SectionHeading>
        {running.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">
            This property runs no departments yet, so nothing can be charged to one.
          </EmptyState>
        ) : (
          <div className={cn(surfaceClass, "mt-2.5 scrollbar overflow-x-auto")}>
            <div className="min-w-[720px]">{running.map((d, i) => row(d, i, true))}</div>
          </div>
        )}
      </section>

      {retired.length > 0 && (
        <section>
          <SectionHeading n={retired.length}>Retired</SectionHeading>
          <div className={cn(surfaceClass, "mt-2.5 scrollbar overflow-x-auto")}>
            <div className="min-w-[720px]">{retired.map((d, i) => row(d, i, false))}</div>
          </div>
        </section>
      )}

      <p className="text-2xs text-muted-foreground">
        A department is never deleted, only retired — its revenue history is why. The
        accounting category cannot be changed at all: moving it would re-attribute every
        shilling already booked against it.
      </p>
    </div>
  );
}
