import { z } from "zod";
export declare const PayComponentKind: z.ZodEnum<["allowance", "deduction"]>;
export type PayComponentKind = z.infer<typeof PayComponentKind>;
export declare const PayAmountType: z.ZodEnum<["fixed", "percent_basic", "percent_gross", "per_day_worked", "per_hour_worked", "per_child"]>;
export type PayAmountType = z.infer<typeof PayAmountType>;
export declare const PayConditionField: z.ZodEnum<["sex", "marital_status", "children", "years_of_service", "prior_experience", "employee_type", "job_position", "department", "branch", "wage_basis"]>;
export type PayConditionField = z.infer<typeof PayConditionField>;
export declare const PayConditionOp: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in"]>;
export type PayConditionOp = z.infer<typeof PayConditionOp>;
export declare const PayCondition: z.ZodObject<{
    field: z.ZodEnum<["sex", "marital_status", "children", "years_of_service", "prior_experience", "employee_type", "job_position", "department", "branch", "wage_basis"]>;
    op: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in"]>;
    /** `in` takes a comma separated list. */
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
    op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
}, {
    value: string;
    field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
    op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
}>;
export type PayCondition = z.infer<typeof PayCondition>;
export declare const PayTargetMode: z.ZodEnum<["include", "exclude"]>;
export type PayTargetMode = z.infer<typeof PayTargetMode>;
export declare const PayComponentStatus: z.ZodEnum<["active", "archived"]>;
export declare const PayComponent: z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<["allowance", "deduction"]>;
    /** An allowance: whether it is taxed. */
    taxable: z.ZodBoolean;
    /** An allowance: whether it counts in the contribution base. */
    inContributionBase: z.ZodBoolean;
    /** A deduction: whether it is taken before tax. */
    beforeTax: z.ZodBoolean;
    amountType: z.ZodEnum<["fixed", "percent_basic", "percent_gross", "per_day_worked", "per_hour_worked", "per_child"]>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    /** A percentage, 0 to 100, two decimals at most. */
    rate: z.ZodNullable<z.ZodNumber>;
    capRwf: z.ZodNullable<z.ZodNumber>;
    condition: z.ZodNullable<z.ZodObject<{
        field: z.ZodEnum<["sex", "marital_status", "children", "years_of_service", "prior_experience", "employee_type", "job_position", "department", "branch", "wage_basis"]>;
        op: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in"]>;
        /** `in` takes a comma separated list. */
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    }, {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    }>>;
    appliesAllActive: z.ZodBoolean;
    oneOffPeriod: z.ZodNullable<z.ZodString>;
} & {
    id: z.ZodString;
    code: z.ZodString;
    status: z.ZodEnum<["active", "archived"]>;
    targets: z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        displayName: z.ZodString;
        mode: z.ZodEnum<["include", "exclude"]>;
    }, "strip", z.ZodTypeAny, {
        mode: "include" | "exclude";
        employeeId: string;
        displayName: string;
    }, {
        mode: "include" | "exclude";
        employeeId: string;
        displayName: string;
    }>, "many">;
    structureIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    code: string;
    status: "active" | "archived";
    name: string;
    kind: "deduction" | "allowance";
    id: string;
    amountRwf: number | null;
    taxable: boolean;
    beforeTax: boolean;
    inContributionBase: boolean;
    amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
    rate: number | null;
    capRwf: number | null;
    condition: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null;
    appliesAllActive: boolean;
    oneOffPeriod: string | null;
    targets: {
        mode: "include" | "exclude";
        employeeId: string;
        displayName: string;
    }[];
    structureIds: string[];
}, {
    code: string;
    status: "active" | "archived";
    name: string;
    kind: "deduction" | "allowance";
    id: string;
    amountRwf: number | null;
    taxable: boolean;
    beforeTax: boolean;
    inContributionBase: boolean;
    amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
    rate: number | null;
    capRwf: number | null;
    condition: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null;
    appliesAllActive: boolean;
    oneOffPeriod: string | null;
    targets: {
        mode: "include" | "exclude";
        employeeId: string;
        displayName: string;
    }[];
    structureIds: string[];
}>;
export type PayComponent = z.infer<typeof PayComponent>;
export declare const PayComponentList: z.ZodObject<{
    components: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodEnum<["allowance", "deduction"]>;
        /** An allowance: whether it is taxed. */
        taxable: z.ZodBoolean;
        /** An allowance: whether it counts in the contribution base. */
        inContributionBase: z.ZodBoolean;
        /** A deduction: whether it is taken before tax. */
        beforeTax: z.ZodBoolean;
        amountType: z.ZodEnum<["fixed", "percent_basic", "percent_gross", "per_day_worked", "per_hour_worked", "per_child"]>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        /** A percentage, 0 to 100, two decimals at most. */
        rate: z.ZodNullable<z.ZodNumber>;
        capRwf: z.ZodNullable<z.ZodNumber>;
        condition: z.ZodNullable<z.ZodObject<{
            field: z.ZodEnum<["sex", "marital_status", "children", "years_of_service", "prior_experience", "employee_type", "job_position", "department", "branch", "wage_basis"]>;
            op: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in"]>;
            /** `in` takes a comma separated list. */
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            value: string;
            field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
            op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
        }, {
            value: string;
            field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
            op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
        }>>;
        appliesAllActive: z.ZodBoolean;
        oneOffPeriod: z.ZodNullable<z.ZodString>;
    } & {
        id: z.ZodString;
        code: z.ZodString;
        status: z.ZodEnum<["active", "archived"]>;
        targets: z.ZodArray<z.ZodObject<{
            employeeId: z.ZodString;
            displayName: z.ZodString;
            mode: z.ZodEnum<["include", "exclude"]>;
        }, "strip", z.ZodTypeAny, {
            mode: "include" | "exclude";
            employeeId: string;
            displayName: string;
        }, {
            mode: "include" | "exclude";
            employeeId: string;
            displayName: string;
        }>, "many">;
        structureIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        code: string;
        status: "active" | "archived";
        name: string;
        kind: "deduction" | "allowance";
        id: string;
        amountRwf: number | null;
        taxable: boolean;
        beforeTax: boolean;
        inContributionBase: boolean;
        amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
        rate: number | null;
        capRwf: number | null;
        condition: {
            value: string;
            field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
            op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
        } | null;
        appliesAllActive: boolean;
        oneOffPeriod: string | null;
        targets: {
            mode: "include" | "exclude";
            employeeId: string;
            displayName: string;
        }[];
        structureIds: string[];
    }, {
        code: string;
        status: "active" | "archived";
        name: string;
        kind: "deduction" | "allowance";
        id: string;
        amountRwf: number | null;
        taxable: boolean;
        beforeTax: boolean;
        inContributionBase: boolean;
        amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
        rate: number | null;
        capRwf: number | null;
        condition: {
            value: string;
            field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
            op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
        } | null;
        appliesAllActive: boolean;
        oneOffPeriod: string | null;
        targets: {
            mode: "include" | "exclude";
            employeeId: string;
            displayName: string;
        }[];
        structureIds: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    components: {
        code: string;
        status: "active" | "archived";
        name: string;
        kind: "deduction" | "allowance";
        id: string;
        amountRwf: number | null;
        taxable: boolean;
        beforeTax: boolean;
        inContributionBase: boolean;
        amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
        rate: number | null;
        capRwf: number | null;
        condition: {
            value: string;
            field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
            op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
        } | null;
        appliesAllActive: boolean;
        oneOffPeriod: string | null;
        targets: {
            mode: "include" | "exclude";
            employeeId: string;
            displayName: string;
        }[];
        structureIds: string[];
    }[];
}, {
    components: {
        code: string;
        status: "active" | "archived";
        name: string;
        kind: "deduction" | "allowance";
        id: string;
        amountRwf: number | null;
        taxable: boolean;
        beforeTax: boolean;
        inContributionBase: boolean;
        amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
        rate: number | null;
        capRwf: number | null;
        condition: {
            value: string;
            field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
            op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
        } | null;
        appliesAllActive: boolean;
        oneOffPeriod: string | null;
        targets: {
            mode: "include" | "exclude";
            employeeId: string;
            displayName: string;
        }[];
        structureIds: string[];
    }[];
}>;
export type PayComponentList = z.infer<typeof PayComponentList>;
export declare const CreatePayComponentRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<["allowance", "deduction"]>;
    /** An allowance: whether it is taxed. */
    taxable: z.ZodBoolean;
    /** An allowance: whether it counts in the contribution base. */
    inContributionBase: z.ZodBoolean;
    /** A deduction: whether it is taken before tax. */
    beforeTax: z.ZodBoolean;
    amountType: z.ZodEnum<["fixed", "percent_basic", "percent_gross", "per_day_worked", "per_hour_worked", "per_child"]>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    /** A percentage, 0 to 100, two decimals at most. */
    rate: z.ZodNullable<z.ZodNumber>;
    capRwf: z.ZodNullable<z.ZodNumber>;
    condition: z.ZodNullable<z.ZodObject<{
        field: z.ZodEnum<["sex", "marital_status", "children", "years_of_service", "prior_experience", "employee_type", "job_position", "department", "branch", "wage_basis"]>;
        op: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in"]>;
        /** `in` takes a comma separated list. */
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    }, {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    }>>;
    appliesAllActive: z.ZodBoolean;
    oneOffPeriod: z.ZodNullable<z.ZodString>;
} & {
    code: z.ZodString;
    targets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        mode: z.ZodEnum<["include", "exclude"]>;
    }, "strip", z.ZodTypeAny, {
        mode: "include" | "exclude";
        employeeId: string;
    }, {
        mode: "include" | "exclude";
        employeeId: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    kind: "deduction" | "allowance";
    amountRwf: number | null;
    taxable: boolean;
    beforeTax: boolean;
    inContributionBase: boolean;
    amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
    rate: number | null;
    capRwf: number | null;
    condition: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null;
    appliesAllActive: boolean;
    oneOffPeriod: string | null;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}, {
    code: string;
    name: string;
    kind: "deduction" | "allowance";
    amountRwf: number | null;
    taxable: boolean;
    beforeTax: boolean;
    inContributionBase: boolean;
    amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
    rate: number | null;
    capRwf: number | null;
    condition: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null;
    appliesAllActive: boolean;
    oneOffPeriod: string | null;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}>, {
    code: string;
    name: string;
    kind: "deduction" | "allowance";
    amountRwf: number | null;
    taxable: boolean;
    beforeTax: boolean;
    inContributionBase: boolean;
    amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
    rate: number | null;
    capRwf: number | null;
    condition: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null;
    appliesAllActive: boolean;
    oneOffPeriod: string | null;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}, {
    code: string;
    name: string;
    kind: "deduction" | "allowance";
    amountRwf: number | null;
    taxable: boolean;
    beforeTax: boolean;
    inContributionBase: boolean;
    amountType: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child";
    rate: number | null;
    capRwf: number | null;
    condition: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null;
    appliesAllActive: boolean;
    oneOffPeriod: string | null;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}>;
