"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @injishi/contracts — the single source of truth for shared shapes.
 *
 * API schemas (Zod) and their inferred TypeScript types are defined here and
 * consumed by every app and the backend. Add or change a shape HERE before
 * wiring it into a consumer; a breaking change is a cross-app event.
 */
__exportStar(require("./primitives"), exports);
__exportStar(require("./phone"), exports);
__exportStar(require("./authz"), exports);
__exportStar(require("./staff-authz"), exports);
__exportStar(require("./rdb"), exports);
__exportStar(require("./countries"), exports);
__exportStar(require("./geography"), exports);
__exportStar(require("./registration"), exports);
__exportStar(require("./inventory"), exports);
__exportStar(require("./setup-steps"), exports);
__exportStar(require("./booking"), exports);
__exportStar(require("./trips"), exports);
__exportStar(require("./stay"), exports);
__exportStar(require("./offers"), exports);
__exportStar(require("./inbox"), exports);
__exportStar(require("./ops"), exports);
__exportStar(require("./broker"), exports);
__exportStar(require("./ordering"), exports);
__exportStar(require("./outlets"), exports);
__exportStar(require("./property-detail"), exports);
__exportStar(require("./ebm"), exports);
__exportStar(require("./ebm-connection"), exports);
__exportStar(require("./admin"), exports);
__exportStar(require("./support"), exports);
__exportStar(require("./assistant"), exports);
__exportStar(require("./waitlist"), exports);
__exportStar(require("./platform"), exports);
__exportStar(require("./training"), exports);
__exportStar(require("./psf"), exports);
__exportStar(require("./identity"), exports);
__exportStar(require("./people"), exports);
__exportStar(require("./people-file"), exports);
__exportStar(require("./time"), exports);
__exportStar(require("./leave"), exports);
__exportStar(require("./payroll-items"), exports);
__exportStar(require("./payroll"), exports);
__exportStar(require("./checklists"), exports);
__exportStar(require("./list-query"), exports);
__exportStar(require("./hr-lists"), exports);
__exportStar(require("./redaction"), exports);
//# sourceMappingURL=index.js.map