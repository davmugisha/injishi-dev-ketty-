"use client";

import { useRef, useState } from "react";
import { CERTIFICATE_KIND_LABEL, type CertificateInput, type RegistrantRole } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { FileUp, X } from "lucide-react";

import { removeCertificate, uploadCertificate } from "@/data/uploads";
import { apiResultMessage } from "@/lib/api";

import { Field, SelectField, TextInput, formatBytes } from "./wizard-ui";

/**
 * The documents a registrant has to hand, inside Business's optional section
 * (RegisterIA board: "Add more now"). Documents used to be a screen of their own
 * that most people skipped; the verifier asks for anything missing at the visit,
 * so attaching one is an offer, never a gate.
 *
 * Each file names WHICH document it is, chosen by the person: the server stores
 * a kind per certificate (`org_certificates.kind`), and a guessed kind is a
 * scan filed under the wrong name for the officer who opens it. So a new file
 * starts unnamed and the step will not continue until it is named or removed.
 */
export interface DocumentDraft {
  kind: CertificateInput["kind"] | "";
  kindOther: string;
  objectKey: string;
  filename: string;
  sizeBytes: number;
}

const KINDS: Record<"host" | "landlord", CertificateInput["kind"][]> = {
  host: ["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other"],
  landlord: ["tax_clearance", "fire_safety", "other"],
};

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
/** 10 MB, the ceiling `POST /uploads/certificate` enforces. */
const MAX_BYTES = 10 * 1024 * 1024;

function whyNot(file: File): string | null {
  if (file.size === 0) return "that file is empty.";
  if (file.size > MAX_BYTES) return `that is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_BYTES)}.`;
  const type = file.type.toLowerCase();
  if (type !== "" && !ACCEPTED.includes(type)) return "a document has to be a PDF, JPEG, PNG or WebP.";
  if (type === "" && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
    return "a document has to be a PDF, JPEG, PNG or WebP.";
  }
  return null;
}

/** What the step refuses about the documents, keyed by row. */
export function documentErrors(docs: DocumentDraft[]): Record<string, string> {
  const out: Record<string, string> = {};
  docs.forEach((d, i) => {
    if (d.kind === "") out[`documents.${i}`] = "Say which document this is, or remove it.";
    else if (d.kind === "other" && d.kindOther.trim() === "") out[`documents.${i}`] = "Name the document.";
  });
  return out;
}

export function BusinessDocuments({
  role,
  docs,
  onChange,
  errors,
  hint,
}: {
  role: RegistrantRole;
  docs: DocumentDraft[];
  onChange: (next: DocumentDraft[]) => void;
  errors: Record<string, string>;
  hint?: string;
}) {
  const kinds = KINDS[role === "landlord" ? "landlord" : "host"];
  const [uploading, setUploading] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const input = useRef<HTMLInputElement | null>(null);

  const accept = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const turnedAway: string[] = [];
    const worth: File[] = [];
    for (const file of Array.from(files)) {
      const problem = whyNot(file);
      if (problem === null) worth.push(file);
      else turnedAway.push(`${file.name}: ${problem}`);
    }
    setProblems(turnedAway);
    if (worth.length === 0) return;
    setUploading(true);
    const added: DocumentDraft[] = [];
    for (const file of worth) {
      const res = await uploadCertificate(file);
      if (res.status !== "ok") {
        setProblems((p) => [...p, `${file.name}: ${apiResultMessage(res)}`]);
        break;
      }
      added.push({
        kind: "",
        kindOther: "",
        objectKey: res.data.objectKey,
        filename: res.data.filename,
        sizeBytes: res.data.sizeBytes,
      });
    }
    setUploading(false);
    if (input.current) input.current.value = "";
    if (added.length > 0) onChange([...docs, ...added]);
  };

  const remove = (index: number) => {
    const doomed = docs[index];
    onChange(docs.filter((_, i) => i !== index));
    // The row is gone from the form either way; an unreferenced stored object
    // is a clean-up job's, not a reason to make a person wait.
    if (doomed) void removeCertificate(doomed.objectKey);
  };

  const patch = (index: number, next: Partial<DocumentDraft>) =>
    onChange(docs.map((d, i) => (i === index ? { ...d, ...next } : d)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-border bg-field p-4">
        <FileUp size={20} aria-hidden className="shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 basis-56 text-sm">
          {hint}{" "}
          <span className="text-muted-foreground">The verifier asks for anything missing at the visit.</span>
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          pending={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? "Uploading…" : "Choose files"}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Choose documents to attach"
          onChange={(e) => void accept(e.target.files)}
        />
      </div>

      {problems.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-destructive" role="alert">
          {problems.map((p) => (
            <li key={p}>We did not attach {p}</li>
          ))}
        </ul>
      ) : null}

      {docs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {docs.map((d, i) => (
            <li key={d.objectKey} className="flex flex-col gap-2 rounded-card border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.filename}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(d.sizeBytes)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${d.filename}`}
                  onClick={() => remove(i)}
                >
                  <X size={16} aria-hidden />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Which document is this?" error={errors[`documents.${i}`]}>
                  <SelectField
                    value={d.kind}
                    placeholder="Choose one"
                    invalid={Boolean(errors[`documents.${i}`])}
                    options={kinds.map((k) => ({ value: k, label: CERTIFICATE_KIND_LABEL[k] }))}
                    onChange={(kind) => patch(i, { kind: kind as DocumentDraft["kind"] })}
                  />
                </Field>
                {d.kind === "other" ? (
                  <Field label="What it is">
                    <TextInput
                      className="w-full"
                      placeholder="Trading licence"
                      value={d.kindOther}
                      onChange={(e) => patch(i, { kindOther: e.target.value })}
                    />
                  </Field>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
