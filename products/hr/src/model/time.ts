/** HR's time shapes, which the app reads from the API and hands HR's views (ADR-074 stage 3). */

export type ClockMode = "anywhere" | "at_work" | "entrance";

export interface BranchClockRule {
  propertyId: string;
  branchName: string;
  clockMode: ClockMode;
  opensMinutesBefore: number | null;
  geofenceRadiusM: number;
  /** A centre set here, where staff clock in; else the property's map pin is used. */
  centre: { lat: number; lng: number } | null;
  propertyHasCoordinates: boolean;
  /** Some centre is known. Without one, every phone clock-in waits for HR. */
  hasCoordinates: boolean;
}

export interface EntranceTablet {
  id: string;
  propertyId: string;
  branchName: string;
  name: string;
  status: "pairing" | "active" | "revoked";
  lastSeenAt: string | null;
  pairingExpiresAt: string | null;
}

export interface FarClockIn {
  employeeId: string;
  displayName: string;
  times: number;
  lastAt: string;
}

export interface ClockSetup {
  branches: BranchClockRule[];
  tablets: EntranceTablet[];
  far: FarClockIn[];
}
