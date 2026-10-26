import { z } from "zod";
/** The landlord as the tenant sees them: the business, who signs for it, how to reach them. */
export declare const TenancyLandlord: z.ZodObject<{
    name: z.ZodString;
    signatoryName: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string | null;
    phone: string | null;
    signatoryName: string | null;
}, {
    name: string;
    email: string | null;
    phone: string | null;
    signatoryName: string | null;
}>;
export type TenancyLandlord = z.infer<typeof TenancyLandlord>;
/** Where the home is, as the contract names it. */
export declare const TenancyPlace: z.ZodObject<{
    propertyName: z.ZodString;
    unitLabel: z.ZodString;
    blockCode: z.ZodNullable<z.ZodString>;
    /** The home in one line: `Unit B-07, Kacyiru Court, KG 7 Ave, Urugwiro village, ...`. */
    line: z.ZodString;
    village: z.ZodNullable<z.ZodString>;
    cell: z.ZodNullable<z.ZodString>;
    sector: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
    province: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    province: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
    line: string;
    propertyName: string;
    unitLabel: string;
    blockCode: string | null;
}, {
    province: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
    line: string;
    propertyName: string;
    unitLabel: string;
    blockCode: string | null;
}>;
export type TenancyPlace = z.infer<typeof TenancyPlace>;
/** A signature standing on the current contract version. Its evidence stays on the signed PDF. */
export declare const TenancySignatureView: z.ZodObject<{
    role: z.ZodEnum<["landlord", "tenant"]>;
    typedName: z.ZodNullable<z.ZodString>;
    method: z.ZodEnum<["email_code", "password", "legacy"]>;
    signedAt: z.ZodString;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    role: "landlord" | "tenant";
    version: number;
    signedAt: string;
    method: "email_code" | "password" | "legacy";
    typedName: string | null;
}, {
    role: "landlord" | "tenant";
    version: number;
    signedAt: string;
    method: "email_code" | "password" | "legacy";
    typedName: string | null;
}>;
export type TenancySignatureView = z.infer<typeof TenancySignatureView>;
/** One row of `GET /me/tenancies`. */
export declare const TenancyListItem: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    landlordName: z.ZodString;
    propertyName: z.ZodString;
    unitLabel: z.ZodString;
    monthlyRentRwf: z.ZodNumber;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    /** Out for signature and the tenant has not signed yet. */
    needsMySignature: z.ZodBoolean;
    /** The oldest charge still open. */
    nextDue: z.ZodNullable<z.ZodObject<{
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        dueOn: string;
    }, {
        amountRwf: number;
        dueOn: string;
    }>>;
    /** What is owed now: open charges already due. */
    balanceRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended" | "signed";
    id: string;
    reference: string;
    propertyName: string;
    unitLabel: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    balanceRwf: number;
    landlordName: string;
    nextDue: {
        amountRwf: number;
        dueOn: string;
    } | null;
    needsMySignature: boolean;
}, {
    status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended" | "signed";
    id: string;
    reference: string;
    propertyName: string;
    unitLabel: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    balanceRwf: number;
    landlordName: string;
    nextDue: {
        amountRwf: number;
        dueOn: string;
    } | null;
    needsMySignature: boolean;
}>;
export type TenancyListItem = z.infer<typeof TenancyListItem>;
/** A lease sent to the signed in email and not accepted yet. */
export declare const TenancyInvitationItem: z.ZodObject<{
    invitationId: z.ZodString;
    leaseId: z.ZodString;
    landlordName: z.ZodString;
    propertyName: z.ZodString;
    unitLabel: z.ZodString;
    monthlyRentRwf: z.ZodNumber;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    sentAt: z.ZodString;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    propertyName: string;
    expiresAt: string;
    leaseId: string;
    unitLabel: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    landlordName: string;
    sentAt: string;
    invitationId: string;
}, {
    propertyName: string;
    expiresAt: string;
    leaseId: string;
    unitLabel: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    landlordName: string;
    sentAt: string;
    invitationId: string;
}>;
export type TenancyInvitationItem = z.infer<typeof TenancyInvitationItem>;
/** `GET /me/tenancies`: the person's tenancies, newest first, and leases waiting for them to accept. */
export declare const TenancyList: z.ZodObject<{
    tenancies: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
        landlordName: z.ZodString;
        propertyName: z.ZodString;
        unitLabel: z.ZodString;
        monthlyRentRwf: z.ZodNumber;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
        /** Out for signature and the tenant has not signed yet. */
        needsMySignature: z.ZodBoolean;
        /** The oldest charge still open. */
        nextDue: z.ZodNullable<z.ZodObject<{
            dueOn: z.ZodEffects<z.ZodString, string, string>;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            dueOn: string;
        }, {
            amountRwf: number;
            dueOn: string;
        }>>;
        /** What is owed now: open charges already due. */
        balanceRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        propertyName: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        balanceRwf: number;
        landlordName: string;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        needsMySignature: boolean;
    }, {
        status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        propertyName: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        balanceRwf: number;
        landlordName: string;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        needsMySignature: boolean;
    }>, "many">;
    invitations: z.ZodArray<z.ZodObject<{
        invitationId: z.ZodString;
        leaseId: z.ZodString;
        landlordName: z.ZodString;
        propertyName: z.ZodString;
        unitLabel: z.ZodString;
        monthlyRentRwf: z.ZodNumber;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
        sentAt: z.ZodString;
        expiresAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        propertyName: string;
        expiresAt: string;
        leaseId: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        landlordName: string;
        sentAt: string;
        invitationId: string;
    }, {
        propertyName: string;
        expiresAt: string;
        leaseId: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        landlordName: string;
        sentAt: string;
        invitationId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    invitations: {
        propertyName: string;
        expiresAt: string;
        leaseId: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        landlordName: string;
        sentAt: string;
        invitationId: string;
    }[];
    tenancies: {
        status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        propertyName: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        balanceRwf: number;
        landlordName: string;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        needsMySignature: boolean;
    }[];
}, {
    invitations: {
        propertyName: string;
        expiresAt: string;
        leaseId: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        landlordName: string;
        sentAt: string;
        invitationId: string;
    }[];
    tenancies: {
        status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        propertyName: string;
        unitLabel: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        balanceRwf: number;
        landlordName: string;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        needsMySignature: boolean;
    }[];
}>;
export type TenancyList = z.infer<typeof TenancyList>;
/** `GET /me/tenancies/:leaseId`, and what accepting an invitation or signing answers. */
export declare const TenancyDetail: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    landlord: z.ZodObject<{
        name: z.ZodString;
        signatoryName: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        email: string | null;
        phone: string | null;
        signatoryName: string | null;
    }, {
        name: string;
        email: string | null;
        phone: string | null;
        signatoryName: string | null;
    }>;
    place: z.ZodObject<{
        propertyName: z.ZodString;
        unitLabel: z.ZodString;
        blockCode: z.ZodNullable<z.ZodString>;
        /** The home in one line: `Unit B-07, Kacyiru Court, KG 7 Ave, Urugwiro village, ...`. */
        line: z.ZodString;
        village: z.ZodNullable<z.ZodString>;
        cell: z.ZodNullable<z.ZodString>;
        sector: z.ZodNullable<z.ZodString>;
        district: z.ZodNullable<z.ZodString>;
        province: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
        line: string;
        propertyName: string;
        unitLabel: string;
        blockCode: string | null;
    }, {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
        line: string;
        propertyName: string;
        unitLabel: string;
        blockCode: string | null;
    }>;
    /** The unit's cover photo (its first photo), a signed link; null when the landlord added none. */
    coverPhotoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tenant: z.ZodObject<{
        fullName: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        fullName: string;
        email: string | null;
        phone: string | null;
    }, {
        fullName: string;
        email: string | null;
        phone: string | null;
    }>;
    terms: z.ZodObject<{
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
        billingStartsOn: z.ZodEffects<z.ZodString, string, string>;
        monthlyRentRwf: z.ZodNumber;
        depositRwf: z.ZodNumber;
        rentDueDay: z.ZodNumber;
        graceDays: z.ZodNumber;
        noticeDays: z.ZodNumber;
        occupants: z.ZodArray<z.ZodString, "many">;
        otherTerms: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    }, {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    }>;
    currentVersion: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        templateVersion: z.ZodNumber;
        contentHash: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }, {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }>>;
    signatures: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["landlord", "tenant"]>;
        typedName: z.ZodNullable<z.ZodString>;
        method: z.ZodEnum<["email_code", "password", "legacy"]>;
        signedAt: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        role: "landlord" | "tenant";
        version: number;
        signedAt: string;
        method: "email_code" | "password" | "legacy";
        typedName: string | null;
    }, {
        role: "landlord" | "tenant";
        version: number;
        signedAt: string;
        method: "email_code" | "password" | "legacy";
        typedName: string | null;
    }>, "many">;
    /** Out for signature and the tenant has not signed yet: the lease page offers Sign. */
    needsMySignature: z.ZodBoolean;
    /** Both sides signed and the signed copy is kept: the PDF is the signed one. */
    signedCopyReady: z.ZodBoolean;
    charges: z.ZodObject<{
        rentChargedRwf: z.ZodNumber;
        rentPaidRwf: z.ZodNumber;
        overdueRwf: z.ZodNumber;
        balanceRwf: z.ZodNumber;
        nextDue: z.ZodNullable<z.ZodObject<{
            dueOn: z.ZodEffects<z.ZodString, string, string>;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            dueOn: string;
        }, {
            amountRwf: number;
            dueOn: string;
        }>>;
        depositAgreedRwf: z.ZodNumber;
        depositStatus: z.ZodNullable<z.ZodEnum<["awaiting", "held", "settled"]>>;
    }, "strip", z.ZodTypeAny, {
        balanceRwf: number;
        rentChargedRwf: number;
        rentPaidRwf: number;
        overdueRwf: number;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        depositAgreedRwf: number;
        depositStatus: "held" | "settled" | "awaiting" | null;
    }, {
        balanceRwf: number;
        rentChargedRwf: number;
        rentPaidRwf: number;
        overdueRwf: number;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        depositAgreedRwf: number;
        depositStatus: "held" | "settled" | "awaiting" | null;
    }>;
    /** The broker who brought the tenant, rated once the tenancy starts. */
    broker: z.ZodNullable<z.ZodObject<{
        name: z.ZodNullable<z.ZodString>;
        rating: z.ZodNullable<z.ZodObject<{
            stars: z.ZodNumber;
            comment: z.ZodNullable<z.ZodString>;
            ratedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            stars: number;
            comment: string | null;
            ratedAt: string;
        }, {
            stars: number;
            comment: string | null;
            ratedAt: string;
        }>>;
        canRate: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
        } | null;
        canRate: boolean;
    }, {
        name: string | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
        } | null;
        canRate: boolean;
    }>>;
    signedAt: z.ZodNullable<z.ZodString>;
    activatedAt: z.ZodNullable<z.ZodString>;
    endedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    cancelledAt: z.ZodNullable<z.ZodString>;
    cancelReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended" | "signed";
    broker: {
        name: string | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
        } | null;
        canRate: boolean;
    } | null;
    landlord: {
        name: string;
        email: string | null;
        phone: string | null;
        signatoryName: string | null;
    };
    id: string;
    place: {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
        line: string;
        propertyName: string;
        unitLabel: string;
        blockCode: string | null;
    };
    tenant: {
        fullName: string;
        email: string | null;
        phone: string | null;
    };
    createdAt: string;
    reference: string;
    charges: {
        balanceRwf: number;
        rentChargedRwf: number;
        rentPaidRwf: number;
        overdueRwf: number;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        depositAgreedRwf: number;
        depositStatus: "held" | "settled" | "awaiting" | null;
    };
    signedAt: string | null;
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    };
    cancelledAt: string | null;
    updatedAt: string;
    cancelReason: string | null;
    endedOn: string | null;
    currentVersion: {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    } | null;
    signatures: {
        role: "landlord" | "tenant";
        version: number;
        signedAt: string;
        method: "email_code" | "password" | "legacy";
        typedName: string | null;
    }[];
    activatedAt: string | null;
    needsMySignature: boolean;
    signedCopyReady: boolean;
    coverPhotoUrl?: string | null | undefined;
}, {
    status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended" | "signed";
    broker: {
        name: string | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
        } | null;
        canRate: boolean;
    } | null;
    landlord: {
        name: string;
        email: string | null;
        phone: string | null;
        signatoryName: string | null;
    };
    id: string;
    place: {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
        line: string;
        propertyName: string;
        unitLabel: string;
        blockCode: string | null;
    };
    tenant: {
        fullName: string;
        email: string | null;
        phone: string | null;
    };
    createdAt: string;
    reference: string;
    charges: {
        balanceRwf: number;
        rentChargedRwf: number;
        rentPaidRwf: number;
        overdueRwf: number;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        depositAgreedRwf: number;
        depositStatus: "held" | "settled" | "awaiting" | null;
    };
    signedAt: string | null;
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    };
    cancelledAt: string | null;
    updatedAt: string;
    cancelReason: string | null;
    endedOn: string | null;
    currentVersion: {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    } | null;
    signatures: {
        role: "landlord" | "tenant";
        version: number;
        signedAt: string;
        method: "email_code" | "password" | "legacy";
        typedName: string | null;
    }[];
    activatedAt: string | null;
    needsMySignature: boolean;
    signedCopyReady: boolean;
    coverPhotoUrl?: string | null | undefined;
}>;
export type TenancyDetail = z.infer<typeof TenancyDetail>;
//# sourceMappingURL=tenancy.d.ts.map