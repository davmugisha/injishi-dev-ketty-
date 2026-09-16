"use client";

/**
 * Which branches a member covers (ADR-054 AC-T1), for People and Invites.
 *
 * `null` means every branch, a list means only those, exactly as the API takes
 * it. The choices are the grant's `branches`: the active branches the caller
 * covers, which for `team.manage` (the owner's) is every active branch. An
 * archived branch is never offered, because the API refuses it.
 *
 * Choosing "Only some" starts from nothing ticked, and the caller's form refuses
 * an empty list before sending with `MEMBER_BRANCHES_REFUSAL.empty`, the words
 * the API would answer, so "no branch at all" is never a silent state.
 */

import type { MemberBranchIds, WorkspaceBranch } from "@injishi/contracts";
import { Checkbox } from "@injishi/ui";
import { cn } from "@/lib/utils";

export function BranchPicker({
  branches,
  value,
  onChange,
  name,
}: {
  branches: readonly WorkspaceBranch[];
  value: MemberBranchIds;
  onChange: (next: MemberBranchIds) => void;
  /** The radio group's name; unique per picker on a screen. */
  name: string;
}) {
  const modes = [
    { every: true, label: "Every branch", note: "Sees and works every branch, including ones added later." },
    { every: false, label: "Only some branches", note: "Sees only the rows of the branches ticked below." },
  ];
  const chosen = new Set(value ?? []);

  return (
    <fieldset className="flex flex-col gap-2.5" data-branch-picker={name}>
      <legend className="pb-1.5 text-sm font-semibold text-ink">Branches</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {modes.map((m) => {
          const on = (value === null) === m.every;
          return (
            <label
              key={m.label}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded border px-3 py-2.5",
                on ? "border-accent-text bg-accent-soft" : "border-line2 bg-field",
              )}
            >
              <input
                type="radio"
                name={name}
                checked={on}
                onChange={() => onChange(m.every ? null : [])}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{m.label}</span>
                <span className="text-2xs text-muted-foreground">{m.note}</span>
              </span>
            </label>
          );
        })}
      </div>
      {value !== null && (
        <div className="flex flex-col gap-1.5 pl-1">
          {branches.map((b) => (
            <Checkbox
              key={b.id}
              isSelected={chosen.has(b.id)}
              onChange={(on) =>
                onChange(on ? [...chosen, b.id] : [...chosen].filter((id) => id !== b.id))
              }
              className="flex w-full items-center gap-2.5 text-sm font-normal text-ink"
            >
              {b.name}
              <span className="text-2xs text-muted-foreground">
                {[b.isHeadOffice && "Head office", b.districtName].filter(Boolean).join(" · ")}
              </span>
            </Checkbox>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/**
 * A member's coverage in words: "Every branch", or the branch names. An id not
 * among the active branches is one archived since, and is said so rather than
 * dropped, so the owner sees why a member covers less than they chose.
 */
export function coverageText(
  branchIds: MemberBranchIds,
  branches: readonly WorkspaceBranch[],
): string {
  if (branchIds === null) return "Every branch";
  const names = branchIds.map(
    (id) => branches.find((b) => b.id === id)?.name ?? "an archived branch",
  );
  return names.length === 0 ? "No branch" : names.join(", ");
}
