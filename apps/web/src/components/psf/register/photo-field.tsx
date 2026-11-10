"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@injishi/web-ui";

import { Field } from "@/app/(app)/(entry)/register/wizard-ui";
import { apiResultMessage, type ApiResult } from "@/lib/api";

const ACCEPT = "image/jpeg,image/png";
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * The owner's passport photo (2026-11-05), required, printed on the membership
 * card and the certificate. Sent as soon as it is picked; the draft keeps the
 * key that came back. JPEG or PNG only: those are what a PDF can print.
 */
export function PassportPhotoField({
  label = "Passport photo",
  hint = "Printed on your membership card and certificate. Anyone who checks your card sees it. JPEG or PNG, up to 2 MB.",
  required = true,
  hidden = false,
  objectKey,
  name,
  error,
  upload,
  onChange,
}: {
  label?: string;
  hint?: ReactNode;
  required?: boolean;
  /** PSF took it off the form (2026-11-06). */
  hidden?: boolean;
  objectKey: string;
  name: string;
  error?: string;
  upload: (file: File) => Promise<ApiResult<{ objectKey: string }>>;
  onChange: (next: { objectKey: string; name: string }) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    if (!ACCEPT.split(",").includes(file.type)) return setProblem("A passport photo must be a JPEG or PNG image.");
    if (file.size > MAX_BYTES) return setProblem("A passport photo must be 2 MB or smaller.");
    setBusy(true);
    const res = await upload(file);
    setBusy(false);
    if (res.status !== "ok") return setProblem(apiResultMessage(res));
    setPreview(URL.createObjectURL(file));
    onChange({ objectKey: res.data.objectKey, name: file.name });
  };

  if (hidden) return null;
  return (
    <Field
      label={label}
      required={required}
      hint={hint}
      error={problem ?? error}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-secondary/60">
          {preview ? (
            // A local object URL: next/image has nothing to optimise here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="You" className="size-full object-cover" />
          ) : (
            <UserRound size={24} aria-hidden className="text-muted-foreground" />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          {objectKey ? <p className="truncate text-sm font-medium">{name || "Photo added"}</p> : null}
          <Button variant="outline" onClick={() => input.current?.click()} pending={busy} disabled={busy}>
            {objectKey ? "Change photo" : "Add a photo"}
          </Button>
        </div>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(ev) => void pick(ev.target.files?.[0])} />
      </div>
    </Field>
  );
}
