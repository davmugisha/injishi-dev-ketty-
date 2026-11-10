/** HR's talent shapes, which the app reads from the API and hands HR's views (ADR-074 stage 3). */

export type CandidateStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";

export interface TalentVacancy {
  id: string;
  title: string;
  branchId: string | null;
  branchName: string | null;
  openings: number;
  wageFromRwf: number | null;
  wageToRwf: number | null;
  closesOn: string | null;
  status: "open" | "closed" | "filled";
  managerName: string | null;
  note: string | null;
  /** What an applicant is asked to send. */
  documents: string[];
  counts: { applied: number; active: number; declined: number; hired: number };
  createdAt: string;
}

/** One round of the salary talk: the business's offer, or what the candidate asks back. */
export interface OfferRound {
  id: string;
  side: "business" | "candidate";
  amountRwf: number;
  startsOn: string | null;
  note: string | null;
  byName: string | null;
  createdAt: string;
}

export interface TalentCandidate {
  id: string;
  vacancyId: string;
  vacancyTitle: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  source: string;
  stage: CandidateStage;
  note: string | null;
  talentPool: boolean;
  appliedOn: string;
  keepUntil: string;
  /** What they asked for when they applied. */
  expectedWageRwf: number | null;
  offerWageRwf: number | null;
  offerStartsOn: string | null;
  /** The wage both sides settled on. */
  agreedWageRwf: number | null;
  rounds: OfferRound[];
  /** What they sent from their progress page; `url` reads it for five minutes. */
  documents: { id: string; name: string; filename: string; sizeBytes: number; uploadedAt: string; url: string }[];
  /** Their private progress page. */
  applicationLink: string | null;
  rejectReason: string | null;
  hiredEmployeeId: string | null;
  scores: { id: string; what: string; score: number; note: string | null; byName: string | null; createdAt: string }[];
  updatedAt: string;
}

export interface TalentInterview {
  id: string;
  candidateId: string;
  candidateName: string;
  vacancyTitle: string;
  startsAt: string;
  place: string | null;
  interviewerName: string | null;
  status: "scheduled" | "done" | "cancelled";
}

export interface TalentBoardView {
  vacancies: TalentVacancy[];
  candidates: TalentCandidate[];
  interviews: TalentInterview[];
}

export interface TalentReview {
  id: string;
  employee: { employeeId: string; displayName: string; jobPositionTitle: string | null };
  selfDone: boolean;
  managerDone: boolean;
  rating: number | null;
  note: string | null;
}

export interface TalentReviewCycle {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: "open" | "closed";
  reviews: TalentReview[];
}

/** A new starter's joining checklist. */
export interface Onboarding {
  id: string;
  employee: { employeeId: string; displayName: string; jobPositionTitle: string | null };
  anchorOn: string;
  doneCount: number;
  tasks: {
    id: string;
    label: string;
    detail: string | null;
    dueOn: string;
    doneAt: string | null;
    doneByName: string | null;
  }[];
}

/** Documents a role may ask for: the list `@injishi/contracts` holds as CANDIDATE_DOCUMENTS. */
export const DOCUMENT_CHOICES = [
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
