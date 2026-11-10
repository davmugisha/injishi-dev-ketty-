"use client";

import { BOARDS, screenHref } from "@injishi/data";
import type { HrActions, HrFeatureId } from "@injishi/product-hr";
import { type HrLinks, HrProvider, type HrShell } from "@injishi/product-hr/web";
import type { ReactNode } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { loadGuestPlaces } from "@/features/guests/places";
import { signOut } from "@/lib/auth-actions";
import { WEB_URL } from "@/lib/return-to";
import {
  answerSwapAction,
  askClaimAction,
  askExtraDaysAction,
  askFixAction,
  askHelpAction,
  askLeaveAction,
  askRotationAction,
  askShiftChangeAction,
  askSwapAction,
  cancelClaimAction,
  cancelRequestAction,
  checkPayslipPinAction,
  handInDocumentAction,
  replyHelpAction,
  sendSelfReviewAction,
} from "../staff/actions";
import {
  acceptSwapForColleague,
  addToRotation,
  cancelEmployeeAccess,
  cancelLeave,
  clockOutFromDesk,
  createRotation,
  decideCorrection,
  decideEmployeeDocument,
  decideExtraDays,
  decideLeave,
  decideShiftSwap,
  giveEmployeeAccess,
  loadEmployeeAccess,
  loadEmployeeDocuments,
  loadEmployeePersonal,
  openEmployeeDocument,
  pickRosterBranch,
  publishRosterWeek,
  registerNewEmployee,
  requestEmployeeDocument,
  saveDeskEntry,
  saveRosterCover,
  setOffboardingStep,
  setRosterLent,
  setRosterShift,
  stopRotation,
  takeOffRotation,
} from "./actions";
import {
  addTabletAction,
  checkClockInAction,
  newTabletCodeAction,
  removeTabletAction,
  saveClockRuleAction,
} from "./clock-actions";
import {
  addPayAmount,
  answerHelpTicket,
  buildPayFile,
  chooseContribution,
  closeHelpTicket,
  confirmPayRun,
  decidePayClaim,
  fixBlocker,
  holdPayslip,
  lendItem,
  loadClaims,
  loadContributions,
  loadLoans,
  loadPastRun,
  loadPayrollSettings,
  openClaimReceipt,
  postAnnouncementAction,
  preparePayRun,
  recomputePayRun,
  recordLoan,
  returnItem,
  saveRssbEmployerNumber,
  setAnnouncementShownAction,
  settleClockRecord,
  submitPayRun,
  withdrawPayRun,
} from "./payroll-actions";
import {
  addCandidateAction,
  addOfferRoundAction,
  agreeOfferAction,
  bookInterviewAction,
  closeReviewCycleAction,
  closeVacancyAction,
  interviewStatusAction,
  moveCandidateAction,
  openReviewCycleAction,
  openVacancyAction,
  scoreCandidateAction,
  setVacancyDocumentsAction,
  tickOnboardingAction,
  updateReviewAction,
} from "./talent-actions";

/*
 * What HR's views may not import, handed to them by the app (ADR-074 stage 3). The views live in
 * `@injishi/product-hr`, and a product never imports an app, so every route that draws one wraps it in
 * `HrMount`: the app's route for every screen (built from the screen registry, which keeps gating access until
 * stage 8), the server actions they send, and the topbar pill they draw into.
 */

const links: HrLinks = {
  ...Object.fromEntries(BOARDS.map((board) => [board, screenHref(board)])),
  // The entrance tablet opens the kiosk on web, another origin, so its link is whole.
  AttendanceKiosk: `${WEB_URL}/kiosk`,
} as HrLinks;

const actions: HrActions = {
  loadPlaces: loadGuestPlaces,
  // People
  decideLeave,
  cancelLeave,
  decideExtraDays,
  decideCorrection,
  saveDeskEntry,
  clockOutFromDesk,
  setOffboardingStep,
  setRosterShift,
  setRosterLent,
  publishRosterWeek,
  decideShiftSwap,
  saveRosterCover,
  acceptSwapForColleague,
  pickRosterBranch,
  askShiftChangeAction,
  askRotationAction,
  checkPayslipPinAction,
  createRotation,
  addToRotation,
  takeOffRotation,
  stopRotation,
  // Employees
  registerNewEmployee,
  loadEmployeeAccess,
  giveEmployeeAccess,
  cancelEmployeeAccess,
  loadEmployeeDocuments,
  loadEmployeePersonal,
  openEmployeeDocument,
  decideEmployeeDocument,
  requestEmployeeDocument,
  // Clock-in rules
  saveClockRuleAction,
  addTabletAction,
  newTabletCodeAction,
  removeTabletAction,
  checkClockInAction,
  // Payroll
  preparePayRun,
  recomputePayRun,
  addPayAmount,
  holdPayslip,
  submitPayRun,
  withdrawPayRun,
  confirmPayRun,
  buildPayFile,
  fixBlocker,
  settleClockRecord,
  loadPastRun,
  loadClaims,
  decidePayClaim,
  openClaimReceipt,
  loadContributions,
  chooseContribution,
  loadPayrollSettings,
  saveRssbEmployerNumber,
  loadLoans,
  recordLoan,
  // Staff services
  answerHelpTicket,
  closeHelpTicket,
  lendItem,
  returnItem,
  postAnnouncementAction,
  setAnnouncementShownAction,
  // Talent
  openVacancyAction,
  setVacancyDocumentsAction,
  closeVacancyAction,
  addCandidateAction,
  addOfferRoundAction,
  agreeOfferAction,
  moveCandidateAction,
  scoreCandidateAction,
  bookInterviewAction,
  interviewStatusAction,
  openReviewCycleAction,
  closeReviewCycleAction,
  updateReviewAction,
  tickOnboardingAction,
  // Self service
  askLeaveAction,
  cancelRequestAction,
  askSwapAction,
  answerSwapAction,
  askExtraDaysAction,
  handInDocumentAction,
  askClaimAction,
  cancelClaimAction,
  askHelpAction,
  replyHelpAction,
  sendSelfReviewAction,
  askFixAction,
  signOut,
};

const shell: HrShell = { TopbarStatus };

/** Mounts an HR view: wrap it in this on every route that draws one. */
export function HrMount({ children, off = [] }: { children: ReactNode; off?: readonly HrFeatureId[] }) {
  return (
    <HrProvider links={links} actions={actions} shell={shell} off={off}>
      {children}
    </HrProvider>
  );
}
