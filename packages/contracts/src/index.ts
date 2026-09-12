/**
 * @injishi/contracts — the single source of truth for shared shapes.
 *
 * API schemas (Zod) and their inferred TypeScript types are defined here and
 * consumed by every app and the backend. Add or change a shape HERE before
 * wiring it into a consumer; a breaking change is a cross-app event.
 */
export * from "./primitives";
export * from "./phone";
export * from "./authz";
export * from "./staff-authz";
export * from "./rdb";
export * from "./countries";
export * from "./geography";
export * from "./registration";
export * from "./inventory";
export * from "./booking";
export * from "./trips";
export * from "./inbox";
export * from "./ops";
export * from "./ebm";
export * from "./ebm-connection";
export * from "./admin";
export * from "./support";
export * from "./platform";
