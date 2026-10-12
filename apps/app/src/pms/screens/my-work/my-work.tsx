"use client";

/**
 * My work: a person's own shifts, hours, leave and payslips (ADR-058,
 * 058-self-service).
 *
 * The Staff screens are the office looking at everybody. This is one person
 * looking at themselves, and it is here for the people who sign in to this app
 * to do a job that is not HR: the desk, the accountant, the manager, the room
 * attendant on the phone surface. Until it existed they could clock a
 * colleague in and not themselves, and asked the office for their own payslip.
 *
 * FIVE LENSES, each a route segment (ADR-018, D-c), so "ask for your leave
 * here" is a link somebody can be sent: Today, My time, My leave, My pay, My
 * documents (`MY_WORK_LENSES` in `lib/nav.ts`).
 *
 * NOTHING HERE HOLDS A PERMISSION. The door is the person's own staff file at
 * this business (`employeeId` on the grant), and every read and command goes
 * through `/me/work/:employeeId`, where the server answers only for the
 * caller's own file. Somebody with no file here is told so, rather than shown
 * five empty lenses.
 *
 * `MyWorkPhone` is the same five lenses for the housekeeper's phone surface,
 * which has no rail and no routes of its own: a row of chips instead.
 */

import type { ComponentType } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { LensPage, type LensLink } from "../../components/lens-page";
import { EmptyState } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useMyWorkFile } from "../../data/my-work";
import { MY_WORK_LENSES, workspaceBase } from "../../lib/nav";
import { MyDocuments } from "./my-documents";
import { MyLeave } from "./my-leave";
import { MyPay } from "./my-pay";
import { MyTime } from "./my-time";
import { MyToday } from "./my-today";
import { useMyFileId } from "./my-work-ui";

export type MyWorkLens = (typeof MY_WORK_LENSES)[number]["key"];

/** Who the page is about: the name on the file, the job, the branch and the number. */
function Whose({ employeeId }: { employeeId: string }) {
  const file = useMyWorkFile(employeeId).data;
  if (!file) return null;
  const parts = [file.jobPositionTitle, file.branchName, `No. ${file.employeeNumber}`].filter(Boolean);
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold text-ink">{file.displayName}</span>
      {parts.length > 0 ? ` · ${parts.join(" · ")}` : ""}
    </p>
  );
}

const NO_FILE = (
  <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
    You are not on the staff list of this business, so there are no shifts, leave or payslips of yours to show. Whoever
    keeps the staff files adds people under People, Employees.
  </EmptyState>
);

function Body({ lens, employeeId, base }: { lens: MyWorkLens; employeeId: string; base: string }) {
  switch (lens) {
    case "time":
      return <MyTime employeeId={employeeId} />;
    case "leave":
      return <MyLeave employeeId={employeeId} />;
    case "pay":
      return <MyPay employeeId={employeeId} />;
    case "documents":
      return <MyDocuments employeeId={employeeId} />;
    default:
      return <MyToday employeeId={employeeId} base={base} />;
  }
}

export function MyWork({ lens }: { lens: MyWorkLens }) {
  const workspaceId = useWorkspaceId();
  const employeeId = useMyFileId();
  const base = `${workspaceBase(workspaceId)}/my-work`;

  const links: LensLink[] = MY_WORK_LENSES.map((l) => ({
    key: l.key,
    label: l.label,
    href: l.segment ? `${base}/${l.segment}` : base,
  }));

  return (
    <LensPage lenses={links} active={lens}>
      {/* A container, so each lens lays out by the room it has rather than the
          window: the same components draw on the phone surface. `relative`
          holds any visually hidden caption inside the scrolling pane. */}
      <div className="@container relative flex max-w-page flex-col gap-4 pt-4">
        {employeeId === null ? (
          NO_FILE
        ) : (
          <>
            <Whose employeeId={employeeId} />
            <Body lens={lens} employeeId={employeeId} base={base} />
          </>
        )}
      </div>
    </LensPage>
  );
}

/**
 * The phone surface's My work. The lens is held in state, not in the address:
 * the phone surface draws the same screen on every route (`AppShell`), so
 * there is no segment to hold it. Today's three figures lead to the other
 * lenses, so here they are buttons that move the chips (`onOpen`).
 */
export function MyWorkPhone({ initial = "today" }: { initial?: MyWorkLens }) {
  const employeeId = useMyFileId();
  const [lens, setLens] = useState<MyWorkLens>(initial);
  const Lens: ComponentType<{ employeeId: string }> | null =
    lens === "time" ? MyTime : lens === "leave" ? MyLeave : lens === "pay" ? MyPay : lens === "documents" ? MyDocuments : null;

  if (employeeId === null) return NO_FILE;

  return (
    <div className="@container relative flex flex-col gap-3.5">
      <div role="tablist" aria-label="My work" className="flex gap-1.5 overflow-x-auto pb-0.5">
        {MY_WORK_LENSES.map((l) => {
          const on = l.key === lens;
          return (
            <button
              key={l.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setLens(l.key)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap",
                on ? "border-accent-text bg-accent-soft text-accent-text" : "border-card-bd bg-card text-ink2",
              )}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      {Lens ? <Lens employeeId={employeeId} /> : <MyToday employeeId={employeeId} base="" onOpen={setLens} />}
    </div>
  );
}
