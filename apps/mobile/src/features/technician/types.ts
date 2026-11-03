// View models the technician screens read (proto-ui, PLAN.md "Data seam"). Jean-Paul fixes what
// housekeeping and the front desk report: his jobs, one work order, its resolution, a tag scan and
// the history of one asset.

import type { ImageRequireSource } from "react-native";
import type { IconName, Tone } from "@/components/ui";

/** A picture: a bundled photo in mock mode, a URL once the API serves them. */
export type Picture = ImageRequireSource | { uri: string };

export type Tag = { label: string; tone: Tone; icon?: IconName };

export type JobState = "todo" | "parts" | "done";

/** One row of the jobs list (`.li.big`): a photo, where and what, the reference and a chip. */
export type JobRow = {
  id: string;
  title: string;
  detail: string;
  photo: Picture;
  tag: Tag;
};

export type JobsBoard = {
  eyebrow: string;
  /** A repeat fault on one asset leads the list (S9). */
  alert: { title: string; body: string; tag: string } | null;
  todo: readonly JobRow[];
  parts: readonly JobRow[];
  /** Who the parts wait on: "Patrick, store". */
  partsNote: string;
  done: readonly JobRow[];
};

export type JobPart = { id: string; title: string; detail: string; tag: Tag };

export type JobNote = { id: string; text: string; time: string };

export type StorePart = { id: string; name: string; stock: string };

export type JobDetail = {
  id: string;
  /** "Room 112 · basin leak". */
  title: string;
  /** The room number, when the job is in a room that can be blocked. */
  room: string | null;
  photo: Picture;
  /** The glass chip on the photo: "1 photo · Jeanne". */
  photoNote: string;
  priority: Tag;
  opened: string;
  state: JobState;
  /** The repair timer: seconds counted so far, and since when it runs (ms since the epoch), or null if stopped. */
  timer: { seconds: number; since: number | null; started: string | null };
  /** An out-of-order request waiting on the manager. */
  block: { title: string; body: string } | null;
  report: { heading: string; text: string; mine: boolean };
  notes: readonly JobNote[];
  parts: readonly JobPart[];
  /** What the store has, for "Add from store". */
  store: readonly StorePart[];
  /** What the fix form starts with. */
  fix: { note: string; photos: readonly Picture[]; spare: readonly Picture[] };
  /** "fixed 11:20 · 18 min", once resolved. */
  resolved: string | null;
};

export type ResolveInput = { job: string; note: string; photos: number; askRelease: boolean };

export type AssetStat = { label: string; value: string; caption: string; tone?: "danger" };

export type Asset = {
  tag: string;
  name: string;
  subtitle: string;
  photo: Picture;
  /** Where it is, on the photo's chip. */
  where: string;
  stats: readonly AssetStat[];
  suggestion: {
    title: string;
    body: string;
    stock: { label: string; tone: "danger" | "warning" | "success"; hint: string };
    /** The store has been asked already. */
    asked: boolean;
  } | null;
  history: readonly { key: string; title: string; detail: string }[];
};

export type ScanView = {
  /** What the camera stand-in shows: the unit in front of him. */
  camera: Picture;
  /** The tag the camera reads when he holds the frame on it. */
  inView: string;
  recent: readonly { tag: string; label: string }[];
  /** Every tag on this site, to check one typed by hand. */
  known: readonly string[];
};
