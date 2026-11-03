// View models the supervisor screens read (proto-ui, PLAN.md "Data seam"). Beatrice runs housekeeping
// on her floor: the live board, the room sheet, the inspection queue, one inspection and her team.

import type { ImageRequireSource } from "react-native";
import type { IconName, RoomStatus, Tone } from "@/components/ui";

/** A picture: a bundled photo in mock mode, a URL once the API serves them. */
export type Picture = ImageRequireSource | { uri: string };

export type FloorId = "1" | "2" | "3";

/** The five states the board counts (do not disturb is a dirty room with a note). */
export type CountStatus = "dirty" | "cleaning" | "clean" | "ready" | "blocked";

export type FloorCell = {
  room: string;
  status: RoomStatus;
  /** The cell's short line: "12:00 · DND", "Grace". */
  note: string;
  flag?: IconName;
  /** What the flag means, read aloud ("arrival moved to 12:00"). */
  flagLabel?: string;
  /** A room waiting for her inspection opens the queue; any other room opens its sheet. */
  opens: "queue" | "room";
};

export type FloorCount = { status: CountStatus; label: string; count: number };

export type FloorBoard = {
  floor: FloorId;
  title: string;
  eyebrow: string;
  floors: readonly { value: FloorId; label: string }[];
  counts: readonly FloorCount[];
  /** Front desk moved an arrival onto a room that is not ready. */
  alert: { room: string; title: string; body: string } | null;
  arrivals: readonly FloorCell[];
  arrivalsNote: string;
  others: readonly FloorCell[];
  othersNote: string;
  /** Rooms on this floor waiting for her inspection. */
  waiting: number;
};

/** A housekeeper who can take a room. */
export type Person = {
  id: string;
  name: string;
  photo?: Picture;
  initials: string;
  /** Where she is and how far along: "In 204 · 5 of 12 done". */
  line: string;
};

export type Notice = {
  tone: "danger" | "warning" | "info" | "success" | "accent";
  icon: IconName;
  title: string;
  body: string;
};

export type RoomSheet = {
  room: string;
  status: RoomStatus;
  /** The pill's word when it says more than the status: "DND 11:00". */
  statusLabel?: string;
  subtitle: string;
  notice: Notice | null;
  /** `assign`: rush or hand over; `inspect`: waiting for her; `done`: ready, nothing to do. */
  mode: "assign" | "inspect" | "done";
  arrival: string | null;
  assignee: string | null;
  people: readonly Person[];
  /** Already first on the housekeeper's list. */
  next: boolean;
};

export type RushInput = { room: string; to: string; next: boolean };

export type QueueRoom = {
  room: string;
  title: string;
  detail: string;
  chip: { label: string; tone: Tone; icon?: IconName };
};

export type DoneRoom = { room: string; title: string; detail: string };

export type InspectionQueue = {
  eyebrow: string;
  waiting: readonly QueueRoom[];
  done: readonly DoneRoom[];
  doneNote: string;
};

export type CheckResult = "pass" | "fail";

export type InspectionCheck = {
  id: string;
  label: string;
  result: CheckResult | null;
  /** A failed check carries a photo for the housekeeper. */
  photo: Picture | null;
  note: string | null;
};

export type Inspection = {
  room: string;
  /** Who cleaned it, first name: the room goes back to her. */
  cleanedBy: string;
  subtitle: string;
  checks: readonly InspectionCheck[];
  state: "open" | "released" | "returned";
};

export type ReturnedRoom = {
  room: string;
  to: string;
  title: string;
  body: string;
  /** What the housekeeper sees: the failed check, its photo and the note. */
  seen: readonly { id: string; title: string; quote: string; photo: Picture | null }[];
  next: QueueRoom | null;
  left: number;
  /** When the undo runs out, in ms since the epoch. */
  undoUntil: number;
};

export type TeamMember = {
  id: string;
  name: string;
  photo?: Picture;
  initials: string;
  line: string;
  /** Rooms done of rooms on the list; absent for someone not clocked in. */
  progress: { done: number; of: number } | null;
};

export type TeamRequest = {
  id: string;
  icon: IconName;
  kind: string;
  title: string;
  body: string;
  decision: "approved" | "declined" | null;
  /** What happens next, once she has answered. */
  outcome: string | null;
};

export type TeamStat = { label: string; value: string; unit?: string; tone?: "accent" | "danger" };

export type TeamToday = {
  eyebrow: string;
  stats: readonly TeamStat[];
  members: readonly TeamMember[];
  requests: readonly TeamRequest[];
};
