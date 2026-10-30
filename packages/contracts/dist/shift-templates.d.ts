import { z } from "zod";
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
export declare const UpdateShiftTemplateRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    startsAt: z.ZodOptional<z.ZodString>;
    endsAt: z.ZodOptional<z.ZodString>;
    breakMinutes: z.ZodOptional<z.ZodNumber>;
    minWorkMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    autoClockOutMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
    breakMinutes?: number | undefined;
    minWorkMinutes?: number | null | undefined;
    autoClockOutMinutes?: number | null | undefined;
}, {
    name?: string | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
    breakMinutes?: number | undefined;
    minWorkMinutes?: number | null | undefined;
    autoClockOutMinutes?: number | null | undefined;
}>, {
    name?: string | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
    breakMinutes?: number | undefined;
    minWorkMinutes?: number | null | undefined;
    autoClockOutMinutes?: number | null | undefined;
}, {
    name?: string | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
    breakMinutes?: number | undefined;
    minWorkMinutes?: number | null | undefined;
    autoClockOutMinutes?: number | null | undefined;
}>;
export type UpdateShiftTemplateRequest = z.infer<typeof UpdateShiftTemplateRequest>;
//# sourceMappingURL=shift-templates.d.ts.map