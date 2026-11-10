import { z } from "zod";
import { IsoDate } from "./booking";
import { RosterCard } from "./people";
import { Uuid } from "./primitives";

/**
 * Talent (058-talent): hiring and reviews.
 *
 * A VACANCY is a role the business is filling at a branch. A CANDIDATE applies to one and moves
 * applied → screening → interview → offer → hired, or is turned down with a reason; their details
 * are kept until `keepUntil` unless they join. Interviews are booked against a candidate and scored
 * one to five. A REVIEW CYCLE opens one review per person on staff, done by the person and by their
 * manager, with a rating.
 */

const Money = z.number().int().nonnegative();

export const VacancyStatus = z.enum(["open", "closed", "filled"]);
export type VacancyStatus = z.infer<typeof VacancyStatus>;
export const CandidateStage = z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"]);
export type CandidateStage = z.infer<typeof CandidateStage>;
export const InterviewStatus = z.enum(["scheduled", "done", "cancelled"]);
export type InterviewStatus = z.infer<typeof InterviewStatus>;

/**
 * Documents a business may ask an applicant for. Each role picks its own from this list, and may add
 * one the list lacks.
 */
export const CANDIDATE_DOCUMENTS = [
    "National ID or passport",
    "CV",
    "Certificates or diplomas",
    "Reference letter",
    "Criminal record certificate",
    "Medical certificate",
    "Food handler's certificate",
    "Passport photo",
    "Driving licence",
    "Work permit",
] as const;

const DocumentName = z.string().trim().min(2).max(80);

export const Vacancy = z.object({
    id: Uuid,
    title: z.string(),
    branchId: Uuid.nullable(),
    branchName: z.string().nullable(),
    openings: z.number().int(),
    wageFromRwf: Money.nullable(),
    wageToRwf: Money.nullable(),
    closesOn: IsoDate.nullable(),
    status: VacancyStatus,
    managerName: z.string().nullable(),
    note: z.string().nullable(),
    /** What an applicant is asked to send. */
    documents: z.array(z.string()),
    counts: z.object({
        applied: z.number().int(),
        active: z.number().int(),
        declined: z.number().int(),
        hired: z.number().int(),
    }),
    createdAt: z.string(),
});
export type Vacancy = z.infer<typeof Vacancy>;

export const CandidateScore = z.object({
    id: Uuid,
    what: z.string(),
    score: z.number().int().min(1).max(5),
    note: z.string().nullable(),
    byName: z.string().nullable(),
    createdAt: z.string(),
});
export type CandidateScore = z.infer<typeof CandidateScore>;

/** Who put a figure on the table in an offer's back and forth. */
export const OfferSide = z.enum(["business", "candidate"]);
export type OfferSide = z.infer<typeof OfferSide>;

/** One round of the salary talk: an offer from the business or what the candidate asks back. */
export const OfferRound = z.object({
    id: Uuid,
    side: OfferSide,
    amountRwf: Money,
    startsOn: IsoDate.nullable(),
    note: z.string().nullable(),
    byName: z.string().nullable(),
    createdAt: z.string(),
});
export type OfferRound = z.infer<typeof OfferRound>;

/** A file an applicant sent from their progress page. */
export const CandidateDocument = z.object({
    id: Uuid,
    name: z.string(),
    filename: z.string(),
    sizeBytes: z.number().int(),
    uploadedAt: z.string(),
    /** A five minute link to read it. */
    url: z.string(),
});
export type CandidateDocument = z.infer<typeof CandidateDocument>;

export const Candidate = z.object({
    id: Uuid,
    vacancyId: Uuid,
    vacancyTitle: z.string(),
    fullName: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    source: z.string(),
    stage: CandidateStage,
    note: z.string().nullable(),
    talentPool: z.boolean(),
    appliedOn: IsoDate,
    /** Their details are deleted after this day unless they join. */
    keepUntil: IsoDate,
    /** What they asked for when they applied. */
    expectedWageRwf: Money.nullable(),
    offerWageRwf: Money.nullable(),
    offerStartsOn: IsoDate.nullable(),
    /** The wage both sides agreed, once they have. */
    agreedWageRwf: Money.nullable(),
    rejectReason: z.string().nullable(),
    hiredEmployeeId: Uuid.nullable(),
    scores: z.array(CandidateScore),
    /** The salary talk, oldest first. */
    rounds: z.array(OfferRound),
    /** What they sent from their progress page. */
    documents: z.array(CandidateDocument),
    /** Their private progress page, to share another way than email. */
    applicationLink: z.string().nullable(),
    updatedAt: z.string(),
});
export type Candidate = z.infer<typeof Candidate>;

export const Interview = z.object({
    id: Uuid,
    candidateId: Uuid,
    candidateName: z.string(),
    vacancyTitle: z.string(),
    startsAt: z.string(),
    place: z.string().nullable(),
    interviewerName: z.string().nullable(),
    status: InterviewStatus,
});
export type Interview = z.infer<typeof Interview>;

