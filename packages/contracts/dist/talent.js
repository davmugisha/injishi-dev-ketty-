"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RespondToOfferRequest = exports.ApplicationView = exports.ApplicationSession = exports.VerifyApplicationCodeRequest = exports.ApplicationCodeSent = exports.SendSelfReviewRequest = exports.MyReviewList = exports.MyReview = exports.UpdateReviewRequest = exports.CreateReviewCycleRequest = exports.CurrentReviewCycle = exports.ReviewCycle = exports.Review = exports.SetInterviewStatusRequest = exports.CreateInterviewRequest = exports.ScoreCandidateRequest = exports.AgreeOfferRequest = exports.AddOfferRoundRequest = exports.MoveCandidateRequest = exports.CreateCandidateRequest = exports.UpdateVacancyRequest = exports.CreateVacancyRequest = exports.TalentBoard = exports.Interview = exports.Candidate = exports.CandidateDocument = exports.OfferRound = exports.OfferSide = exports.CandidateScore = exports.Vacancy = exports.CANDIDATE_DOCUMENTS = exports.InterviewStatus = exports.CandidateStage = exports.VacancyStatus = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const people_1 = require("./people");
const primitives_1 = require("./primitives");
/**
 * Talent (058-talent): hiring and reviews.
 *
 * A VACANCY is a role the business is filling at a branch. A CANDIDATE applies to one and moves
 * applied → screening → interview → offer → hired, or is turned down with a reason; their details
 * are kept until `keepUntil` unless they join. Interviews are booked against a candidate and scored
 * one to five. A REVIEW CYCLE opens one review per person on staff, done by the person and by their
 * manager, with a rating.
 */
const Money = zod_1.z.number().int().nonnegative();
exports.VacancyStatus = zod_1.z.enum(["open", "closed", "filled"]);
exports.CandidateStage = zod_1.z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"]);
exports.InterviewStatus = zod_1.z.enum(["scheduled", "done", "cancelled"]);
/**
 * Documents a business may ask an applicant for. Each role picks its own from this list, and may add
 * one the list lacks.
 */
