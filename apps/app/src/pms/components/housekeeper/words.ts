/**
 * The words on the housekeeper's phone.
 *
 * Short, plain, and the same word for the same thing on every tab. Read by
 * somebody between rooms, often in a second language, so no idiom and no
 * sentence where one word will do.
 */

import type {
  HousekeepingStatus,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  MaintenanceCategory,
} from "@injishi/contracts";

export type Intent = "ok" | "warn" | "info" | "bad" | "neutral" | "accent";

export const ROOM_STATUS: Record<HousekeepingStatus, { label: string; intent: Intent }> = {
  dirty: { label: "Needs cleaning", intent: "warn" },
  clean: { label: "Clean", intent: "ok" },
  inspected: { label: "Inspected", intent: "info" },
  out_of_order: { label: "Out of order", intent: "bad" },
};

/** The order the status buttons and filters appear in. */
export const ROOM_STATUS_ORDER: HousekeepingStatus[] = ["dirty", "clean", "inspected", "out_of_order"];

export const TASK_STATUS: Record<HousekeepingTaskStatus, { label: string; intent: Intent }> = {
  pending: { label: "To do", intent: "warn" },
  in_progress: { label: "Cleaning now", intent: "info" },
  done: { label: "Done", intent: "ok" },
  inspected: { label: "Inspected", intent: "neutral" },
  blocked: { label: "Waiting for repair", intent: "bad" },
};

export const TASK_TYPE: Record<HousekeepingTaskType, string> = {
  checkout_clean: "Guest left — full clean",
  stayover_clean: "Guest staying — tidy",
  inspection: "Check the room",
  deep_clean: "Deep clean",
  turndown: "Evening turndown",
};

/** The one next step a cleaner takes on a task, and its button. */
export const TASK_NEXT: Partial<
  Record<HousekeepingTaskStatus, { to: HousekeepingTaskStatus; label: string }>
> = {
  pending: { to: "in_progress", label: "Start" },
  in_progress: { to: "done", label: "Finish" },
  blocked: { to: "pending", label: "Repaired — back to my list" },
};

export const FAULTS: { value: MaintenanceCategory; label: string }[] = [
  { value: "plumbing", label: "Water / toilet" },
  { value: "electrical", label: "Lights / power" },
  { value: "hvac", label: "Air con / fan" },
  { value: "appliance", label: "TV / fridge" },
  { value: "furniture", label: "Bed / furniture" },
  { value: "safety", label: "Lock / safety" },
  { value: "other", label: "Other" },
];

export function roomName(label: string | null | undefined): string {
  return label ? `Room ${label}` : "Room (no number)";
}
