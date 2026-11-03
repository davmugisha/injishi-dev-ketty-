/**
 * PMS's web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links, commands, shell and photographs through `PmsProvider`; nothing here reads the API or knows a URL.
 */

export { GroupsView } from "./commercial/groups-view.tsx";
export { ListingView } from "./commercial/listing-view.tsx";
export { PackagesView } from "./commercial/packages-view.tsx";
export { RatesInventoryView } from "./commercial/rates-inventory-view.tsx";
export { RevenueView } from "./commercial/revenue-view.tsx";
export { SalesEventsView } from "./commercial/sales-events-view.tsx";
export { FoliosView } from "./folios/folios-view.tsx";
export { NightAuditView } from "./folios/night-audit-view.tsx";
export { CheckInView } from "./front-desk/check-in-view.tsx";
export { FrontDeskTodayView } from "./front-desk/front-desk-today-view.tsx";
export { ReservationDetailView } from "./front-desk/reservation-detail-view.tsx";
export { ReservationsView } from "./front-desk/reservations-view.tsx";
export { RoomRackView } from "./front-desk/room-rack-view.tsx";
export { WalkInView } from "./front-desk/walk-in-view.tsx";
export { type FolioPaymentState, type FolioStage, GuestFolioView } from "./guest/guest-folio-view.tsx";
export { GuestKeyView, type KeyMode } from "./guest/guest-key-view.tsx";
export { GuestPreArrivalView, type PreArrivalStep } from "./guest/guest-pre-arrival-view.tsx";
export { GuestRequestsView } from "./guest/guest-requests-view.tsx";
export { GuestStayView, type LateCheckout } from "./guest/guest-stay-view.tsx";
export { GuestTripView } from "./guest/guest-trip-view.tsx";
export {
  type PmsLinks,
  type PmsMedia,
  PmsProvider,
  type PmsShell,
  type TopbarStatusProps,
} from "./mount.tsx";
export { HousekeepingBoardView } from "./operations/housekeeping-board-view.tsx";
export { LostFoundView } from "./operations/lost-found-view.tsx";
export { LoyaltyView } from "./operations/loyalty-view.tsx";
export { MaintenanceView } from "./operations/maintenance-view.tsx";
export { InspectRoomView } from "./staff-phone/inspect-room-view.tsx";
export { StaffReportView } from "./staff-phone/staff-report-view.tsx";
export { StaffTaskView } from "./staff-phone/staff-task-view.tsx";
export { StaffTodayView } from "./staff-phone/staff-today-view.tsx";
export { TechWorkOrdersView } from "./staff-phone/tech-work-orders-view.tsx";
export { CheckoutView, type MomoState, type ReceiptOutcome } from "./stays/checkout-view.tsx";
export { GuestsView } from "./stays/guests-view.tsx";
export { MessagesView } from "./stays/messages-view.tsx";
export { OfflineDeskView } from "./stays/offline-desk-view.tsx";
export { StayFolioView } from "./stays/stay-folio-view.tsx";
