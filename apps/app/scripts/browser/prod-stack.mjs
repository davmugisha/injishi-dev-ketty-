#!/usr/bin/env node
/**
 * Start the production shape on this machine (`prod-shape.mjs` says what that is and why `localhost` is not
 * it): an https edge on :8443 routing `www.`, `app.` and `api.injishi.test` by Host, the API as production
 * runs it (NODE_ENV and INJISHI_ENVIRONMENT `production`, so codes are random and mailed), and web and the
 * app built with those public origins.
 *
 *   node apps/app/scripts/browser/prod-stack.mjs            # next start over existing builds
 *   node apps/app/scripts/browser/prod-stack.mjs --build    # next build first (the NEXT_PUBLIC_* are baked)
 *   node apps/app/scripts/browser/prod-stack.mjs --dev      # next dev, for iterating
 *   node apps/app/scripts/browser/prod-stack.mjs --only api,edge
 *
 * Needs the local stack's Postgres, Redis, MinIO and Mailpit (`pnpm dev:stack`), a migrated database, a
 * built API (`pnpm api:build`) and `server/api/.env`; the variables below override that file. The web and
 * app builds go to `.next-prod-shape`, never `.next`, so they cannot be mistaken for anything else.
 * Prints "PROD STACK READY" once every host answers through the edge, then runs until stopped.
 */
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN,
  APEX,
  API,
  APP,
  CERT,
  CLIENT_IP_HEADER,
  COOKIE_DOMAIN,
  EDGE_PORT,
  HOSTS_PRELOAD,
  KEY,
  PARENT,
  STATE_DIR,
  UPSTREAM,
  WEB,
} from "./prod-shape.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const args = process.argv.slice(2);
const DEV = args.includes("--dev");
const BUILD = args.includes("--build");
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const wants = (name) => !only || only.has(name);
const DIST = ".next-prod-shape";

mkdirSync(path.join(STATE_DIR, "logs"), { recursive: true });

function ensureCertificate() {
  if (existsSync(CERT) && existsSync(KEY)) return;
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      KEY,
      "-out",
      CERT,
      "-days",
      "30",
      "-subj",
      `/CN=${PARENT}`,
      "-addext",
      `subjectAltName=DNS:${PARENT},DNS:*.${PARENT}`,
      "-addext",
      "basicConstraints=critical,CA:TRUE",
    ],
    { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
  );
}

