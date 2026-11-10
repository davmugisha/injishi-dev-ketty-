import { z } from "zod";
export declare const VacancyStatus: z.ZodEnum<["open", "closed", "filled"]>;
export type VacancyStatus = z.infer<typeof VacancyStatus>;
export declare const CandidateStage: z.ZodEnum<["applied", "screening", "interview", "offer", "hired", "rejected"]>;
export type CandidateStage = z.infer<typeof CandidateStage>;
export declare const InterviewStatus: z.ZodEnum<["scheduled", "done", "cancelled"]>;
export type InterviewStatus = z.infer<typeof InterviewStatus>;
/**
 * Documents a business may ask an applicant for. Each role picks its own from this list, and may add
 * one the list lacks.
 */
export declare const CANDIDATE_DOCUMENTS: readonly ["National ID or passport", "CV", "Certificates or diplomas", "Reference letter", "Criminal record certificate", "Medical certificate", "Food handler's certificate", "Passport photo", "Driving licence", "Work permit"];
export declare const Vacancy: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    branchId: z.ZodNullable<z.ZodString>;
    branchName: z.ZodNullable<z.ZodString>;
    openings: z.ZodNumber;
    wageFromRwf: z.ZodNullable<z.ZodNumber>;
    wageToRwf: z.ZodNullable<z.ZodNumber>;
    closesOn: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["open", "closed", "filled"]>;
    managerName: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    /** What an applicant is asked to send. */
    documents: z.ZodArray<z.ZodString, "many">;
    counts: z.ZodObject<{
        applied: z.ZodNumber;
        active: z.ZodNumber;
        declined: z.ZodNumber;
        hired: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        active: number;
        declined: number;
        applied: number;
        hired: number;
    }, {
        active: number;
        declined: number;
        applied: number;
        hired: number;
    }>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "open" | "closed" | "filled";
    id: string;
    documents: string[];
    note: string | null;
    counts: {
        active: number;
        declined: number;
        applied: number;
        hired: number;
    };
    title: string;
    createdAt: string;
    branchId: string | null;
    branchName: string | null;
    openings: number;
    wageFromRwf: number | null;
    wageToRwf: number | null;
    closesOn: string | null;
    managerName: string | null;
}, {
    status: "open" | "closed" | "filled";
    id: string;
    documents: string[];
    note: string | null;
    counts: {
        active: number;
        declined: number;
        applied: number;
        hired: number;
    };
    title: string;
    createdAt: string;
    branchId: string | null;
    branchName: string | null;
    openings: number;
    wageFromRwf: number | null;
    wageToRwf: number | null;
    closesOn: string | null;
    managerName: string | null;
}>;
export type Vacancy = z.infer<typeof Vacancy>;
export declare const CandidateScore: z.ZodObject<{
    id: z.ZodString;
    what: z.ZodString;
    score: z.ZodNumber;
    note: z.ZodNullable<z.ZodString>;
    byName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    note: string | null;
    createdAt: string;
    byName: string | null;
    what: string;
    score: number;
}, {
    id: string;
    note: string | null;
    createdAt: string;
    byName: string | null;
    what: string;
    score: number;
}>;
export type CandidateScore = z.infer<typeof CandidateScore>;
/** Who put a figure on the table in an offer's back and forth. */
export declare const OfferSide: z.ZodEnum<["business", "candidate"]>;
export type OfferSide = z.infer<typeof OfferSide>;
/** One round of the salary talk: an offer from the business or what the candidate asks back. */
export declare const OfferRound: z.ZodObject<{
    id: z.ZodString;
    side: z.ZodEnum<["business", "candidate"]>;
    amountRwf: z.ZodNumber;
    startsOn: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    byName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    amountRwf: number;
    startsOn: string | null;
    note: string | null;
    createdAt: string;
    side: "business" | "candidate";
    byName: string | null;
}, {
    id: string;
    amountRwf: number;
    startsOn: string | null;
    note: string | null;
    createdAt: string;
    side: "business" | "candidate";
    byName: string | null;
}>;
export type OfferRound = z.infer<typeof OfferRound>;
/** A file an applicant sent from their progress page. */
export declare const CandidateDocument: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    filename: z.ZodString;
    sizeBytes: z.ZodNumber;
    uploadedAt: z.ZodString;
    /** A five minute link to read it. */
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    sizeBytes: number;
    url: string;
    filename: string;
    uploadedAt: string;
}, {
    name: string;
    id: string;
    sizeBytes: number;
    url: string;
    filename: string;
    uploadedAt: string;
}>;
export type CandidateDocument = z.infer<typeof CandidateDocument>;
export declare const Candidate: z.ZodObject<{
    id: z.ZodString;
    vacancyId: z.ZodString;
    vacancyTitle: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    source: z.ZodString;
    stage: z.ZodEnum<["applied", "screening", "interview", "offer", "hired", "rejected"]>;
    note: z.ZodNullable<z.ZodString>;
    talentPool: z.ZodBoolean;
    appliedOn: z.ZodString;
    /** Their details are deleted after this day unless they join. */
    keepUntil: z.ZodString;
    /** What they asked for when they applied. */
    expectedWageRwf: z.ZodNullable<z.ZodNumber>;
    offerWageRwf: z.ZodNullable<z.ZodNumber>;
    offerStartsOn: z.ZodNullable<z.ZodString>;
    /** The wage both sides agreed, once they have. */
    agreedWageRwf: z.ZodNullable<z.ZodNumber>;
    rejectReason: z.ZodNullable<z.ZodString>;
    hiredEmployeeId: z.ZodNullable<z.ZodString>;
    scores: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        what: z.ZodString;
        score: z.ZodNumber;
        note: z.ZodNullable<z.ZodString>;
        byName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        note: string | null;
        createdAt: string;
        byName: string | null;
        what: string;
        score: number;
    }, {
        id: string;
        note: string | null;
        createdAt: string;
        byName: string | null;
        what: string;
        score: number;
    }>, "many">;
    /** The salary talk, oldest first. */
    rounds: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        side: z.ZodEnum<["business", "candidate"]>;
        amountRwf: z.ZodNumber;
        startsOn: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        byName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        amountRwf: number;
        startsOn: string | null;
        note: string | null;
        createdAt: string;
        side: "business" | "candidate";
        byName: string | null;
    }, {
        id: string;
        amountRwf: number;
        startsOn: string | null;
        note: string | null;
        createdAt: string;
        side: "business" | "candidate";
        byName: string | null;
    }>, "many">;
    /** What they sent from their progress page. */
    documents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        filename: z.ZodString;
        sizeBytes: z.ZodNumber;
        uploadedAt: z.ZodString;
        /** A five minute link to read it. */
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        sizeBytes: number;
        url: string;
        filename: string;
        uploadedAt: string;
    }, {
        name: string;
        id: string;
        sizeBytes: number;
        url: string;
        filename: string;
        uploadedAt: string;
    }>, "many">;
    /** Their private progress page, to share another way than email. */
    applicationLink: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    fullName: string;
    email: string | null;
    documents: {
        name: string;
        id: string;
        sizeBytes: number;
        url: string;
        filename: string;
        uploadedAt: string;
    }[];
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    source: string;
    note: string | null;
    phone: string | null;
    updatedAt: string;
    rejectReason: string | null;
    vacancyId: string;
    vacancyTitle: string;
    talentPool: boolean;
    appliedOn: string;
    keepUntil: string;
    expectedWageRwf: number | null;
    offerWageRwf: number | null;
    offerStartsOn: string | null;
    agreedWageRwf: number | null;
    hiredEmployeeId: string | null;
    scores: {
        id: string;
        note: string | null;
        createdAt: string;
        byName: string | null;
        what: string;
        score: number;
    }[];
    rounds: {
        id: string;
        amountRwf: number;
        startsOn: string | null;
        note: string | null;
        createdAt: string;
        side: "business" | "candidate";
        byName: string | null;
    }[];
    applicationLink: string | null;
}, {
    id: string;
    fullName: string;
    email: string | null;
    documents: {
        name: string;
        id: string;
        sizeBytes: number;
        url: string;
        filename: string;
        uploadedAt: string;
    }[];
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    source: string;
    note: string | null;
    phone: string | null;
    updatedAt: string;
    rejectReason: string | null;
    vacancyId: string;
    vacancyTitle: string;
    talentPool: boolean;
    appliedOn: string;
    keepUntil: string;
    expectedWageRwf: number | null;
    offerWageRwf: number | null;
    offerStartsOn: string | null;
    agreedWageRwf: number | null;
    hiredEmployeeId: string | null;
    scores: {
        id: string;
        note: string | null;
        createdAt: string;
        byName: string | null;
        what: string;
        score: number;
    }[];
    rounds: {
        id: string;
        amountRwf: number;
        startsOn: string | null;
        note: string | null;
        createdAt: string;
        side: "business" | "candidate";
        byName: string | null;
    }[];
    applicationLink: string | null;
}>;
export type Candidate = z.infer<typeof Candidate>;
export declare const Interview: z.ZodObject<{
    id: z.ZodString;
    candidateId: z.ZodString;
    candidateName: z.ZodString;
    vacancyTitle: z.ZodString;
    startsAt: z.ZodString;
    place: z.ZodNullable<z.ZodString>;
    interviewerName: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["scheduled", "done", "cancelled"]>;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "scheduled" | "done";
    id: string;
    startsAt: string;
    place: string | null;
    vacancyTitle: string;
    candidateId: string;
    candidateName: string;
    interviewerName: string | null;
}, {
    status: "cancelled" | "scheduled" | "done";
    id: string;
    startsAt: string;
    place: string | null;
    vacancyTitle: string;
    candidateId: string;
    candidateName: string;
    interviewerName: string | null;
}>;
export type Interview = z.infer<typeof Interview>;
/** `GET /ops/talent`: the open hiring at a glance. */
export declare const TalentBoard: z.ZodObject<{
    vacancies: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        branchId: z.ZodNullable<z.ZodString>;
        branchName: z.ZodNullable<z.ZodString>;
        openings: z.ZodNumber;
        wageFromRwf: z.ZodNullable<z.ZodNumber>;
        wageToRwf: z.ZodNullable<z.ZodNumber>;
        closesOn: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["open", "closed", "filled"]>;
        managerName: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        /** What an applicant is asked to send. */
        documents: z.ZodArray<z.ZodString, "many">;
        counts: z.ZodObject<{
            applied: z.ZodNumber;
            active: z.ZodNumber;
            declined: z.ZodNumber;
            hired: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            active: number;
            declined: number;
            applied: number;
            hired: number;
        }, {
            active: number;
            declined: number;
            applied: number;
            hired: number;
        }>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "closed" | "filled";
        id: string;
        documents: string[];
        note: string | null;
        counts: {
            active: number;
            declined: number;
            applied: number;
            hired: number;
        };
        title: string;
        createdAt: string;
        branchId: string | null;
        branchName: string | null;
        openings: number;
        wageFromRwf: number | null;
        wageToRwf: number | null;
        closesOn: string | null;
        managerName: string | null;
    }, {
        status: "open" | "closed" | "filled";
        id: string;
        documents: string[];
        note: string | null;
        counts: {
            active: number;
            declined: number;
            applied: number;
            hired: number;
        };
        title: string;
        createdAt: string;
        branchId: string | null;
        branchName: string | null;
        openings: number;
        wageFromRwf: number | null;
        wageToRwf: number | null;
        closesOn: string | null;
        managerName: string | null;
    }>, "many">;
    candidates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        vacancyId: z.ZodString;
        vacancyTitle: z.ZodString;
        fullName: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        source: z.ZodString;
        stage: z.ZodEnum<["applied", "screening", "interview", "offer", "hired", "rejected"]>;
        note: z.ZodNullable<z.ZodString>;
        talentPool: z.ZodBoolean;
        appliedOn: z.ZodString;
        /** Their details are deleted after this day unless they join. */
        keepUntil: z.ZodString;
        /** What they asked for when they applied. */
        expectedWageRwf: z.ZodNullable<z.ZodNumber>;
        offerWageRwf: z.ZodNullable<z.ZodNumber>;
        offerStartsOn: z.ZodNullable<z.ZodString>;
        /** The wage both sides agreed, once they have. */
        agreedWageRwf: z.ZodNullable<z.ZodNumber>;
        rejectReason: z.ZodNullable<z.ZodString>;
        hiredEmployeeId: z.ZodNullable<z.ZodString>;
        scores: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            what: z.ZodString;
            score: z.ZodNumber;
            note: z.ZodNullable<z.ZodString>;
            byName: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            note: string | null;
            createdAt: string;
            byName: string | null;
            what: string;
            score: number;
        }, {
            id: string;
            note: string | null;
            createdAt: string;
            byName: string | null;
            what: string;
            score: number;
        }>, "many">;
        /** The salary talk, oldest first. */
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            side: z.ZodEnum<["business", "candidate"]>;
            amountRwf: z.ZodNumber;
            startsOn: z.ZodNullable<z.ZodString>;
            note: z.ZodNullable<z.ZodString>;
            byName: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            amountRwf: number;
            startsOn: string | null;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
            byName: string | null;
        }, {
            id: string;
            amountRwf: number;
            startsOn: string | null;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
            byName: string | null;
        }>, "many">;
        /** What they sent from their progress page. */
        documents: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            filename: z.ZodString;
            sizeBytes: z.ZodNumber;
            uploadedAt: z.ZodString;
            /** A five minute link to read it. */
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            sizeBytes: number;
            url: string;
            filename: string;
            uploadedAt: string;
        }, {
            name: string;
            id: string;
            sizeBytes: number;
            url: string;
            filename: string;
            uploadedAt: string;
        }>, "many">;
        /** Their private progress page, to share another way than email. */
        applicationLink: z.ZodNullable<z.ZodString>;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
        email: string | null;
        documents: {
            name: string;
            id: string;
            sizeBytes: number;
            url: string;
            filename: string;
            uploadedAt: string;
        }[];
        stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
        source: string;
        note: string | null;
        phone: string | null;
        updatedAt: string;
        rejectReason: string | null;
        vacancyId: string;
        vacancyTitle: string;
        talentPool: boolean;
        appliedOn: string;
        keepUntil: string;
        expectedWageRwf: number | null;
        offerWageRwf: number | null;
        offerStartsOn: string | null;
        agreedWageRwf: number | null;
        hiredEmployeeId: string | null;
        scores: {
            id: string;
            note: string | null;
            createdAt: string;
            byName: string | null;
            what: string;
            score: number;
        }[];
        rounds: {
            id: string;
            amountRwf: number;
            startsOn: string | null;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
            byName: string | null;
        }[];
        applicationLink: string | null;
    }, {
        id: string;
        fullName: string;
        email: string | null;
        documents: {
            name: string;
            id: string;
            sizeBytes: number;
            url: string;
            filename: string;
            uploadedAt: string;
        }[];
        stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
        source: string;
        note: string | null;
        phone: string | null;
        updatedAt: string;
        rejectReason: string | null;
        vacancyId: string;
        vacancyTitle: string;
        talentPool: boolean;
        appliedOn: string;
        keepUntil: string;
        expectedWageRwf: number | null;
        offerWageRwf: number | null;
        offerStartsOn: string | null;
        agreedWageRwf: number | null;
        hiredEmployeeId: string | null;
        scores: {
            id: string;
            note: string | null;
            createdAt: string;
            byName: string | null;
            what: string;
            score: number;
        }[];
        rounds: {
            id: string;
            amountRwf: number;
            startsOn: string | null;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
            byName: string | null;
        }[];
        applicationLink: string | null;
    }>, "many">;
    interviews: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        candidateId: z.ZodString;
        candidateName: z.ZodString;
        vacancyTitle: z.ZodString;
        startsAt: z.ZodString;
        place: z.ZodNullable<z.ZodString>;
        interviewerName: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["scheduled", "done", "cancelled"]>;
    }, "strip", z.ZodTypeAny, {
        status: "cancelled" | "scheduled" | "done";
        id: string;
        startsAt: string;
        place: string | null;
        vacancyTitle: string;
        candidateId: string;
        candidateName: string;
        interviewerName: string | null;
    }, {
        status: "cancelled" | "scheduled" | "done";
        id: string;
        startsAt: string;
        place: string | null;
        vacancyTitle: string;
        candidateId: string;
        candidateName: string;
        interviewerName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    vacancies: {
        status: "open" | "closed" | "filled";
        id: string;
        documents: string[];
        note: string | null;
        counts: {
            active: number;
            declined: number;
            applied: number;
            hired: number;
        };
        title: string;
        createdAt: string;
        branchId: string | null;
        branchName: string | null;
        openings: number;
        wageFromRwf: number | null;
        wageToRwf: number | null;
        closesOn: string | null;
        managerName: string | null;
    }[];
    candidates: {
        id: string;
        fullName: string;
        email: string | null;
        documents: {
            name: string;
            id: string;
            sizeBytes: number;
            url: string;
            filename: string;
            uploadedAt: string;
        }[];
        stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
        source: string;
        note: string | null;
        phone: string | null;
        updatedAt: string;
        rejectReason: string | null;
        vacancyId: string;
        vacancyTitle: string;
        talentPool: boolean;
        appliedOn: string;
        keepUntil: string;
        expectedWageRwf: number | null;
        offerWageRwf: number | null;
        offerStartsOn: string | null;
        agreedWageRwf: number | null;
        hiredEmployeeId: string | null;
        scores: {
            id: string;
            note: string | null;
            createdAt: string;
            byName: string | null;
            what: string;
            score: number;
        }[];
        rounds: {
            id: string;
            amountRwf: number;
            startsOn: string | null;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
            byName: string | null;
        }[];
        applicationLink: string | null;
    }[];
    interviews: {
        status: "cancelled" | "scheduled" | "done";
        id: string;
        startsAt: string;
        place: string | null;
        vacancyTitle: string;
        candidateId: string;
        candidateName: string;
        interviewerName: string | null;
    }[];
}, {
    vacancies: {
        status: "open" | "closed" | "filled";
        id: string;
        documents: string[];
        note: string | null;
        counts: {
            active: number;
            declined: number;
            applied: number;
            hired: number;
        };
        title: string;
        createdAt: string;
        branchId: string | null;
        branchName: string | null;
        openings: number;
        wageFromRwf: number | null;
        wageToRwf: number | null;
        closesOn: string | null;
        managerName: string | null;
    }[];
    candidates: {
        id: string;
        fullName: string;
        email: string | null;
        documents: {
            name: string;
            id: string;
            sizeBytes: number;
            url: string;
            filename: string;
            uploadedAt: string;
        }[];
        stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
        source: string;
        note: string | null;
        phone: string | null;
        updatedAt: string;
        rejectReason: string | null;
        vacancyId: string;
        vacancyTitle: string;
        talentPool: boolean;
        appliedOn: string;
        keepUntil: string;
        expectedWageRwf: number | null;
        offerWageRwf: number | null;
        offerStartsOn: string | null;
        agreedWageRwf: number | null;
        hiredEmployeeId: string | null;
        scores: {
            id: string;
            note: string | null;
            createdAt: string;
            byName: string | null;
            what: string;
            score: number;
        }[];
        rounds: {
            id: string;
            amountRwf: number;
            startsOn: string | null;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
            byName: string | null;
        }[];
        applicationLink: string | null;
    }[];
    interviews: {
        status: "cancelled" | "scheduled" | "done";
        id: string;
        startsAt: string;
        place: string | null;
        vacancyTitle: string;
        candidateId: string;
        candidateName: string;
        interviewerName: string | null;
    }[];
}>;
export type TalentBoard = z.infer<typeof TalentBoard>;
/** `POST /ops/vacancies`. */
export declare const CreateVacancyRequest: z.ZodEffects<z.ZodObject<{
    title: z.ZodString;
    branchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    openings: z.ZodOptional<z.ZodNumber>;
    wageFromRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    wageToRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    closesOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    managerEmployeeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    documents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    documents?: string[] | undefined;
    note?: string | null | undefined;
    branchId?: string | null | undefined;
    openings?: number | undefined;
    wageFromRwf?: number | null | undefined;
    wageToRwf?: number | null | undefined;
    closesOn?: string | null | undefined;
    managerEmployeeId?: string | null | undefined;
}, {
    title: string;
    documents?: string[] | undefined;
    note?: string | null | undefined;
    branchId?: string | null | undefined;
    openings?: number | undefined;
    wageFromRwf?: number | null | undefined;
    wageToRwf?: number | null | undefined;
    closesOn?: string | null | undefined;
    managerEmployeeId?: string | null | undefined;
}>, {
    title: string;
    documents?: string[] | undefined;
    note?: string | null | undefined;
    branchId?: string | null | undefined;
    openings?: number | undefined;
    wageFromRwf?: number | null | undefined;
    wageToRwf?: number | null | undefined;
    closesOn?: string | null | undefined;
    managerEmployeeId?: string | null | undefined;
}, {
    title: string;
    documents?: string[] | undefined;
    note?: string | null | undefined;
    branchId?: string | null | undefined;
    openings?: number | undefined;
    wageFromRwf?: number | null | undefined;
    wageToRwf?: number | null | undefined;
    closesOn?: string | null | undefined;
    managerEmployeeId?: string | null | undefined;
}>;
export type CreateVacancyRequest = z.infer<typeof CreateVacancyRequest>;
/** `PATCH /ops/vacancies/:id`: close it, mark it filled, or move its closing day. */
export declare const UpdateVacancyRequest: z.ZodEffects<z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["open", "closed", "filled"]>>;
    closesOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    documents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    status?: "open" | "closed" | "filled" | undefined;
    documents?: string[] | undefined;
    note?: string | null | undefined;
    closesOn?: string | null | undefined;
}, {
    status?: "open" | "closed" | "filled" | undefined;
    documents?: string[] | undefined;
    note?: string | null | undefined;
    closesOn?: string | null | undefined;
}>, {
    status?: "open" | "closed" | "filled" | undefined;
    documents?: string[] | undefined;
    note?: string | null | undefined;
    closesOn?: string | null | undefined;
}, {
    status?: "open" | "closed" | "filled" | undefined;
    documents?: string[] | undefined;
    note?: string | null | undefined;
    closesOn?: string | null | undefined;
}>;
export type UpdateVacancyRequest = z.infer<typeof UpdateVacancyRequest>;
/** `POST /ops/candidates`. */
export declare const CreateCandidateRequest: z.ZodObject<{
    vacancyId: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodString;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** They agreed to be kept for other roles too. */
    talentPool: z.ZodOptional<z.ZodBoolean>;
    /** The wage they ask for. */
    expectedWageRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    source: string;
    vacancyId: string;
    email?: string | null | undefined;
    note?: string | null | undefined;
    phone?: string | null | undefined;
    talentPool?: boolean | undefined;
    expectedWageRwf?: number | null | undefined;
}, {
    fullName: string;
    source: string;
    vacancyId: string;
    email?: string | null | undefined;
    note?: string | null | undefined;
    phone?: string | null | undefined;
    talentPool?: boolean | undefined;
    expectedWageRwf?: number | null | undefined;
}>;
export type CreateCandidateRequest = z.infer<typeof CreateCandidateRequest>;
/** `POST /ops/candidates/:id/stage`: the next step, an offer's terms, or a turn-down's reason. */
export declare const MoveCandidateRequest: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    stage: z.ZodEnum<["applied", "screening", "interview", "offer", "hired", "rejected"]>;
    offerWageRwf: z.ZodOptional<z.ZodNumber>;
    offerStartsOn: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    hiredEmployeeId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    reason?: string | undefined;
    offerWageRwf?: number | undefined;
    offerStartsOn?: string | undefined;
    hiredEmployeeId?: string | undefined;
}, {
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    reason?: string | undefined;
    offerWageRwf?: number | undefined;
    offerStartsOn?: string | undefined;
    hiredEmployeeId?: string | undefined;
}>, {
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    reason?: string | undefined;
    offerWageRwf?: number | undefined;
    offerStartsOn?: string | undefined;
    hiredEmployeeId?: string | undefined;
}, {
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    reason?: string | undefined;
    offerWageRwf?: number | undefined;
    offerStartsOn?: string | undefined;
    hiredEmployeeId?: string | undefined;
}>, {
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    reason?: string | undefined;
    offerWageRwf?: number | undefined;
    offerStartsOn?: string | undefined;
    hiredEmployeeId?: string | undefined;
}, {
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    reason?: string | undefined;
    offerWageRwf?: number | undefined;
    offerStartsOn?: string | undefined;
    hiredEmployeeId?: string | undefined;
}>;
export type MoveCandidateRequest = z.infer<typeof MoveCandidateRequest>;
/** `POST /ops/candidates/:id/offer-rounds`: the business offers again, or the candidate asks back. */
export declare const AddOfferRoundRequest: z.ZodObject<{
    side: z.ZodEnum<["business", "candidate"]>;
    amountRwf: z.ZodEffects<z.ZodNumber, number, number>;
    startsOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    side: "business" | "candidate";
    startsOn?: string | null | undefined;
    note?: string | null | undefined;
}, {
    amountRwf: number;
    side: "business" | "candidate";
    startsOn?: string | null | undefined;
    note?: string | null | undefined;
}>;
export type AddOfferRoundRequest = z.infer<typeof AddOfferRoundRequest>;
/** `POST /ops/candidates/:id/offer/agree`: both sides settled on this wage. */
export declare const AgreeOfferRequest: z.ZodObject<{
    amountRwf: z.ZodEffects<z.ZodNumber, number, number>;
    startsOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    startsOn?: string | null | undefined;
}, {
    amountRwf: number;
    startsOn?: string | null | undefined;
}>;
export type AgreeOfferRequest = z.infer<typeof AgreeOfferRequest>;
/** `POST /ops/candidates/:id/scores`. */
export declare const ScoreCandidateRequest: z.ZodObject<{
    what: z.ZodString;
    score: z.ZodNumber;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    what: string;
    score: number;
    note?: string | null | undefined;
}, {
    what: string;
    score: number;
    note?: string | null | undefined;
}>;
export type ScoreCandidateRequest = z.infer<typeof ScoreCandidateRequest>;
/** `POST /ops/interviews`. */
export declare const CreateInterviewRequest: z.ZodObject<{
    candidateId: z.ZodString;
    startsAt: z.ZodString;
    place: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    interviewerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    startsAt: string;
    candidateId: string;
    place?: string | null | undefined;
    interviewerName?: string | null | undefined;
}, {
    startsAt: string;
    candidateId: string;
    place?: string | null | undefined;
    interviewerName?: string | null | undefined;
}>;
export type CreateInterviewRequest = z.infer<typeof CreateInterviewRequest>;
/** `POST /ops/interviews/:id/status`. */
export declare const SetInterviewStatusRequest: z.ZodObject<{
    status: z.ZodEnum<["scheduled", "done", "cancelled"]>;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "scheduled" | "done";
}, {
    status: "cancelled" | "scheduled" | "done";
}>;
export type SetInterviewStatusRequest = z.infer<typeof SetInterviewStatusRequest>;
export declare const Review: z.ZodObject<{
    id: z.ZodString;
    employee: z.ZodObject<{
        employeeId: z.ZodString;
        displayName: z.ZodString;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }>;
    selfDone: z.ZodBoolean;
    managerDone: z.ZodBoolean;
    rating: z.ZodNullable<z.ZodNumber>;
    note: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    note: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    rating: number | null;
    selfDone: boolean;
    managerDone: boolean;
}, {
    id: string;
    note: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    rating: number | null;
    selfDone: boolean;
    managerDone: boolean;
}>;
export type Review = z.infer<typeof Review>;
export declare const ReviewCycle: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    status: z.ZodEnum<["open", "closed"]>;
    reviews: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employee: z.ZodObject<{
            employeeId: z.ZodString;
            displayName: z.ZodString;
            jobPositionTitle: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        }, {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        }>;
        selfDone: z.ZodBoolean;
        managerDone: z.ZodBoolean;
        rating: z.ZodNullable<z.ZodNumber>;
        note: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        rating: number | null;
        selfDone: boolean;
        managerDone: boolean;
    }, {
        id: string;
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        rating: number | null;
        selfDone: boolean;
        managerDone: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "open" | "closed";
    name: string;
    id: string;
    startsOn: string;
    reviews: {
        id: string;
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        rating: number | null;
        selfDone: boolean;
        managerDone: boolean;
    }[];
    endsOn: string;
}, {
    status: "open" | "closed";
    name: string;
    id: string;
    startsOn: string;
    reviews: {
        id: string;
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        rating: number | null;
        selfDone: boolean;
        managerDone: boolean;
    }[];
    endsOn: string;
}>;
export type ReviewCycle = z.infer<typeof ReviewCycle>;
export declare const CurrentReviewCycle: z.ZodObject<{
    cycle: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        startsOn: z.ZodString;
        endsOn: z.ZodString;
        status: z.ZodEnum<["open", "closed"]>;
        reviews: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            employee: z.ZodObject<{
                employeeId: z.ZodString;
                displayName: z.ZodString;
                jobPositionTitle: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                employeeId: string;
                displayName: string;
                jobPositionTitle: string | null;
            }, {
                employeeId: string;
                displayName: string;
                jobPositionTitle: string | null;
            }>;
            selfDone: z.ZodBoolean;
            managerDone: z.ZodBoolean;
            rating: z.ZodNullable<z.ZodNumber>;
            note: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            note: string | null;
            employee: {
                employeeId: string;
                displayName: string;
                jobPositionTitle: string | null;
            };
            rating: number | null;
            selfDone: boolean;
            managerDone: boolean;
        }, {
            id: string;
            note: string | null;
            employee: {
                employeeId: string;
                displayName: string;
                jobPositionTitle: string | null;
            };
            rating: number | null;
            selfDone: boolean;
            managerDone: boolean;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "closed";
        name: string;
        id: string;
        startsOn: string;
        reviews: {
            id: string;
            note: string | null;
            employee: {
                employeeId: string;
                displayName: string;
                jobPositionTitle: string | null;
            };
            rating: number | null;
            selfDone: boolean;
            managerDone: boolean;
        }[];
        endsOn: string;
    }, {
        status: "open" | "closed";
        name: string;
        id: string;
        startsOn: string;
        reviews: {
            id: string;
            note: string | null;
            employee: {
                employeeId: string;
                displayName: string;
                jobPositionTitle: string | null;
            };
            rating: number | null;
            selfDone: boolean;
            managerDone: boolean;
        }[];
        endsOn: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    cycle: {
        status: "open" | "closed";
        name: string;
        id: string;
        startsOn: string;
        reviews: {
            id: string;
            note: string | null;
            employee: {
                employeeId: string;
                displayName: string;
                jobPositionTitle: string | null;
            };
            rating: number | null;
            selfDone: boolean;
            managerDone: boolean;
        }[];
        endsOn: string;
    } | null;
}, {
    cycle: {
        status: "open" | "closed";
        name: string;
        id: string;
        startsOn: string;
        reviews: {
            id: string;
            note: string | null;
            employee: {
                employeeId: string;
                displayName: string;
                jobPositionTitle: string | null;
            };
            rating: number | null;
            selfDone: boolean;
            managerDone: boolean;
        }[];
        endsOn: string;
    } | null;
}>;
export type CurrentReviewCycle = z.infer<typeof CurrentReviewCycle>;
/** `POST /ops/review-cycles`: one review for each person on staff. */
export declare const CreateReviewCycleRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    startsOn: string;
    endsOn: string;
}, {
    name: string;
    startsOn: string;
    endsOn: string;
}>, {
    name: string;
    startsOn: string;
    endsOn: string;
}, {
    name: string;
    startsOn: string;
    endsOn: string;
}>;
export type CreateReviewCycleRequest = z.infer<typeof CreateReviewCycleRequest>;
/** `PATCH /ops/reviews/:id`. */
export declare const UpdateReviewRequest: z.ZodEffects<z.ZodObject<{
    selfDone: z.ZodOptional<z.ZodBoolean>;
    managerDone: z.ZodOptional<z.ZodBoolean>;
    rating: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
    rating?: number | null | undefined;
    selfDone?: boolean | undefined;
    managerDone?: boolean | undefined;
}, {
    note?: string | null | undefined;
    rating?: number | null | undefined;
    selfDone?: boolean | undefined;
    managerDone?: boolean | undefined;
}>, {
    note?: string | null | undefined;
    rating?: number | null | undefined;
    selfDone?: boolean | undefined;
    managerDone?: boolean | undefined;
}, {
    note?: string | null | undefined;
    rating?: number | null | undefined;
    selfDone?: boolean | undefined;
    managerDone?: boolean | undefined;
}>;
export type UpdateReviewRequest = z.infer<typeof UpdateReviewRequest>;
/** One of a person's own reviews (`GET /me/work/:employeeId/reviews`). `note` is what they wrote. */
export declare const MyReview: z.ZodObject<{
    id: z.ZodString;
    cycleName: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    cycleOpen: z.ZodBoolean;
    selfDone: z.ZodBoolean;
    managerDone: z.ZodBoolean;
    rating: z.ZodNullable<z.ZodNumber>;
    note: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    startsOn: string;
    note: string | null;
    rating: number | null;
    endsOn: string;
    selfDone: boolean;
    managerDone: boolean;
    cycleName: string;
    cycleOpen: boolean;
}, {
    id: string;
    startsOn: string;
    note: string | null;
    rating: number | null;
    endsOn: string;
    selfDone: boolean;
    managerDone: boolean;
    cycleName: string;
    cycleOpen: boolean;
}>;
export type MyReview = z.infer<typeof MyReview>;
export declare const MyReviewList: z.ZodObject<{
    reviews: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        cycleName: z.ZodString;
        startsOn: z.ZodString;
        endsOn: z.ZodString;
        cycleOpen: z.ZodBoolean;
        selfDone: z.ZodBoolean;
        managerDone: z.ZodBoolean;
        rating: z.ZodNullable<z.ZodNumber>;
        note: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        startsOn: string;
        note: string | null;
        rating: number | null;
        endsOn: string;
        selfDone: boolean;
        managerDone: boolean;
        cycleName: string;
        cycleOpen: boolean;
    }, {
        id: string;
        startsOn: string;
        note: string | null;
        rating: number | null;
        endsOn: string;
        selfDone: boolean;
        managerDone: boolean;
        cycleName: string;
        cycleOpen: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    reviews: {
        id: string;
        startsOn: string;
        note: string | null;
        rating: number | null;
        endsOn: string;
        selfDone: boolean;
        managerDone: boolean;
        cycleName: string;
        cycleOpen: boolean;
    }[];
}, {
    reviews: {
        id: string;
        startsOn: string;
        note: string | null;
        rating: number | null;
        endsOn: string;
        selfDone: boolean;
        managerDone: boolean;
        cycleName: string;
        cycleOpen: boolean;
    }[];
}>;
export type MyReviewList = z.infer<typeof MyReviewList>;
/** `POST /me/work/:employeeId/reviews/:id/self`: the person's own words on their period. */
export declare const SendSelfReviewRequest: z.ZodObject<{
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
}, {
    note: string;
}>;
export type SendSelfReviewRequest = z.infer<typeof SendSelfReviewRequest>;
/** `POST /applications/:token/code`: a code went to this (masked) address. */
export declare const ApplicationCodeSent: z.ZodObject<{
    sentTo: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sentTo: string;
}, {
    sentTo: string;
}>;
export type ApplicationCodeSent = z.infer<typeof ApplicationCodeSent>;
/** `POST /applications/:token/verify`. */
export declare const VerifyApplicationCodeRequest: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type VerifyApplicationCodeRequest = z.infer<typeof VerifyApplicationCodeRequest>;
/** The page's session, sent back as `x-application-session`. */
export declare const ApplicationSession: z.ZodObject<{
    session: z.ZodString;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresAt: string;
    session: string;
}, {
    expiresAt: string;
    session: string;
}>;
export type ApplicationSession = z.infer<typeof ApplicationSession>;
/** `GET /applications/:token`: what an applicant sees of their own application. */
export declare const ApplicationView: z.ZodObject<{
    firstName: z.ZodString;
    role: z.ZodString;
    business: z.ZodString;
    branch: z.ZodNullable<z.ZodString>;
    stage: z.ZodEnum<["applied", "screening", "interview", "offer", "hired", "rejected"]>;
    appliedOn: z.ZodString;
    interview: z.ZodNullable<z.ZodObject<{
        startsAt: z.ZodString;
        place: z.ZodNullable<z.ZodString>;
        interviewerName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        startsAt: string;
        place: string | null;
        interviewerName: string | null;
    }, {
        startsAt: string;
        place: string | null;
        interviewerName: string | null;
    }>>;
    documents: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        filename: z.ZodNullable<z.ZodString>;
        uploadedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        filename: string | null;
        uploadedAt: string | null;
    }, {
        name: string;
        filename: string | null;
        uploadedAt: string | null;
    }>, "many">;
    offer: z.ZodNullable<z.ZodObject<{
        amountRwf: z.ZodNumber;
        startsOn: z.ZodNullable<z.ZodString>;
        agreedRwf: z.ZodNullable<z.ZodNumber>;
        rounds: z.ZodArray<z.ZodObject<{
            side: z.ZodEnum<["business", "candidate"]>;
            amountRwf: z.ZodNumber;
            note: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
        }, {
            amountRwf: number;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
        }>, "many">;
        /** Their turn: the last figure is the business's and nothing is agreed. */
        canRespond: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        startsOn: string | null;
        rounds: {
            amountRwf: number;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
        }[];
        agreedRwf: number | null;
        canRespond: boolean;
    }, {
        amountRwf: number;
        startsOn: string | null;
        rounds: {
            amountRwf: number;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
        }[];
        agreedRwf: number | null;
        canRespond: boolean;
    }>>;
    /** Why, when they were turned down. */
    closedReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    business: string;
    firstName: string;
    role: string;
    documents: {
        name: string;
        filename: string | null;
        uploadedAt: string | null;
    }[];
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    branch: string | null;
    offer: {
        amountRwf: number;
        startsOn: string | null;
        rounds: {
            amountRwf: number;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
        }[];
        agreedRwf: number | null;
        canRespond: boolean;
    } | null;
    interview: {
        startsAt: string;
        place: string | null;
        interviewerName: string | null;
    } | null;
    appliedOn: string;
    closedReason: string | null;
}, {
    business: string;
    firstName: string;
    role: string;
    documents: {
        name: string;
        filename: string | null;
        uploadedAt: string | null;
    }[];
    stage: "rejected" | "applied" | "offer" | "screening" | "interview" | "hired";
    branch: string | null;
    offer: {
        amountRwf: number;
        startsOn: string | null;
        rounds: {
            amountRwf: number;
            note: string | null;
            createdAt: string;
            side: "business" | "candidate";
        }[];
        agreedRwf: number | null;
        canRespond: boolean;
    } | null;
    interview: {
        startsAt: string;
        place: string | null;
        interviewerName: string | null;
    } | null;
    appliedOn: string;
    closedReason: string | null;
}>;
export type ApplicationView = z.infer<typeof ApplicationView>;
/** `POST /applications/:token/offer`: take the offer, or ask for another figure. */
export declare const RespondToOfferRequest: z.ZodUnion<[z.ZodObject<{
    accept: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    accept: true;
}, {
    accept: true;
}>, z.ZodObject<{
    askRwf: z.ZodEffects<z.ZodNumber, number, number>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    askRwf: number;
    note?: string | null | undefined;
}, {
    askRwf: number;
    note?: string | null | undefined;
}>]>;
export type RespondToOfferRequest = z.infer<typeof RespondToOfferRequest>;
//# sourceMappingURL=talent.d.ts.map