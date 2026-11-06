"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@injishi/web-ui";

import { Field } from "@/app/(app)/(entry)/register/wizard-ui";
import { apiResultMessage } from "@/lib/api";
import { uploadPsfLogo } from "@/data/psf";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * The business's logo (2026-10-23), optional, printed on its membership
 * certificate. Sent as soon as it is picked, under the form's verified ID
 * check, and kept in the draft as the key that came back; the picture itself
 * is shown from memory, so after a reload only its name is left to show.
 */
export function LogoField({
  label = "Logo (optional)",
  hint = "Printed on your membership certificate. PNG, JPEG or WebP, up to 2 MB.",
  required = false,
  checkToken,
  objectKey,
  name,
  error,
  onChange,
}: {
  label?: string;
  hint?: ReactNode;
  required?: boolean;
  checkToken: string | null;
  objectKey: string;
  name: string;
  error?: string;
  onChange: (next: { logoObjectKey: string; logoName: string }) => void;
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
    if (!ACCEPT.split(",").includes(file.type)) return setProblem("A logo must be a PNG, JPEG or WebP image.");
    if (file.size > MAX_BYTES) return setProblem("A logo must be 2 MB or smaller.");
    if (!checkToken) return setProblem("Check your National ID first, then add your logo.");
    setBusy(true);
    const res = await uploadPsfLogo(checkToken, file);
    setBusy(false);
    if (res.status !== "ok") return setProblem(apiResultMessage(res));
    setPreview(URL.createObjectURL(file));
    onChange({ logoObjectKey: res.data.objectKey, logoName: file.name });
  };

  const remove = () => {
    setPreview(null);
    setProblem(null);
    onChange({ logoObjectKey: "", logoName: "" });
    if (input.current) input.current.value = "";
  };

  return (
    <Field label={label} hint={hint} required={required} error={problem ?? error}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-secondary/60">
          {preview ? (
            // A local object URL: next/image has nothing to optimise here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your logo" className="size-full object-contain p-1.5" />
          ) : (
            <ImagePlus size={22} aria-hidden className="text-muted-foreground" />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          {objectKey ? <p className="truncate text-sm font-medium">{name || "Logo added"}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => input.current?.click()} pending={busy} disabled={busy}>
              {objectKey ? "Change logo" : "Add a logo"}
            </Button>
            {objectKey ? (
              <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Trash2 size={14} aria-hidden /> Remove
              </button>
            ) : null}
          </div>
        </div>
        <input
          ref={input}
          id="psf-logo"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(ev) => void pick(ev.target.files?.[0])}
        />
      </div>
    </Field>
  );
}