/** Long, distinct secrets for this shape only, kept so a restart keeps its sessions. */
function secrets() {
  const file = path.join(STATE_DIR, "secrets.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const make = () => randomBytes(48).toString("base64url");
  const value = { BETTER_AUTH_SECRET: make(), COOKIE_SECRET: make(), HR_PIN_PEPPER: make() };
  writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
  return value;
}

/** What every frontend is built and run with, as `docker-compose.dokploy.yml`'s production-public block. */
const PUBLIC = {
  NEXT_PUBLIC_API_URL: API,
  NEXT_PUBLIC_WEB_URL: WEB,
  NEXT_PUBLIC_SITE_URL: WEB,
  NEXT_PUBLIC_PMS_URL: APP,
  NEXT_PUBLIC_INJISHI_ENVIRONMENT: "production",
};

const NODE_ENVIRONMENT = {
  NODE_OPTIONS: `--require ${HOSTS_PRELOAD.replaceAll("\\", "/")}`,
  NODE_EXTRA_CA_CERTS: CERT,
  NEXT_TELEMETRY_DISABLED: "1",
};

function apiEnvironment() {
  return {
    ...NODE_ENVIRONMENT,
    ...secrets(),
    NODE_ENV: "production",
    PORT: String(UPSTREAM.api),
    INJISHI_ENVIRONMENT: "production",
    // The local database is the sample one; production's is real. Staging runs exactly this pair.
    INJISHI_DATABASE_KIND: "sample",
    TRUST_PROXY: "1",
    BETTER_AUTH_URL: API,
    AUTH_COOKIE_DOMAIN: COOKIE_DOMAIN,
    CORS_ORIGINS: [WEB, APEX, APP, ADMIN].join(","),
    WEB_URL: WEB,
    SMTP_URL: "smtp://127.0.0.1:1025",
    MAIL_FROM: "Injishi <no-reply@injishi.test>",
    // As production: no Google credentials, no code in the log.
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    OTP_DEBUG_LOG: "",
    OVERSIGHT_HOSTNAMES: "",
    // Production refuses to create buckets (minio-init provisions them); the local stack already made its own.
    STORAGE_CREATE_BUCKETS: "",
    LOG_LEVEL: "warn",
  };
}

const children = [];

function start(name, command, commandArgs, { cwd, env }) {
  const log = createWriteStream(path.join(STATE_DIR, "logs", `${name}.log`), { flags: "a" });
  log.write(`\n--- ${new Date().toISOString()} ${command} ${commandArgs.join(" ")}\n`);
  const child = spawn(command, commandArgs, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on("exit", (code) =>
    console.log(`  ${name} exited (${code}); see ${path.join(STATE_DIR, "logs", `${name}.log`)}`),
  );
  children.push(child);
  return child;
}

function next(app) {
  const cwd = path.join(ROOT, "apps", app);
  const bin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
  const port = app === "web" ? UPSTREAM.www : UPSTREAM.app;
  const env = {
    ...NODE_ENVIRONMENT,
    ...PUBLIC,
    NEXT_DIST_DIR: DIST,
    PORT: String(port),
    ...(app === "web"
      ? { INTERNAL_API_URL: `http://127.0.0.1:${UPSTREAM.api}` }
      : {
          INJISHI_API_URL: `http://127.0.0.1:${UPSTREAM.api}`,
          INJISHI_API_ORIGIN: APP,
          AUTH_COOKIE_DOMAIN: COOKIE_DOMAIN,
          OPERATOR_ASSET_PREFIX: "/operator-static",
          INJISHI_DB_URL: `file:${path.join(STATE_DIR, "app.db").replaceAll("\\", "/")}`,
        }),
  };
  if (app === "web") execFileSync(process.execPath, ["scripts/copy-maplibre-worker.mjs"], { cwd, stdio: "ignore" });
  if (BUILD && !DEV) {
    console.log(`  building ${app} (next build into ${DIST})…`);
    // `next build` points tsconfig.json and next-env.d.ts at its distDir's types. Those lines must not be
    // committed (scripts/check-tsconfig-includes.mjs), so both files go back as they were.
    const touched = ["tsconfig.json", "next-env.d.ts"].map((file) => path.join(cwd, file));
    const before = touched.map((file) => (existsSync(file) ? readFileSync(file) : null));
    try {
      // Web builds with webpack under Next 16 (its service worker plugin; apps/web/next.config.ts).
      execFileSync(process.execPath, [bin, "build", ...(app === "web" ? ["--webpack"] : [])], {
        cwd,
        env: { ...process.env, ...env, NODE_ENV: "production" },
        stdio: ["ignore", "inherit", "inherit"],
      });
    } finally {
      for (const [i, file] of touched.entries()) if (before[i] !== null) writeFileSync(file, before[i]);
    }
  }
  const mode = DEV
    ? ["dev", ...(app === "web" ? ["--webpack"] : []), "--port", String(port)]
    : ["start", "--port", String(port)];
  return start(app, process.execPath, [bin, ...mode], {
    cwd,
    env: { ...env, NODE_ENV: DEV ? "development" : "production" },
  });
}

function edge() {
  const options = { key: readFileSync(KEY), cert: readFileSync(CERT) };
  const route = (req) => {
    const host = String(req.headers.host ?? "")
      .split(":")[0]
      .toLowerCase();
    if (host === PARENT) return { redirect: true };
    const name = host.endsWith(`.${PARENT}`) ? host.slice(0, -(PARENT.length + 1)) : null;
    const port = name ? UPSTREAM[name] : undefined;
    return port ? { port, host } : null;
  };
  const forwarded = (req) => {
    const seen = String(req.headers[CLIENT_IP_HEADER] ?? "") || req.socket.remoteAddress?.replace(/^::ffff:/, "");
    const headers = { ...req.headers };
    delete headers[CLIENT_IP_HEADER];
    delete headers["x-forwarded-for"];
    delete headers["x-real-ip"];
    return {
      ...headers,
      "x-forwarded-for": seen,
      "x-real-ip": seen,
      "x-forwarded-proto": "https",
      "x-forwarded-host": req.headers.host,
      "x-forwarded-port": String(EDGE_PORT),
    };
  };
  const server = https.createServer(options, (req, res) => {
    const target = route(req);
    if (target?.redirect) {
      res.writeHead(301, { location: `${WEB}${req.url}` });
      return res.end();
    }
    if (!target) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end(`no service for ${req.headers.host}`);
    }
    const upstream = http.request(
      { host: "127.0.0.1", port: target.port, method: req.method, path: req.url, headers: forwarded(req) },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.rawHeaders);
        answer.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
      res.end(`edge: ${target.host} did not answer (${error.code ?? error.message})`);
    });
    req.pipe(upstream);
  });
  // Next's dev server keeps a websocket for reloads.
  server.on("upgrade", (req, socket, head) => {
    const target = route(req);
    if (!target?.port) return socket.destroy();
    const upstream = http.request({
      host: "127.0.0.1",
      port: target.port,
      method: req.method,
      path: req.url,
      headers: forwarded(req),
    });
    upstream.on("upgrade", (answer, upstreamSocket, upstreamHead) => {
      const lines = [`HTTP/1.1 ${answer.statusCode} ${answer.statusMessage}`];
      for (let i = 0; i < answer.rawHeaders.length; i += 2)
        lines.push(`${answer.rawHeaders[i]}: ${answer.rawHeaders[i + 1]}`);
      socket.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) upstreamSocket.write(head);
      upstreamSocket.pipe(socket).pipe(upstreamSocket);
    });
    upstream.on("error", () => socket.destroy());
    upstream.end();
  });
  server.listen(EDGE_PORT, "127.0.0.1");
  return server;
}

