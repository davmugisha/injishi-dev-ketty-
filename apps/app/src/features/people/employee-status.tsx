import { Link as LinkIcon, LinkSlash } from "@gravity-ui/icons";
import { Chip } from "@heroui/react";
import type { Employee, EmployeeStatus } from "@injishi/data/fixtures/people";
import { type Tone, toneColor } from "@injishi/ui";

export const STATUS: Record<EmployeeStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  leave: { label: "On sick leave", tone: "info" },
  leaving: { label: "Leaving 20 Oct", tone: "warning" },
  probation: { label: "Probation", tone: "accent" },
};

/** Login chip of an employee file: linked, being revoked (leaver) or none. */
export function loginChip(e: Employee): { label: string; tone: Tone; linked: boolean } {
  if (!e.login) return { label: "None", tone: "default", linked: false };
  return e.status === "leaving"
    ? { label: "Linked · revoking", tone: "warning", linked: true }
    : { label: "Linked", tone: "accent", linked: true };
}

export function LoginChip({ employee, size = "sm" }: { employee: Employee; size?: "sm" | "md" }) {
  const c = loginChip(employee);
  return (
    <Chip size={size} variant="soft" color={toneColor(c.tone)}>
      {c.linked ? <LinkIcon className="size-3" /> : <LinkSlash className="size-3" />}
      <Chip.Label>{c.label}</Chip.Label>
    </Chip>
  );
}
