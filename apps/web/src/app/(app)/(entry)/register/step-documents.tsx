"use client";

import { useRef, useState, type DragEvent } from "react";
import type { OrgCertificateKind } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { File, FileCheck, FileText, FileUp, Flame, HeartPulse, Medal, ShieldCheck, Stamp, X } from "lucide-react";

import { removeCertificate, uploadCertificate } from "@/data/uploads";
import { apiResultMessage } from "@/lib/api";

import type { DocumentDraft } from "./business-draft";
import { documentRows, type DocumentRow, type RegisterPath } from "./register-steps";
import { Field, SelectField, TextInput, formatBytes } from "./wizard-ui";

/**
 * Step 4, Documents (Register.dc.html): one row per document the artboard
 * names, each with its own Upload, and its state said twice, as a chip and as
 * a line (Uploaded, Failed, Uploading, Needed, Optional). One row is required:
 * the RDB certificate for a business, the land title for a residence.
 *
 * The drop zone at the top takes several files at once and asks which row each
 * one is, because a guessed kind files a tax clearance under the RDB
 * certificate for the officer who opens it. A file is uploaded the moment it is
 * chosen (`POST /uploads/certificate`, 10 MB, PDF or image) and sent with the
 * registration when it is signed.
 */

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const ACCEPTED = ACCEPT.split(",");
/** The ceiling `POST /uploads/certificate` enforces. */
const MAX_BYTES = 10 * 1024 * 1024;

const ICON: Partial<Record<OrgCertificateKind, typeof File>> = {
  rdb_certificate: FileText,
  tourism_license: FileCheck,
  rdb_grade: Medal,
  tax_clearance: FileText,
  fire_safety: Flame,
  health_inspection: HeartPulse,
  psf_certificate: Stamp,
  land_title: ShieldCheck,
};

function whyNot(file: globalThis.File): string | null {
  if (file.size === 0) return "the file is empty";
  if (file.size > MAX_BYTES) return `${formatBytes(file.size)}, larger than 10 MB`;
  const type = file.type.toLowerCase();
  const byName = /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
  if ((type !== "" && !ACCEPTED.includes(type)) || (type === "" && !byName)) return "not a PDF, JPG or PNG";
  return null;
}

type Transient = { status: "uploading" | "failed"; filename: string; reason?: string };

interface Unsorted {
  objectKey: string;
  filename: string;
  sizeBytes: number;
}