function stopAll() {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {}
    } else child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});
process.on("exit", stopAll);

ensureCertificate();
// This process fetches its own edge below, over the same names and certificate.
process.env.NODE_EXTRA_CA_CERTS = CERT;
await import("./test-hosts.cjs");

if (wants("edge")) edge();
if (wants("api")) {
  const api = path.join(ROOT, "server", "api");
  if (!existsSync(path.join(api, "dist", "main.js"))) throw new Error("server/api is not built: run pnpm api:build");
  start("api", process.execPath, ["dist/main.js"], { cwd: api, env: apiEnvironment() });
}
if (wants("app")) next("app");
if (wants("web")) next("web");

// https.get honours NODE_EXTRA_CA_CERTS only at startup, so the readiness probe trusts the edge directly.
const agent = new https.Agent({ ca: readFileSync(CERT) });
async function ready(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { agent, timeout: 10_000 }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

const probes = [
  wants("api") && `${API}/api/v1/health`,
  wants("app") && `${APP}/sign-in`,
  wants("web") && `${WEB}/`,
].filter(Boolean);
const deadline = Date.now() + 15 * 60_000;
const pending = new Set(probes);
while (pending.size && Date.now() < deadline) {
  for (const url of [...pending]) if (await ready(url)) pending.delete(url);
  if (pending.size) await new Promise((r) => setTimeout(r, 2_000));
}
if (pending.size) {
  console.log(`PROD STACK NOT READY: ${[...pending].join(", ")} (logs in ${path.join(STATE_DIR, "logs")})`);
  stopAll();
  process.exit(1);
}
console.log(`PROD STACK READY  web ${WEB}  app ${APP}  api ${API}  (logs in ${path.join(STATE_DIR, "logs")})`);
