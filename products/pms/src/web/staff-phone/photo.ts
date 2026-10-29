/**
 * A photograph taken on the phone, made small enough to send on weak signal before it goes to the API
 * (`POST /api/v1/uploads` takes images up to 8 MB; a server action takes a body of about 1 MB, so the phone
 * shrinks every photo to well under that). Browser only.
 */

/** The longest side of a sent photo, in pixels: plenty to see a stain or a broken fitting. */
const MAX_SIDE = 1600;
/** What a shrunk photo must stay under to fit one server action's body. */
const MAX_BYTES = 900 * 1024;

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** The photo as a JPEG no larger than MAX_SIDE on its long edge and MAX_BYTES in size, or an error in words. */
export async function shrinkPhoto(file: File): Promise<{ ok: true; photo: File } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) return { ok: false, error: "Choose a photo (JPEG, PNG or WebP)." };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: "This photo could not be opened. Take it again." };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return { ok: false, error: "This phone cannot prepare the photo." };
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await encode(canvas, quality);
    if (blob && blob.size <= MAX_BYTES) {
      const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;
      return { ok: true, photo: new File([blob], name, { type: "image/jpeg" }) };
    }
  }
  return { ok: false, error: "This photo is too large to send. Take it again from further away." };
}

/** One upload's key, minted once per photo taken and reused if the same photo is sent again. */
export function attemptToken(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
