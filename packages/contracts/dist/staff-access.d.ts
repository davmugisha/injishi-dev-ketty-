import { z } from "zod";
import { InvitableOrgRole } from "./ops";
/**
 * Giving a staff file its Injishi login while putting the person on file (HR onboarding).
 *
 * The file and the login stay two things: a file is HR's record of somebody employed, a login is
 * an account that may act in the business. HR, holding `team.invite`, names the address, the role
 * and the branches. A front-line role's invitation goes out at once; a role that reaches money,
 * staff files, payroll or prices (`accessNeedsOwner`) is a request the owner approves on Team and
 * roles, and only then is the invitation sent. The owner, holding `team.manage`, gives any role
 * at once.
 */
/** `POST /api/v1/ops/employees/:id/access`. */
export declare const GrantEmployeeAccessRequest: z.ZodObject<{
    email: z.ZodString;
    orgRole: z.ZodEnum<["manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
    /** The branches the person will cover; null is every branch (ADR-054). */
    branchIds: z.ZodDefault<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    /** For a request the owner decides: shown to them beside it. */
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
    branchIds: string[] | null;
    note?: string | null | undefined;
}, {
    email: string;
    orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
    note?: string | null | undefined;
    branchIds?: string[] | null | undefined;
}>;
export type GrantEmployeeAccessRequest = z.infer<typeof GrantEmployeeAccessRequest>;
export declare const StaffAccessRequestStatus: z.ZodEnum<["pending", "approved", "declined", "cancelled"]>;
export type StaffAccessRequestStatus = z.infer<typeof StaffAccessRequestStatus>;
/** A login asked for one file, as HR and the owner read it. */
export declare const StaffAccessRequest: z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    employeeName: z.ZodString;
    employeeNumber: z.ZodString;
    jobTitle: z.ZodNullable<z.ZodString>;
    email: z.ZodString;
    orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
    /** Null is every branch. */
    branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodEnum<["pending", "approved", "declined", "cancelled"]>;
    /** What HR wrote for the owner. */
    note: z.ZodNullable<z.ZodString>;
    requestedAt: z.ZodString;
    requestedByName: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    decidedByName: z.ZodNullable<z.ZodString>;
    /** Why the owner declined. */
    decisionNote: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "pending" | "declined" | "cancelled";
    id: string;
    email: string;
    decidedAt: string | null;
    decisionNote: string | null;
    note: string | null;
    decidedByName: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
    branchIds: string[] | null;
    employeeId: string;
    employeeNumber: string;
    requestedByName: string | null;
    jobTitle: string | null;
    employeeName: string;
    requestedAt: string;
}, {
    status: "approved" | "pending" | "declined" | "cancelled";
    id: string;
    email: string;
    decidedAt: string | null;
    decisionNote: string | null;
    note: string | null;
    decidedByName: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
    branchIds: string[] | null;
    employeeId: string;
    employeeNumber: string;
    requestedByName: string | null;
    jobTitle: string | null;
    employeeName: string;
    requestedAt: string;
}>;
export type StaffAccessRequest = z.infer<typeof StaffAccessRequest>;
/** One role as the access form offers it: its permissions HERE, and whether the owner approves it. */
export declare const AccessRoleOption: z.ZodObject<{
    orgRole: z.ZodEnum<["manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
    label: z.ZodString;
    /** What the role is for, in one line. */
    summary: z.ZodString;
    /** The role's permissions at this business, by area, in the screen's words. */
    areas: z.ZodArray<z.ZodObject<{
        area: z.ZodEnum<["front_desk", "rooms", "services", "money", "property", "people"]>;
        label: z.ZodString;
        permissions: z.ZodArray<z.ZodObject<{
            permission: z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.manage", "lease.sign", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run", "lostfound.manage", "team.invite", "payout.manage", "expense.manage", "tax.manage", "guest.register", "pos.sell", "pos.checkout", "pos.discount", "pos.override", "pos.refund", "table.manage", "kitchen.work", "register.operate", "shift.review", "stock.manage", "customer.view", "customer.manage", "customer.admin"]>;
            label: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            label: string;
            permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
        }, {
            label: string;
            permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        label: string;
        permissions: {
            label: string;
            permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
        }[];
        area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
    }, {
        label: string;
        permissions: {
            label: string;
            permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
        }[];
        area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
    }>, "many">;
    /** A login into this role waits for the owner when the caller does not manage the team. */
    needsOwner: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    label: string;
    orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
    areas: {
        label: string;
        permissions: {
            label: string;
            permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
        }[];
        area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
    }[];
    summary: string;
    needsOwner: boolean;
}, {
    label: string;
    orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
    areas: {
        label: string;
        permissions: {
            label: string;
            permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
        }[];
        area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
    }[];
    summary: string;
    needsOwner: boolean;
}>;
export type AccessRoleOption = z.infer<typeof AccessRoleOption>;
/**
 * `GET /api/v1/ops/employees/access-options`: what a login may be, before there is a file to give
 * it to (the new employee form). The same roles, branches and rights the file's read carries.
 */
export declare const EmployeeAccessOptions: z.ZodObject<{
    roles: z.ZodArray<z.ZodObject<{
        orgRole: z.ZodEnum<["manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
        label: z.ZodString;
        /** What the role is for, in one line. */
        summary: z.ZodString;
        /** The role's permissions at this business, by area, in the screen's words. */
        areas: z.ZodArray<z.ZodObject<{
            area: z.ZodEnum<["front_desk", "rooms", "services", "money", "property", "people"]>;
            label: z.ZodString;
            permissions: z.ZodArray<z.ZodObject<{
                permission: z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.manage", "lease.sign", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run", "lostfound.manage", "team.invite", "payout.manage", "expense.manage", "tax.manage", "guest.register", "pos.sell", "pos.checkout", "pos.discount", "pos.override", "pos.refund", "table.manage", "kitchen.work", "register.operate", "shift.review", "stock.manage", "customer.view", "customer.manage", "customer.admin"]>;
                label: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }, {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }, {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }>, "many">;
        /** A login into this role waits for the owner when the caller does not manage the team. */
        needsOwner: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        label: string;
        orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        areas: {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }[];
        summary: string;
        needsOwner: boolean;
    }, {
        label: string;
        orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        areas: {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }[];
        summary: string;
        needsOwner: boolean;
    }>, "many">;
    /** The branches the caller covers, which are the ones a login they give may name. */
    branches: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
    }, {
        name: string;
        id: string;
    }>, "many">;
    /** The caller may give logins (`team.invite` or `team.manage`); without it the state reads only. */
    canGrant: z.ZodBoolean;
    /** The caller manages the team: every role goes out at once, none is requested. */
    grantsEveryRole: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    branches: {
        name: string;
        id: string;
    }[];
    roles: {
        label: string;
        orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        areas: {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }[];
        summary: string;
        needsOwner: boolean;
    }[];
    canGrant: boolean;
    grantsEveryRole: boolean;
}, {
    branches: {
        name: string;
        id: string;
    }[];
    roles: {
        label: string;
        orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        areas: {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }[];
        summary: string;
        needsOwner: boolean;
    }[];
    canGrant: boolean;
    grantsEveryRole: boolean;
}>;
export type EmployeeAccessOptions = z.infer<typeof EmployeeAccessOptions>;
/**
 * `GET /api/v1/ops/employees/:id/access`: where the file's login stands, and what may be given.
 *
 * `state` reads in that order: an account on the file is `active`; else a live invitation sent
 * for it is `invited`; else a request waiting for the owner is `awaiting_owner`; else `none`.
 */
export declare const EmployeeAccess: z.ZodObject<{
    roles: z.ZodArray<z.ZodObject<{
        orgRole: z.ZodEnum<["manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
        label: z.ZodString;
        /** What the role is for, in one line. */
        summary: z.ZodString;
        /** The role's permissions at this business, by area, in the screen's words. */
        areas: z.ZodArray<z.ZodObject<{
            area: z.ZodEnum<["front_desk", "rooms", "services", "money", "property", "people"]>;
            label: z.ZodString;
            permissions: z.ZodArray<z.ZodObject<{
                permission: z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.manage", "lease.sign", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run", "lostfound.manage", "team.invite", "payout.manage", "expense.manage", "tax.manage", "guest.register", "pos.sell", "pos.checkout", "pos.discount", "pos.override", "pos.refund", "table.manage", "kitchen.work", "register.operate", "shift.review", "stock.manage", "customer.view", "customer.manage", "customer.admin"]>;
                label: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }, {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }, {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }>, "many">;
        /** A login into this role waits for the owner when the caller does not manage the team. */
        needsOwner: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        label: string;
        orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        areas: {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }[];
        summary: string;
        needsOwner: boolean;
    }, {
        label: string;
        orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        areas: {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }[];
        summary: string;
        needsOwner: boolean;
    }>, "many">;
    /** The branches the caller covers, which are the ones a login they give may name. */
    branches: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
    }, {
        name: string;
        id: string;
    }>, "many">;
    /** The caller may give logins (`team.invite` or `team.manage`); without it the state reads only. */
    canGrant: z.ZodBoolean;
    /** The caller manages the team: every role goes out at once, none is requested. */
    grantsEveryRole: z.ZodBoolean;
} & {
    employeeId: z.ZodString;
    state: z.ZodEnum<["active", "invited", "awaiting_owner", "none"]>;
    member: z.ZodNullable<z.ZodObject<{
        email: z.ZodNullable<z.ZodString>;
        orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
        branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
        lastActiveAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        lastActiveAt: string | null;
        branchIds: string[] | null;
    }, {
        email: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        lastActiveAt: string | null;
        branchIds: string[] | null;
    }>>;
    invitation: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
        branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
        sentAt: z.ZodString;
        expiresAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        expiresAt: string;
        email: string;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        sentAt: string;
    }, {
        id: string;
        expiresAt: string;
        email: string;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        sentAt: string;
    }>>;
    /** The file's latest request, whatever became of it. */
    request: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        employeeName: z.ZodString;
        employeeNumber: z.ZodString;
        jobTitle: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
        orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
        /** Null is every branch. */
        branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodEnum<["pending", "approved", "declined", "cancelled"]>;
        /** What HR wrote for the owner. */
        note: z.ZodNullable<z.ZodString>;
        requestedAt: z.ZodString;
        requestedByName: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        /** Why the owner declined. */
        decisionNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "pending" | "declined" | "cancelled";
        id: string;
        email: string;
        decidedAt: string | null;
        decisionNote: string | null;
        note: string | null;
        decidedByName: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        employeeId: string;
        employeeNumber: string;
        requestedByName: string | null;
        jobTitle: string | null;
        employeeName: string;
        requestedAt: string;
    }, {
        status: "approved" | "pending" | "declined" | "cancelled";
        id: string;
        email: string;
        decidedAt: string | null;
        decisionNote: string | null;
        note: string | null;
        decidedByName: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        employeeId: string;
        employeeNumber: string;
        requestedByName: string | null;
        jobTitle: string | null;
        employeeName: string;
        requestedAt: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    state: "active" | "none" | "invited" | "awaiting_owner";
    branches: {
        name: string;
        id: string;
    }[];
    member: {
        email: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        lastActiveAt: string | null;
        branchIds: string[] | null;
    } | null;
    roles: {
        label: string;
        orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        areas: {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }[];
        summary: string;
        needsOwner: boolean;
    }[];
    employeeId: string;
    request: {
        status: "approved" | "pending" | "declined" | "cancelled";
        id: string;
        email: string;
        decidedAt: string | null;
        decisionNote: string | null;
        note: string | null;
        decidedByName: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        employeeId: string;
        employeeNumber: string;
        requestedByName: string | null;
        jobTitle: string | null;
        employeeName: string;
        requestedAt: string;
    } | null;
    canGrant: boolean;
    grantsEveryRole: boolean;
    invitation: {
        id: string;
        expiresAt: string;
        email: string;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        sentAt: string;
    } | null;
}, {
    state: "active" | "none" | "invited" | "awaiting_owner";
    branches: {
        name: string;
        id: string;
    }[];
    member: {
        email: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        lastActiveAt: string | null;
        branchIds: string[] | null;
    } | null;
    roles: {
        label: string;
        orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        areas: {
            label: string;
            permissions: {
                label: string;
                permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
            }[];
            area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
        }[];
        summary: string;
        needsOwner: boolean;
    }[];
    employeeId: string;
    request: {
        status: "approved" | "pending" | "declined" | "cancelled";
        id: string;
        email: string;
        decidedAt: string | null;
        decisionNote: string | null;
        note: string | null;
        decidedByName: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        employeeId: string;
        employeeNumber: string;
        requestedByName: string | null;
        jobTitle: string | null;
        employeeName: string;
        requestedAt: string;
    } | null;
    canGrant: boolean;
    grantsEveryRole: boolean;
    invitation: {
        id: string;
        expiresAt: string;
        email: string;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        sentAt: string;
    } | null;
}>;
export type EmployeeAccess = z.infer<typeof EmployeeAccess>;
/** What giving a login did: sent the invitation, or asked the owner. */
export declare const GrantEmployeeAccessResponse: z.ZodObject<{
    outcome: z.ZodEnum<["invited", "requested"]>;
    access: z.ZodObject<{
        roles: z.ZodArray<z.ZodObject<{
            orgRole: z.ZodEnum<["manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
            label: z.ZodString;
            /** What the role is for, in one line. */
            summary: z.ZodString;
            /** The role's permissions at this business, by area, in the screen's words. */
            areas: z.ZodArray<z.ZodObject<{
                area: z.ZodEnum<["front_desk", "rooms", "services", "money", "property", "people"]>;
                label: z.ZodString;
                permissions: z.ZodArray<z.ZodObject<{
                    permission: z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.manage", "lease.sign", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run", "lostfound.manage", "team.invite", "payout.manage", "expense.manage", "tax.manage", "guest.register", "pos.sell", "pos.checkout", "pos.discount", "pos.override", "pos.refund", "table.manage", "kitchen.work", "register.operate", "shift.review", "stock.manage", "customer.view", "customer.manage", "customer.admin"]>;
                    label: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }, {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                label: string;
                permissions: {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }[];
                area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
            }, {
                label: string;
                permissions: {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }[];
                area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
            }>, "many">;
            /** A login into this role waits for the owner when the caller does not manage the team. */
            needsOwner: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            label: string;
            orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            areas: {
                label: string;
                permissions: {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }[];
                area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
            }[];
            summary: string;
            needsOwner: boolean;
        }, {
            label: string;
            orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            areas: {
                label: string;
                permissions: {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }[];
                area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
            }[];
            summary: string;
            needsOwner: boolean;
        }>, "many">;
        /** The branches the caller covers, which are the ones a login they give may name. */
        branches: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
        }, {
            name: string;
            id: string;
        }>, "many">;
        /** The caller may give logins (`team.invite` or `team.manage`); without it the state reads only. */
        canGrant: z.ZodBoolean;
        /** The caller manages the team: every role goes out at once, none is requested. */
        grantsEveryRole: z.ZodBoolean;
    } & {
        employeeId: z.ZodString;
        state: z.ZodEnum<["active", "invited", "awaiting_owner", "none"]>;
        member: z.ZodNullable<z.ZodObject<{
            email: z.ZodNullable<z.ZodString>;
            orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
            branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
            lastActiveAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            email: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            lastActiveAt: string | null;
            branchIds: string[] | null;
        }, {
            email: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            lastActiveAt: string | null;
            branchIds: string[] | null;
        }>>;
        invitation: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            email: z.ZodString;
            orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
            branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
            sentAt: z.ZodString;
            expiresAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            expiresAt: string;
            email: string;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            sentAt: string;
        }, {
            id: string;
            expiresAt: string;
            email: string;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            sentAt: string;
        }>>;
        /** The file's latest request, whatever became of it. */
        request: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            employeeId: z.ZodString;
            employeeName: z.ZodString;
            employeeNumber: z.ZodString;
            jobTitle: z.ZodNullable<z.ZodString>;
            email: z.ZodString;
            orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
            /** Null is every branch. */
            branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
            status: z.ZodEnum<["pending", "approved", "declined", "cancelled"]>;
            /** What HR wrote for the owner. */
            note: z.ZodNullable<z.ZodString>;
            requestedAt: z.ZodString;
            requestedByName: z.ZodNullable<z.ZodString>;
            decidedAt: z.ZodNullable<z.ZodString>;
            decidedByName: z.ZodNullable<z.ZodString>;
            /** Why the owner declined. */
            decisionNote: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "approved" | "pending" | "declined" | "cancelled";
            id: string;
            email: string;
            decidedAt: string | null;
            decisionNote: string | null;
            note: string | null;
            decidedByName: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            employeeId: string;
            employeeNumber: string;
            requestedByName: string | null;
            jobTitle: string | null;
            employeeName: string;
            requestedAt: string;
        }, {
            status: "approved" | "pending" | "declined" | "cancelled";
            id: string;
            email: string;
            decidedAt: string | null;
            decisionNote: string | null;
            note: string | null;
            decidedByName: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            employeeId: string;
            employeeNumber: string;
            requestedByName: string | null;
            jobTitle: string | null;
            employeeName: string;
            requestedAt: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        state: "active" | "none" | "invited" | "awaiting_owner";
        branches: {
            name: string;
            id: string;
        }[];
        member: {
            email: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            lastActiveAt: string | null;
            branchIds: string[] | null;
        } | null;
        roles: {
            label: string;
            orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            areas: {
                label: string;
                permissions: {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }[];
                area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
            }[];
            summary: string;
            needsOwner: boolean;
        }[];
        employeeId: string;
        request: {
            status: "approved" | "pending" | "declined" | "cancelled";
            id: string;
            email: string;
            decidedAt: string | null;
            decisionNote: string | null;
            note: string | null;
            decidedByName: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            employeeId: string;
            employeeNumber: string;
            requestedByName: string | null;
            jobTitle: string | null;
            employeeName: string;
            requestedAt: string;
        } | null;
        canGrant: boolean;
        grantsEveryRole: boolean;
        invitation: {
            id: string;
            expiresAt: string;
            email: string;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            sentAt: string;
        } | null;
    }, {
        state: "active" | "none" | "invited" | "awaiting_owner";
        branches: {
            name: string;
            id: string;
        }[];
        member: {
            email: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            lastActiveAt: string | null;
            branchIds: string[] | null;
        } | null;
        roles: {
            label: string;
            orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            areas: {
                label: string;
                permissions: {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }[];
                area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
            }[];
            summary: string;
            needsOwner: boolean;
        }[];
        employeeId: string;
        request: {
            status: "approved" | "pending" | "declined" | "cancelled";
            id: string;
            email: string;
            decidedAt: string | null;
            decisionNote: string | null;
            note: string | null;
            decidedByName: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            employeeId: string;
            employeeNumber: string;
            requestedByName: string | null;
            jobTitle: string | null;
            employeeName: string;
            requestedAt: string;
        } | null;
        canGrant: boolean;
        grantsEveryRole: boolean;
        invitation: {
            id: string;
            expiresAt: string;
            email: string;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            sentAt: string;
        } | null;
    }>;
}, "strip", z.ZodTypeAny, {
    access: {
        state: "active" | "none" | "invited" | "awaiting_owner";
        branches: {
            name: string;
            id: string;
        }[];
        member: {
            email: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            lastActiveAt: string | null;
            branchIds: string[] | null;
        } | null;
        roles: {
            label: string;
            orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            areas: {
                label: string;
                permissions: {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }[];
                area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
            }[];
            summary: string;
            needsOwner: boolean;
        }[];
        employeeId: string;
        request: {
            status: "approved" | "pending" | "declined" | "cancelled";
            id: string;
            email: string;
            decidedAt: string | null;
            decisionNote: string | null;
            note: string | null;
            decidedByName: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            employeeId: string;
            employeeNumber: string;
            requestedByName: string | null;
            jobTitle: string | null;
            employeeName: string;
            requestedAt: string;
        } | null;
        canGrant: boolean;
        grantsEveryRole: boolean;
        invitation: {
            id: string;
            expiresAt: string;
            email: string;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            sentAt: string;
        } | null;
    };
    outcome: "invited" | "requested";
}, {
    access: {
        state: "active" | "none" | "invited" | "awaiting_owner";
        branches: {
            name: string;
            id: string;
        }[];
        member: {
            email: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            lastActiveAt: string | null;
            branchIds: string[] | null;
        } | null;
        roles: {
            label: string;
            orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            areas: {
                label: string;
                permissions: {
                    label: string;
                    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.manage" | "lease.sign" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run" | "lostfound.manage" | "team.invite" | "payout.manage" | "expense.manage" | "tax.manage" | "guest.register" | "pos.sell" | "pos.checkout" | "pos.discount" | "pos.override" | "pos.refund" | "table.manage" | "kitchen.work" | "register.operate" | "shift.review" | "stock.manage" | "customer.view" | "customer.manage" | "customer.admin";
                }[];
                area: "property" | "people" | "money" | "rooms" | "front_desk" | "services";
            }[];
            summary: string;
            needsOwner: boolean;
        }[];
        employeeId: string;
        request: {
            status: "approved" | "pending" | "declined" | "cancelled";
            id: string;
            email: string;
            decidedAt: string | null;
            decisionNote: string | null;
            note: string | null;
            decidedByName: string | null;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            employeeId: string;
            employeeNumber: string;
            requestedByName: string | null;
            jobTitle: string | null;
            employeeName: string;
            requestedAt: string;
        } | null;
        canGrant: boolean;
        grantsEveryRole: boolean;
        invitation: {
            id: string;
            expiresAt: string;
            email: string;
            orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
            branchIds: string[] | null;
            sentAt: string;
        } | null;
    };
    outcome: "invited" | "requested";
}>;
export type GrantEmployeeAccessResponse = z.infer<typeof GrantEmployeeAccessResponse>;
/** `GET /api/v1/ops/team/access-requests`: waiting ones first, then the last month's decisions. */
export declare const StaffAccessRequestList: z.ZodObject<{
    requests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        employeeName: z.ZodString;
        employeeNumber: z.ZodString;
        jobTitle: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
        orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
        /** Null is every branch. */
        branchIds: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodEnum<["pending", "approved", "declined", "cancelled"]>;
        /** What HR wrote for the owner. */
        note: z.ZodNullable<z.ZodString>;
        requestedAt: z.ZodString;
        requestedByName: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        /** Why the owner declined. */
        decisionNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "pending" | "declined" | "cancelled";
        id: string;
        email: string;
        decidedAt: string | null;
        decisionNote: string | null;
        note: string | null;
        decidedByName: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        employeeId: string;
        employeeNumber: string;
        requestedByName: string | null;
        jobTitle: string | null;
        employeeName: string;
        requestedAt: string;
    }, {
        status: "approved" | "pending" | "declined" | "cancelled";
        id: string;
        email: string;
        decidedAt: string | null;
        decisionNote: string | null;
        note: string | null;
        decidedByName: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        employeeId: string;
        employeeNumber: string;
        requestedByName: string | null;
        jobTitle: string | null;
        employeeName: string;
        requestedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        status: "approved" | "pending" | "declined" | "cancelled";
        id: string;
        email: string;
        decidedAt: string | null;
        decisionNote: string | null;
        note: string | null;
        decidedByName: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        employeeId: string;
        employeeNumber: string;
        requestedByName: string | null;
        jobTitle: string | null;
        employeeName: string;
        requestedAt: string;
    }[];
}, {
    requests: {
        status: "approved" | "pending" | "declined" | "cancelled";
        id: string;
        email: string;
        decidedAt: string | null;
        decisionNote: string | null;
        note: string | null;
        decidedByName: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller";
        branchIds: string[] | null;
        employeeId: string;
        employeeNumber: string;
        requestedByName: string | null;
        jobTitle: string | null;
        employeeName: string;
        requestedAt: string;
    }[];
}>;
export type StaffAccessRequestList = z.infer<typeof StaffAccessRequestList>;
/** `POST /api/v1/ops/team/access-requests/:id/decline`. */
export declare const DeclineStaffAccessRequest: z.ZodObject<{
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
}, {
    note: string;
}>;
export type DeclineStaffAccessRequest = z.infer<typeof DeclineStaffAccessRequest>;
/** What each staff role is for, in one line a person choosing a login reads. */
export declare const ORG_ROLE_SUMMARY: Readonly<Record<InvitableOrgRole, string>>;
/** The words a refused login carries, one per rule. */
export declare const STAFF_ACCESS_REFUSAL: {
    readonly offboarded: "This person has left. A login can only be given to someone on file.";
    readonly hasLogin: "This person already has a login here. The owner changes their role on Team and roles.";
    readonly pending: "A login for this person is already waiting for the owner. Cancel it first to ask again.";
    readonly branches: "You can only give a login for the branches you cover.";
    readonly notPending: "This request has been decided already.";
};
//# sourceMappingURL=staff-access.d.ts.map