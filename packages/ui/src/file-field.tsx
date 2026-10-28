"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import { ActionButton, IconAction } from "./buttons.tsx";
import { Icon } from "./icon.tsx";
import { formatFileSize, MB } from "./media.ts";

/** Receipts and proofs: a PDF or a photo. */
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const DOCUMENT_ACCEPT = DOCUMENT_TYPES.join(",");
const DOCUMENT_EXT = /\.(pdf|jpe?g|png|webp)$/i;

/** Why this file can't be a receipt, or null. */
export function documentFileProblem(
  file: { name: string; type: string; size: number },
  maxBytes = 10 * MB,
): string | null {
  const known =
    (DOCUMENT_TYPES as readonly string[]).includes(file.type) || (!file.type && DOCUMENT_EXT.test(file.name));
  if (!known) return "Pick a PDF or a photo (JPEG, PNG or WebP).";
  if (file.size > maxBytes)
    return `That file is ${formatFileSize(file.size)}. Pick one up to ${formatFileSize(maxBytes)}.`;
  if (file.size === 0) return "That file is empty.";
  return null;
}

export interface FileFieldProps {
  label: ReactNode;
  /** The file picked, or null. */
  value: File | null;
  onChange: (file: File | null) => void;
  /** @default 10 MB */
  maxBytes?: number;
  /** The button's words. @default "Attach a file" */
  buttonLabel?: string;
  description?: ReactNode;
  errorMessage?: string | null;
  isDisabled?: boolean;
  className?: string;
}

/**
 * One file beside a form (a receipt, RRA's proof): a small Attach button, then the file's name and size
 * with Remove. PDFs and photos only, within `maxBytes`; checked here before anything is sent.
 */
export function FileField({
  label,
  value,
  onChange,
  maxBytes = 10 * MB,
  buttonLabel = "Attach a file",
  description,
  errorMessage,
  isDisabled,
  className,
}: FileFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = problem ?? errorMessage ?? null;
  return (
    <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
      <span id={id} className="text-sm font-medium text-foreground">
        {label}
      </span>
      <input
        ref={input}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={id}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!file) return;
          const why = documentFileProblem(file, maxBytes);
          setProblem(why);
          if (!why) onChange(file);
        }}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-separator px-3 py-2">
          <Icon name={value.type === "application/pdf" ? "FileText" : "Picture"} className="size-4 text-muted" />
          <span className="min-w-0 flex-1 truncate text-sm">{value.name}</span>
          <span className="text-xs text-muted tabular">{formatFileSize(value.size)}</span>
          <IconAction
            icon="Xmark"
            label={`Remove ${value.name}`}
            size="sm"
            isDisabled={isDisabled}
            onPress={() => onChange(null)}
          />
        </div>
      ) : (
        <ActionButton
          icon="Paperclip"
          size="sm"
          className="self-start"
          isDisabled={isDisabled}
          aria-describedby={id}
          onPress={() => input.current?.click()}
        >
          {buttonLabel}
        </ActionButton>
      )}
      {shown ? (
        <p className="text-xs text-danger" role="alert">
          {shown}
        </p>
      ) : description ? (
        <p className="text-xs text-muted">{description}</p>
      ) : null}
    </div>
  );
}