exports.CANDIDATE_DOCUMENTS = [
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
];
const DocumentName = zod_1.z.string().trim().min(2).max(80);
exports.Vacancy = zod_1.z.object({
    id: primitives_1.Uuid,
    title: zod_1.z.string(),
    branchId: primitives_1.Uuid.nullable(),
    branchName: zod_1.z.string().nullable(),
    openings: zod_1.z.number().int(),
    wageFromRwf: Money.nullable(),
    wageToRwf: Money.nullable(),
    closesOn: booking_1.IsoDate.nullable(),
    status: exports.VacancyStatus,
    managerName: zod_1.z.string().nullable(),
    note: zod_1.z.string().nullable(),
    /** What an applicant is asked to send. */
    documents: zod_1.z.array(zod_1.z.string()),
    counts: zod_1.z.object({
        applied: zod_1.z.number().int(),
        active: zod_1.z.number().int(),
        declined: zod_1.z.number().int(),
        hired: zod_1.z.number().int(),
    }),
    createdAt: zod_1.z.string(),
});
exports.CandidateScore = zod_1.z.object({
    id: primitives_1.Uuid,
    what: zod_1.z.string(),
    score: zod_1.z.number().int().min(1).max(5),
    note: zod_1.z.string().nullable(),
    byName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/** Who put a figure on the table in an offer's back and forth. */
exports.OfferSide = zod_1.z.enum(["business", "candidate"]);
/** One round of the salary talk: an offer from the business or what the candidate asks back. */
exports.OfferRound = zod_1.z.object({
    id: primitives_1.Uuid,
    side: exports.OfferSide,
    amountRwf: Money,
    startsOn: booking_1.IsoDate.nullable(),
    note: zod_1.z.string().nullable(),
    byName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/** A file an applicant sent from their progress page. */
exports.CandidateDocument = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    filename: zod_1.z.string(),
    sizeBytes: zod_1.z.number().int(),
    uploadedAt: zod_1.z.string(),
    /** A five minute link to read it. */
    url: zod_1.z.string(),
});
exports.Candidate = zod_1.z.object({
    id: primitives_1.Uuid,
    vacancyId: primitives_1.Uuid,
    vacancyTitle: zod_1.z.string(),
    fullName: zod_1.z.string(),
    phone: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    source: zod_1.z.string(),
    stage: exports.CandidateStage,
    note: zod_1.z.string().nullable(),
    talentPool: zod_1.z.boolean(),
    appliedOn: booking_1.IsoDate,
    /** Their details are deleted after this day unless they join. */
    keepUntil: booking_1.IsoDate,
    /** What they asked for when they applied. */
    expectedWageRwf: Money.nullable(),
    offerWageRwf: Money.nullable(),
    offerStartsOn: booking_1.IsoDate.nullable(),
    /** The wage both sides agreed, once they have. */
    agreedWageRwf: Money.nullable(),
    rejectReason: zod_1.z.string().nullable(),
    hiredEmployeeId: primitives_1.Uuid.nullable(),
    scores: zod_1.z.array(exports.CandidateScore),
    /** The salary talk, oldest first. */
    rounds: zod_1.z.array(exports.OfferRound),
    /** What they sent from their progress page. */
    documents: zod_1.z.array(exports.CandidateDocument),
    /** Their private progress page, to share another way than email. */
    applicationLink: zod_1.z.string().nullable(),
    updatedAt: zod_1.z.string(),
});
exports.Interview = zod_1.z.object({
    id: primitives_1.Uuid,
    candidateId: primitives_1.Uuid,
    candidateName: zod_1.z.string(),
    vacancyTitle: zod_1.z.string(),
    startsAt: zod_1.z.string(),
    place: zod_1.z.string().nullable(),
    interviewerName: zod_1.z.string().nullable(),
    status: exports.InterviewStatus,
});
/** `GET /ops/talent`: the open hiring at a glance. */
exports.TalentBoard = zod_1.z.object({
    vacancies: zod_1.z.array(exports.Vacancy),
    candidates: zod_1.z.array(exports.Candidate),
    interviews: zod_1.z.array(exports.Interview),
});
/** `POST /ops/vacancies`. */
exports.CreateVacancyRequest = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(2, "Name the role.").max(80),
    branchId: primitives_1.Uuid.nullable().optional(),
    openings: zod_1.z.number().int().min(1).max(50).optional(),
    wageFromRwf: Money.nullable().optional(),
    wageToRwf: Money.nullable().optional(),
    closesOn: booking_1.IsoDate.nullable().optional(),
    managerEmployeeId: primitives_1.Uuid.nullable().optional(),
    note: zod_1.z.string().trim().max(500).nullable().optional(),
    documents: zod_1.z.array(DocumentName).max(15).optional(),
})
    .refine((b) => !b.wageFromRwf || !b.wageToRwf || b.wageToRwf >= b.wageFromRwf, {
    message: "The top of the band is above its bottom.",
    path: ["wageToRwf"],
});
/** `PATCH /ops/vacancies/:id`: close it, mark it filled, or move its closing day. */
exports.UpdateVacancyRequest = zod_1.z
    .object({
    status: exports.VacancyStatus,
    closesOn: booking_1.IsoDate.nullable(),
    note: zod_1.z.string().trim().max(500).nullable(),
    documents: zod_1.z.array(DocumentName).max(15),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
/** `POST /ops/candidates`. */
exports.CreateCandidateRequest = zod_1.z.object({
    vacancyId: primitives_1.Uuid,
    fullName: zod_1.z.string().trim().min(2, "Write their name.").max(120),
    phone: zod_1.z.string().trim().max(30).nullable().optional(),
    email: zod_1.z.string().trim().email("That is not an email address.").max(160).nullable().optional(),
    source: zod_1.z.string().trim().min(2).max(60),
    note: zod_1.z.string().trim().max(500).nullable().optional(),
    /** They agreed to be kept for other roles too. */
    talentPool: zod_1.z.boolean().optional(),
    /** The wage they ask for. */
    expectedWageRwf: Money.nullable().optional(),
});
/** `POST /ops/candidates/:id/stage`: the next step, an offer's terms, or a turn-down's reason. */
exports.MoveCandidateRequest = zod_1.z
    .object({
    stage: exports.CandidateStage,
    offerWageRwf: Money.optional(),
    offerStartsOn: booking_1.IsoDate.optional(),
    reason: zod_1.z.string().trim().min(3).max(300).optional(),
    hiredEmployeeId: primitives_1.Uuid.optional(),
})
    .refine((b) => b.stage !== "rejected" || !!b.reason, { message: "Say why, for the candidate.", path: ["reason"] })
    .refine((b) => b.stage !== "offer" || (b.offerWageRwf !== undefined && !!b.offerStartsOn), {
    message: "An offer names the wage and the first day.",
    path: ["offerWageRwf"],
});
/** `POST /ops/candidates/:id/offer-rounds`: the business offers again, or the candidate asks back. */
exports.AddOfferRoundRequest = zod_1.z.object({
    side: exports.OfferSide,
    amountRwf: Money.refine((n) => n > 0, "Name an amount."),
    startsOn: booking_1.IsoDate.nullable().optional(),
    note: zod_1.z.string().trim().max(300).nullable().optional(),
});
/** `POST /ops/candidates/:id/offer/agree`: both sides settled on this wage. */
exports.AgreeOfferRequest = zod_1.z.object({
    amountRwf: Money.refine((n) => n > 0, "Name an amount."),
    startsOn: booking_1.IsoDate.nullable().optional(),
});
/** `POST /ops/candidates/:id/scores`. */
exports.ScoreCandidateRequest = zod_1.z.object({
    what: zod_1.z.string().trim().min(2).max(60),
    score: zod_1.z.number().int().min(1).max(5),
    note: zod_1.z.string().trim().max(300).nullable().optional(),
});
/** `POST /ops/interviews`. */
exports.CreateInterviewRequest = zod_1.z.object({
    candidateId: primitives_1.Uuid,
    startsAt: zod_1.z.string().datetime({ offset: true }),
    place: zod_1.z.string().trim().max(120).nullable().optional(),
    interviewerName: zod_1.z.string().trim().max(120).nullable().optional(),
});
/** `POST /ops/interviews/:id/status`. */
exports.SetInterviewStatusRequest = zod_1.z.object({ status: exports.InterviewStatus });
// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
exports.Review = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: people_1.RosterCard,
    selfDone: zod_1.z.boolean(),
    managerDone: zod_1.z.boolean(),
    rating: zod_1.z.number().int().min(1).max(5).nullable(),
    note: zod_1.z.string().nullable(),
});
exports.ReviewCycle = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    startsOn: booking_1.IsoDate,
    endsOn: booking_1.IsoDate,
    status: zod_1.z.enum(["open", "closed"]),
    reviews: zod_1.z.array(exports.Review),
});
exports.CurrentReviewCycle = zod_1.z.object({ cycle: exports.ReviewCycle.nullable() });
/** `POST /ops/review-cycles`: one review for each person on staff. */
exports.CreateReviewCycleRequest = zod_1.z
    .object({ name: zod_1.z.string().trim().min(2).max(60), startsOn: booking_1.IsoDate, endsOn: booking_1.IsoDate })
    .refine((b) => b.endsOn >= b.startsOn, { message: "It ends after it starts.", path: ["endsOn"] });
