"use client";

import { useRef, useState } from "react";
import { Button } from "@heroui/react";
import {
  CERTIFICATE_KIND_LABEL,
  type CertificateInput,
  type RegistrantRole,
} from "@injishi/contracts";
import {
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { removeCertificate, uploadCertificate } from "@/data/uploads";
import { apiResultMessage } from "@/lib/api";

import {
  Field,
  Notice,
  SelectField,
  StepActions,
  TextInput,
  formatBytes,
} from "./wizard-ui";

/**
 * Step 4 — your documents (ADR-026, AC-4 and AC-5).
 *
 * This step used to be a sentence saying certificates were not possible yet.
 * They are now: `POST /api/v1/uploads/certificate` stores the file and hands
 * back an `objectKey`, and that key is what `CertificateInput` carries into
 * `POST /registrations`. The two acts stay separate on purpose — a person can
 * attach a document, look at it, change their mind and attach another, all
 * before any registration exists to hang it on.
 *
 * **Nothing here is required, and the button says so.** The verifying officer
 * asks for these at the visit either way, and a registration blocked on a
 * document somebody has to go and find at home is a registration abandoned in a
 * different room. "Skip for now" is a first-class action, not a small link.
 *
 * A file is uploaded the moment it is chosen rather than at the end. A batch
 * upload on Continue means five files, one slow connection, and one failure
 * that loses all five — and it means the person cannot see that anything
 * worked until the step they are trying to leave.
 *
 * FOUR THINGS THIS STEP DOES BEYOND ATTACHING A FILE, because attaching alone
 * is where the mistakes live:
 *
 * 1. It says what is still MISSING. A checklist of the documents this kind of
 *    business is asked for, ticked as they arrive. Without it the only feedback
 *    a person gets is a list of what they happened to upload, which never tells
 *    anybody they forgot the fire safety certificate.
 * 2. It lets you LOOK at what you attached, in the page. Three scans off a
 *    phone are three files called `IMG_4471.jpg`, and the commonest document
 *    mistake in any registration is the right kind of file being the wrong
 *    photograph — a blurred one, or page two of a two page certificate.
 * 3. It lets you REMOVE one, and says so in words rather than only in an icon.
 * 4. It refuses an obviously wrong file BEFORE the upload rather than after,
 *    naming what was wrong with that particular file. A 40 MB video is a minute
 *    of somebody's data spent to be told no.
 */

/** One attached document, held while the registration is being filled in. */
export interface CertificateDraft {
  kind: CertificateInput["kind"];
  kindOther: string;
  certificateNumber: string;
  objectKey: string;
  filename: string;
  sizeBytes: number;
  /** What the server decided the file is. Drives the preview and the type line. */
  mime: string;
  /**
   * A local `blob:` url for the file this browser just read.
   *
   * The preview shows the file from the PERSON'S OWN MACHINE rather than
   * fetching the stored object back. That is deliberate and it is the honest
   * one: the point of looking is to check that the right page was scanned, and
   * the bytes they chose are the bytes that were sent. It also means the preview
   * costs no round trip on a connection that has just carried a 9 MB scan.
   *
   * It lives as long as the document does, so it survives leaving this step and
   * coming back. It is revoked when the row is removed, which is the only moment
   * it can no longer be needed.
   */
  previewUrl: string;
}

/**
 * Which kinds each branch is offered.
 *
 * A residence has no RDB grade and no tourism licence — those belong to a
 * graded hospitality business — so offering them would invite a landlord to
 * attach a document that means nothing on their file. `other` carries anything
 * this list does not name, which is what keeps the list short.
 */
const HOSPITALITY_KINDS: CertificateInput["kind"][] = [
  "rdb_grade",
  "tourism_license",
  "tax_clearance",
  "fire_safety",
  "health_inspection",
  "other",
];

const RESIDENCE_KINDS: CertificateInput["kind"][] = [
  "tax_clearance",
  "fire_safety",
  "other",
];

/**
 * What the verifying officer asks for at the visit, per branch.
 *
 * ASKED FOR, not required to continue — the two are different and the screen
 * says which this is. A hospitality business is graded by RDB and inspected for
 * fire and health, and those three plus a tax clearance are what an officer
 * opens a file expecting to find. A landlord is asked for far less, because a
 * let house is not an inspected premises.
 *
 * `other` is never on this list: a checklist row for "another document" is a row
 * that can never be ticked.
 */
const EXPECTED_KINDS: Record<RegistrantRole, CertificateInput["kind"][]> = {
  host: ["rdb_grade", "tax_clearance", "fire_safety", "health_inspection"],
  landlord: ["tax_clearance", "fire_safety"],
  broker: [],
};

/** What the upload endpoint stores, and what the drop zone already promised. */
const ACCEPTED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** 10 MB, the same ceiling `POST /uploads/certificate` enforces. */
const MAX_BYTES = 10 * 1024 * 1024;

export function StepDocuments({
  role,
  drafts,
  onChange,
  busy,
  onBack,
  onNext,
}: {
  role: RegistrantRole;
  drafts: CertificateDraft[];
  onChange: (next: CertificateDraft[]) => void;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const kinds = role === "host" ? HOSPITALITY_KINDS : RESIDENCE_KINDS;
  const expected = EXPECTED_KINDS[role];
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  /** One sentence per file we would not take, naming the file. */
  const [refused, setRefused] = useState<string[]>([]);
  /** Which document's preview is open. One at a time; the panels are tall. */
  const [previewing, setPreviewing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const attachedKinds = new Set(drafts.map((d) => d.kind));
  const missing = expected.filter((k) => !attachedKinds.has(k));

  const accept = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    setRefused([]);

    // The obviously wrong ones never leave the machine. A refusal after a
    // 40 MB upload is a refusal the person paid for in data and in minutes,
    // and the server would give the same answer.
    const turnedAway: string[] = [];
    const worth: File[] = [];
    for (const file of Array.from(files)) {
      const problem = whyNot(file);
      if (problem === null) worth.push(file);
      else turnedAway.push(`${file.name} — ${problem}`);
    }
    setRefused(turnedAway);
    if (worth.length === 0) return;

    setUploading(true);
    const added: CertificateDraft[] = [];
    for (const file of worth) {
      const res = await uploadCertificate(file);
      if (res.status !== "ok") {
        setError(apiResultMessage(res));
        break;
      }
      added.push({
        // The first document a host is asked for is the RDB grade certificate,
        // so that is the kind a new row opens on. It is a starting point and
        // not an assertion: the select sits on the row and changes it.
        kind: kinds[0],
        kindOther: "",
        certificateNumber: "",
        objectKey: res.data.objectKey,
        filename: res.data.filename,
        sizeBytes: res.data.sizeBytes,
        mime: res.data.mime,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setUploading(false);
    if (added.length > 0) onChange([...drafts, ...added]);
  };

  const drop = async (index: number) => {
    const doomed = drafts[index];
    if (previewing === doomed.objectKey) setPreviewing(null);
    onChange(drafts.filter((_, i) => i !== index));
    // The blob url dies with the row. Nothing can reach it once the row is gone,
    // and a browser holds the whole file in memory behind one of these.
    URL.revokeObjectURL(doomed.previewUrl);
    // Fire and forget on purpose. The row is gone from the form either way;
    // a stored object nobody references is a cleanup job's problem, not a
    // reason to make a person watch a spinner to un-attach a file.
    void removeCertificate(doomed.objectKey);
  };

  const patch = (index: number, next: Partial<CertificateDraft>) => {
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...next } : d)));
  };

  return (
    <section aria-labelledby="step-documents">
      <h2 id="step-documents" className="text-xl font-semibold tracking-tight">
        Your documents
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {role === "host"
          ? "Your RDB grade certificate and anything else you hold. Your verifying officer reads these."
          : "Anything you hold for this property. Your verifying officer reads these."}
      </p>

      <div className="mt-6 space-y-4">
        {expected.length > 0 ? (
          <DocumentChecklist
            expected={expected}
            attached={attachedKinds}
            missing={missing}
          />
        ) : null}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void accept(e.dataTransfer.files);
          }}
          className={[
            "flex flex-col items-center gap-3 rounded-card border-2 border-dashed p-8 text-center transition-colors",
            dragging
              ? "border-accent-brand bg-accent-brand/10"
              : "border-border bg-secondary",
          ].join(" ")}
        >
          <span className="flex size-12 items-center justify-center rounded-full border border-border text-muted-foreground">
            <UploadCloud size={22} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">
              Drop your certificates here
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PDF, JPEG, PNG or WebP. Up to 10 MB each.
            </p>
          </div>
          {/* The real control, kept out of the layout rather than out of the
              accessibility tree. `sr-only` would still put a bare file input
              in the tab order beside a button that does the same thing; this
              hides it from both and the button below drives it. */}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              void accept(e.target.files);
              // Cleared so choosing the same file twice still fires a change.
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            isDisabled={uploading}
            isPending={uploading}
            onPress={() => inputRef.current?.click()}
          >
            <Paperclip size={14} aria-hidden className="mr-1.5" />
            {uploading ? "Uploading…" : "Choose files"}
          </Button>
        </div>

        {refused.length > 0 ? (
          <Notice tone="warning">
            <p className="font-semibold">
              {refused.length === 1
                ? "One file was not attached."
                : `${refused.length} files were not attached.`}
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {refused.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {drafts.length > 0 ? (
          <ul className="space-y-3">
            {drafts.map((draft, index) => (
              <li
                key={draft.objectKey}
                className="rounded-card border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded border border-border text-muted-foreground">
                    {isImage(draft.mime) ? (
                      <ImageIcon size={18} aria-hidden />
                    ) : (
                      <FileText size={18} aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {draft.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fileTypeLabel(draft.mime)} · {formatBytes(draft.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={previewing === draft.objectKey}
                      aria-label={
                        previewing === draft.objectKey
                          ? `Hide the preview of ${draft.filename}`
                          : `Preview ${draft.filename}`
                      }
                      onPress={() =>
                        setPreviewing(
                          previewing === draft.objectKey
                            ? null
                            : draft.objectKey,
                        )
                      }
                    >
                      {previewing === draft.objectKey ? (
                        <EyeOff size={15} aria-hidden className="mr-1.5" />
                      ) : (
                        <Eye size={15} aria-hidden className="mr-1.5" />
                      )}
                      {previewing === draft.objectKey ? "Hide" : "Preview"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${draft.filename}`}
                      onPress={() => void drop(index)}
                    >
                      <Trash2 size={15} aria-hidden className="mr-1.5" />
                      Remove
                    </Button>
                  </div>
                </div>

                {previewing === draft.objectKey ? (
                  <DocumentPreview draft={draft} />
                ) : null}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="What is this document?">
                    <SelectField
                      value={draft.kind}
                      options={kinds.map((k) => ({
                        value: k,
                        label: CERTIFICATE_KIND_LABEL[k],
                      }))}
                      onChange={(value) =>
                        patch(index, {
                          kind: value as CertificateInput["kind"],
                          // Required with `other`, forbidden without it — the
                          // database carries the same rule.
                          kindOther: value === "other" ? draft.kindOther : "",
                        })
                      }
                    />
                  </Field>
                  {draft.kind === "other" ? (
                    <Field label="Tell us what it is" required>
                      <TextInput
                        value={draft.kindOther}
                        onChange={(e) =>
                          patch(index, { kindOther: e.target.value })
                        }
                      />
                    </Field>
                  ) : (
                    <Field label="Certificate number" hint="Optional.">
                      <TextInput
                        value={draft.certificateNumber}
                        onChange={(e) =>
                          patch(index, { certificateNumber: e.target.value })
                        }
                      />
                    </Field>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <Notice tone="info">
          You do not have to attach anything now. Your verifying officer will ask
          for these at the visit, and you can add them here at any time before
          then.
        </Notice>
      </div>

      <StepActions
        onBack={onBack}
        onNext={onNext}
        nextLabel={drafts.length === 0 ? "Skip for now" : "Continue"}
        busy={busy}
        disabled={drafts.some((d) => d.kind === "other" && !d.kindOther.trim())}
      />
    </section>
  );
}

/**
 * What the officer will look for, and what is already here.
 *
 * A list of what you uploaded can never tell you what you forgot, which is the
 * only question a person actually has on this screen. Every expected document
 * gets a row whether or not it has arrived, so the gap is visible rather than
 * inferred.
 *
 * It states an EXPECTATION and never a blocker, because that is the truth: the
 * step can be skipped whole, and a checklist that reads as a gate would make
 * people believe they cannot continue without documents they may not hold yet.
 */
function DocumentChecklist({
  expected,
  attached,
  missing,
}: {
  expected: CertificateInput["kind"][];
  attached: Set<CertificateInput["kind"]>;
  missing: CertificateInput["kind"][];
}) {
  return (
    <div className="rounded-card border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold">
          What your verifying officer will ask for
        </p>
        <p className="text-xs text-muted-foreground">
          {missing.length === 0
            ? "All attached."
            : `${expected.length - missing.length} of ${expected.length} attached · ${missing.length} still to come`}
        </p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {expected.map((kind) => {
          const here = attached.has(kind);
          return (
            <li key={kind} className="flex items-center gap-2 text-sm">
              <span
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  here
                    ? "border-success bg-success text-success-foreground"
                    : "border-border text-muted-foreground",
                ].join(" ")}
              >
                {here ? <Check size={12} aria-hidden /> : null}
              </span>
              <span className={here ? "" : "text-muted-foreground"}>
                {CERTIFICATE_KIND_LABEL[kind]}
              </span>
              <span className="sr-only">
                {here ? " — attached" : " — not attached yet"}
              </span>
            </li>
          );
        })}
      </ul>
      {missing.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          You can carry on without these. Attaching them now is what lets the
          officer read your file before the visit rather than at it.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The attached file, shown in the page.
 *
 * An image renders directly; a PDF gets the browser's own viewer through
 * `<object>`, which is the one element that degrades honestly — a browser with
 * no PDF plugin renders the children instead of an empty grey box, so the link
 * below is a real fallback and not decoration.
 *
 * The new-tab link stays even when the inline view works, because a certificate
 * scanned at A4 is unreadable at 20rem and the only useful thing a person can do
 * with it is open it properly.
 */
function DocumentPreview({ draft }: { draft: CertificateDraft }) {
  return (
    <div className="mt-3 rounded-card border border-border bg-secondary p-3">
      {isImage(draft.mime) ? (
        // eslint-disable-next-line @next/next/no-img-element -- a blob: url from
        // the person's own file. `next/image` optimises through a loader that
        // cannot see this browser's memory, and would render nothing.
        <img
          src={draft.previewUrl}
          alt={`Preview of ${draft.filename}`}
          className="mx-auto max-h-80 w-auto rounded border border-border"
        />
      ) : (
        <object
          data={draft.previewUrl}
          type={draft.mime}
          className="h-80 w-full rounded border border-border bg-background"
          aria-label={`Preview of ${draft.filename}`}
        >
          <p className="p-4 text-sm text-muted-foreground">
            This browser cannot show a PDF in the page. Open it in a new tab to
            check it.
          </p>
        </object>
      )}
      <p className="mt-2 text-center text-xs">
        <a
          href={draft.previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-accent-text underline underline-offset-2"
        >
          <ExternalLink size={12} aria-hidden />
          View {draft.filename} in a new tab
        </a>
      </p>
    </div>
  );
}

/**
 * Why this file cannot be attached, or `null` when it can.
 *
 * Named per file rather than as one blanket message: somebody who dragged four
 * scans and a video needs to know which one was the video.
 */
function whyNot(file: File): string | null {
  if (file.size === 0) {
    return "that file is empty. It may not have finished downloading.";
  }
  if (file.size > MAX_BYTES) {
    return `that is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)} — scan it again at a lower quality, or send the pages separately.`;
  }
  // The browser reports "" for a type it does not recognise. Refusing on an
  // empty type would turn away a valid PDF from an unusual source, so the
  // EXTENSION is the second opinion and the server is the third.
  const declared = file.type.toLowerCase();
  if (declared !== "" && !ACCEPTED_MIME.includes(declared)) {
    return `we cannot read ${fileTypeLabel(declared)}. A certificate has to be a PDF, JPEG, PNG or WebP.`;
  }
  if (declared === "" && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
    return "we could not tell what kind of file that is. A certificate has to be a PDF, JPEG, PNG or WebP.";
  }
  return null;
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

/** A mime type as a person would name the file. */
function fileTypeLabel(mime: string): string {
  const known: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG image",
    "image/png": "PNG image",
    "image/webp": "WebP image",
  };
  const hit = known[mime.toLowerCase()];
  if (hit) return hit;
  // `application/vnd.openxmlformats-...wordprocessingml.document` is not a
  // sentence. The subtype's last word is the closest thing to one a person can
  // recognise, and "a document file" is better than the full mime string.
  const subtype = mime.split("/")[1] ?? "";
  const tail = subtype.split(/[.+]/).pop() ?? "";
  return tail ? `a ${tail} file` : "that kind of file";
}