export function StepDocuments({
  path,
  docs,
  onDocsChange,
  errors,
}: {
  path: RegisterPath;
  docs: DocumentDraft[];
  onDocsChange: (next: DocumentDraft[]) => void;
  errors: Record<string, string>;
}) {
  const rows = documentRows(path);
  const [transient, setTransient] = useState<Record<string, Transient>>({});
  const [unsorted, setUnsorted] = useState<Unsorted[]>([]);
  const [zoneProblems, setZoneProblems] = useState<string[]>([]);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** The latest docs, for an upload that finishes after another one changed them. */
  const docsRef = useRef(docs);
  docsRef.current = docs;

  const docFor = (kind: OrgCertificateKind) => docs.find((d) => d.kind === kind) ?? null;
  const freeRows = rows.filter((r) => !docFor(r.kind));

  async function uploadInto(row: DocumentRow, file: globalThis.File) {
    const problem = whyNot(file);
    if (problem) {
      setTransient((t) => ({ ...t, [row.kind]: { status: "failed", filename: file.name, reason: problem } }));
      return;
    }
    setTransient((t) => ({ ...t, [row.kind]: { status: "uploading", filename: file.name } }));
    const res = await uploadCertificate(file);
    if (res.status !== "ok") {
      setTransient((t) => ({ ...t, [row.kind]: { status: "failed", filename: file.name, reason: apiResultMessage(res) } }));
      return;
    }
    setTransient((t) => {
      const next = { ...t };
      delete next[row.kind];
      return next;
    });
    const doc: DocumentDraft = {
      kind: row.kind,
      kindOther: "",
      objectKey: res.data.objectKey,
      filename: res.data.filename,
      sizeBytes: res.data.sizeBytes,
    };
    onDocsChange([...docsRef.current.filter((d) => d.kind !== row.kind), doc]);
  }

  async function acceptZone(files: ArrayLike<globalThis.File> | null) {
    if (!files || files.length === 0) return;
    const problems: string[] = [];
    const added: Unsorted[] = [];
    setZoneBusy(true);
    for (const file of Array.from(files)) {
      const problem = whyNot(file);
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
        continue;
      }
      const res = await uploadCertificate(file);
      if (res.status !== "ok") {
        problems.push(`${file.name}: ${apiResultMessage(res)}`);
        break;
      }
      added.push({ objectKey: res.data.objectKey, filename: res.data.filename, sizeBytes: res.data.sizeBytes });
    }
    setZoneBusy(false);
    setZoneProblems(problems);
    if (added.length) setUnsorted((u) => [...u, ...added]);
  }

  const remove = (kind: OrgCertificateKind) => {
    const doomed = docFor(kind);
    onDocsChange(docs.filter((d) => d.kind !== kind));
    // Gone from the form either way; an unreferenced stored object is a clean up job's.
    if (doomed) void removeCertificate(doomed.objectKey);
  };

  const file = (u: Unsorted, kind: string) => {
    const row = rows.find((r) => r.kind === kind);
    if (!row) return;
    setUnsorted((list) => list.filter((x) => x.objectKey !== u.objectKey));
    onDocsChange([
      ...docs.filter((d) => d.kind !== row.kind),
      { kind: row.kind, kindOther: "", objectKey: u.objectKey, filename: u.filename, sizeBytes: u.sizeBytes },
    ]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void acceptZone(e.dataTransfer.files);
  };

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-6 text-center",
          dragging ? "border-accent-brand bg-accent-brand/10" : "border-border bg-field",
        )}
      >
        <FileUp size={28} aria-hidden className="text-muted-foreground" />
        <p className="text-sm font-semibold">Drop files here or browse</p>
        <p className="text-xs text-muted-foreground">
          PDF, JPG or PNG, up to 10 MB each. Phone photos are fine if all four corners show.
        </p>
        {zoneBusy ? (
          <span role="status" className="text-xs text-muted-foreground">
            Uploading…
          </span>
        ) : (
          <FilePick label="Browse files" multiple onFiles={(files) => void acceptZone(files)} />
        )}
      </div>

      {zoneProblems.length ? (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
          {zoneProblems.map((p) => (
            <li key={p}>We did not upload {p}.</li>
          ))}
        </ul>
      ) : null}

      {unsorted.length ? (
        <ul className="flex flex-col gap-2" aria-label="Files to sort">
          {unsorted.map((u) => (
            <li key={u.objectKey} className="flex flex-col gap-2 rounded-card border border-border p-3 sm:flex-row sm:items-end">
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{u.filename}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(u.sizeBytes)}, uploaded</span>
              </span>
              <div className="w-full sm:w-64">
                <Field label="Which document is this?">
                  <SelectField
                    value=""
                    placeholder="Choose one"
                    options={freeRows.map((r) => ({ value: r.kind, label: r.label }))}
                    onChange={(kind) => kind && file(u, kind)}
                  />
                </Field>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${u.filename}`}
                onClick={() => {
                  setUnsorted((list) => list.filter((x) => x.objectKey !== u.objectKey));
                  void removeCertificate(u.objectKey);
                }}
              >
                <X size={16} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="flex flex-col divide-y divide-border rounded-card bg-secondary">
        {rows.map((row) => {
          const doc = docFor(row.kind);
          const t = transient[row.kind];
          const state = doc ? "done" : t?.status === "uploading" ? "uploading" : t?.status === "failed" ? "failed" : "none";
          const Icon = ICON[row.kind] ?? File;
          const chip =
            state === "done"
              ? { label: "Uploaded", cls: "bg-success/15 text-success" }
              : state === "failed"
                ? { label: "Failed", cls: "bg-destructive/10 text-destructive" }
                : state === "uploading"
                  ? { label: "Uploading", cls: "bg-card text-muted-foreground" }
                  : row.required
                    ? { label: "Needed", cls: "bg-warning/15 text-foreground" }
                    : { label: "Optional", cls: "bg-card text-muted-foreground" };
          const meta =
            state === "done" && doc
              ? `${doc.filename} · ${formatBytes(doc.sizeBytes)}`
              : state === "failed" && t
                ? `${t.filename} · ${t.reason ?? "it did not upload"}`
                : state === "uploading" && t
                  ? `${t.filename} · uploading`
                  : row.required
                    ? "Needed to continue"
                    : "Not added";
          return (
            <li key={row.kind} className="flex flex-col gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
                  <Icon size={16} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {row.label}
                    {row.required ? (
                      <span className="rounded-full bg-accent-brand/15 px-2 py-0.5 text-2xs font-semibold text-accent-text">
                        Required
                      </span>
                    ) : null}
                  </span>
                  <span className={cn("break-words text-xs", state === "failed" ? "text-destructive" : "text-muted-foreground")}>
                    {meta}
                  </span>
                </span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", chip.cls)}>{chip.label}</span>
                {state === "done" ? (
                  <Button variant="ghost" size="sm" onClick={() => remove(row.kind)}>
                    Remove<span className="sr-only">: {row.label}</span>
                  </Button>
                ) : state === "uploading" ? null : (
                  <FilePick
                    label={state === "failed" ? "Try again" : "Upload"}
                    hiddenLabel={`: ${row.label}`}
                    onFiles={(files) => {
                      const chosen = files[0];
                      if (chosen) void uploadInto(row, chosen);
                    }}
                  />
                )}
              </div>
              {row.kind === "other" && doc ? (
                <div className="max-w-form md:pl-12">
                  <Field label="What it is" error={errors["documents.other"]}>
                    <TextInput
                      className="w-full"
                      placeholder="Trading licence"
                      value={doc.kindOther}
                      onChange={(e) =>
                        onDocsChange(docs.map((d) => (d.kind === "other" ? { ...d, kindOther: e.target.value } : d)))
                      }
                    />
                  </Field>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * A button that opens the file picker: a LABEL wearing the button, with the
 * file input inside it. The browser opens the picker for a press on a label
 * natively, with nothing to go wrong in between; a button that calls
 * `input.click()` from a script depends on the press still counting as the
 * person's own by the time it runs. Keyboard users reach the input inside the
 * label (visually hidden) and the label shows the focus ring.
 */
function FilePick({
  label,
  hiddenLabel,
  multiple = false,
  onFiles,
}: {
  label: string;
  /** Read after the label by a screen reader only: which document it is for. */
  hiddenLabel?: string;
  multiple?: boolean;
  onFiles: (files: globalThis.File[]) => void;
}) {
  return (
    <Button asChild variant="secondary" size="sm">
      <label className="cursor-pointer focus-within:ring-2 focus-within:ring-ring">
        {label}
        {hiddenLabel ? <span className="sr-only">{hiddenLabel}</span> : null}
        <input
          type="file"
          accept={ACCEPT}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            // Cleared so the same file can be chosen again after a failure.
            e.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
      </label>
    </Button>
  );
}

/** Whether Documents can be left: the required row filled, "Other" named, nothing waiting to be sorted. */
export function documentsReady(path: RegisterPath, docs: DocumentDraft[]): { ok: boolean; why: string } {
  const required = documentRows(path).filter((r) => r.required);
  const missing = required.filter((r) => !docs.some((d) => d.kind === r.kind));
  if (missing.length) {
    const label = missing[0]!.label;
    // "RDB certificate" keeps its capitals; "Land title" reads mid sentence.
    const named = /^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
    return { ok: false, why: `Upload the ${named} to continue.` };
  }
  if (docs.some((d) => d.kind === "other" && d.kindOther.trim() === "")) {
    return { ok: false, why: "Say what the Other document is." };
  }
  return { ok: true, why: "" };
}
