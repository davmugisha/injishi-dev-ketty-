"use client";

import { ArrowUpFromSquare, Check, Magnifier, Picture } from "@gravity-ui/icons";
import { Button, Input, TextField } from "@heroui/react";
import { type ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  isUpload,
  type LibraryGroup,
  libraryPhoto,
  MENU_LIBRARY,
  photoSrc,
  suggestedPhoto,
  uploadSrc,
} from "./dish-art";

export { finalPhoto } from "./dish-art";

const GROUPS: ("All" | LibraryGroup)[] = ["All", "Drinks", "Food", "Services"];
/** What the file picker offers, and what the API accepts (it checks the bytes again). */
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
/** A label that looks like a small secondary button (it opens the file picker natively). */
const LABEL_BUTTON =
  "inline-flex min-h-8 cursor-pointer select-none items-center gap-1.5 rounded-lg border border-separator bg-surface px-3 text-[13px] font-medium text-foreground hover:bg-default";

const TONE = {
  amber: "bg-[#fff7e6] text-[#8a5a00]",
  green: "bg-[#e9f7ef] text-[#1f6b3a]",
  blue: "bg-[#e8f1fd] text-[#1d4f91]",
};

type Shown = {
  /** A library id, an upload token, or "pending" for a file picked and not used yet. */
  key: string;
  src: string;
  label: string;
  state: "suggested" | "chosen" | "uploaded" | "pending";
};

/**
 * The recipe image in Create recipe and Edit recipe.
 *
 * The name suggests a photo from the library and the preview follows the name as it is typed; it is labelled a
 * suggestion, not final. The owner keeps it, picks another from the library, or uploads their own: the file picker
 * opens, the picked file is previewed here, and only "Use this photo" uploads it (the API checks it, re-encodes it and
 * stores it; `upload:<id>` comes back). Whatever is shown here when the recipe is saved is the photo saved with it.
 * `chosen` is null while the suggestion is followed; a pick or an upload (or a photo saved earlier) stays put when the
 * name changes, and the new suggestion is offered.
 */
