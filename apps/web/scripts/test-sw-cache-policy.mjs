import assert from "node:assert/strict";
import { classifyRequest } from "../src/lib/sw-cache-policy.ts";

const nav = { sameOrigin: true, isNavigation: true };
const sub = { sameOrigin: true, isNavigation: false };
const cross = { sameOrigin: false, isNavigation: false };

// NEVER cache authenticated data or documents (per-workspace isolation).
assert.equal(classifyRequest("/api/v1/bookings", sub), "network-only");
assert.equal(classifyRequest("/api/auth/session", sub), "network-only");
assert.equal(classifyRequest("/host-today", nav), "network-only");
assert.equal(classifyRequest("/explore", nav), "network-only");
assert.equal(classifyRequest("https://s3.example/signed?x=1", cross), "network-only");

// Same-origin ABSOLUTE URLs must be classified from the normalized pathname,
// not skipped or mismatched, for both denylisted and allowlisted paths.
assert.equal(classifyRequest("https://injishi.be/api/v1/bookings", sub), "network-only");
assert.equal(
  classifyRequest("https://injishi.be/shared/js/injishi-web-shell.js", sub),
  "cache-first",
);

// Dot-segment normalization: a bare path with ".." must not bypass the /api/
// denylist by satisfying an allowlist prefix before normalization.
assert.equal(classifyRequest("/assets/../api/v1/bookings", sub), "network-only");

// DO cache static, non-user-specific same-origin assets.
assert.equal(classifyRequest("/_next/static/chunks/abc.js", sub), "cache-first");
assert.equal(classifyRequest("/shared/js/injishi-web-shell.js", sub), "cache-first");
assert.equal(classifyRequest("/assets/css/site.css", sub), "cache-first");
assert.equal(classifyRequest("/icons/icon-192.png", sub), "cache-first");
assert.equal(classifyRequest("/img/hero.avif", sub), "cache-first");

console.log("sw-cache-policy: all assertions passed");