/** `GET /ops/talent`: the open hiring at a glance. */
export const TalentBoard = z.object({
    vacancies: z.array(Vacancy),
    candidates: z.array(Candidate),
    interviews: z.array(Interview),
});
export type TalentBoard = z.infer<typeof TalentBoard>;

/** `POST /ops/vacancies`. */
export const CreateVacancyRequest = z
    .object({
    title: z.string().trim().min(2, "Name the role.").max(80),
    branchId: Uuid.nullable().optional(),
    openings: z.number().int().min(1).max(50).optional(),
    wageFromRwf: Money.nullable().optional(),
    wageToRwf: Money.nullable().optional(),
    closesOn: IsoDate.nullable().optional(),
    managerEmployeeId: Uuid.nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
    documents: z.array(DocumentName).max(15).optional(),
})
    .refine((b) => !b.wageFromRwf || !b.wageToRwf || b.wageToRwf >= b.wageFromRwf, {
    message: "The top of the band is above its bottom.",
    path: ["wageToRwf"],
});
export type CreateVacancyRequest = z.infer<typeof CreateVacancyRequest>;

/** `PATCH /ops/vacancies/:id`: close it, mark it filled, or move its closing day. */
export const UpdateVacancyRequest = z
    .object({
    status: VacancyStatus,
    closesOn: IsoDate.nullable(),
    note: z.string().trim().max(500).nullable(),
    documents: z.array(DocumentName).max(15),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateVacancyRequest = z.infer<typeof UpdateVacancyRequest>;

/** `POST /ops/candidates`. */
export const CreateCandidateRequest = z.object({
    vacancyId: Uuid,
    fullName: z.string().trim().min(2, "Write their name.").max(120),
    phone: z.string().trim().max(30).nullable().optional(),
    email: z.string().trim().email("That is not an email address.").max(160).nullable().optional(),
    source: z.string().trim().min(2).max(60),
    note: z.string().trim().max(500).nullable().optional(),
    /** They agreed to be kept for other roles too. */
    talentPool: z.boolean().optional(),
    /** The wage they ask for. */
    expectedWageRwf: Money.nullable().optional(),
});
export type CreateCandidateRequest = z.infer<typeof CreateCandidateRequest>;

/** `POST /ops/candidates/:id/stage`: the next step, an offer's terms, or a turn-down's reason. */
export const MoveCandidateRequest = z
    .object({
    stage: CandidateStage,
    offerWageRwf: Money.optional(),
    offerStartsOn: IsoDate.optional(),
    reason: z.string().trim().min(3).max(300).optional(),
    hiredEmployeeId: Uuid.optional(),
})
    .refine((b) => b.stage !== "rejected" || !!b.reason, { message: "Say why, for the candidate.", path: ["reason"] })
    .refine((b) => b.stage !== "offer" || (b.offerWageRwf !== undefined && !!b.offerStartsOn), {
    message: "An offer names the wage and the first day.",
    path: ["offerWageRwf"],
});
export type MoveCandidateRequest = z.infer<typeof MoveCandidateRequest>;

/** `POST /ops/candidates/:id/offer-rounds`: the business offers again, or the candidate asks back. */
export const AddOfferRoundRequest = z.object({
    side: OfferSide,
    amountRwf: Money.refine((n) => n > 0, "Name an amount."),
    startsOn: IsoDate.nullable().optional(),
    note: z.string().trim().max(300).nullable().optional(),
});
export type AddOfferRoundRequest = z.infer<typeof AddOfferRoundRequest>;

/** `POST /ops/candidates/:id/offer/agree`: both sides settled on this wage. */
export const AgreeOfferRequest = z.object({
    amountRwf: Money.refine((n) => n > 0, "Name an amount."),
    startsOn: IsoDate.nullable().optional(),
});
export type AgreeOfferRequest = z.infer<typeof AgreeOfferRequest>;

/** `POST /ops/candidates/:id/scores`. */
export const ScoreCandidateRequest = z.object({
    what: z.string().trim().min(2).max(60),
    score: z.number().int().min(1).max(5),
    note: z.string().trim().max(300).nullable().optional(),
});
export type ScoreCandidateRequest = z.infer<typeof ScoreCandidateRequest>;

/** `POST /ops/interviews`. */
export const CreateInterviewRequest = z.object({
    candidateId: Uuid,
    startsAt: z.string().datetime({ offset: true }),
    place: z.string().trim().max(120).nullable().optional(),
    interviewerName: z.string().trim().max(120).nullable().optional(),
});
export type CreateInterviewRequest = z.infer<typeof CreateInterviewRequest>;

/** `POST /ops/interviews/:id/status`. */
export const SetInterviewStatusRequest = z.object({ status: InterviewStatus });
export type SetInterviewStatusRequest = z.infer<typeof SetInterviewStatusRequest>;

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const Review = z.object({
    id: Uuid,
    employee: RosterCard,
    selfDone: z.boolean(),
    managerDone: z.boolean(),
    rating: z.number().int().min(1).max(5).nullable(),
    note: z.string().nullable(),
});
export type Review = z.infer<typeof Review>;

export const ReviewCycle = z.object({
    id: Uuid,
    name: z.string(),
    startsOn: IsoDate,
    endsOn: IsoDate,
    status: z.enum(["open", "closed"]),
    reviews: z.array(Review),
});
export type ReviewCycle = z.infer<typeof ReviewCycle>;
export const CurrentReviewCycle = z.object({ cycle: ReviewCycle.nullable() });
export type CurrentReviewCycle = z.infer<typeof CurrentReviewCycle>;

/** `POST /ops/review-cycles`: one review for each person on staff. */
export const CreateReviewCycleRequest = z
    .object({ name: z.string().trim().min(2).max(60), startsOn: IsoDate, endsOn: IsoDate })
    .refine((b) => b.endsOn >= b.startsOn, { message: "It ends after it starts.", path: ["endsOn"] });
export type CreateReviewCycleRequest = z.infer<typeof CreateReviewCycleRequest>;

/** `PATCH /ops/reviews/:id`. */
export const UpdateReviewRequest = z
    .object({
    selfDone: z.boolean(),
    managerDone: z.boolean(),
    rating: z.number().int().min(1).max(5).nullable(),
    note: z.string().trim().max(1000).nullable(),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateReviewRequest = z.infer<typeof UpdateReviewRequest>;

/** One of a person's own reviews (`GET /me/work/:employeeId/reviews`). `note` is what they wrote. */
export const MyReview = z.object({
    id: Uuid,
    cycleName: z.string(),
    startsOn: IsoDate,
    endsOn: IsoDate,
    cycleOpen: z.boolean(),
    selfDone: z.boolean(),
    managerDone: z.boolean(),
    rating: z.number().int().min(1).max(5).nullable(),
    note: z.string().nullable(),
});
export type MyReview = z.infer<typeof MyReview>;
export const MyReviewList = z.object({ reviews: z.array(MyReview) });
export type MyReviewList = z.infer<typeof MyReviewList>;

/** `POST /me/work/:employeeId/reviews/:id/self`: the person's own words on their period. */
export const SendSelfReviewRequest = z.object({
    note: z.string().trim().min(3, "Write a few words.").max(1000),
});
export type SendSelfReviewRequest = z.infer<typeof SendSelfReviewRequest>;

// ── The applicant's own progress page, public, behind a code sent to their email ──

/** `POST /applications/:token/code`: a code went to this (masked) address. */
export const ApplicationCodeSent = z.object({ sentTo: z.string() });
export type ApplicationCodeSent = z.infer<typeof ApplicationCodeSent>;

/** `POST /applications/:token/verify`. */
export const VerifyApplicationCodeRequest = z.object({ code: z.string().trim().regex(/^\d{6}$/, "The code is six digits.") });
export type VerifyApplicationCodeRequest = z.infer<typeof VerifyApplicationCodeRequest>;

/** The page's session, sent back as `x-application-session`. */
export const ApplicationSession = z.object({ session: z.string(), expiresAt: z.string() });
export type ApplicationSession = z.infer<typeof ApplicationSession>;

/** `GET /applications/:token`: what an applicant sees of their own application. */
export const ApplicationView = z.object({
    firstName: z.string(),
    role: z.string(),
    business: z.string(),
    branch: z.string().nullable(),
    stage: CandidateStage,
    appliedOn: IsoDate,
    interview: z
        .object({ startsAt: z.string(), place: z.string().nullable(), interviewerName: z.string().nullable() })
        .nullable(),
    documents: z.array(z.object({ name: z.string(), filename: z.string().nullable(), uploadedAt: z.string().nullable() })),
    offer: z
        .object({
        amountRwf: Money,
        startsOn: IsoDate.nullable(),
        agreedRwf: Money.nullable(),
        rounds: z.array(z.object({ side: OfferSide, amountRwf: Money, note: z.string().nullable(), createdAt: z.string() })),
        /** Their turn: the last figure is the business's and nothing is agreed. */
        canRespond: z.boolean(),
    })
        .nullable(),
    /** Why, when they were turned down. */
    closedReason: z.string().nullable(),
});
export type ApplicationView = z.infer<typeof ApplicationView>;

/** `POST /applications/:token/offer`: take the offer, or ask for another figure. */
export const RespondToOfferRequest = z.union([
    z.object({ accept: z.literal(true) }),
    z.object({
        askRwf: Money.refine((n) => n > 0, "Name an amount."),
        note: z.string().trim().max(300).nullable().optional(),
    }),
]);
export type RespondToOfferRequest = z.infer<typeof RespondToOfferRequest>;