export type CreatePayComponentRequest = z.infer<typeof CreatePayComponentRequest>;
/** Whole rule groups at once; `targets` replaces the list when present. */
export declare const UpdatePayComponentRequest: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodEnum<["allowance", "deduction"]>>;
    taxable: z.ZodOptional<z.ZodBoolean>;
    inContributionBase: z.ZodOptional<z.ZodBoolean>;
    beforeTax: z.ZodOptional<z.ZodBoolean>;
    amountType: z.ZodOptional<z.ZodEnum<["fixed", "percent_basic", "percent_gross", "per_day_worked", "per_hour_worked", "per_child"]>>;
    amountRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    rate: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    capRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    condition: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        field: z.ZodEnum<["sex", "marital_status", "children", "years_of_service", "prior_experience", "employee_type", "job_position", "department", "branch", "wage_basis"]>;
        op: z.ZodEnum<["eq", "ne", "gt", "gte", "lt", "lte", "in"]>;
        /** `in` takes a comma separated list. */
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    }, {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    }>>>;
    appliesAllActive: z.ZodOptional<z.ZodBoolean>;
    oneOffPeriod: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["active", "archived"]>>;
    targets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        mode: z.ZodEnum<["include", "exclude"]>;
    }, "strip", z.ZodTypeAny, {
        mode: "include" | "exclude";
        employeeId: string;
    }, {
        mode: "include" | "exclude";
        employeeId: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    kind?: "deduction" | "allowance" | undefined;
    amountRwf?: number | null | undefined;
    taxable?: boolean | undefined;
    beforeTax?: boolean | undefined;
    inContributionBase?: boolean | undefined;
    amountType?: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child" | undefined;
    rate?: number | null | undefined;
    capRwf?: number | null | undefined;
    condition?: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null | undefined;
    appliesAllActive?: boolean | undefined;
    oneOffPeriod?: string | null | undefined;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    kind?: "deduction" | "allowance" | undefined;
    amountRwf?: number | null | undefined;
    taxable?: boolean | undefined;
    beforeTax?: boolean | undefined;
    inContributionBase?: boolean | undefined;
    amountType?: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child" | undefined;
    rate?: number | null | undefined;
    capRwf?: number | null | undefined;
    condition?: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null | undefined;
    appliesAllActive?: boolean | undefined;
    oneOffPeriod?: string | null | undefined;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    kind?: "deduction" | "allowance" | undefined;
    amountRwf?: number | null | undefined;
    taxable?: boolean | undefined;
    beforeTax?: boolean | undefined;
    inContributionBase?: boolean | undefined;
    amountType?: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child" | undefined;
    rate?: number | null | undefined;
    capRwf?: number | null | undefined;
    condition?: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null | undefined;
    appliesAllActive?: boolean | undefined;
    oneOffPeriod?: string | null | undefined;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    kind?: "deduction" | "allowance" | undefined;
    amountRwf?: number | null | undefined;
    taxable?: boolean | undefined;
    beforeTax?: boolean | undefined;
    inContributionBase?: boolean | undefined;
    amountType?: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child" | undefined;
    rate?: number | null | undefined;
    capRwf?: number | null | undefined;
    condition?: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null | undefined;
    appliesAllActive?: boolean | undefined;
    oneOffPeriod?: string | null | undefined;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    kind?: "deduction" | "allowance" | undefined;
    amountRwf?: number | null | undefined;
    taxable?: boolean | undefined;
    beforeTax?: boolean | undefined;
    inContributionBase?: boolean | undefined;
    amountType?: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child" | undefined;
    rate?: number | null | undefined;
    capRwf?: number | null | undefined;
    condition?: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null | undefined;
    appliesAllActive?: boolean | undefined;
    oneOffPeriod?: string | null | undefined;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    kind?: "deduction" | "allowance" | undefined;
    amountRwf?: number | null | undefined;
    taxable?: boolean | undefined;
    beforeTax?: boolean | undefined;
    inContributionBase?: boolean | undefined;
    amountType?: "fixed" | "percent_basic" | "percent_gross" | "per_day_worked" | "per_hour_worked" | "per_child" | undefined;
    rate?: number | null | undefined;
    capRwf?: number | null | undefined;
    condition?: {
        value: string;
        field: "children" | "sex" | "marital_status" | "years_of_service" | "prior_experience" | "employee_type" | "job_position" | "department" | "branch" | "wage_basis";
        op: "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte";
    } | null | undefined;
    appliesAllActive?: boolean | undefined;
    oneOffPeriod?: string | null | undefined;
    targets?: {
        mode: "include" | "exclude";
        employeeId: string;
    }[] | undefined;
}>;
export type UpdatePayComponentRequest = z.infer<typeof UpdatePayComponentRequest>;
export declare const PayStructure: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["active", "archived"]>;
    componentIds: z.ZodArray<z.ZodString, "many">;
    /** Contracts that carry it now. */
    contractCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    name: string;
    id: string;
    componentIds: string[];
    contractCount: number;
}, {
    status: "active" | "archived";
    name: string;
    id: string;
    componentIds: string[];
    contractCount: number;
}>;
export type PayStructure = z.infer<typeof PayStructure>;
export declare const PayStructureList: z.ZodObject<{
    structures: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        status: z.ZodEnum<["active", "archived"]>;
        componentIds: z.ZodArray<z.ZodString, "many">;
        /** Contracts that carry it now. */
        contractCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        name: string;
        id: string;
        componentIds: string[];
        contractCount: number;
    }, {
        status: "active" | "archived";
        name: string;
        id: string;
        componentIds: string[];
        contractCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    structures: {
        status: "active" | "archived";
        name: string;
        id: string;
        componentIds: string[];
        contractCount: number;
    }[];
}, {
    structures: {
        status: "active" | "archived";
        name: string;
        id: string;
        componentIds: string[];
        contractCount: number;
    }[];
}>;
export type PayStructureList = z.infer<typeof PayStructureList>;
export declare const CreatePayStructureRequest: z.ZodObject<{
    name: z.ZodString;
    componentIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    componentIds: string[];
}, {
    name: string;
    componentIds: string[];
}>;
export type CreatePayStructureRequest = z.infer<typeof CreatePayStructureRequest>;
export declare const UpdatePayStructureRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    componentIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodOptional<z.ZodEnum<["active", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    componentIds?: string[] | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    componentIds?: string[] | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    componentIds?: string[] | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    componentIds?: string[] | undefined;
}>;
export type UpdatePayStructureRequest = z.infer<typeof UpdatePayStructureRequest>;
export declare const LoanKind: z.ZodEnum<["loan", "advance"]>;
export type LoanKind = z.infer<typeof LoanKind>;
export declare const LoanPaidOut: z.ZodEnum<["payslip", "outside"]>;
export type LoanPaidOut = z.infer<typeof LoanPaidOut>;
export declare const LoanInstallment: z.ZodObject<{
    id: z.ZodString;
    period: z.ZodString;
    amountRwf: z.ZodNumber;
    deferredFrom: z.ZodNullable<z.ZodString>;
    paid: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    amountRwf: number;
    paid: boolean;
    period: string;
    deferredFrom: string | null;
}, {
    id: string;
    amountRwf: number;
    paid: boolean;
    period: string;
    deferredFrom: string | null;
}>;
export type LoanInstallment = z.infer<typeof LoanInstallment>;
export declare const Loan: z.ZodObject<{
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
    branchId: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<["loan", "advance"]>;
    amountRwf: z.ZodNumber;
    givenOn: z.ZodString;
    installments: z.ZodNumber;
    firstPeriod: z.ZodString;
    paidOut: z.ZodEnum<["payslip", "outside"]>;
    reason: z.ZodNullable<z.ZodString>;
    paidRwf: z.ZodNumber;
    remainingRwf: z.ZodNumber;
    settledAt: z.ZodNullable<z.ZodString>;
    schedule: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        period: z.ZodString;
        amountRwf: z.ZodNumber;
        deferredFrom: z.ZodNullable<z.ZodString>;
        paid: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        amountRwf: number;
        paid: boolean;
        period: string;
        deferredFrom: string | null;
    }, {
        id: string;
        amountRwf: number;
        paid: boolean;
        period: string;
        deferredFrom: string | null;
    }>, "many">;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "loan" | "advance";
    id: string;
    amountRwf: number;
    reason: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    settledAt: string | null;
    paidRwf: number;
    branchId: string | null;
    givenOn: string;
    installments: number;
    firstPeriod: string;
    paidOut: "payslip" | "outside";
    remainingRwf: number;
    schedule: {
        id: string;
        amountRwf: number;
        paid: boolean;
        period: string;
        deferredFrom: string | null;
    }[];
}, {
    kind: "loan" | "advance";
    id: string;
    amountRwf: number;
    reason: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    settledAt: string | null;
    paidRwf: number;
    branchId: string | null;
    givenOn: string;
    installments: number;
    firstPeriod: string;
    paidOut: "payslip" | "outside";
    remainingRwf: number;
    schedule: {
        id: string;
        amountRwf: number;
        paid: boolean;
        period: string;
        deferredFrom: string | null;
    }[];
}>;
export type Loan = z.infer<typeof Loan>;
export declare const CreateLoanRequest: z.ZodObject<{
    employeeId: z.ZodString;
    kind: z.ZodEnum<["loan", "advance"]>;
    amountRwf: z.ZodNumber;
    givenOn: z.ZodString;
    installments: z.ZodNumber;
    firstPeriod: z.ZodString;
    paidOut: z.ZodEnum<["payslip", "outside"]>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    kind: "loan" | "advance";
    amountRwf: number;
    employeeId: string;
    givenOn: string;
    installments: number;
    firstPeriod: string;
    paidOut: "payslip" | "outside";
    reason?: string | null | undefined;
}, {
    kind: "loan" | "advance";
    amountRwf: number;
    employeeId: string;
    givenOn: string;
    installments: number;
    firstPeriod: string;
    paidOut: "payslip" | "outside";
    reason?: string | null | undefined;
}>;
export type CreateLoanRequest = z.infer<typeof CreateLoanRequest>;
/** Deduct everything still owed in this month. */
export declare const SettleLoanRequest: z.ZodObject<{
    period: z.ZodString;
}, "strip", z.ZodTypeAny, {
    period: string;
}, {
    period: string;
}>;
export type SettleLoanRequest = z.infer<typeof SettleLoanRequest>;
export declare const PayClaimKind: z.ZodEnum<["reimbursement", "leave_encashment"]>;
export type PayClaimKind = z.infer<typeof PayClaimKind>;
export declare const PayClaimStatus: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
export type PayClaimStatus = z.infer<typeof PayClaimStatus>;
export declare const PayClaim: z.ZodObject<{
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
    branchId: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<["reimbursement", "leave_encashment"]>;
    /** A reimbursement's amount; an encashment's at the day rate once decided. */
    amountRwf: z.ZodNullable<z.ZodNumber>;
    leaveType: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
    }, {
        name: string;
        id: string;
    }>>;
    days: z.ZodNullable<z.ZodNumber>;
    /** The month it is paid in. */
    period: z.ZodString;
    hasReceipt: z.ZodBoolean;
    reason: z.ZodString;
    status: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
    decidedAt: z.ZodNullable<z.ZodString>;
    decidedByName: z.ZodNullable<z.ZodString>;
    decisionNote: z.ZodNullable<z.ZodString>;
    /** Paid with a confirmed payslip. */
    paid: z.ZodBoolean;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected" | "cancelled" | "requested";
    kind: "reimbursement" | "leave_encashment";
    decidedAt: string | null;
    id: string;
    amountRwf: number | null;
    reason: string;
    decisionNote: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    paid: boolean;
    createdAt: string;
    branchId: string | null;
    period: string;
    days: number | null;
    leaveType: {
        name: string;
        id: string;
    } | null;
    decidedByName: string | null;
    hasReceipt: boolean;
}, {
    status: "approved" | "rejected" | "cancelled" | "requested";
    kind: "reimbursement" | "leave_encashment";
    decidedAt: string | null;
    id: string;
    amountRwf: number | null;
    reason: string;
    decisionNote: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    paid: boolean;
    createdAt: string;
    branchId: string | null;
    period: string;
    days: number | null;
    leaveType: {
        name: string;
        id: string;
    } | null;
    decidedByName: string | null;
    hasReceipt: boolean;
}>;
export type PayClaim = z.infer<typeof PayClaim>;
export declare const CreatePayClaimRequest: z.ZodIntersection<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"reimbursement">;
    amountRwf: z.ZodNumber;
    receiptKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "reimbursement";
    amountRwf: number;
    reason: string;
    receiptKey?: string | null | undefined;
}, {
    kind: "reimbursement";
    amountRwf: number;
    reason: string;
    receiptKey?: string | null | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"leave_encashment">;
    leaveTypeId: z.ZodString;
    days: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "leave_encashment";
    reason: string;
    days: number;
    leaveTypeId: string;
}, {
    kind: "leave_encashment";
    reason: string;
    days: number;
    leaveTypeId: string;
}>]>, z.ZodObject<{
    employeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
}, {
    employeeId: string;
}>>;
export type CreatePayClaimRequest = z.infer<typeof CreatePayClaimRequest>;
export declare const CreateMyPayClaimRequest: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"reimbursement">;
    amountRwf: z.ZodNumber;
    receiptKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "reimbursement";
    amountRwf: number;
    reason: string;
    receiptKey?: string | null | undefined;
}, {
    kind: "reimbursement";
    amountRwf: number;
    reason: string;
    receiptKey?: string | null | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"leave_encashment">;
    leaveTypeId: z.ZodString;
    days: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "leave_encashment";
    reason: string;
    days: number;
    leaveTypeId: string;
}, {
    kind: "leave_encashment";
    reason: string;
    days: number;
    leaveTypeId: string;
}>]>;
export type CreateMyPayClaimRequest = z.infer<typeof CreateMyPayClaimRequest>;
export declare const PayDecisionRequest: z.ZodObject<{
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
}, {
    note?: string | null | undefined;
}>;
export type PayDecisionRequest = z.infer<typeof PayDecisionRequest>;
export declare const PayAdjustmentSide: z.ZodEnum<["earning", "deduction"]>;
export type PayAdjustmentSide = z.infer<typeof PayAdjustmentSide>;
export declare const PayAdjustmentSource: z.ZodEnum<["manual", "leave", "asset_fine", "held_payslip", "late_claim"]>;
export type PayAdjustmentSource = z.infer<typeof PayAdjustmentSource>;
export declare const PayAdjustmentStatus: z.ZodEnum<["open", "waived", "paid"]>;
export type PayAdjustmentStatus = z.infer<typeof PayAdjustmentStatus>;
export declare const PayAdjustment: z.ZodObject<{
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
    branchId: z.ZodNullable<z.ZodString>;
    side: z.ZodEnum<["earning", "deduction"]>;
    amountRwf: z.ZodNumber;
    taxable: z.ZodBoolean;
    contributable: z.ZodBoolean;
    correctsPeriod: z.ZodString;
    reason: z.ZodString;
    source: z.ZodEnum<["manual", "leave", "asset_fine", "held_payslip", "late_claim"]>;
    status: z.ZodEnum<["open", "waived", "paid"]>;
    /** The month whose payslip paid it. */
    paidInPeriod: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "open" | "paid" | "waived";
    id: string;
    amountRwf: number;
    reason: string;
    source: "manual" | "leave" | "asset_fine" | "held_payslip" | "late_claim";
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    branchId: string | null;
    side: "earning" | "deduction";
    taxable: boolean;
    contributable: boolean;
    correctsPeriod: string;
    paidInPeriod: string | null;
}, {
    status: "open" | "paid" | "waived";
    id: string;
    amountRwf: number;
    reason: string;
    source: "manual" | "leave" | "asset_fine" | "held_payslip" | "late_claim";
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    branchId: string | null;
    side: "earning" | "deduction";
    taxable: boolean;
    contributable: boolean;
    correctsPeriod: string;
    paidInPeriod: string | null;
}>;
export type PayAdjustment = z.infer<typeof PayAdjustment>;
export declare const CreatePayAdjustmentRequest: z.ZodObject<{
    employeeId: z.ZodString;
    side: z.ZodEnum<["earning", "deduction"]>;
    amountRwf: z.ZodNumber;
    taxable: z.ZodBoolean;
    contributable: z.ZodBoolean;
    correctsPeriod: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    reason: string;
    side: "earning" | "deduction";
    taxable: boolean;
    contributable: boolean;
    employeeId: string;
    correctsPeriod: string;
}, {
    amountRwf: number;
    reason: string;
    side: "earning" | "deduction";
    taxable: boolean;
    contributable: boolean;
    employeeId: string;
    correctsPeriod: string;
}>;
export type CreatePayAdjustmentRequest = z.infer<typeof CreatePayAdjustmentRequest>;
export declare const WaivePayAdjustmentRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type WaivePayAdjustmentRequest = z.infer<typeof WaivePayAdjustmentRequest>;
/** `POST /ops/pay-runs/:id/hold`: leave a person out of a draft, their month carried to the next (AC-PY7). */
export declare const HoldPayslipRequest: z.ZodObject<{
    employeeId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    employeeId: string;
}, {
    reason: string;
    employeeId: string;
}>;
export type HoldPayslipRequest = z.infer<typeof HoldPayslipRequest>;
export declare const PaidMethod: z.ZodEnum<["bank", "momo", "cash"]>;
export type PaidMethod = z.infer<typeof PaidMethod>;
export declare const PayslipRow: z.ZodObject<{
    id: z.ZodString;
    payRunId: z.ZodString;
    period: z.ZodString;
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
    employeeNumber: z.ZodString;
    branchId: z.ZodNullable<z.ZodString>;
    grossRwf: z.ZodNumber;
    netRwf: z.ZodNumber;
    status: z.ZodEnum<["draft", "confirmed"]>;
    paidAt: z.ZodNullable<z.ZodString>;
    paidMethod: z.ZodNullable<z.ZodEnum<["bank", "momo", "cash"]>>;
    paidReference: z.ZodNullable<z.ZodString>;
    sentAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "confirmed";
    id: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    grossRwf: number;
    paidAt: string | null;
    branchId: string | null;
    employeeNumber: string;
    netRwf: number;
    paidMethod: "cash" | "bank" | "momo" | null;
    paidReference: string | null;
    sentAt: string | null;
    period: string;
    payRunId: string;
}, {
    status: "draft" | "confirmed";
    id: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    grossRwf: number;
    paidAt: string | null;
    branchId: string | null;
    employeeNumber: string;
    netRwf: number;
    paidMethod: "cash" | "bank" | "momo" | null;
    paidReference: string | null;
    sentAt: string | null;
    period: string;
    payRunId: string;
}>;
export type PayslipRow = z.infer<typeof PayslipRow>;
export declare const MarkPaidParams: z.ZodObject<{
    paidOn: z.ZodString;
    method: z.ZodEnum<["bank", "momo", "cash"]>;
    reference: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reference: string;
    method: "cash" | "bank" | "momo";
    paidOn: string;
}, {
    reference: string;
    method: "cash" | "bank" | "momo";
    paidOn: string;
}>;
export type MarkPaidParams = z.infer<typeof MarkPaidParams>;
export declare const UnmarkPaidRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type UnmarkPaidRequest = z.infer<typeof UnmarkPaidRequest>;
export declare const PayExportKind: z.ZodEnum<["bank", "momo"]>;
export type PayExportKind = z.infer<typeof PayExportKind>;
export declare const PayDeclarationKind: z.ZodEnum<["paye", "rssb"]>;
export type PayDeclarationKind = z.infer<typeof PayDeclarationKind>;
export declare const PayFile: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodUnion<[z.ZodEnum<["bank", "momo"]>, z.ZodEnum<["paye", "rssb"]>]>;
    rowCount: z.ZodNullable<z.ZodNumber>;
    totalRwf: z.ZodNullable<z.ZodNumber>;
    /** A declaration's format: `provisional` until the accountant's sheet names one. */
    formatVersion: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    createdByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "bank" | "momo" | "paye" | "rssb";
    id: string;
    createdAt: string;
    totalRwf: number | null;
    rowCount: number | null;
    formatVersion: string | null;
    createdByName: string | null;
}, {
    kind: "bank" | "momo" | "paye" | "rssb";
    id: string;
    createdAt: string;
    totalRwf: number | null;
    rowCount: number | null;
    formatVersion: string | null;
    createdByName: string | null;
}>;
export type PayFile = z.infer<typeof PayFile>;
export declare const PayFileList: z.ZodObject<{
    files: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodUnion<[z.ZodEnum<["bank", "momo"]>, z.ZodEnum<["paye", "rssb"]>]>;
        rowCount: z.ZodNullable<z.ZodNumber>;
        totalRwf: z.ZodNullable<z.ZodNumber>;
        /** A declaration's format: `provisional` until the accountant's sheet names one. */
        formatVersion: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        createdByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "bank" | "momo" | "paye" | "rssb";
        id: string;
        createdAt: string;
        totalRwf: number | null;
        rowCount: number | null;
        formatVersion: string | null;
        createdByName: string | null;
    }, {
        kind: "bank" | "momo" | "paye" | "rssb";
        id: string;
        createdAt: string;
        totalRwf: number | null;
        rowCount: number | null;
        formatVersion: string | null;
        createdByName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    files: {
        kind: "bank" | "momo" | "paye" | "rssb";
        id: string;
        createdAt: string;
        totalRwf: number | null;
        rowCount: number | null;
        formatVersion: string | null;
        createdByName: string | null;
    }[];
}, {
    files: {
        kind: "bank" | "momo" | "paye" | "rssb";
        id: string;
        createdAt: string;
        totalRwf: number | null;
        rowCount: number | null;
        formatVersion: string | null;
        createdByName: string | null;
    }[];
}>;
export type PayFileList = z.infer<typeof PayFileList>;
export declare const CreatePayExportRequest: z.ZodObject<{
    kind: z.ZodEnum<["bank", "momo"]>;
}, "strip", z.ZodTypeAny, {
    kind: "bank" | "momo";
}, {
    kind: "bank" | "momo";
}>;
export type CreatePayExportRequest = z.infer<typeof CreatePayExportRequest>;
export declare const CreatePayDeclarationRequest: z.ZodObject<{
    kind: z.ZodEnum<["paye", "rssb"]>;
}, "strip", z.ZodTypeAny, {
    kind: "paye" | "rssb";
}, {
    kind: "paye" | "rssb";
}>;
export type CreatePayDeclarationRequest = z.infer<typeof CreatePayDeclarationRequest>;
/** A file just built: a five minute link to it, and who was left out and why. */
export declare const PayFileResult: z.ZodObject<{
    file: z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodUnion<[z.ZodEnum<["bank", "momo"]>, z.ZodEnum<["paye", "rssb"]>]>;
        rowCount: z.ZodNullable<z.ZodNumber>;
        totalRwf: z.ZodNullable<z.ZodNumber>;
        /** A declaration's format: `provisional` until the accountant's sheet names one. */
        formatVersion: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        createdByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "bank" | "momo" | "paye" | "rssb";
        id: string;
        createdAt: string;
        totalRwf: number | null;
        rowCount: number | null;
        formatVersion: string | null;
        createdByName: string | null;
    }, {
        kind: "bank" | "momo" | "paye" | "rssb";
        id: string;
        createdAt: string;
        totalRwf: number | null;
        rowCount: number | null;
        formatVersion: string | null;
        createdByName: string | null;
    }>;
    url: z.ZodString;
    expiresInSeconds: z.ZodNumber;
    leftOut: z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        displayName: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        employeeId: string;
        displayName: string;
    }, {
        reason: string;
        employeeId: string;
        displayName: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    url: string;
    file: {
        kind: "bank" | "momo" | "paye" | "rssb";
        id: string;
        createdAt: string;
        totalRwf: number | null;
        rowCount: number | null;
        formatVersion: string | null;
        createdByName: string | null;
    };
    expiresInSeconds: number;
    leftOut: {
        reason: string;
        employeeId: string;
        displayName: string;
    }[];
}, {
    url: string;
    file: {
        kind: "bank" | "momo" | "paye" | "rssb";
        id: string;
        createdAt: string;
        totalRwf: number | null;
        rowCount: number | null;
        formatVersion: string | null;
        createdByName: string | null;
    };
    expiresInSeconds: number;
    leftOut: {
        reason: string;
        employeeId: string;
        displayName: string;
    }[];
}>;
export type PayFileResult = z.infer<typeof PayFileResult>;
export declare const PayrollRule: z.ZodObject<{
    configType: z.ZodString;
    label: z.ZodString;
    inForce: z.ZodNullable<z.ZodObject<{
        configEntryId: z.ZodString;
        version: z.ZodNumber;
        effectiveFrom: z.ZodNullable<z.ZodString>;
        value: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        version: number;
        effectiveFrom: string | null;
        configEntryId: string;
        value?: unknown;
    }, {
        version: number;
        effectiveFrom: string | null;
        configEntryId: string;
        value?: unknown;
    }>>;
    history: z.ZodArray<z.ZodObject<{
        configEntryId: z.ZodString;
        version: z.ZodNumber;
        effectiveFrom: z.ZodNullable<z.ZodString>;
        effectiveTo: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        version: number;
        effectiveFrom: string | null;
        effectiveTo: string | null;
        configEntryId: string;
    }, {
        version: number;
        effectiveFrom: string | null;
        effectiveTo: string | null;
        configEntryId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    history: {
        version: number;
        effectiveFrom: string | null;
        effectiveTo: string | null;
        configEntryId: string;
    }[];
    label: string;
    configType: string;
    inForce: {
        version: number;
        effectiveFrom: string | null;
        configEntryId: string;
        value?: unknown;
    } | null;
}, {
    history: {
        version: number;
        effectiveFrom: string | null;
        effectiveTo: string | null;
        configEntryId: string;
    }[];
    label: string;
    configType: string;
    inForce: {
        version: number;
        effectiveFrom: string | null;
        configEntryId: string;
        value?: unknown;
    } | null;
}>;
export type PayrollRule = z.infer<typeof PayrollRule>;
export declare const PayrollRules: z.ZodObject<{
    rules: z.ZodArray<z.ZodObject<{
        configType: z.ZodString;
        label: z.ZodString;
        inForce: z.ZodNullable<z.ZodObject<{
            configEntryId: z.ZodString;
            version: z.ZodNumber;
            effectiveFrom: z.ZodNullable<z.ZodString>;
            value: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            version: number;
            effectiveFrom: string | null;
            configEntryId: string;
            value?: unknown;
        }, {
            version: number;
            effectiveFrom: string | null;
            configEntryId: string;
            value?: unknown;
        }>>;
        history: z.ZodArray<z.ZodObject<{
            configEntryId: z.ZodString;
            version: z.ZodNumber;
            effectiveFrom: z.ZodNullable<z.ZodString>;
            effectiveTo: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            version: number;
            effectiveFrom: string | null;
            effectiveTo: string | null;
            configEntryId: string;
        }, {
            version: number;
            effectiveFrom: string | null;
            effectiveTo: string | null;
            configEntryId: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        history: {
            version: number;
            effectiveFrom: string | null;
            effectiveTo: string | null;
            configEntryId: string;
        }[];
        label: string;
        configType: string;
        inForce: {
            version: number;
            effectiveFrom: string | null;
            configEntryId: string;
            value?: unknown;
        } | null;
    }, {
        history: {
            version: number;
            effectiveFrom: string | null;
            effectiveTo: string | null;
            configEntryId: string;
        }[];
        label: string;
        configType: string;
        inForce: {
            version: number;
            effectiveFrom: string | null;
            configEntryId: string;
            value?: unknown;
        } | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    rules: {
        history: {
            version: number;
            effectiveFrom: string | null;
            effectiveTo: string | null;
            configEntryId: string;
        }[];
        label: string;
        configType: string;
        inForce: {
            version: number;
            effectiveFrom: string | null;
            configEntryId: string;
            value?: unknown;
        } | null;
    }[];
}, {
    rules: {
        history: {
            version: number;
            effectiveFrom: string | null;
            effectiveTo: string | null;
            configEntryId: string;
        }[];
        label: string;
        configType: string;
        inForce: {
            version: number;
            effectiveFrom: string | null;
            configEntryId: string;
            value?: unknown;
        } | null;
    }[];
}>;
export type PayrollRules = z.infer<typeof PayrollRules>;
export declare const PayrollDashboard: z.ZodObject<{
    months: z.ZodArray<z.ZodObject<{
        period: z.ZodString;
        status: z.ZodEnum<["draft", "confirmed"]>;
        headcount: z.ZodNumber;
        grossRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        payeRwf: z.ZodNumber;
        employeeContributionsRwf: z.ZodNumber;
        employerContributionsRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "draft" | "confirmed";
        grossRwf: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        headcount: number;
    }, {
        status: "draft" | "confirmed";
        grossRwf: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        headcount: number;
    }>, "many">;
    openLoansRwf: z.ZodNumber;
    claimsWaiting: z.ZodNumber;
    adjustmentsOpen: z.ZodNumber;
    unpaidPayslips: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    months: {
        status: "draft" | "confirmed";
        grossRwf: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        headcount: number;
    }[];
    openLoansRwf: number;
    claimsWaiting: number;
    adjustmentsOpen: number;
    unpaidPayslips: number;
}, {
    months: {
        status: "draft" | "confirmed";
        grossRwf: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        headcount: number;
    }[];
    openLoansRwf: number;
    claimsWaiting: number;
    adjustmentsOpen: number;
    unpaidPayslips: number;
}>;
export type PayrollDashboard = z.infer<typeof PayrollDashboard>;
export declare const ContractRow: z.ZodObject<{
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
    employeeNumber: z.ZodString;
    branchId: z.ZodNullable<z.ZodString>;
    contractType: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodNullable<z.ZodString>;
    wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
    wageRwf: z.ZodNumber;
    status: z.ZodString;
    payStructureId: z.ZodNullable<z.ZodString>;
    noticeDays: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: string;
    id: string;
    startsOn: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    branchId: string | null;
    employeeNumber: string;
    contractType: string;
    endsOn: string | null;
    wageBasis: "monthly" | "daily" | "hourly";
    wageRwf: number;
    payStructureId: string | null;
    noticeDays: number | null;
}, {
    status: string;
    id: string;
    startsOn: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    branchId: string | null;
    employeeNumber: string;
    contractType: string;
    endsOn: string | null;
    wageBasis: "monthly" | "daily" | "hourly";
    wageRwf: number;
    payStructureId: string | null;
    noticeDays: number | null;
}>;
export type ContractRow = z.infer<typeof ContractRow>;
/** `PATCH /ops/contracts/:id`: the pay terms a contract carries; its wage and dates change only by a new contract. */
export declare const UpdateContractPayTermsRequest: z.ZodEffects<z.ZodObject<{
    payStructureId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    noticeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    payStructureId?: string | null | undefined;
    noticeDays?: number | null | undefined;
}, {
    payStructureId?: string | null | undefined;
    noticeDays?: number | null | undefined;
}>, {
    payStructureId?: string | null | undefined;
    noticeDays?: number | null | undefined;
}, {
    payStructureId?: string | null | undefined;
    noticeDays?: number | null | undefined;
}>;
export type UpdateContractPayTermsRequest = z.infer<typeof UpdateContractPayTermsRequest>;
export declare const MyPayslip: z.ZodObject<{
    id: z.ZodString;
    period: z.ZodString;
    grossRwf: z.ZodNumber;
    netRwf: z.ZodNumber;
    paidAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    grossRwf: number;
    paidAt: string | null;
    netRwf: number;
    period: string;
}, {
    id: string;
    grossRwf: number;
    paidAt: string | null;
    netRwf: number;
    period: string;
}>;
export type MyPayslip = z.infer<typeof MyPayslip>;
export declare const MyPayslipList: z.ZodObject<{
    payslips: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        period: z.ZodString;
        grossRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        paidAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        grossRwf: number;
        paidAt: string | null;
        netRwf: number;
        period: string;
    }, {
        id: string;
        grossRwf: number;
        paidAt: string | null;
        netRwf: number;
        period: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    payslips: {
        id: string;
        grossRwf: number;
        paidAt: string | null;
        netRwf: number;
        period: string;
    }[];
}, {
    payslips: {
        id: string;
        grossRwf: number;
        paidAt: string | null;
        netRwf: number;
        period: string;
    }[];
}>;
export type MyPayslipList = z.infer<typeof MyPayslipList>;
export declare const MyLoanList: z.ZodObject<{
    loans: z.ZodArray<z.ZodObject<{
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
        branchId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<["loan", "advance"]>;
        amountRwf: z.ZodNumber;
        givenOn: z.ZodString;
        installments: z.ZodNumber;
        firstPeriod: z.ZodString;
        paidOut: z.ZodEnum<["payslip", "outside"]>;
        reason: z.ZodNullable<z.ZodString>;
        paidRwf: z.ZodNumber;
        remainingRwf: z.ZodNumber;
        settledAt: z.ZodNullable<z.ZodString>;
        schedule: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            period: z.ZodString;
            amountRwf: z.ZodNumber;
            deferredFrom: z.ZodNullable<z.ZodString>;
            paid: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }, {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }>, "many">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "loan" | "advance";
        id: string;
        amountRwf: number;
        reason: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        settledAt: string | null;
        paidRwf: number;
        branchId: string | null;
        givenOn: string;
        installments: number;
        firstPeriod: string;
        paidOut: "payslip" | "outside";
        remainingRwf: number;
        schedule: {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }[];
    }, {
        kind: "loan" | "advance";
        id: string;
        amountRwf: number;
        reason: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        settledAt: string | null;
        paidRwf: number;
        branchId: string | null;
        givenOn: string;
        installments: number;
        firstPeriod: string;
        paidOut: "payslip" | "outside";
        remainingRwf: number;
        schedule: {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    loans: {
        kind: "loan" | "advance";
        id: string;
        amountRwf: number;
        reason: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        settledAt: string | null;
        paidRwf: number;
        branchId: string | null;
        givenOn: string;
        installments: number;
        firstPeriod: string;
        paidOut: "payslip" | "outside";
        remainingRwf: number;
        schedule: {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }[];
    }[];
}, {
    loans: {
        kind: "loan" | "advance";
        id: string;
        amountRwf: number;
        reason: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        settledAt: string | null;
        paidRwf: number;
        branchId: string | null;
        givenOn: string;
        installments: number;
        firstPeriod: string;
        paidOut: "payslip" | "outside";
        remainingRwf: number;
        schedule: {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }[];
    }[];
}>;
export type MyLoanList = z.infer<typeof MyLoanList>;
export declare const MyPayClaimList: z.ZodObject<{
    claims: z.ZodArray<z.ZodObject<{
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
        branchId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<["reimbursement", "leave_encashment"]>;
        /** A reimbursement's amount; an encashment's at the day rate once decided. */
        amountRwf: z.ZodNullable<z.ZodNumber>;
        leaveType: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
        }, {
            name: string;
            id: string;
        }>>;
        days: z.ZodNullable<z.ZodNumber>;
        /** The month it is paid in. */
        period: z.ZodString;
        hasReceipt: z.ZodBoolean;
        reason: z.ZodString;
        status: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        /** Paid with a confirmed payslip. */
        paid: z.ZodBoolean;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        kind: "reimbursement" | "leave_encashment";
        decidedAt: string | null;
        id: string;
        amountRwf: number | null;
        reason: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        paid: boolean;
        createdAt: string;
        branchId: string | null;
        period: string;
        days: number | null;
        leaveType: {
            name: string;
            id: string;
        } | null;
        decidedByName: string | null;
        hasReceipt: boolean;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        kind: "reimbursement" | "leave_encashment";
        decidedAt: string | null;
        id: string;
        amountRwf: number | null;
        reason: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        paid: boolean;
        createdAt: string;
        branchId: string | null;
        period: string;
        days: number | null;
        leaveType: {
            name: string;
            id: string;
        } | null;
        decidedByName: string | null;
        hasReceipt: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    claims: {
        status: "approved" | "rejected" | "cancelled" | "requested";
        kind: "reimbursement" | "leave_encashment";
        decidedAt: string | null;
        id: string;
        amountRwf: number | null;
        reason: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        paid: boolean;
        createdAt: string;
        branchId: string | null;
        period: string;
        days: number | null;
        leaveType: {
            name: string;
            id: string;
        } | null;
        decidedByName: string | null;
        hasReceipt: boolean;
    }[];
}, {
    claims: {
        status: "approved" | "rejected" | "cancelled" | "requested";
        kind: "reimbursement" | "leave_encashment";
        decidedAt: string | null;
        id: string;
        amountRwf: number | null;
        reason: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        paid: boolean;
        createdAt: string;
        branchId: string | null;
        period: string;
        days: number | null;
        leaveType: {
            name: string;
            id: string;
        } | null;
        decidedByName: string | null;
        hasReceipt: boolean;
    }[];
}>;
export type MyPayClaimList = z.infer<typeof MyPayClaimList>;
//# sourceMappingURL=payroll-items.d.ts.map