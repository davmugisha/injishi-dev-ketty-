"use client";

/**
 * One guest-facing desk, and the LEAD who answers it.
 *
 * A guest does not message "Housekeeping". They open a thread headed by a named
 * person with a job title, and they expect that person to know what was said
 * yesterday. So the operator side has to name the same human, and this card is
 * where that name is chosen.
 *
 * THE LEAD IS STORED ON THE THREAD, not in a table beside it — see
 * `setDepartmentLead`. That is what makes this screen honest rather than
 * decorative: changing the lead here changes the name at the top of the
 * conversation the guest is reading, and posts a line telling them so. A lead
 * kept anywhere else would be an operator-side belief about a conversation
 * showing somebody else's name.
 *
 * These five desks are NOT the USALI departments on the Departments table in
 * production. Those decide which revenue account a charge posts to; these
 * decide who picks up a message. A property with one Food and Beverage
 * department still needs a kitchen desk and a front desk, and collapsing the
 * two vocabularies is how a guest ends up messaging "Other operated".
 */

import { cn } from "@/lib/utils";

import { Badge, Initials, SectionHeading, SelectField, surfaceClass } from "../ui";
import { kigaliStamp } from "./clock";
import {
  DEPARTMENT_BLURB,
  DEPARTMENT_LABEL,
  type ChatThread,
  type Department,
} from "./order-store";

export interface DeskLead {
  name: string;
  role: string;
}

export interface LeadCardProps {
  department: Department;
  thread: ChatThread;
  /** Everyone on this property's roster who could hold the desk. */
  roster: DeskLead[];
  onAssign: (lead: DeskLead) => void;
  /** The refusal sentence, when this operator may not manage departments. */
  deniedReason?: string;
  /** How many room orders report into this desk. Kitchen only, in practice. */
  orderCount: number;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LeadCard({
  department,
  thread,
  roster,
  onAssign,
  deniedReason,
  orderCount,
}: LeadCardProps) {
  const last = thread.messages[thread.messages.length - 1];
  /* The person on the desk may have been chosen already, or may be somebody who
     has since left the roster. Either way the thread's own answer wins — it is
     what the guest is looking at. */
  const options = roster.some((person) => person.name === thread.leadName)
    ? roster
    : [{ name: thread.leadName, role: thread.leadRole }, ...roster];

  return (
    <section className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
      <div className="flex flex-wrap items-baseline gap-2">
        <SectionHeading>{DEPARTMENT_LABEL[department]}</SectionHeading>
        <span className="flex-1" />
        {orderCount > 0 && <Badge intent="info">{orderCount} orders</Badge>}
        <Badge intent="neutral">{thread.messages.length} messages</Badge>
      </div>

      <div className="flex items-center gap-3">
        <Initials size={40}>{initialsOf(thread.leadName)}</Initials>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="truncate text-sm font-bold text-foreground">{thread.leadName}</span>
            <Badge intent="accent">Lead</Badge>
          </span>
          <span className="block truncate text-2xs text-muted-foreground">{thread.leadRole}</span>
        </span>
      </div>

      <p className="text-xs leading-relaxed text-ink2">
        What guests bring here: {DEPARTMENT_BLURB[department]}
      </p>

      {/* A div, not a label. `SelectField` renders a HeroUI listbox rather than
          a native control, so a wrapping label has no form element to point at
          and a click on the heading would do nothing. Its accessible name comes
          from the `label` prop instead. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-bold tracking-[0.08em] uppercase text-muted-foreground">
          Who leads this desk
        </span>
        <SelectField
          label={`Lead for ${DEPARTMENT_LABEL[department]}`}
          value={thread.leadName}
          disabled={Boolean(deniedReason)}
          onChange={(name) => {
            const picked = options.find((person) => person.name === name);
            if (picked) onAssign(picked);
          }}
          options={options.map((person) => ({
            value: person.name,
            label: `${person.name} · ${person.role}`,
          }))}
        />
        <span className="text-2xs text-faint">
          {deniedReason ??
            "The guest sees this name at the top of their conversation, and is told when it changes."}
        </span>
      </div>

      {last && (
        <p className="border-t border-line pt-2.5 text-2xs text-muted-foreground">
          <span className="pms-num">{kigaliStamp(last.at)}</span> ·{" "}
          {last.from === "guest" ? "Guest" : last.from === "staff" ? thread.leadName : "Injishi"}:{" "}
          <span className="text-ink2">{last.body}</span>
        </p>
      )}
    </section>
  );
}
