import { z } from "zod";
import { TimeOfDay } from "./people";

/**
 * `PATCH /ops/shift-templates/:id` (ADR-058): change a shift's name, hours or
 * break.
 *
 * A shift could be added and never changed, so a hotel that moved its morning
 * shift half an hour earlier was left with two "Morning" shifts or a wrong
 * one. The branch and department stay as they were: a shift moved to another
 * branch is another shift.
 *
 * SHIFTS ALREADY ROSTERED KEEP THEIR HOURS. A roster entry holds the instants
 * it was given the day it was made, and people have read them on their phones;
 * new hours apply to what is rostered from then on.
 */
export const UpdateShiftTemplateRequest = z
  .object({
    name: z.string().trim().min(1, "Name the shift.").max(60),
    startsAt: TimeOfDay,
    endsAt: TimeOfDay,
    breakMinutes: z.number().int().min(0).max(720),
    minWorkMinutes: z.number().int().min(0).max(1440).nullable(),
    autoClockOutMinutes: z.number().int().min(0).max(720).nullable(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateShiftTemplateRequest = z.infer<typeof UpdateShiftTemplateRequest>;
