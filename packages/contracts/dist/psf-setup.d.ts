import { z } from "zod";
/**
 * PSF's own setup (2026-11-06, the owner): what the National Manager changes without a release.
 * The split between districts and headquarters, the levels and bands, and the public form's fields.
 */
export declare const SetPsfSplitRateRequest: z.ZodObject<{
    districtPercent: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    districtPercent: number;
}, {
    districtPercent: number;
}>;
export type SetPsfSplitRateRequest = z.infer<typeof SetPsfSplitRateRequest>;
export declare const PsfSplitRateView: z.ZodObject<{
    districtPercent: z.ZodNumber;
    headquartersPercent: z.ZodNumber;
    canEdit: z.ZodBoolean;
    history: z.ZodArray<z.ZodObject<{
        districtPercent: z.ZodNumber;
        setByName: z.ZodNullable<z.ZodString>;
        at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        at: string;
        setByName: string | null;
        districtPercent: number;
    }, {
        at: string;
        setByName: string | null;
        districtPercent: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    history: {
        at: string;
        setByName: string | null;
        districtPercent: number;
    }[];
    canEdit: boolean;
    districtPercent: number;
    headquartersPercent: number;
}, {
    history: {
        at: string;
        setByName: string | null;
        districtPercent: number;
    }[];
    canEdit: boolean;
    districtPercent: number;
    headquartersPercent: number;
}>;
export type PsfSplitRateView = z.infer<typeof PsfSplitRateView>;
/** A fee's split: the district's share rounded down, the rest, rounding included, headquarters. */
export declare function psfSplitOf(amountRwf: number, districtPercent: number): {
    districtRwf: number;
    headquartersRwf: number;
};
export declare const PsfMoneyQuery: z.ZodObject<{
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    from?: string | undefined;
    to?: string | undefined;
}, {
    from?: string | undefined;
    to?: string | undefined;
}>;
export type PsfMoneyQuery = z.infer<typeof PsfMoneyQuery>;
/** One amount and who it is for (2026-11-06): the whole fee, the district's share, headquarters' share. */
export declare const PsfFeeLine: z.ZodObject<{
    totalRwf: z.ZodNumber;
    districtRwf: z.ZodNumber;
    headquartersRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    totalRwf: number;
    districtRwf: number;
    headquartersRwf: number;
}, {
    totalRwf: number;
    districtRwf: number;
    headquartersRwf: number;
}>;
export type PsfFeeLine = z.infer<typeof PsfFeeLine>;
export declare const PSF_FEE_KINDS: readonly ["application", "renewal", "upgrade"];
export type PsfFeeKind = (typeof PSF_FEE_KINDS)[number];
export declare const PSF_FEE_KIND_LABEL: Record<PsfFeeKind, string>;
/** What came in, by what it was paid for. */
export declare const PsfFeeKinds: z.ZodObject<{
    application: z.ZodObject<{
        totalRwf: z.ZodNumber;
        districtRwf: z.ZodNumber;
        headquartersRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    }, {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    }>;
    renewal: z.ZodObject<{
        totalRwf: z.ZodNumber;
        districtRwf: z.ZodNumber;
        headquartersRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    }, {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    }>;
    upgrade: z.ZodObject<{
        totalRwf: z.ZodNumber;
        districtRwf: z.ZodNumber;
        headquartersRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    }, {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    }>;
}, "strip", z.ZodTypeAny, {
    renewal: {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    };
    upgrade: {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    };
    application: {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    };
}, {
    renewal: {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    };
    upgrade: {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    };
    application: {
        totalRwf: number;
        districtRwf: number;
        headquartersRwf: number;
    };
}>;
export type PsfFeeKinds = z.infer<typeof PsfFeeKinds>;
export declare const PSF_NO_FEE_KINDS: PsfFeeKinds;
/** Whose revenue "our revenue" is: headquarters for the National Manager, the district's for everyone else. */
export declare const PsfOurShare: z.ZodEnum<["headquarters", "district"]>;
export type PsfOurShare = z.infer<typeof PsfOurShare>;
/** Which amounts a screen shows: the whole fee, or the viewer's own share of it. */
export type PsfFeeView = "all" | "ours";
export declare function psfFeeLinesAdded(lines: readonly PsfFeeLine[]): PsfFeeLine;
/** Rows of a fee ledger, rolled up by what they were paid for. */
export declare function psfFeeKindsOf(rows: readonly (PsfFeeLine & {
    kind: PsfFeeKind;
})[]): PsfFeeKinds;
export declare function psfFeeTotal(kinds: PsfFeeKinds): PsfFeeLine;
/** The amount to show for a line, in the view picked. */
export declare function psfFeeShown(line: PsfFeeLine, view: PsfFeeView, ours: PsfOurShare): number;
export declare const PsfMoneyView: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    /** The level this officer reads at: a National Manager sees it all. */
    level: z.ZodEnum<["country", "province", "district"]>;
    districtPercent: z.ZodNumber;
    ourShare: z.ZodEnum<["headquarters", "district"]>;
    totals: z.ZodObject<{
        totalRwf: z.ZodNumber;
        districtRwf: z.ZodNumber;
        headquartersRwf: z.ZodNumber;
        /** The same amounts, by what they were paid for. */
        kinds: z.ZodObject<{
            application: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
            renewal: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
            upgrade: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        }, {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        }>;
        /** Payments in the period. */
        payments: z.ZodNumber;
        /** Members in good standing today. */
        members: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }, {
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }>;
    byRegion: z.ZodArray<z.ZodObject<{
        totalRwf: z.ZodNumber;
        districtRwf: z.ZodNumber;
        headquartersRwf: z.ZodNumber;
        /** The same amounts, by what they were paid for. */
        kinds: z.ZodObject<{
            application: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
            renewal: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
            upgrade: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        }, {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        }>;
        /** Payments in the period. */
        payments: z.ZodNumber;
        /** Members in good standing today. */
        members: z.ZodNumber;
    } & {
        provinceId: z.ZodNumber;
        provinceName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provinceId: number;
        provinceName: string;
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }, {
        provinceId: number;
        provinceName: string;
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }>, "many">;
    byDistrict: z.ZodArray<z.ZodObject<{
        totalRwf: z.ZodNumber;
        districtRwf: z.ZodNumber;
        headquartersRwf: z.ZodNumber;
        /** The same amounts, by what they were paid for. */
        kinds: z.ZodObject<{
            application: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
            renewal: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
            upgrade: z.ZodObject<{
                totalRwf: z.ZodNumber;
                districtRwf: z.ZodNumber;
                headquartersRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }, {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        }, {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        }>;
        /** Payments in the period. */
        payments: z.ZodNumber;
        /** Members in good standing today. */
        members: z.ZodNumber;
    } & {
        districtId: z.ZodNumber;
        districtName: z.ZodString;
        provinceId: z.ZodNumber;
        provinceName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        districtName: string;
        provinceId: number;
        districtId: number;
        provinceName: string;
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }, {
        districtName: string;
        provinceId: number;
        districtId: number;
        provinceName: string;
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    byDistrict: {
        districtName: string;
        provinceId: number;
        districtId: number;
        provinceName: string;
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }[];
    totals: {
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    };
    from: string;
    to: string;
    level: "country" | "province" | "district";
    districtPercent: number;
    ourShare: "district" | "headquarters";
    byRegion: {
        provinceId: number;
        provinceName: string;
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }[];
}, {
    byDistrict: {
        districtName: string;
        provinceId: number;
        districtId: number;
        provinceName: string;
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }[];
    totals: {
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    };
    from: string;
    to: string;
    level: "country" | "province" | "district";
    districtPercent: number;
    ourShare: "district" | "headquarters";
    byRegion: {
        provinceId: number;
        provinceName: string;
        members: number;
        payments: number;
        totalRwf: number;
        kinds: {
            renewal: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            upgrade: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
            application: {
                totalRwf: number;
                districtRwf: number;
                headquartersRwf: number;
            };
        };
        districtRwf: number;
        headquartersRwf: number;
    }[];
}>;
export type PsfMoneyView = z.infer<typeof PsfMoneyView>;
export declare const PsfLevel: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    blurb: z.ZodNullable<z.ZodString>;
    sortOrder: z.ZodNumber;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    name: string;
    sortOrder: number;
    blurb: string | null;
}, {
    code: string;
    active: boolean;
    name: string;
    sortOrder: number;
    blurb: string | null;
}>;
export type PsfLevel = z.infer<typeof PsfLevel>;
export declare const CreatePsfLevelRequest: z.ZodObject<{
    name: z.ZodString;
    blurb: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    blurb?: string | null | undefined;
}, {
    name: string;
    blurb?: string | null | undefined;
}>;
export type CreatePsfLevelRequest = z.infer<typeof CreatePsfLevelRequest>;
export declare const UpdatePsfLevelRequest: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    blurb: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    name?: string | undefined;
    sortOrder?: number | undefined;
    blurb?: string | null | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    sortOrder?: number | undefined;
    blurb?: string | null | undefined;
}>;
export type UpdatePsfLevelRequest = z.infer<typeof UpdatePsfLevelRequest>;
export declare const PsfBand: z.ZodObject<{
    code: z.ZodString;
    level: z.ZodString;
    name: z.ZodString;
    /** The least a member pays in this band. */
    minRwf: z.ZodNullable<z.ZodNumber>;
    /** The most; null is "and up". */
    maxRwf: z.ZodNullable<z.ZodNumber>;
    sortOrder: z.ZodNumber;
    active: z.ZodBoolean;
    /** What the membership card's ribbon says, like Bronze. */
    cardBadge: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    /** Members on it today: they keep it until they renew or upgrade. */
    members: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    name: string;
    sortOrder: number;
    members: number;
    level: string;
    minRwf: number | null;
    maxRwf: number | null;
    cardBadge: string | null;
}, {
    code: string;
    active: boolean;
    name: string;
    sortOrder: number;
    members: number;
    level: string;
    minRwf: number | null;
    maxRwf: number | null;
    cardBadge?: string | null | undefined;
}>;
export type PsfBand = z.infer<typeof PsfBand>;
export declare const CreatePsfBandRequest: z.ZodEffects<z.ZodObject<{
    level: z.ZodString;
    /** Empty is the usual name: "Indatwa, 10,000 to 19,999". */
    name: z.ZodOptional<z.ZodString>;
    cardBadge: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    minRwf: z.ZodNumber;
    maxRwf: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    level: string;
    minRwf: number;
    maxRwf: number | null;
    name?: string | undefined;
    cardBadge?: string | null | undefined;
}, {
    level: string;
    minRwf: number;
    maxRwf: number | null;
    name?: string | undefined;
    cardBadge?: string | null | undefined;
}>, {
    level: string;
    minRwf: number;
    maxRwf: number | null;
    name?: string | undefined;
    cardBadge?: string | null | undefined;
}, {
    level: string;
    minRwf: number;
    maxRwf: number | null;
    name?: string | undefined;
    cardBadge?: string | null | undefined;
}>;
export type CreatePsfBandRequest = z.infer<typeof CreatePsfBandRequest>;
export declare const UpdatePsfBandRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    cardBadge: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    minRwf: z.ZodOptional<z.ZodNumber>;
    maxRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    name?: string | undefined;
    sortOrder?: number | undefined;
    minRwf?: number | undefined;
    maxRwf?: number | null | undefined;
    cardBadge?: string | null | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    sortOrder?: number | undefined;
    minRwf?: number | undefined;
    maxRwf?: number | null | undefined;
    cardBadge?: string | null | undefined;
}>, {
    active?: boolean | undefined;
    name?: string | undefined;
    sortOrder?: number | undefined;
    minRwf?: number | undefined;
    maxRwf?: number | null | undefined;
    cardBadge?: string | null | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    sortOrder?: number | undefined;
    minRwf?: number | undefined;
    maxRwf?: number | null | undefined;
    cardBadge?: string | null | undefined;
}>;
export type UpdatePsfBandRequest = z.infer<typeof UpdatePsfBandRequest>;
export declare const PsfBandsView: z.ZodObject<{
    levels: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        blurb: z.ZodNullable<z.ZodString>;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: string;
        active: boolean;
        name: string;
        sortOrder: number;
        blurb: string | null;
    }, {
        code: string;
        active: boolean;
        name: string;
        sortOrder: number;
        blurb: string | null;
    }>, "many">;
    bands: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        level: z.ZodString;
        name: z.ZodString;
        /** The least a member pays in this band. */
        minRwf: z.ZodNullable<z.ZodNumber>;
        /** The most; null is "and up". */
        maxRwf: z.ZodNullable<z.ZodNumber>;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
        /** What the membership card's ribbon says, like Bronze. */
        cardBadge: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        /** Members on it today: they keep it until they renew or upgrade. */
        members: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        active: boolean;
        name: string;
        sortOrder: number;
        members: number;
        level: string;
        minRwf: number | null;
        maxRwf: number | null;
        cardBadge: string | null;
    }, {
        code: string;
        active: boolean;
        name: string;
        sortOrder: number;
        members: number;
        level: string;
        minRwf: number | null;
        maxRwf: number | null;
        cardBadge?: string | null | undefined;
    }>, "many">;
    canEdit: z.ZodBoolean;
    /** Said once after a save, like the district prices a new range cleared. */
    note: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note: string | null;
    canEdit: boolean;
    levels: {
        code: string;
        active: boolean;
        name: string;
        sortOrder: number;
        blurb: string | null;
    }[];
    bands: {
        code: string;
        active: boolean;
        name: string;
        sortOrder: number;
        members: number;
        level: string;
        minRwf: number | null;
        maxRwf: number | null;
        cardBadge: string | null;
    }[];
}, {
    canEdit: boolean;
    levels: {
        code: string;
        active: boolean;
        name: string;
        sortOrder: number;
        blurb: string | null;
    }[];
    bands: {
        code: string;
        active: boolean;
        name: string;
        sortOrder: number;
        members: number;
        level: string;
        minRwf: number | null;
        maxRwf: number | null;
        cardBadge?: string | null | undefined;
    }[];
    note?: string | null | undefined;
}>;
export type PsfBandsView = z.infer<typeof PsfBandsView>;
/** The band a new range collides with, if any. Bands PSF prices by quote carry no range and never collide. */
export declare function psfBandOverlap<T extends {
    code: string;
    minRwf: number | null;
    maxRwf: number | null;
    active: boolean;
}>(bands: readonly T[], range: {
    code?: string;
    minRwf: number;
    maxRwf: number | null;
}): T | null;
/** The usual name of a band. */
export declare function psfBandName(levelName: string, minRwf: number, maxRwf: number | null): string;
/** A short code from a name: `Silver circle` is `silver_circle`. */
export declare function psfCodeFrom(name: string): string;
export declare const PSF_FORM_STEPS: readonly ["business", "place", "you", "membership"];
export declare const PsfFormStep: z.ZodEnum<["business", "place", "you", "membership"]>;
export type PsfFormStep = z.infer<typeof PsfFormStep>;
export declare const PSF_FORM_STEP_LABEL: Readonly<Record<PsfFormStep, string>>;
/**
 * Every built-in field of the public form. `locked` fields keep showing and stay required, because the
 * system runs on them: the certificate, the District Manager a business goes to, the price, the texts,
 * the records PSF's reports count. PSF can still change their wording and order.
 */
