/**
 * The five desks as a GUEST meets them: a mark to recognise, and a first line.
 *
 * `lib/order-store.ts` already owns the department vocabulary — the labels, the
 * blurbs and the invented leads — and this file deliberately does not restate
 * any of it. What lives here is the part that is purely about the inbox screens:
 * which glyph stands for a desk, and what a guest might plausibly open with.
 *
 * WHY OPENERS EXIST. A chat screen with an empty composer asks the guest to
 * compose the first message of a conversation with a stranger, in a hotel, in
 * their second or third language. Every messaging product that matters offers a
 * first line instead, and in a DEMO the reason is sharper still: a presenter
 * with thirty seconds cannot type "Could housekeeping bring two more towels" on
 * a laptop trackpad and keep the room's attention. Tapping one is a real send
 * through `sendGuestMessage`, not a canned transcript.
 *
 * The wording is Rwandan hospitality, not generic filler: an airport run at six
 * in the morning, a room skipped because the guest is working in it, a power cut
 * the generator should have caught. Nobody named in `DEPARTMENT_LEAD` exists.
 */

import type { Department } from "@/lib/order-store";

/**
 * The glyph for each desk.
 *
 * Chosen so the five are told apart at a glance in a 20px rail icon rather than
 * read: a bell for the front desk, folded linen for housekeeping, a cup for the
 * kitchen, a spanner for maintenance, a shield for security. They come from the
 * app's own `Icon` set, so an unknown key degrades to the help mark instead of
 * leaving a hole in the row.
 */
export const DEPARTMENT_ICON: Record<Department, string> = {
  front_desk: "bell",
  housekeeping: "shirt",
  kitchen: "coffee",
  maintenance: "wrench",
  security: "shield",
};

/**
 * Two things a guest might actually say to each desk, ready to send.
 *
 * Offered only until the guest has written in that thread. After that they are
 * clutter: somebody mid-conversation does not need an opener, and leaving the
 * chips up under a live exchange makes the screen read as a form rather than a
 * conversation.
 */
export const DEPARTMENT_OPENER: Record<Department, string[]> = {
  front_desk: [
    "Could the receptionist book me a taxi to the airport for 06:00 tomorrow?",
    "May I keep the room until 14:00 on the day I leave?",
  ],
  housekeeping: [
    "Could housekeeping bring two more towels and a spare blanket?",
    "Please skip my room today — I am working in it.",
  ],
  kitchen: [
    "Is the kitchen still serving? I would like to see the room service menu.",
    "One of us cannot eat peanuts. Please keep them off anything we order.",
  ],
  maintenance: [
    "The air conditioning in the room is running but not cooling.",
    "The safe will not accept a new code. Could someone come up?",
  ],
  security: [
    "My key card stopped opening the door about ten minutes ago.",
    "I left a jacket in the lobby this afternoon — has it been handed in?",
  ],
};

/**
 * Initials for a lead's avatar disc.
 *
 * Two letters from the two ends of the name, so "Jean-Claude Habimana" reads
 * JH rather than JC — the surname is what a guest is told at the desk. A single
 * word gives one letter rather than an empty disc.
 */
export function leadInitials(leadName: string): string {
  const parts = leadName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
