"use client";

import { toast } from "@heroui/react";
import {
  FAULT_CATEGORY_LABEL,
  FAULT_PHOTO_MAX_BYTES,
  FAULT_PHOTOS_PER_PHASE,
  FAULT_URGENCY_LABEL,
  type FaultPhotoView,
  type MaintenanceCategory,
  type MaintenancePriority,
} from "@injishi/contracts";
import {
  FormDialog,
  type PhotoItem,
  type PhotoUpload,
  PhotoUploader,
  SelectField,
  type UploadState,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/server/rentals/action-kit";
import { fieldErrorsOnly, SwitchRow, TextInput } from "../rentals/fields";
import { sendForm } from "../rentals/send-form";

const CATEGORIES = (Object.keys(FAULT_CATEGORY_LABEL) as MaintenanceCategory[]).map((id) => ({
  id,
  label: FAULT_CATEGORY_LABEL[id],
}));
const URGENCIES = (Object.keys(FAULT_URGENCY_LABEL) as MaintenancePriority[]).map((id) => ({
  id,
  label: FAULT_URGENCY_LABEL[id],
}));

export interface FaultDraft {
  title: string;
  category: MaintenanceCategory;
  description?: string;
  urgency: MaintenancePriority;
  staffMayEnter: boolean;
  unitId?: string;
}

/**
 * Report a fault: what is wrong, the kind, how urgent, whether someone may let themselves in, and up to
 * four photos. The fault is saved first; the photos picked go up right after and the dialog closes once
 * they are all in. Used by the tenant on their home and by the landlord on any unit.
 */
export function ReportFaultDialog({
  title,
  description,
  units,
  create,
  photoRoute,
  onClose,
  onSaved,
}: {
  title: string;
  description?: string;
  /** The landlord picks the unit; the tenant's is their home. */
  units?: { id: string; label: string }[];
  create: (draft: FaultDraft) => Promise<ActionResult<{ id: string; reference: string | null }>>;
  /** Where a photo of the saved fault goes. */
  photoRoute: (faultId: string) => string;
  onClose: () => void;
  onSaved: (faultId: string) => void;
}) {
  const router = useRouter();
  const [unitId, setUnitId] = useState<string | null>(units?.length === 1 ? (units[0]?.id ?? null) : null);
  const [what, setWhat] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory | null>(null);
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState<MaintenancePriority | null>(null);
  const [mayEnter, setMayEnter] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [state, setState] = useState<UploadState>({ queued: 0, uploading: 0, failed: 0 });
  const [saved, setSaved] = useState<{ id: string; reference: string | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const upload = useMemo<PhotoUpload | null>(
    () =>
      saved
        ? async (file, progress, signal) => {
            const form = new FormData();
            form.append("phase", "report");
            form.append("photos", file, file.name);
            const r = await sendForm<{ photos: FaultPhotoView[] }>(
              photoRoute(saved.id),
              "POST",
              form,
              progress,
              signal,
            );
            if (!r.ok) throw new Error(r.error);
            const last = r.value.photos.at(-1);
            return { id: last?.id ?? crypto.randomUUID(), url: last?.url ?? "" };
          }
        : null,
    [saved, photoRoute],
  );

  // Saved with photos waiting: they go up now; close once every one is in.
  const done = useRef(false);
  useEffect(() => {
    if (!saved || done.current) return;
    if (state.queued > 0 || state.uploading > 0 || state.failed > 0) return;
    done.current = true;
    toast.success(`Fault ${saved.reference ?? ""} reported`.replace("  ", " "));
    onSaved(saved.id);
    router.refresh();
  }, [saved, state, onSaved, router]);

  const submit = () =>
    start(async () => {
      if (saved) return;
      const next: Record<string, string> = {};
      if (units && !unitId) next.unitId = "Pick the unit.";
      if (what.trim().length < 3) next.title = "Say what is wrong in a few words.";
      if (!category) next.category = "Pick the kind.";
      if (!urgency) next.urgency = "Say how urgent it is.";
      setErrors(next);
      setFormError(null);
      if (Object.keys(next).length > 0 || !category || !urgency) return;
      const r = await create({
        title: what.trim(),
        category,
        description: details.trim() || undefined,
        urgency,
        staffMayEnter: mayEnter,
        ...(unitId ? { unitId } : {}),
      });
      if (!r.ok) {
        const fields = fieldErrorsOnly(r.fieldErrors);
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? null : r.error);
        return;
      }
      setSaved(r.value);
    });

  const busy = pending || (saved !== null && (state.queued > 0 || state.uploading > 0));
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (open) return;
        if (!saved) {
          onClose();
          return;
        }
        onSaved(saved.id);
        router.refresh();
      }}
      title={title}
      description={saved ? "Saved. The photos are going up." : description}
      submitLabel={saved ? "Uploading" : "Report it"}
      submitIcon="PaperPlane"
      isPending={busy}
      validationErrors={errors}
      formError={
        formError ??
        (saved && state.failed > 0 ? "The fault is reported. A photo didn't upload: try it again or remove it." : null)
      }
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {units ? (
        <SelectField
          label="Unit"
          name="unitId"
          options={units}
          value={unitId}
          onChange={(v) => {
            setUnitId(v);
            setErrors((e) => ({ ...e, unitId: "" }));
          }}
          placeholder="Pick the unit"
          errorMessage={errors.unitId || null}
          isDisabled={saved !== null}
          isRequired
        />
      ) : null}
      <TextInput
        label="What is wrong"
        name="title"
        value={what}
        onChange={(v) => {
          setWhat(v);
          setErrors((e) => ({ ...e, title: "" }));
        }}
        placeholder="Kitchen tap leaking"
        errorMessage={errors.title || null}
        isRequired
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Kind"
          name="category"
          options={CATEGORIES}
          value={category}
          onChange={(v) => {
            setCategory(v as MaintenanceCategory);
            setErrors(({ category: _, ...rest }) => rest);
          }}
          errorMessage={errors.category || null}
          isRequired
          isDisabled={saved !== null}
        />
        <SelectField
          label="How urgent"
          name="urgency"
          options={URGENCIES}
          value={urgency}
          onChange={(v) => {
            setUrgency(v as MaintenancePriority);
            setErrors(({ urgency: _, ...rest }) => rest);
          }}
          errorMessage={errors.urgency || null}
          isRequired
          isDisabled={saved !== null}
        />
      </div>
      <TextInput
        label="Details"
        name="description"
        value={details}
        onChange={setDetails}
        placeholder="Where it is, since when, what you tried"
        errorMessage={errors.description || null}
        multiline
      />
      <SwitchRow
        label="Someone may come in when nobody is home"
        description="The fixer can let themselves in with the landlord's key."
        isSelected={mayEnter}
        onChange={setMayEnter}
      />
      <PhotoUploader
        label="Photos"
        photos={photos}
        max={FAULT_PHOTOS_PER_PHASE}
        maxBytes={FAULT_PHOTO_MAX_BYTES}
        upload={upload}
        onUploaded={(p) => setPhotos((list) => [...list, p])}
        onStateChange={setState}
        isDisabled={pending}
      />
    </FormDialog>
  );
}
