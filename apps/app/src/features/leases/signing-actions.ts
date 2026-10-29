"use server";

/**
 * What both signers share: storing the drawn signature (`POST /uploads`, kind `lease_signature`) before the
 * signature itself names it by key. The drawing is the signer's own: the API checks the uploader when the
 * lease is signed.
 */
import { currentApi } from "@/lib/session";
import { type ActionResult, runPerson } from "@/server/rentals/action-kit";

/** The most a drawn signature may weigh as a PNG data URL (the pad exports at twice its size). */
const MAX_DRAWING_BYTES = 1_500_000;

export async function uploadSignatureDrawing(dataUrl: string): Promise<ActionResult<{ objectKey: string }>> {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return { ok: false, error: "Draw your signature again, then sign." };
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DRAWING_BYTES) {
    return { ok: false, error: "Draw your signature again, then sign." };
  }
  const api = await currentApi();
  const form = new FormData();
  form.append("kind", "lease_signature");
  form.append("attemptToken", crypto.randomUUID());
  form.append("file", new Blob([bytes], { type: "image/png" }), "signature.png");
  return runPerson(async () => {
    const saved = await api.upload<{ objectKey: string }>("/api/v1/uploads", form);
    return { objectKey: saved.objectKey };
  });
}
