"use client";

/**
 * Choose a file and send it up as an HR upload (058-people-file): the one
 * control behind the photo, a document, a note's or a policy's attachment and a
 * disciplinary letter. It answers the key the server gave back; the write that
 * follows is what hangs the file on its record, and it checks the key again.
 *
 * What a file IS is decided by the server from its first bytes. `accept` only
 * narrows the browser's picker to what will pass.
 */

import type { HrUpload, HrUploadPurpose } from "@injishi/contracts";
import { useRef, useState } from "react";

import { ActionButton } from "../../components/ui";
import { humanError } from "../../data/api";
import { uploadHrFile } from "../../data/people-file";

const ACCEPT: Record<HrUploadPurpose, string> = {
  photo: "image/jpeg,image/png,image/heic,image/webp",
  document: "application/pdf,image/jpeg,image/png,image/heic",
  attachment: "application/pdf,image/jpeg,image/png,image/heic,image/webp",
};

export function HrFileInput({
  workspaceId,
  purpose,
  label,
  onUploaded,
}: {
  workspaceId: string | null;
  purpose: HrUploadPurpose;
  label: string;
  onUploaded: (upload: HrUpload, filename: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (file: File) => {
    if (!workspaceId) return;
    setPending(true);
    setError(null);
    try {
      onUploaded(await uploadHrFile(workspaceId, purpose, file), file.name);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setPending(false);
      // The same file chosen again is a new choice, not no change.
      if (input.current) input.current.value = "";
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        accept={ACCEPT[purpose]}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) void send(file);
        }}
      />
      <ActionButton onClick={() => input.current?.click()} pending={pending}>
        {pending ? "Uploading" : label}
      </ActionButton>
      {error && (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
