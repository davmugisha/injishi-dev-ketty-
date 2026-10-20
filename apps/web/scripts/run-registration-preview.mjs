import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer, connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = dirname(scriptDir);
const apiScript = join(scriptDir, "registration-preview-api.mjs");
const nextBin = join(webDir, "node_modules", "next", "dist", "bin", "next");
const apiHost = "127.0.0.1";
const apiPort = 8000;
const webPort = 3000;
const children = new Map();
let stopping = false;
let exitCode = 0;

function portIsFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen({ host: apiHost, port, exclusive: true }, () => {
      probe.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: apiHost, port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForApi() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await portIsOpen(apiPort)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The local preview API did not start on port 8000 within five seconds.");
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  process.exitCode = code;
  for (const child of children.values()) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (!child.pid) {
      child.kill();
      continue;
    }
    if (process.platform === "win32") {
      // Next dev starts a worker process. Terminate the whole tree on Windows.
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.once("error", () => child.kill());
    } else {
      // Each child owns a process group so Next's worker exits with its CLI.
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    }
  }
  const timeout = setTimeout(() => {
    for (const child of children.values()) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    process.exit(exitCode);
  }, 3000);
  timeout.unref();
  if (children.size === 0) process.exit(exitCode);
}

function start(name, args, env) {
  const child = spawn(process.execPath, args, {
    cwd: webDir,
    env,
    stdio: "inherit",
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  children.set(name, child);
  child.once("error", (error) => {
    console.error(`[registration preview] ${name} could not start: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      console.error(`[registration preview] ${name} stopped unexpectedly (${signal ?? code ?? "unknown"}).`);
      stop(1);
    }
    if ([...children.values()].every((running) => running.exitCode !== null || running.signalCode !== null)) {
      process.exit(exitCode);
    }
  });
  return child;
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

try {
  await access(apiScript);
  await access(nextBin);
  for (const port of [apiPort, webPort]) {
    try {
      await portIsFree(port);
    } catch (error) {
      if (error?.code === "EADDRINUSE") {
        throw new Error(`Port ${port} is already in use. Stop the existing local service, then run preview:registration again.`);
      }
      throw error;
    }
  }

  const env = { ...process.env, NEXT_PUBLIC_API_URL: `http://${apiHost}:${apiPort}` };
  start("preview API", [apiScript], env);
  await waitForApi();
  start("Next dev", [nextBin, "dev", "--port", String(webPort), "--hostname", apiHost], env);
  console.log("[registration preview] Fictional data, held in memory. No real verification or payment occurs.");
  console.log("[registration preview] Open http://127.0.0.1:3000/register?kind=hotel");
} catch (error) {
  console.error(`[registration preview] ${error.message}`);
  stop(1);
}
