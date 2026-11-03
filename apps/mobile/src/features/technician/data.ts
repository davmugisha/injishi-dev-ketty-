// The technician app's reads and writes, on the mock/api seam (proto-ui, PLAN.md "Data seam"). No real
// call exists for these screens yet, so api mode answers "Not connected yet" until the API serves them.

import { useAction, useSource } from "@/data/source";
import {
  addNote,
  askStore,
  asset,
  createJob,
  emptyJobsBoard,
  jobDetail,
  jobsBoard,
  requestPart,
  resolveJob,
  scanView,
  toggleTimer,
} from "./mock-data";
import type { ResolveInput } from "./types";

/** Every technician write can change the list, a job and an asset: all of them re-read. */
const ALL = [["technician"]] as const;

export function useJobsBoard() {
  return useSource(["technician", "jobs"], { mock: () => jobsBoard(), empty: () => emptyJobsBoard() });
}

export function useJob(job: string) {
  return useSource(["technician", "job", job], { mock: () => jobDetail(job) });
}

/** Start or pause the repair timer. */
export function useToggleTimer() {
  return useAction({ mock: (job: string) => toggleTimer(job), invalidates: ALL });
}

export function useAddNote() {
  return useAction({ mock: (input: { job: string; text: string }) => addNote(input), invalidates: ALL });
}

/** Ask Patrick at the store for a part for this job. */
export function useRequestPart() {
  return useAction({ mock: (input: { job: string; part: string }) => requestPart(input), invalidates: ALL });
}

/** Record the fix and, when asked, start the release chain: Beatrice inspects, then Aline releases. */
export function useResolveJob() {
  return useAction({ mock: (input: ResolveInput) => resolveJob(input), invalidates: ALL });
}

export function useScanView() {
  return useSource(["technician", "scan"], { mock: () => scanView() });
}

export function useAsset(tag: string) {
  return useSource(["technician", "asset", tag], { mock: () => asset(tag) });
}

/** Ask Patrick to order what the suggestion needs. */
export function useAskStore() {
  return useAction({ mock: (tag: string) => askStore(tag), invalidates: ALL });
}

/** A new work order filled in from the asset. */
export function useCreateJob() {
  return useAction({ mock: (tag: string) => createJob(tag), invalidates: ALL });
}
