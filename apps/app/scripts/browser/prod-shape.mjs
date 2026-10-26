/**
 * The production shape, on one laptop: what `prod-stack.mjs` starts and what `auth-e2e.mjs` drives.
 *
 * Production is three https hosts under one parent domain, `www.`, `app.` and `api.injishi.com`, behind
 * one edge that routes by Host. The session cookie is Better Auth's `__Secure-` cookie on the parent
 * domain (`AUTH_COOKIE_DOMAIN=.injishi.com`), which web and the app read and the API writes.
 *
 * `localhost` hides every part of that: a host-only cookie on `localhost` reaches every port, plain http
 * drops `Secure` and the `__Secure-` prefix, and no `Domain` attribute is ever needed. A sign-in that
 * passes there proves nothing about the cookie production depends on. So this names hosts under
 * `injishi.test` (RFC 2606, never a real site), served over https by a local edge on one port, with
 * Chromium and Node both told those names are this machine.
 */
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PARENT = "injishi.test";
export const EDGE_PORT = Number(process.env.PROD_SHAPE_EDGE_PORT ?? 8443);

/** Where each host's service listens. The edge routes `<name>.injishi.test` to these. */
export const UPSTREAM = {
  www: Number(process.env.PROD_SHAPE_WEB_PORT ?? 3100),
  app: Number(process.env.PROD_SHAPE_APP_PORT ?? 3102),
  api: Number(process.env.PROD_SHAPE_API_PORT ?? 8100),
};

const origin = (name) => `https://${name ? `${name}.` : ""}${PARENT}${EDGE_PORT === 443 ? "" : `:${EDGE_PORT}`}`;

export const WEB = origin("www");
export const APP = origin("app");
export const API = origin("api");
export const APEX = origin("");
export const ADMIN = origin("admin");

/** The cookie domain production sets, in this shape. */
export const COOKIE_DOMAIN = `.${PARENT}`;

/** Certificate, secrets and logs for one machine. Outside the repository: none of it is source. */
export const STATE_DIR = process.env.PROD_SHAPE_DIR ?? path.join(os.tmpdir(), "injishi-prod-shape");
export const CERT = path.join(STATE_DIR, "edge-cert.pem");
export const KEY = path.join(STATE_DIR, "edge-key.pem");

/**
 * The edge stamps the visitor's address as Traefik does: it drops whatever the client sent and writes the
 * one it saw. Every request from this machine is 127.0.0.1, so a check that wants to be a distinct visitor
 * names an address in this header and the edge takes it as the one it saw. Without it every run would share
 * one per-IP send budget, which production visitors do not.
 */
export const CLIENT_IP_HEADER = "x-prod-shape-client-ip";

export const MAILPIT = (process.env.MAILPIT_URL ?? "http://localhost:8025").replace(/\/$/, "");

const here = path.dirname(fileURLToPath(import.meta.url));
/** Preloaded into every Node process of the stack, so `*.injishi.test` resolves here (`test-hosts.cjs`). */
export const HOSTS_PRELOAD = path.join(here, "test-hosts.cjs");

/** Chromium: the names are this machine, and the edge's certificate is the test one. */
export const CHROMIUM_ARGS = [
  `--host-resolver-rules=MAP *.${PARENT} 127.0.0.1,MAP ${PARENT} 127.0.0.1`,
  "--ignore-certificate-errors",
];
