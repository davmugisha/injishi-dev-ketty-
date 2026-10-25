"use client";

/**
 * The live line to the API (P3.4): one Socket.IO connection per tab, opened with the session cookie
 * (the API reads it at the handshake), shared by the sidebar's counts and the open conversation. Events
 * carry ids only; whoever hears one reads over HTTP. Locally the app is on :3002 and the API on :8000:
 * the cookie is the same site's, so it travels; when the socket can't connect at all, `connected` stays
 * false and the screens poll instead.
 */
import { io, type Socket } from "socket.io-client";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const PATH = "/api/realtime";

export interface MessageEvent {
  leaseId: string;
  threadId: string;
}

type Listener = (event: MessageEvent) => void;

let socket: Socket | null = null;
let workspaceId: string | null = null;
const onNew = new Set<Listener>();
const onRead = new Set<Listener>();
const onStatus = new Set<(connected: boolean) => void>();
const threads = new Map<string, { workspaceId: string | null; count: number }>();

function rejoin(s: Socket) {
  if (workspaceId) s.emit("workspace", { workspaceId });
  for (const [leaseId, t] of threads) s.emit("thread", { leaseId, workspaceId: t.workspaceId ?? undefined });
}

function ensure(): Socket | null {
  if (typeof window === "undefined") return null;
  if (socket) return socket;
  socket = io(API_URL, {
    path: PATH,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionDelay: 2000,
    reconnectionDelayMax: 20_000,
  });
  socket.on("connect", () => {
    rejoin(socket as Socket);
    for (const f of onStatus) f(true);
  });
  socket.on("disconnect", () => {
    for (const f of onStatus) f(false);
  });
  socket.on("connect_error", () => {
    for (const f of onStatus) f(false);
  });
  socket.on("message:new", (e: MessageEvent) => {
    for (const f of onNew) f(e);
  });
  socket.on("thread:read", (e: MessageEvent) => {
    for (const f of onRead) f(e);
  });
  return socket;
}

export function isConnected(): boolean {
  return Boolean(socket?.connected);
}

/** The landlord's screens hear their business's conversations. */
export function joinWorkspace(id: string | null): void {
  workspaceId = id;
  const s = ensure();
  if (s?.connected && id) s.emit("workspace", { workspaceId: id });
}

/** An open conversation hears its own events; call again after the first message made the thread. */
export function joinThread(leaseId: string, ws: string | null): () => void {
  const t = threads.get(leaseId) ?? { workspaceId: ws, count: 0 };
  t.count += 1;
  threads.set(leaseId, t);
  const s = ensure();
  if (s?.connected) s.emit("thread", { leaseId, workspaceId: ws ?? undefined });
  return () => {
    const cur = threads.get(leaseId);
    if (!cur) return;
    cur.count -= 1;
    if (cur.count <= 0) threads.delete(leaseId);
  };
}

export function rejoinThread(leaseId: string, ws: string | null): void {
  const s = ensure();
  if (s?.connected) s.emit("thread", { leaseId, workspaceId: ws ?? undefined });
}

export function onMessage(f: Listener): () => void {
  ensure();
  onNew.add(f);
  return () => onNew.delete(f);
}

export function onThreadRead(f: Listener): () => void {
  ensure();
  onRead.add(f);
  return () => onRead.delete(f);
}

export function onConnection(f: (connected: boolean) => void): () => void {
  ensure();
  onStatus.add(f);
  f(isConnected());
  return () => onStatus.delete(f);
}
