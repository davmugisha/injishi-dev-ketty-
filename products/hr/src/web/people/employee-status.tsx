import { Link as LinkIcon, LinkSlash } from "@gravity-ui/icons";
import { Chip, Tooltip } from "@heroui/react";
import { type Tone, toneColor } from "@injishi/ui";
import type { Employee, EmployeeStatus } from "../../model/people.ts";

export const STATUS: Record<EmployeeStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  // The prototype's "On sick leave" and "Leaving 20 Oct" named one person's day; the contract line carries the date.
  leave: { label: "On leave", tone: "info" },
  leaving: { label: "Leaving", tone: "warning" },
  probation: { label: "Probation", tone: "accent" },
};

/** Login chip of an employee file: linked, being revoked (leaver) or none. */
function loginChip(e: Employee): { label: string; tone: Tone; linked: boolean } {
  if (!e.login) return { label: "None", tone: "default", linked: false };
  return e.status === "leaving"
    ? { label: "Linked · revoking", tone: "warning", linked: true }
    : { label: "Linked", tone: "accent", linked: true };
}

export function LoginChip({
  employee,
  size = "sm",
  iconOnly = false,
}: {
  employee: Employee;
  size?: "sm" | "md";
  /** Just the link icon, its label on hover: for a dense table. */
  iconOnly?: boolean;
}) {
  const c = loginChip(employee);
  if (iconOnly) {
    return (
      <Tooltip delay={150} closeDelay={0}>
        <Tooltip.Trigger
          aria-label={`Login: ${c.label}`}
          className={`inline-flex size-7 items-center justify-center rounded-full outline-none ${
            c.linked
              ? c.tone === "warning"
                ? "bg-warning-soft text-warning-soft-foreground"
                : "bg-accent-soft text-accent-soft-foreground"
              : "text-muted"
          }`}
        >
          {c.linked ? <LinkIcon className="size-3.5" /> : <LinkSlash className="size-3.5" />}
        </Tooltip.Trigger>
        <Tooltip.Content className="text-xs">{employee.login ?? c.label}</Tooltip.Content>
      </Tooltip>
    );
  }
  return (
    <Chip size={size} variant="soft" color={toneColor(c.tone)}>
      {c.linked ? <LinkIcon className="size-3" /> : <LinkSlash className="size-3" />}
      <Chip.Label>{c.label}</Chip.Label>
    </Chip>
  );
}
