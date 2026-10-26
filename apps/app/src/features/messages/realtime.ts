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
  /** A lease conversation's event names its lease; a broker conversation's (2026-10-26), its placement. */
  leaseId?: string;
  placementId?: string;
  threadId: string;
}

/** Which conversation: a lease's (landlord and tenant) or a placement's (broker and landlord). */
export type ConversationRef = { kind: "lease"; id: string } | { kind: "placement"; id: string };

const refKey = (ref: ConversationRef) => `${ref.kind}:${ref.id}`;

/** Whether an event is about this conversation. */
export function isAbout(e: MessageEvent, ref: ConversationRef): boolean {
  return ref.kind === "lease" ? e.leaseId === ref.id : e.placementId === ref.id;
}

type Listener = (event: MessageEvent) => void;

let socket: Socket | null = null;
let workspaceId: string | null = null;
const onNew = new Set<Listener>();
const onRead = new Set<Listener>();
const onStatus = new Set<(connected: boolean) => void>();
const threads = new Map<string, { ref: ConversationRef; workspaceId: string | null; count: number }>();

function joinPayload(ref: ConversationRef, ws: string | null) {
  return ref.kind === "lease"
    ? { leaseId: ref.id, workspaceId: ws ?? undefined }
    : { placementId: ref.id, workspaceId: ws ?? undefined };
}

function rejoin(s: Socket) {
  if (workspaceId) s.emit("workspace", { workspaceId });
  for (const t of threads.values()) s.emit("thread", joinPayload(t.ref, t.workspaceId));
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

/**
 * An open conversation hears its own events; call again after the first message made the thread.
 * `ws` is the landlord's business; the tenant and the broker pass null (their own rooms).
 */
export function joinThread(ref: ConversationRef, ws: string | null): () => void {
  const key = refKey(ref);
  const t = threads.get(key) ?? { ref, workspaceId: ws, count: 0 };
  t.count += 1;
  threads.set(key, t);
  const s = ensure();
  if (s?.connected) s.emit("thread", joinPayload(ref, ws));
  return () => {
    const cur = threads.get(key);
    if (!cur) return;
    cur.count -= 1;
    if (cur.count <= 0) threads.delete(key);
  };
}

export function rejoinThread(ref: ConversationRef, ws: string | null): void {
  const s = ensure();
  if (s?.connected) s.emit("thread", joinPayload(ref, ws));
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
