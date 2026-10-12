import { z } from "zod";
export declare const ChecklistKind: z.ZodEnum<["onboarding", "offboarding"]>;
export type ChecklistKind = z.infer<typeof ChecklistKind>;
export declare const CHECKLIST_KIND_LABEL: Readonly<Record<ChecklistKind, string>>;
export declare const ChecklistTemplateItem: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    /** The person does this themselves; otherwise the office does. */
    byEmployee: z.ZodBoolean;
    /**
     * When it is due, in days from the day the checklist counts from: the first
     * day for somebody joining, the last day for somebody leaving. Negative is
     * before that day, as "collect the uniform" two days before a last day.
     */
    dueAfterDays: z.ZodNumber;
    /** Only for people in this job; null is everybody. */
    jobPosition: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
    }, {
        id: string;
        title: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    byEmployee: boolean;
    dueAfterDays: number;
    jobPosition: {
        id: string;
        title: string;
    } | null;
}, {
    id: string;
    label: string;
    byEmployee: boolean;
    dueAfterDays: number;
    jobPosition: {
        id: string;
        title: string;
    } | null;
}>;
export type ChecklistTemplateItem = z.infer<typeof ChecklistTemplateItem>;
export declare const ChecklistTemplate: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["onboarding", "offboarding"]>;
    name: z.ZodString;
    /** The one a new file, or an offboarding, starts from. One per kind. */
    isDefault: z.ZodBoolean;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        /** The person does this themselves; otherwise the office does. */
        byEmployee: z.ZodBoolean;
        /**
         * When it is due, in days from the day the checklist counts from: the first
         * day for somebody joining, the last day for somebody leaving. Negative is
         * before that day, as "collect the uniform" two days before a last day.
         */
        dueAfterDays: z.ZodNumber;
        /** Only for people in this job; null is everybody. */
        jobPosition: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
        }, {
            id: string;
            title: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        byEmployee: boolean;
        dueAfterDays: number;
        jobPosition: {
            id: string;
            title: string;
        } | null;
    }, {
        id: string;
        label: string;
        byEmployee: boolean;
        dueAfterDays: number;
        jobPosition: {
            id: string;
            title: string;
        } | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "onboarding" | "offboarding";
    items: {
        id: string;
        label: string;
        byEmployee: boolean;
        dueAfterDays: number;
        jobPosition: {
            id: string;
            title: string;
        } | null;
    }[];
    id: string;
    isDefault: boolean;
}, {
    name: string;
    kind: "onboarding" | "offboarding";
    items: {
        id: string;
        label: string;
        byEmployee: boolean;
        dueAfterDays: number;
        jobPosition: {
            id: string;
            title: string;
        } | null;
    }[];
    id: string;
    isDefault: boolean;
}>;
export type ChecklistTemplate = z.infer<typeof ChecklistTemplate>;
export declare const ChecklistTemplateList: z.ZodObject<{
    templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["onboarding", "offboarding"]>;
        name: z.ZodString;
        /** The one a new file, or an offboarding, starts from. One per kind. */
        isDefault: z.ZodBoolean;
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            /** The person does this themselves; otherwise the office does. */
            byEmployee: z.ZodBoolean;
            /**
             * When it is due, in days from the day the checklist counts from: the first
             * day for somebody joining, the last day for somebody leaving. Negative is
             * before that day, as "collect the uniform" two days before a last day.
             */
            dueAfterDays: z.ZodNumber;
            /** Only for people in this job; null is everybody. */
            jobPosition: z.ZodNullable<z.ZodObject<{
                id: z.ZodString;
                title: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                id: string;
                title: string;
            }, {
                id: string;
                title: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            byEmployee: boolean;
            dueAfterDays: number;
            jobPosition: {
                id: string;
                title: string;
            } | null;
        }, {
            id: string;
            label: string;
            byEmployee: boolean;
            dueAfterDays: number;
            jobPosition: {
                id: string;
                title: string;
            } | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "onboarding" | "offboarding";
        items: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueAfterDays: number;
            jobPosition: {
                id: string;
                title: string;
            } | null;
        }[];
        id: string;
        isDefault: boolean;
    }, {
        name: string;
        kind: "onboarding" | "offboarding";
        items: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueAfterDays: number;
            jobPosition: {
                id: string;
                title: string;
            } | null;
        }[];
        id: string;
        isDefault: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    templates: {
        name: string;
        kind: "onboarding" | "offboarding";
        items: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueAfterDays: number;
            jobPosition: {
                id: string;
                title: string;
            } | null;
        }[];
        id: string;
        isDefault: boolean;
    }[];
}, {
    templates: {
        name: string;
        kind: "onboarding" | "offboarding";
        items: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueAfterDays: number;
            jobPosition: {
                id: string;
                title: string;
            } | null;
        }[];
        id: string;
        isDefault: boolean;
    }[];
}>;
export type ChecklistTemplateList = z.infer<typeof ChecklistTemplateList>;
/** `POST /ops/hr/checklist-templates`. */
export declare const CreateChecklistTemplateRequest: z.ZodObject<{
    kind: z.ZodEnum<["onboarding", "offboarding"]>;
    name: z.ZodString;
    isDefault: z.ZodOptional<z.ZodBoolean>;
    items: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        byEmployee: z.ZodOptional<z.ZodBoolean>;
        dueAfterDays: z.ZodOptional<z.ZodNumber>;
        jobPositionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        jobPositionId?: string | null | undefined;
        byEmployee?: boolean | undefined;
        dueAfterDays?: number | undefined;
    }, {
        label: string;
        jobPositionId?: string | null | undefined;
        byEmployee?: boolean | undefined;
        dueAfterDays?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "onboarding" | "offboarding";
    items: {
        label: string;
        jobPositionId?: string | null | undefined;
        byEmployee?: boolean | undefined;
        dueAfterDays?: number | undefined;
    }[];
    isDefault?: boolean | undefined;
}, {
    name: string;
    kind: "onboarding" | "offboarding";
    items: {
        label: string;
        jobPositionId?: string | null | undefined;
        byEmployee?: boolean | undefined;
        dueAfterDays?: number | undefined;
    }[];
    isDefault?: boolean | undefined;
}>;
export type CreateChecklistTemplateRequest = z.infer<typeof CreateChecklistTemplateRequest>;
/**
 * `PUT /ops/hr/checklist-templates/:id`: the whole template, its tasks
 * replaced in the order sent. Its kind never changes: a joining list that
 * became a leaving list would be a different list.
 */