/** `PATCH /ops/reviews/:id`. */
exports.UpdateReviewRequest = zod_1.z
    .object({
    selfDone: zod_1.z.boolean(),
    managerDone: zod_1.z.boolean(),
    rating: zod_1.z.number().int().min(1).max(5).nullable(),
    note: zod_1.z.string().trim().max(1000).nullable(),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
/** One of a person's own reviews (`GET /me/work/:employeeId/reviews`). `note` is what they wrote. */
exports.MyReview = zod_1.z.object({
    id: primitives_1.Uuid,
    cycleName: zod_1.z.string(),
    startsOn: booking_1.IsoDate,
    endsOn: booking_1.IsoDate,
    cycleOpen: zod_1.z.boolean(),
    selfDone: zod_1.z.boolean(),
    managerDone: zod_1.z.boolean(),
    rating: zod_1.z.number().int().min(1).max(5).nullable(),
    note: zod_1.z.string().nullable(),
});
exports.MyReviewList = zod_1.z.object({ reviews: zod_1.z.array(exports.MyReview) });
/** `POST /me/work/:employeeId/reviews/:id/self`: the person's own words on their period. */
exports.SendSelfReviewRequest = zod_1.z.object({
    note: zod_1.z.string().trim().min(3, "Write a few words.").max(1000),
});
// ── The applicant's own progress page, public, behind a code sent to their email ──
/** `POST /applications/:token/code`: a code went to this (masked) address. */
exports.ApplicationCodeSent = zod_1.z.object({ sentTo: zod_1.z.string() });
/** `POST /applications/:token/verify`. */
exports.VerifyApplicationCodeRequest = zod_1.z.object({ code: zod_1.z.string().trim().regex(/^\d{6}$/, "The code is six digits.") });
/** The page's session, sent back as `x-application-session`. */
exports.ApplicationSession = zod_1.z.object({ session: zod_1.z.string(), expiresAt: zod_1.z.string() });
/** `GET /applications/:token`: what an applicant sees of their own application. */
exports.ApplicationView = zod_1.z.object({
    firstName: zod_1.z.string(),
    role: zod_1.z.string(),
    business: zod_1.z.string(),
    branch: zod_1.z.string().nullable(),
    stage: exports.CandidateStage,
    appliedOn: booking_1.IsoDate,
    interview: zod_1.z
        .object({ startsAt: zod_1.z.string(), place: zod_1.z.string().nullable(), interviewerName: zod_1.z.string().nullable() })
        .nullable(),
    documents: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), filename: zod_1.z.string().nullable(), uploadedAt: zod_1.z.string().nullable() })),
    offer: zod_1.z
        .object({
        amountRwf: Money,
        startsOn: booking_1.IsoDate.nullable(),
        agreedRwf: Money.nullable(),
        rounds: zod_1.z.array(zod_1.z.object({ side: exports.OfferSide, amountRwf: Money, note: zod_1.z.string().nullable(), createdAt: zod_1.z.string() })),
        /** Their turn: the last figure is the business's and nothing is agreed. */
        canRespond: zod_1.z.boolean(),
    })
        .nullable(),
    /** Why, when they were turned down. */
    closedReason: zod_1.z.string().nullable(),
});
/** `POST /applications/:token/offer`: take the offer, or ask for another figure. */
exports.RespondToOfferRequest = zod_1.z.union([
    zod_1.z.object({ accept: zod_1.z.literal(true) }),
    zod_1.z.object({
        askRwf: Money.refine((n) => n > 0, "Name an amount."),
        note: zod_1.z.string().trim().max(300).nullable().optional(),
    }),
]);
//# sourceMappingURL=talent.js.map