export function RecipeImage({
  outletId,
  name,
  section,
  chosen,
  saved,
  onChange,
}: {
  outletId: string;
  name: string;
  section: string;
  /** The photo picked or uploaded in this form, or the one saved earlier; null follows the name's suggestion. */
  chosen: string | null;
  /** The photo saved with the recipe before this edit, if any. */
  saved: string | null;
  onChange: (photo: string | null) => void;
}) {
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("All");
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A new upload is shown from the file the owner picked until the recipe is saved (it has no address of its own yet).
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const inputId = useId();
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    },
    [],
  );

  const typed = name.trim().length > 0;
  // Nothing is suggested before a name is typed. The name decides first; a name that says nothing falls back to the
  // menu category (the till does the same for an item with no saved photo), and the note says which it was.
  const byName = typed ? suggestedPhoto(name) : null;
  const suggestion = typed ? libraryPhoto(suggestedPhoto(name, section)) : undefined;
  const pick = libraryPhoto(chosen);
  const uploaded = isUpload(chosen) ? (localUrls[chosen] ?? uploadSrc(chosen)) : null;

  const shown: Shown | null = pending
    ? { key: "pending", src: pending.url, label: pending.file.name, state: "pending" }
    : uploaded && chosen
      ? { key: chosen, src: uploaded, label: "Your own photo", state: "uploaded" }
      : pick
        ? { key: pick.id, src: photoSrc(pick.id), label: pick.label, state: "chosen" }
        : suggestion
          ? { key: suggestion.id, src: photoSrc(suggestion.id), label: suggestion.label, state: "suggested" }
          : null;

  const q = query.trim().toLowerCase();
  const photos = useMemo(
    () =>
      MENU_LIBRARY.filter((p) => (group === "All" || p.group === group) && (!q || p.label.toLowerCase().includes(q))),
    [group, q],
  );

  const isSaved = !!shown && !pending && !!saved && chosen === saved;
  const badge = !shown
    ? null
    : shown.state === "pending"
      ? { text: "New photo, not used yet", tone: TONE.blue }
      : isSaved
        ? { text: "Saved image", tone: TONE.green }
        : shown.state === "suggested"
          ? { text: "Suggested image", tone: TONE.amber }
          : shown.state === "uploaded"
            ? { text: "Your photo", tone: TONE.green }
            : { text: "Your choice", tone: TONE.green };

  const note = !shown
    ? typed
      ? `No library photo matches "${name.trim()}". Choose one from the photo library, or upload your own.`
      : "Type the recipe name: a matching photo from the library appears here."
    : shown.state === "pending"
      ? "Check the photo. It is used only when you press Use this photo."
      : isSaved
        ? "This is the image saved with the recipe."
        : shown.state === "suggested"
          ? `Suggested from the ${byName ? "recipe name" : `menu category (${section})`}. It is not final: keep it, choose another, or upload your own. The image shown here is saved with the recipe.`
          : shown.state === "uploaded"
            ? "Your own photo. It is saved with the recipe when you save it."
            : "You chose this image from the photo library. It is saved with the recipe.";

  const offerSuggestion = !pending && shown?.state !== "suggested" && !!suggestion;
  const offerSaved = !pending && !!saved && chosen !== saved;

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared, so picking the same file again still fires a change.
    e.target.value = "";
    if (!file) return;
    const okType = UPLOAD_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!okType) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setError("That photo is larger than 8 MB. Choose a smaller one.");
      return;
    }
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setError(null);
    setBrowsing(false);
    setPending({ file, url });
  };

  const confirmUpload = async () => {
    if (!pending) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("photo", pending.file, pending.file.name);
      const res = await fetch(`/api/pos/menu-photos?outlet=${encodeURIComponent(outletId)}`, { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { photo?: string; message?: string | string[] } | null;
      if (!res.ok || !data?.photo) {
        const message = Array.isArray(data?.message) ? data?.message[0] : data?.message;
        setError(message || "The photo could not be uploaded. Try again.");
        return;
      }
      const token = data.photo;
      setLocalUrls((m) => ({ ...m, [token]: pending.url }));
      setPending(null);
      onChange(token);
    } catch {
      setError("The upload stopped. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-ui="recipe-image" className="flex flex-col gap-3">
      <span className="text-[13px] font-medium">Recipe image</span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          data-ui="recipe-image-preview"
          data-photo={shown?.key ?? ""}
          data-state={shown?.state ?? "empty"}
          className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl border border-separator bg-[var(--pos-band)] sm:w-[340px]"
        >
          {shown ? (
            <>
              {/* biome-ignore lint/performance/noImgElement: library JPEGs, uploads and local previews; no optimiser */}
              <img
                key={shown.key}
                src={shown.src}
                alt={`${shown.label}, for ${typed ? name.trim() : "this recipe"}`}
                className="size-full object-cover"
                draggable={false}
              />
              {badge ? (
                <span
                  data-ui="recipe-image-badge"
                  className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 text-[12px] font-semibold shadow-sm ${badge.tone}`}
                >
                  {badge.text}
                </span>
              ) : null}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/65 to-transparent px-3 pt-8 pb-2.5 text-[13px] font-medium text-white">
                {shown.label}
              </span>
            </>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 border-2 border-dashed border-separator px-6 text-center">
              <Picture className="size-8 text-muted" />
              <p className="text-[13px] text-muted">{typed ? "No matching photo yet" : "Image preview"}</p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p data-ui="recipe-image-note" className="text-[13px] leading-[19px] text-muted">
            {note}
          </p>
          {offerSuggestion && suggestion ? (
            <p className="text-[12.5px] text-muted">
              The name suggests <span className="font-medium text-foreground">{suggestion.label}</span>.
            </p>
          ) : null}

          {pending ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                data-ui="use-upload"
                isDisabled={uploading}
                onPress={() => void confirmUpload()}
              >
                {uploading ? "Uploading…" : "Use this photo"}
              </Button>
              <label
                htmlFor={uploading ? undefined : inputId}
                data-ui="choose-different-file"
                className={`${LABEL_BUTTON} ${uploading ? "pointer-events-none opacity-50" : ""}`}
              >
                Choose a different file
              </label>
              <Button
                size="sm"
                variant="ghost"
                data-ui="cancel-upload"
                isDisabled={uploading}
                onPress={() => {
                  setPending(null);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {offerSuggestion ? (
                <Button size="sm" variant="secondary" data-ui="use-suggested" onPress={() => onChange(null)}>
                  Use suggested image
                </Button>
              ) : null}
              {offerSaved && saved ? (
                <Button size="sm" variant="secondary" data-ui="use-saved" onPress={() => onChange(saved)}>
                  Keep the saved image
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={shown ? "secondary" : "primary"}
                data-ui="choose-from-library"
                aria-expanded={browsing}
                onPress={() => setBrowsing((b) => !b)}
              >
                {browsing ? "Close photo library" : shown ? "Choose another image" : "Choose from photo library"}
              </Button>
              {/* A real label for the file input: a click opens the system file picker in every browser. */}
              <label htmlFor={inputId} data-ui="upload-image" className={LABEL_BUTTON}>
                <ArrowUpFromSquare className="size-4" />
                Upload your own
              </label>
            </div>
          )}
          <input
            id={inputId}
            data-ui="upload-input"
            type="file"
            accept={UPLOAD_ACCEPT}
            aria-label="Upload your own photo"
            className="sr-only"
            onChange={pickFile}
          />
          {error ? (
            <p data-ui="upload-error" role="alert" className="text-[12.5px] font-medium text-danger">
              {error}
            </p>
          ) : (
            <p className="text-[12px] text-muted">JPG, PNG or WebP, up to 8 MB.</p>
          )}
        </div>
      </div>

      {browsing && !pending ? (
        <section
          data-ui="photo-library"
          aria-label="Photo library"
          className="flex flex-col gap-3 rounded-2xl border border-separator bg-surface p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <fieldset className="m-0 flex flex-wrap gap-1 border-0 p-0">
              <legend className="sr-only">Show</legend>
              {GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className={`min-h-8 rounded-full border px-3 text-[13px] font-medium ${
                    group === g
                      ? "border-accent bg-accent-soft text-accent-soft-foreground"
                      : "border-separator text-muted hover:bg-default"
                  }`}
                >
                  {g}
                </button>
              ))}
            </fieldset>
            <span className="flex-1" />
            <TextField
              value={query}
              onChange={setQuery}
              aria-label="Search the photo library"
              className="w-full sm:w-56"
            >
              <div className="relative w-full min-w-0">
                <Magnifier className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                <Input placeholder="Search photos" className="w-full min-w-0 pl-9" />
              </div>
            </TextField>
          </div>
          {photos.length === 0 ? (
            <p className="px-1 py-4 text-[13px] text-muted">No photo matches "{query}".</p>
          ) : (
            <ul className="grid max-h-[340px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-5">
              {photos.map((p) => {
                const selected = shown?.key === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      data-photo={p.id}
                      aria-pressed={selected}
                      aria-label={`${p.label}${p.id === suggestion?.id ? " (suggested)" : ""}`}
                      onClick={() => onChange(p.id === suggestion?.id && !saved ? null : p.id)}
                      className={`group relative flex w-full flex-col overflow-hidden rounded-xl border text-left outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        selected ? "border-accent ring-2 ring-accent" : "border-separator hover:border-accent"
                      }`}
                    >
                      <span className="relative aspect-[4/3] w-full bg-[var(--pos-band)]">
                        {/* biome-ignore lint/performance/noImgElement: bundled library JPEGs */}
                        <img
                          src={photoSrc(p.id)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className="size-full object-cover"
                        />
                        {selected ? (
                          <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                            <Check className="size-3.5" />
                          </span>
                        ) : null}
                        {p.id === suggestion?.id ? (
                          <span className="absolute top-1.5 left-1.5 rounded-full bg-[#fff7e6] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#8a5a00]">
                            Suggested
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate px-2 py-1.5 text-[12px] font-medium">{p.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
