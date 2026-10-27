import { toast } from "@heroui/react";

/**
 * Shows the API's refusal as a toast, and answers whether the command went through. The app's PMS screens
 * keep their own copy until they move (stage 4); a product never imports another.
 */
export function reported(result: { ok: true } | { ok: false; error: string }): boolean {
  if (!result.ok) toast.danger(result.error);
  return result.ok;
}
