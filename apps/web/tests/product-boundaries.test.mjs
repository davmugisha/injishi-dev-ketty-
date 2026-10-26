/**
 * The planted controls for `injishi/product-boundaries` and `injishi/no-demo-data`
 * (ADR-074 D-f).
 *
 * No product exists when these rules land, so nothing on disk can prove them:
 * a rule that finds nothing and a rule that checks nothing look the same from
 * outside (the lesson `eslint-rules.test.mjs` records for the design rules).
 * Every refused edge of ADR-074's import table is planted here, from a file
 * placed where it would live, and every allowed edge is pinned beside it.
 *
 * The file names are real paths under this checkout, because the rules decide
 * which root a file sits in from its path relative to the repository. Nothing
 * is read from them.
 *
 * WHY THIS FILE LIVES IN apps/web: see `eslint-rules.test.mjs`. `tools/` has no
 * test runner, and this app already runs `node --test` and resolves `eslint`.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";

import { noDemoData, productBoundaries } from "../../../tools/eslint-rules/product-boundaries.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const at = (path) => join(ROOT, ...path.split("/"));

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const PMS = at("products/pms/src/modules/reservations/web/reservations-view.tsx");
const WEB = at("apps/web/src/app/(marketplace)/stay/page.tsx");
const APP = at("apps/app/src/features/frontdesk/arrivals.tsx");
const MOBILE = at("apps/mobile/src/screens/stay.tsx");
const PACKAGE = at("packages/ui/src/layout.tsx");
const SERVER = at("server/api/src/modules/booking/booking.module.ts");

const valid = (code, filename) => ({ code, filename });
const invalid = (code, filename, messageId) => ({ code, filename, errors: [{ messageId }] });

describe("injishi/product-boundaries", () => {
  test("refuses every edge ADR-074's import table refuses, and only those", () => {
    ruleTester.run("product-boundaries", productBoundaries, {
      valid: [
        // An app imports a product through its declared exports.
        valid(`import { definition } from "@injishi/product-pms";`, WEB),
        valid(`import { ReservationsView } from "@injishi/product-pms/web";`, APP),
        valid(`import { StayCard } from "@injishi/product-pms/native";`, MOBILE),
        valid(`import "@injishi/product-pms/styles.css";`, WEB),
        // A product imports technical packages, and itself.
        valid(`import { Chip } from "@injishi/ui";`, PMS),
        valid(`import type { ProductDefinition } from "@injishi/product-contract";`, PMS),
        valid(`import { createApiClient } from "@injishi/api-client";`, PMS),
        valid(`import { rows } from "../model.ts";`, PMS),
        valid(`import { definition } from "@injishi/product-pms";`, PMS),
        // product-contract is a package, not a product named "contract".
        valid(`import type { ProductId } from "@injishi/product-contract";`, PACKAGE),
        // The server imports its own modules and the shared contracts.
        valid(`import { Booking } from "@injishi/contracts";`, SERVER),
        valid(`import { Pool } from "pg";`, SERVER),
        // Client code reads the API, never the server, but the shared auth
        // entry points are fine.
        valid(`import { makeAuthClient } from "@injishi/auth/client";`, APP),
        // The demo's embedded store runs drizzle-orm on a phone; that is
        // no-demo-data's to retire, not this rule's.
        valid(`import { drizzle } from "drizzle-orm/expo-sqlite";`, MOBILE),
        // A file outside the four roots is not this rule's business.
        valid(`import { readFileSync } from "node:fs"; import "../../products/pos/src/index.ts";`, at("scripts/x.mjs")),
      ],
      invalid: [
        // A product to an app.
        invalid(`import { session } from "@injishi/app";`, PMS, "productToApp"),
        invalid(`import { shell } from "../../../../../../apps/app/src/shell.tsx";`, PMS, "productToApp"),
        // A product to another product, by name, by relative path, as a type,
        // as a re-export, dynamically and through require.
        invalid(`import { Till } from "@injishi/product-pos";`, PMS, "productToProduct"),
        invalid(`import { Till } from "../../../../../pos/src/modules/till/model.ts";`, PMS, "productToProduct"),
        invalid(`import type { Ticket } from "@injishi/product-pos/web";`, PMS, "productToProduct"),
        invalid(`export { Till } from "@injishi/product-pos";`, PMS, "productToProduct"),
        invalid(`export * from "@injishi/product-pos";`, PMS, "productToProduct"),
        invalid(`const till = await import("@injishi/product-pos");`, PMS, "productToProduct"),
        invalid(`const till = require("@injishi/product-pos");`, PMS, "productToProduct"),
        invalid(`type T = typeof import("@injishi/product-pos");`, PMS, "productToProduct"),
        // A technical package to a product.
        invalid(`import { definition } from "@injishi/product-hr";`, PACKAGE, "packageToProduct"),
        invalid(`import { x } from "../../../products/hr/src/index.ts";`, PACKAGE, "packageToProduct"),
        // The server to a product.
        invalid(`import { definition } from "@injishi/product-hr";`, SERVER, "serverToProduct"),
        // Client code to the server, a driver, a provider SDK or auth's server entry.
        invalid(`import { BookingService } from "@injishi/api";`, APP, "clientToServer"),
        invalid(`import { x } from "../../../../../server/api/src/modules/booking/booking.service.ts";`, APP, "clientToServer"),
        invalid(`import { Pool } from "pg";`, APP, "clientToServer"),
        invalid(`import { pgTable } from "drizzle-orm/pg-core";`, PMS, "clientToServer"),
        invalid(`import { S3Client } from "@aws-sdk/client-s3";`, WEB, "clientToServer"),
        invalid(`import nodemailer from "nodemailer";`, APP, "clientToServer"),
        invalid(`import { Queue } from "bullmq";`, PMS, "clientToServer"),
        invalid(`import { Injectable } from "@nestjs/common";`, PMS, "clientToServer"),
        invalid(`import { createAuth } from "@injishi/auth/server";`, MOBILE, "clientToServer"),
        // An app past a product's exports.
        invalid(`import { rows } from "@injishi/product-pms/src/modules/reservations/model.ts";`, APP, "productThroughExports"),
        invalid(`import { rows } from "../../../../../../products/pms/src/index.ts";`, WEB, "productThroughExports"),
      ],
    });
  });
});

describe("injishi/no-demo-data", () => {
  test("refuses the demo packages in production code, and exempts the demo itself", () => {
    ruleTester.run("no-demo-data", noDemoData, {
      valid: [
        // The demo packages may read each other.
        valid(`import { personas } from "@injishi/data/personas";`, at("packages/db/src/seed.ts")),
        // A demo folder anywhere, and the app's demo sign in.
        valid(`import { personas } from "@injishi/data";`, at("apps/app/src/features/demo/switcher.tsx")),
        valid(`import { openDb } from "@injishi/db";`, at("apps/app/src/server/auth.ts")),
        // Anything else from the packages is fine.
        valid(`import { cn } from "@injishi/utils";`, APP),
        // An explicit allow list replaces the default.
        {
          code: `import { personas } from "@injishi/data";`,
          filename: APP,
          options: [{ allow: ["apps/app/src/features/**"] }],
        },
      ],
      invalid: [
        invalid(`import { owner } from "@injishi/data/fixtures/owner";`, APP, "demoData"),
        invalid(`import { personas } from "@injishi/data";`, MOBILE, "demoData"),
        invalid(`import { openDb } from "@injishi/db";`, WEB, "demoData"),
        invalid(`import { personas } from "@injishi/data";`, PMS, "demoData"),
        invalid(`import { personas } from "@injishi/data";`, PACKAGE, "demoData"),
        invalid(`import { x } from "../../../../../packages/data/src/index.ts";`, APP, "demoData"),
        invalid(`const db = await import("@injishi/db");`, APP, "demoData"),
      ],
    });
  });
});