export declare const PSF_FORM_FIELDS: readonly [{
    readonly key: "registrationKind";
    readonly step: "business";
    readonly label: "How is it registered?";
    readonly help: "A TIN is not required to join PSF.";
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "tin";
    readonly step: "business";
    readonly label: "TIN";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "registrationNumber";
    readonly step: "business";
    readonly label: "Registration number";
    readonly help: "As printed on the certificate.";
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "companyType";
    readonly step: "business";
    readonly label: "Kind of company";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "ownership";
    readonly step: "business";
    readonly label: "Ownership";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "legalName";
    readonly step: "business";
    readonly label: "Business name";
    readonly help: "As your customers and your certificate know it. Every branch goes by this name too.";
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "website";
    readonly step: "business";
    readonly label: "Website";
    readonly help: null;
    readonly required: false;
    readonly locked: false;
}, {
    readonly key: "clusterCode";
    readonly step: "business";
    readonly label: "Your sector";
    readonly help: "PSF groups its members by sector. Pick yours, then the association you belong to.";
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "subsectorId";
    readonly step: "business";
    readonly label: "Kind of business";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "associationCode";
    readonly step: "business";
    readonly label: "Association";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "businessActivity";
    readonly step: "business";
    readonly label: "What does the business do?";
    readonly help: null;
    readonly required: true;
    readonly locked: false;
}, {
    readonly key: "ownerGroups";
    readonly step: "business";
    readonly label: "Who owns it";
    readonly help: null;
    readonly required: false;
    readonly locked: false;
}, {
    readonly key: "province";
    readonly step: "place";
    readonly label: "Province";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "district";
    readonly step: "place";
    readonly label: "District";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "sector";
    readonly step: "place";
    readonly label: "Sector";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "cell";
    readonly step: "place";
    readonly label: "Cell";
    readonly help: null;
    readonly required: true;
    readonly locked: false;
}, {
    readonly key: "village";
    readonly step: "place";
    readonly label: "Village";
    readonly help: null;
    readonly required: true;
    readonly locked: false;
}, {
    readonly key: "street";
    readonly step: "place";
    readonly label: "Street address";
    readonly help: null;
    readonly required: false;
    readonly locked: false;
}, {
    readonly key: "tradeDirection";
    readonly step: "place";
    readonly label: "Do you export or import?";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "nationalId";
    readonly step: "you";
    readonly label: "National ID number";
    readonly help: "16 digits, as printed on your ID.";
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "role";
    readonly step: "you";
    readonly label: "Your role in the business";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "gender";
    readonly step: "you";
    readonly label: "Gender";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "photo";
    readonly step: "you";
    readonly label: "Passport photo";
    readonly help: "Printed on your membership card and certificate. Anyone who checks your card sees it. JPEG or PNG, up to 2 MB.";
    readonly required: true;
    readonly locked: false;
}, {
    readonly key: "phone";
    readonly step: "you";
    readonly label: "Phone";
    readonly help: null;
    readonly required: true;
    readonly locked: true;
}, {
    readonly key: "email";
    readonly step: "you";
    readonly label: "Email";
    readonly help: null;
    readonly required: false;
    readonly locked: false;
}, {
    readonly key: "logo";
    readonly step: "membership";
    readonly label: "Logo";
    readonly help: "Printed on your membership certificate. PNG, JPEG or WebP, up to 2 MB.";
    readonly required: false;
    readonly locked: false;
}];
export type PsfFormFieldName = (typeof PSF_FORM_FIELDS)[number]["key"];
/** One built-in field as it stands: PSF's settings over the form's own wording. */
export declare const PsfFormFieldSetting: z.ZodObject<{
    key: z.ZodString;
    step: z.ZodEnum<["business", "place", "you", "membership"]>;
    label: z.ZodString;
    help: z.ZodNullable<z.ZodString>;
    required: z.ZodBoolean;
    visible: z.ZodBoolean;
    locked: z.ZodBoolean;
    sortOrder: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sortOrder: number;
    label: string;
    key: string;
    required: boolean;
    locked: boolean;
    step: "business" | "membership" | "place" | "you";
    help: string | null;
    visible: boolean;
}, {
    sortOrder: number;
    label: string;
    key: string;
    required: boolean;
    locked: boolean;
    step: "business" | "membership" | "place" | "you";
    help: string | null;
    visible: boolean;
}>;
export type PsfFormFieldSetting = z.infer<typeof PsfFormFieldSetting>;
export declare const UpdatePsfFormFieldSettingRequest: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    help: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    required: z.ZodOptional<z.ZodBoolean>;
    visible: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sortOrder?: number | undefined;
    label?: string | undefined;
    required?: boolean | undefined;
    help?: string | null | undefined;
    visible?: boolean | undefined;
}, {
    sortOrder?: number | undefined;
    label?: string | undefined;
    required?: boolean | undefined;
    help?: string | null | undefined;
    visible?: boolean | undefined;
}>;
export type UpdatePsfFormFieldSettingRequest = z.infer<typeof UpdatePsfFormFieldSettingRequest>;
/** An extra question PSF added. */
export declare const PsfFormExtra: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    step: z.ZodEnum<["business", "place", "you", "membership"]>;
    label: z.ZodString;
    help: z.ZodNullable<z.ZodString>;
    fieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
    required: z.ZodBoolean;
    options: z.ZodArray<z.ZodString, "many">;
    sortOrder: z.ZodNumber;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    options: string[];
    active: boolean;
    id: string;
    sortOrder: number;
    label: string;
    key: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    required: boolean;
    step: "business" | "membership" | "place" | "you";
    help: string | null;
}, {
    options: string[];
    active: boolean;
    id: string;
    sortOrder: number;
    label: string;
    key: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    required: boolean;
    step: "business" | "membership" | "place" | "you";
    help: string | null;
}>;
export type PsfFormExtra = z.infer<typeof PsfFormExtra>;
/** `GET /psf/form-config`: what the public form asks. Hidden fields and retired questions are left to the form to skip. */
export declare const PsfFormConfig: z.ZodObject<{
    fields: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        step: z.ZodEnum<["business", "place", "you", "membership"]>;
        label: z.ZodString;
        help: z.ZodNullable<z.ZodString>;
        required: z.ZodBoolean;
        visible: z.ZodBoolean;
        locked: z.ZodBoolean;
        sortOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sortOrder: number;
        label: string;
        key: string;
        required: boolean;
        locked: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
        visible: boolean;
    }, {
        sortOrder: number;
        label: string;
        key: string;
        required: boolean;
        locked: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
        visible: boolean;
    }>, "many">;
    extras: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        step: z.ZodEnum<["business", "place", "you", "membership"]>;
        label: z.ZodString;
        help: z.ZodNullable<z.ZodString>;
        fieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
        required: z.ZodBoolean;
        options: z.ZodArray<z.ZodString, "many">;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        label: string;
        key: string;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
    }, {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        label: string;
        key: string;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    fields: {
        sortOrder: number;
        label: string;
        key: string;
        required: boolean;
        locked: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
        visible: boolean;
    }[];
    extras: {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        label: string;
        key: string;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
    }[];
}, {
    fields: {
        sortOrder: number;
        label: string;
        key: string;
        required: boolean;
        locked: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
        visible: boolean;
    }[];
    extras: {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        label: string;
        key: string;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
    }[];
}>;
export type PsfFormConfig = z.infer<typeof PsfFormConfig>;
export declare const PsfFormSetupView: z.ZodObject<{
    fields: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        step: z.ZodEnum<["business", "place", "you", "membership"]>;
        label: z.ZodString;
        help: z.ZodNullable<z.ZodString>;
        required: z.ZodBoolean;
        visible: z.ZodBoolean;
        locked: z.ZodBoolean;
        sortOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sortOrder: number;
        label: string;
        key: string;
        required: boolean;
        locked: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
        visible: boolean;
    }, {
        sortOrder: number;
        label: string;
        key: string;
        required: boolean;
        locked: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
        visible: boolean;
    }>, "many">;
    extras: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        step: z.ZodEnum<["business", "place", "you", "membership"]>;
        label: z.ZodString;
        help: z.ZodNullable<z.ZodString>;
        fieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
        required: z.ZodBoolean;
        options: z.ZodArray<z.ZodString, "many">;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        label: string;
        key: string;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
    }, {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        label: string;
        key: string;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
    }>, "many">;
} & {
    canEdit: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    canEdit: boolean;
    fields: {
        sortOrder: number;
        label: string;
        key: string;
        required: boolean;
        locked: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
        visible: boolean;
    }[];
    extras: {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        label: string;
        key: string;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
    }[];
}, {
    canEdit: boolean;
    fields: {
        sortOrder: number;
        label: string;
        key: string;
        required: boolean;
        locked: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
        visible: boolean;
    }[];
    extras: {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        label: string;
        key: string;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
        step: "business" | "membership" | "place" | "you";
        help: string | null;
    }[];
}>;
export type PsfFormSetupView = z.infer<typeof PsfFormSetupView>;
/** The form's own settings, for before the API answers and for a field PSF never touched. */
export declare function psfFormDefaults(): PsfFormFieldSetting[];
/** The answers to PSF's extra questions, as the form sends them. */
export declare const PsfExtraAnswers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
export type PsfExtraAnswers = z.infer<typeof PsfExtraAnswers>;
/** The problem with one answer to an extra question, or null. Shared by the form and the API. */
export declare function psfExtraAnswerProblem(field: Pick<PsfFormExtra, "label" | "fieldType" | "required" | "options">, value: unknown): string | null;
/** Catalogue: a sector and an association, added or changed by the National Manager. */
export declare const AddPsfSectorRequest: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
}>;
export type AddPsfSectorRequest = z.infer<typeof AddPsfSectorRequest>;
export declare const ChangePsfSectorRequest: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    name?: string | undefined;
    sortOrder?: number | undefined;
    description?: string | null | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    sortOrder?: number | undefined;
    description?: string | null | undefined;
}>;
export type ChangePsfSectorRequest = z.infer<typeof ChangePsfSectorRequest>;
export declare const AddPsfAssociationRequest: z.ZodObject<{
    clusterCode: z.ZodString;
    name: z.ZodString;
    acronym: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    clusterCode: string;
    acronym?: string | null | undefined;
}, {
    name: string;
    clusterCode: string;
    acronym?: string | null | undefined;
}>;
export type AddPsfAssociationRequest = z.infer<typeof AddPsfAssociationRequest>;
export declare const ChangePsfAssociationRequest: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    acronym: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    name?: string | undefined;
    acronym?: string | null | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    acronym?: string | null | undefined;
}>;
export type ChangePsfAssociationRequest = z.infer<typeof ChangePsfAssociationRequest>;
export declare const CreatePsfFormExtraRequest: z.ZodEffects<z.ZodObject<{
    step: z.ZodEnum<["business", "place", "you", "membership"]>;
    label: z.ZodString;
    help: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
    required: z.ZodDefault<z.ZodBoolean>;
    options: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    options: string[];
    label: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    required: boolean;
    step: "business" | "membership" | "place" | "you";
    help?: string | null | undefined;
}, {
    label: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    step: "business" | "membership" | "place" | "you";
    options?: string[] | undefined;
    required?: boolean | undefined;
    help?: string | null | undefined;
}>, {
    options: string[];
    label: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    required: boolean;
    step: "business" | "membership" | "place" | "you";
    help?: string | null | undefined;
}, {
    label: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    step: "business" | "membership" | "place" | "you";
    options?: string[] | undefined;
    required?: boolean | undefined;
    help?: string | null | undefined;
}>;
export type CreatePsfFormExtraRequest = z.infer<typeof CreatePsfFormExtraRequest>;
export declare const UpdatePsfFormExtraRequest: z.ZodObject<{
    step: z.ZodOptional<z.ZodEnum<["business", "place", "you", "membership"]>>;
    label: z.ZodOptional<z.ZodString>;
    help: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    required: z.ZodOptional<z.ZodBoolean>;
    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    options?: string[] | undefined;
    active?: boolean | undefined;
    sortOrder?: number | undefined;
    label?: string | undefined;
    required?: boolean | undefined;
    step?: "business" | "membership" | "place" | "you" | undefined;
    help?: string | null | undefined;
}, {
    options?: string[] | undefined;
    active?: boolean | undefined;
    sortOrder?: number | undefined;
    label?: string | undefined;
    required?: boolean | undefined;
    step?: "business" | "membership" | "place" | "you" | undefined;
    help?: string | null | undefined;
}>;
export type UpdatePsfFormExtraRequest = z.infer<typeof UpdatePsfFormExtraRequest>;
//# sourceMappingURL=psf-setup.d.ts.map