export declare const UpdateChecklistTemplateRequest: z.ZodObject<Omit<{
    kind: z.ZodEnum<["onboarding", "offboarding"]>;
    name: z.ZodString;
    isDefault: z.ZodOptional<z.ZodBoolean>;
    items: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        byEmployee: z.ZodOptional<z.ZodBoolean>;
        dueAfterDays: z.ZodOptional<z.ZodNumber>;
        jobPositionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        jobPositionId?: string | null | undefined;
        byEmployee?: boolean | undefined;
        dueAfterDays?: number | undefined;
    }, {
        label: string;
        jobPositionId?: string | null | undefined;
        byEmployee?: boolean | undefined;
        dueAfterDays?: number | undefined;
    }>, "many">;
}, "kind">, "strip", z.ZodTypeAny, {
    name: string;
    items: {
        label: string;
        jobPositionId?: string | null | undefined;
        byEmployee?: boolean | undefined;
        dueAfterDays?: number | undefined;
    }[];
    isDefault?: boolean | undefined;
}, {
    name: string;
    items: {
        label: string;
        jobPositionId?: string | null | undefined;
        byEmployee?: boolean | undefined;
        dueAfterDays?: number | undefined;
    }[];
    isDefault?: boolean | undefined;
}>;
export type UpdateChecklistTemplateRequest = z.infer<typeof UpdateChecklistTemplateRequest>;
export declare const ChecklistTask: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    byEmployee: z.ZodBoolean;
    dueOn: z.ZodString;
    doneAt: z.ZodNullable<z.ZodString>;
    doneByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    byEmployee: boolean;
    dueOn: string;
    doneAt: string | null;
    doneByName: string | null;
}, {
    id: string;
    label: string;
    byEmployee: boolean;
    dueOn: string;
    doneAt: string | null;
    doneByName: string | null;
}>;
export type ChecklistTask = z.infer<typeof ChecklistTask>;
export declare const EmployeeChecklist: z.ZodObject<{
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
    /** The branch the person works at: what branch limits read. */
    branchId: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<["onboarding", "offboarding"]>;
    /** The template's name when it was copied. */
    templateName: z.ZodString;
    /** The day the due dates count from: the first day, or the last. */
    anchorOn: z.ZodString;
    startedAt: z.ZodString;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        byEmployee: z.ZodBoolean;
        dueOn: z.ZodString;
        doneAt: z.ZodNullable<z.ZodString>;
        doneByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        byEmployee: boolean;
        dueOn: string;
        doneAt: string | null;
        doneByName: string | null;
    }, {
        id: string;
        label: string;
        byEmployee: boolean;
        dueOn: string;
        doneAt: string | null;
        doneByName: string | null;
    }>, "many">;
    doneCount: z.ZodNumber;
    /** Tasks not done whose day has passed, today in Kigali. Computed at read, never stored. */
    overdueCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    kind: "onboarding" | "offboarding";
    id: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    startedAt: string;
    tasks: {
        id: string;
        label: string;
        byEmployee: boolean;
        dueOn: string;
        doneAt: string | null;
        doneByName: string | null;
    }[];
    branchId: string | null;
    templateName: string;
    anchorOn: string;
    doneCount: number;
    overdueCount: number;
}, {
    kind: "onboarding" | "offboarding";
    id: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    startedAt: string;
    tasks: {
        id: string;
        label: string;
        byEmployee: boolean;
        dueOn: string;
        doneAt: string | null;
        doneByName: string | null;
    }[];
    branchId: string | null;
    templateName: string;
    anchorOn: string;
    doneCount: number;
    overdueCount: number;
}>;
export type EmployeeChecklist = z.infer<typeof EmployeeChecklist>;
/**
 * `GET /ops/hr/checklists`: every checklist in the caller's branches, the ones
 * still open first, and who joined or is leaving with none started.
 */
