/**
 * Illustrative values for the input sections of the component gallery (`/kit`) and nothing else: a small
 * slice of Rwanda's places, fake uploads, a sample video made in the browser, rent on a calendar. No
 * screen may import this: screens read the API (places from `/api/v1/geography/*`).
 */
import type { PhotoItem, PlaceLevel, PlaceOption, UploadProgress } from "@injishi/ui";

/** A rent day for the gallery's schedule specimen. */
export interface RentDayItem {
  id: string;
  day: string;
  status: "paid" | "open" | "overdue";
  title: string;
  detail?: string;
  amount: number;
}

import { addDays } from "./kit-data";

// --- Places ------------------------------------------------------------------------------------------

const PROVINCES: PlaceOption[] = [
  { id: 1, name: "Kigali City" },
  { id: 2, name: "Southern Province" },
  { id: 3, name: "Western Province" },
  { id: 4, name: "Northern Province" },
  { id: 5, name: "Eastern Province" },
];

const DISTRICTS: Record<number, string[]> = {
  1: ["Nyarugenge", "Gasabo", "Kicukiro"],
  2: ["Huye", "Nyanza", "Muhanga", "Kamonyi"],
  3: ["Rubavu", "Karongi", "Rusizi"],
  4: ["Musanze", "Gicumbi", "Burera"],
  5: ["Rwamagana", "Kayonza", "Bugesera", "Nyagatare"],
};

const GASABO_SECTORS = [
  "Bumbogo",
  "Gatsata",
  "Gikomero",
  "Gisozi",
  "Jabana",
  "Jali",
  "Kacyiru",
  "Kimihurura",
  "Kimironko",
  "Kinyinya",
  "Ndera",
  "Nduba",
  "Remera",
  "Rusororo",
  "Rutunga",
];

const KIMIHURURA_CELLS = ["Kamukina", "Kimihurura", "Rugando"];
const VILLAGES = ["Amahoro", "Ubumwe", "Urugwiro", "Kabeza", "Umutekano", "Ishema"];

function named(parentId: number, names: string[]): PlaceOption[] {
  return names.map((name, i) => ({ id: parentId * 100 + i + 1, name }));
}

/** The places one level down, as the geography endpoints would list them. */
export function kitPlaces(level: PlaceLevel, parentId: number | string | null): PlaceOption[] {
  const parent = Number(parentId);
  switch (level) {
    case "province":
      return PROVINCES;
    case "district":
      return named(parent, DISTRICTS[parent] ?? []);
    case "sector":
      return named(parent, parent === 102 ? GASABO_SECTORS : ["Gitega", "Kigali", "Nyamirambo", "Rwezamenyo"]);
    case "cell":
      return named(parent, parent === 10208 ? KIMIHURURA_CELLS : ["Akabahizi", "Gihanga", "Kora"]);
    case "village":
      return named(parent, VILLAGES);
  }
}

/** A loader that answers like the API, a little later. */
export function kitPlaceLoader(delayMs = 350) {
  return (level: PlaceLevel, parentId: number | string | null) =>
    new Promise<PlaceOption[]>((resolve) => setTimeout(() => resolve(kitPlaces(level, parentId)), delayMs));
}

/** A loader whose districts fail the first time, to show the error with Try again. */
export function kitFlakyLoader() {
  let failed = false;
  const ok = kitPlaceLoader(300);
  return (level: PlaceLevel, parentId: number | string | null) => {
    if (level === "district" && !failed) {
      failed = true;
      return new Promise<PlaceOption[]>((_, reject) => setTimeout(() => reject(new Error("offline")), 300));
    }
    return ok(level, parentId);
  };
}

export const KIGALI = PROVINCES[0];
export const GASABO = { id: 102, name: "Gasabo" };
export const KIMIHURURA = { id: 10208, name: "Kimihurura" };
export const RUGANDO = { id: 1020803, name: "Rugando" };
export const AMAHORO = { id: 102080301, name: "Amahoro" };

// --- Uploads ------------------------------------------------------------------------------------------

let next = 0;

/**
 * An upload that only pretends: progress over `ms`, then the file itself as the saved photo. `stallAt`
 * stops the progress there (a slow network); `failAt` throws there (a dropped connection).
 */
