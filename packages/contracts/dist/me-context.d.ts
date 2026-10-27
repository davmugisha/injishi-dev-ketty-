import { z } from "zod";
/** The surfaces a person can land on, in the order they are preferred. */
export declare const MeSurface: z.ZodEnum<["landlord", "business", "tenant", "leader", "broker", "admin", "guest"]>;
export type MeSurface = z.infer<typeof MeSurface>;
/** A business the person is an active member of. */
export declare const MeContextBusiness: z.ZodObject<{
    workspaceId: z.ZodString;
    orgId: z.ZodString;
    orgName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    role: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
    registrationStatus: z.ZodNullable<z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>>;
    /** Approved and running: only then does it grant any permission. */
    operational: z.ZodBoolean;
    permissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.manage", "lease.sign", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run", "lostfound.manage", "payout.manage", "expense.manage", "tax.manage", "guest.register", "pos.sell", "pos.checkout", "pos.discount", "pos.override", "pos.refund", "table.manage", "kitchen.work", "register.operate", "shift.review"]>, "many">;
    /** A landlord business's lease signatory, as their ID names them; null until set or for other businesses. */
    signatoryName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    domain: "hospitality" | "residence";
    role: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    orgId: string;
    workspaceId: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
    orgName: string;
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review")[];
    signatoryName: string | null;
    operational: boolean;
}, {
    domain: "hospitality" | "residence";
    role: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    orgId: string;
    workspaceId: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
    orgName: string;
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review")[];
    signatoryName: string | null;
    operational: boolean;
}>;
export type MeContextBusiness = z.infer<typeof MeContextBusiness>;
/** A home the person rents: a lease naming them (through `tenants.user_id`) that is not a draft. */
export declare const MeContextTenancy: z.ZodObject<{
    leaseId: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    landlordName: z.ZodString;
    propertyName: z.ZodString;
    unitLabel: z.ZodString;
    monthlyRentRwf: z.ZodNumber;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    reference: string;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    landlordName: string;
}, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    reference: string;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    landlordName: string;
}>;
export type MeContextTenancy = z.infer<typeof MeContextTenancy>;
export declare const MeContext: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        id: string;
        email: string;
    }, {
        name: string | null;
        id: string;
        email: string;
    }>;
    businesses: z.ZodArray<z.ZodObject<{
        workspaceId: z.ZodString;
        orgId: z.ZodString;
        orgName: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        role: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
        registrationStatus: z.ZodNullable<z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>>;
        /** Approved and running: only then does it grant any permission. */
        operational: z.ZodBoolean;
        permissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.manage", "lease.sign", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run", "lostfound.manage", "payout.manage", "expense.manage", "tax.manage", "guest.register", "pos.sell", "pos.checkout", "pos.discount", "pos.override", "pos.refund", "table.manage", "kitchen.work", "register.operate", "shift.review"]>, "many">;
        /** A landlord business's lease signatory, as their ID names them; null until set or for other businesses. */
        signatoryName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        domain: "hospitality" | "residence";
        role: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        orgId: string;
        workspaceId: string;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
        orgName: string;
        permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review")[];
        signatoryName: string | null;
        operational: boolean;
    }, {
        domain: "hospitality" | "residence";
        role: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        orgId: string;
        workspaceId: string;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
        orgName: string;
        permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review")[];
        signatoryName: string | null;
        operational: boolean;
    }>, "many">;
    /** The workspace this session last chose (`POST /me/active-workspace`); a hint about order, never about access. */
    activeWorkspaceId: z.ZodNullable<z.ZodString>;
    tenancies: z.ZodArray<z.ZodObject<{
        leaseId: z.ZodString;
        reference: z.ZodString;
        status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
        landlordName: z.ZodString;
        propertyName: z.ZodString;
        unitLabel: z.ZodString;
        monthlyRentRwf: z.ZodNumber;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        reference: string;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        landlordName: string;
    }, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        reference: string;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        landlordName: string;
    }>, "many">;
    /** Seats as a local leader or a government officer. */
    oversight: z.ZodArray<z.ZodObject<{
        assignmentId: z.ZodString;
        oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national", "dgie_village", "dgie_cell"]>;
        governmentBodyCode: z.ZodString;
        governmentTitle: z.ZodNullable<z.ZodString>;
        scopeLevel: z.ZodEnum<["country", "province", "district", "sector", "cell", "village"]>;
        provinceId: z.ZodNullable<z.ZodNumber>;
        districtId: z.ZodNullable<z.ZodNumber>;
        sectorId: z.ZodNullable<z.ZodNumber>;
        cellId: z.ZodNullable<z.ZodNumber>;
        villageId: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        governmentBodyCode: string;
        governmentTitle: string | null;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        assignmentId: string;
    }, {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        governmentBodyCode: string;
        governmentTitle: string | null;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        assignmentId: string;
    }>, "many">;
    broker: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        name: string | null;
        id: string;
    }, {
        status: string;
        name: string | null;
        id: string;
    }>>;
    staff: z.ZodObject<{
        isStaff: z.ZodBoolean;
        roles: z.ZodArray<z.ZodEnum<["super_admin", "ops", "compliance", "finance", "trainer"]>, "many">;
    }, "strip", z.ZodTypeAny, {
        roles: ("finance" | "super_admin" | "ops" | "compliance" | "trainer")[];
        isStaff: boolean;
    }, {
        roles: ("finance" | "super_admin" | "ops" | "compliance" | "trainer")[];
        isStaff: boolean;
    }>;
    /** Where this person lands after signing in, with the business it is about (landlord and business). */
    landing: z.ZodObject<{
        surface: z.ZodEnum<["landlord", "business", "tenant", "leader", "broker", "admin", "guest"]>;
        workspaceId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string | null;
        surface: "business" | "broker" | "admin" | "guest" | "landlord" | "tenant" | "leader";
    }, {
        workspaceId: string | null;
        surface: "business" | "broker" | "admin" | "guest" | "landlord" | "tenant" | "leader";
    }>;
}, "strip", z.ZodTypeAny, {
    broker: {
        status: string;
        name: string | null;
        id: string;
    } | null;
    user: {
        name: string | null;
        id: string;
        email: string;
    };
    oversight: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        governmentBodyCode: string;
        governmentTitle: string | null;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        assignmentId: string;
    }[];
    staff: {
        roles: ("finance" | "super_admin" | "ops" | "compliance" | "trainer")[];
        isStaff: boolean;
    };
    businesses: {
        domain: "hospitality" | "residence";
        role: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        orgId: string;
        workspaceId: string;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
        orgName: string;
        permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review")[];
        signatoryName: string | null;
        operational: boolean;
    }[];
    tenancies: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        reference: string;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        landlordName: string;
    }[];
    activeWorkspaceId: string | null;
    landing: {
        workspaceId: string | null;
        surface: "business" | "broker" | "admin" | "guest" | "landlord" | "tenant" | "leader";
    };
}, {
    broker: {
        status: string;
        name: string | null;
        id: string;
    } | null;
    user: {
        name: string | null;
        id: string;
        email: string;
    };
    oversight: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        governmentBodyCode: string;
        governmentTitle: string | null;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        assignmentId: string;
    }[];
    staff: {
        roles: ("finance" | "super_admin" | "ops" | "compliance" | "trainer")[];
        isStaff: boolean;
    };
    businesses: {
        domain: "hospitality" | "residence";
        role: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        orgId: string;
        workspaceId: string;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
        orgName: string;
        permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review")[];
        signatoryName: string | null;
        operational: boolean;
    }[];
    tenancies: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        reference: string;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        landlordName: string;
    }[];
    activeWorkspaceId: string | null;
    landing: {
        workspaceId: string | null;
        surface: "business" | "broker" | "admin" | "guest" | "landlord" | "tenant" | "leader";
    };
}>;
export type MeContext = z.infer<typeof MeContext>;
/** The leases that make someone a tenant: anything the landlord has signed and sent. */
export declare const TENANCY_STATUSES: readonly ["pending_signature", "signed", "active", "ending", "ended"];
/**
 * The residence business a landlord works in: the session's choice when it is an operational residence
 * business, else the first operational one. Null when the person runs no residence business.
 */
export declare function landlordBusiness(businesses: readonly MeContextBusiness[], activeWorkspaceId: string | null): MeContextBusiness | null;
/**
 * Where a person lands (blueprint 3.2): the business the session last chose when it runs; else a
 * residence business (the landlord's home); else any other business; else their own home as a tenant;
 * else a local leader's or officer's console; else the broker's workspace; else the admin console; else
 * the guest side. A tenancy counts once the lease is out of draft and not cancelled.
 */
export declare function landingFor(context: Pick<MeContext, "businesses" | "activeWorkspaceId" | "tenancies" | "oversight" | "broker" | "staff">): MeContext["landing"];
//# sourceMappingURL=me-context.d.ts.map