export declare const ChecklistBoard: z.ZodObject<{
    today: z.ZodString;
    checklists: z.ZodArray<z.ZodObject<{
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
        /** The branch the person works at: what branch limits read. */
        branchId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<["onboarding", "offboarding"]>;
        /** The template's name when it was copied. */
        templateName: z.ZodString;
        /** The day the due dates count from: the first day, or the last. */
        anchorOn: z.ZodString;
        startedAt: z.ZodString;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            byEmployee: z.ZodBoolean;
            dueOn: z.ZodString;
            doneAt: z.ZodNullable<z.ZodString>;
            doneByName: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }, {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }>, "many">;
        doneCount: z.ZodNumber;
        /** Tasks not done whose day has passed, today in Kigali. Computed at read, never stored. */
        overdueCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "onboarding" | "offboarding";
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        startedAt: string;
        tasks: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }[];
        branchId: string | null;
        templateName: string;
        anchorOn: string;
        doneCount: number;
        overdueCount: number;
    }, {
        kind: "onboarding" | "offboarding";
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        startedAt: string;
        tasks: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }[];
        branchId: string | null;
        templateName: string;
        anchorOn: string;
        doneCount: number;
        overdueCount: number;
    }>, "many">;
    unstarted: z.ZodArray<z.ZodObject<{
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
        kind: z.ZodEnum<["onboarding", "offboarding"]>;
        /** The first day, or the last. */
        on: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "onboarding" | "offboarding";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        on: string;
    }, {
        kind: "onboarding" | "offboarding";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        on: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    today: string;
    checklists: {
        kind: "onboarding" | "offboarding";
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        startedAt: string;
        tasks: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }[];
        branchId: string | null;
        templateName: string;
        anchorOn: string;
        doneCount: number;
        overdueCount: number;
    }[];
    unstarted: {
        kind: "onboarding" | "offboarding";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        on: string;
    }[];
}, {
    today: string;
    checklists: {
        kind: "onboarding" | "offboarding";
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        startedAt: string;
        tasks: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }[];
        branchId: string | null;
        templateName: string;
        anchorOn: string;
        doneCount: number;
        overdueCount: number;
    }[];
    unstarted: {
        kind: "onboarding" | "offboarding";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        on: string;
    }[];
}>;
export type ChecklistBoard = z.infer<typeof ChecklistBoard>;
/** `POST /ops/hr/checklists`: from a template named, or the default of that kind. */
export declare const StartChecklistRequest: z.ZodObject<{
    employeeId: z.ZodString;
    kind: z.ZodEnum<["onboarding", "offboarding"]>;
    templateId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "onboarding" | "offboarding";
    employeeId: string;
    templateId?: string | undefined;
}, {
    kind: "onboarding" | "offboarding";
    employeeId: string;
    templateId?: string | undefined;
}>;
export type StartChecklistRequest = z.infer<typeof StartChecklistRequest>;
/** `GET /me/work/:employeeId/checklists`: the person's own, every task shown, theirs to tick marked. */
export declare const MyChecklists: z.ZodObject<{
    today: z.ZodString;
    checklists: z.ZodArray<z.ZodObject<{
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
        /** The branch the person works at: what branch limits read. */
        branchId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<["onboarding", "offboarding"]>;
        /** The template's name when it was copied. */
        templateName: z.ZodString;
        /** The day the due dates count from: the first day, or the last. */
        anchorOn: z.ZodString;
        startedAt: z.ZodString;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            byEmployee: z.ZodBoolean;
            dueOn: z.ZodString;
            doneAt: z.ZodNullable<z.ZodString>;
            doneByName: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }, {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }>, "many">;
        doneCount: z.ZodNumber;
        /** Tasks not done whose day has passed, today in Kigali. Computed at read, never stored. */
        overdueCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "onboarding" | "offboarding";
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        startedAt: string;
        tasks: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }[];
        branchId: string | null;
        templateName: string;
        anchorOn: string;
        doneCount: number;
        overdueCount: number;
    }, {
        kind: "onboarding" | "offboarding";
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        startedAt: string;
        tasks: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }[];
        branchId: string | null;
        templateName: string;
        anchorOn: string;
        doneCount: number;
        overdueCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    today: string;
    checklists: {
        kind: "onboarding" | "offboarding";
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        startedAt: string;
        tasks: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }[];
        branchId: string | null;
        templateName: string;
        anchorOn: string;
        doneCount: number;
        overdueCount: number;
    }[];
}, {
    today: string;
    checklists: {
        kind: "onboarding" | "offboarding";
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        startedAt: string;
        tasks: {
            id: string;
            label: string;
            byEmployee: boolean;
            dueOn: string;
            doneAt: string | null;
            doneByName: string | null;
        }[];
        branchId: string | null;
        templateName: string;
        anchorOn: string;
        doneCount: number;
        overdueCount: number;
    }[];
}>;
export type MyChecklists = z.infer<typeof MyChecklists>;
//# sourceMappingURL=checklists.d.ts.map