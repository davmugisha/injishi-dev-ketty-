import { normalisePhone } from "@injishi/ui";
import type { CustomerInput } from "@/server/pos";

/**
 * The rules of the customer form, kept apart from its markup so they can be tested without a browser. The phone is
 * checked by the same rule the API applies (a Rwandan mobile however it is spaced, or another country's number with
 * its + code), so the person sees the stored form before they save; the API still decides.
 */
export interface CustomerForm {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  marketingConsent: boolean;
}

export const emptyCustomerForm: CustomerForm = {
  fullName: "",
  phone: "",
  email: "",
  notes: "",
  marketingConsent: false,
};

/** The phone as it will be stored, or null while what is typed is not a number. */
export const storedPhone = (raw: string): string | null => normalisePhone(raw, { allowInternational: true });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The first thing wrong with the form, as a sentence, or null when it can be saved. */
export function customerFormProblem(f: CustomerForm): string | null {
  if (f.fullName.trim().length < 2) return "Type the customer's name.";
  if (!storedPhone(f.phone)) {
    return "Enter a Rwandan mobile like 0788 123 456, or a number from another country starting with +.";
  }
  if (f.email.trim() && !EMAIL.test(f.email.trim())) return "Enter a valid email address, like name@example.com.";
  if (f.notes.length > 500) return "Keep the note under 500 characters.";
  return null;
}

/** What is sent to the API: trimmed, with a blank email or note as `null`. The API normalises the phone again. */
export function customerPayload(f: CustomerForm): CustomerInput {
  return {
    fullName: f.fullName.trim(),
    phone: f.phone.trim(),
    email: f.email.trim() || null,
    marketingConsent: f.marketingConsent,
    notes: f.notes.trim() || null,
  };
}