export function fakeUpload<T>({
  ms = 2400,
  stallAt,
  failAt,
  done,
}: {
  ms?: number;
  stallAt?: number;
  failAt?: number;
  done: (file: File) => T;
}) {
  return (file: File, onProgress: UploadProgress, signal: AbortSignal) =>
    new Promise<T>((resolve, reject) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const f = Math.min(1, (Date.now() - started) / ms);
        if (stallAt !== undefined && f >= stallAt) {
          onProgress(stallAt);
          return;
        }
        onProgress(f);
        if (failAt !== undefined && f >= failAt) {
          window.clearInterval(timer);
          reject(new Error("The connection dropped."));
        } else if (f >= 1) {
          window.clearInterval(timer);
          resolve(done(file));
        }
      }, 120);
      signal.addEventListener("abort", () => {
        window.clearInterval(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      });
    });
}

export function savedPhoto(file: File): PhotoItem {
  next += 1;
  return { id: `kit-photo-${next}`, url: URL.createObjectURL(file), alt: file.name.replace(/\.\w+$/, "") };
}

/** A stock photo as a File, as if picked from the phone. */
export async function stockFile(src: string, name: string): Promise<File> {
  const blob = await (await fetch(src)).blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/** Hand files to the first file input inside `root`, as a person picking them would. */
export function pickFiles(root: HTMLElement | null, files: File[]) {
  const input = root?.querySelector<HTMLInputElement>("input[type=file]");
  if (!input) return;
  const transfer = new DataTransfer();
  for (const f of files) transfer.items.add(f);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * A short video tour made in the browser: a slow pan across a stock photo, recorded from a canvas. The
 * gallery's video specimens play it, so no video file is kept in the repository. Null where the browser
 * can't record.
 */
export async function makeSampleVideo(photoSrc: string, seconds = 4): Promise<File | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const image = new Image();
  image.src = photoSrc;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const stream = canvas.captureStream(30);
  const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  const paint = (t: number) => {
    const progress = Math.min(1, t / seconds);
    const zoom = 1.25 - 0.15 * progress;
    const w = canvas.width * zoom;
    const h = (w * image.naturalHeight) / image.naturalWidth;
    ctx.drawImage(image, -(w - canvas.width) * progress, -(h - canvas.height) / 2, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(16, 16, 180, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "600 16px sans-serif";
    ctx.fillText(`Sample tour 0:0${Math.min(seconds, Math.floor(t))}`, 28, 39);
  };
  paint(0);
  recorder.start(250);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = (performance.now() - start) / 1000;
      paint(t);
      if (t < seconds) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
  recorder.stop();
  await stopped;
  for (const track of stream.getTracks()) track.stop();
  const mime = (recorder.mimeType || type || "video/webm").split(";")[0];
  return new File([new Blob(chunks, { type: mime })], mime === "video/mp4" ? "sample-tour.mp4" : "sample-tour.webm", {
    type: mime,
  });
}

// --- Rent ---------------------------------------------------------------------------------------------

export function rentDays(today: string): RentDayItem[] {
  const rows: [number, RentDayItem["status"], string, string, number][] = [
    [-9, "paid", "Aline Uwase", "A-01", 350_000],
    [-9, "paid", "Eric Nshimiyimana", "A-02", 350_000],
    [-6, "overdue", "Jean Bosco Habimana", "B-03", 420_000],
    [-6, "paid", "Claudine Mukeshimana", "B-01", 420_000],
    [-2, "overdue", "Patrick Mugisha", "C-02", 280_000],
    [0, "open", "Grace Mukamana", "B-04", 480_000],
    [0, "open", "Diane Ingabire", "Studio 3", 210_000],
    [3, "open", "Olivier Niyonzima", "A-05", 350_000],
    [7, "open", "Sandrine Uwimana", "C-01", 280_000],
    [7, "open", "Emmanuel Nkurunziza", "C-04", 300_000],
    [7, "paid", "Yvonne Umutoni", "A-03", 350_000],
    [12, "open", "Kevin Ishimwe", "B-02", 420_000],
    [19, "open", "Aline Uwase", "A-01", 350_000],
  ];
  return rows.map(([offset, status, title, unit, amount], i) => ({
    id: `kit-rent-${i}`,
    day: addDays(today, offset),
    status,
    title,
    detail: `${unit} · rent`,
    amount,
  }));
}
