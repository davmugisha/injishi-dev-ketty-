"use client";

import { Label } from "@heroui/react";
import { type PointerEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { ActionButton } from "./buttons.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A point in units of the pad's width, so a drawing keeps its shape when the pad is resized. */
interface Point {
  x: number;
  y: number;
  /** Line width in CSS pixels at a 1:1 pad; a pen's pressure changes it. */
  w: number;
}

const INK = 2.2;

function strokeWidth(event: PointerEvent<HTMLCanvasElement>): number {
  // A pen reports pressure (0..1); a mouse reports 0.5 while pressed, a finger 0 or 0.5.
  if (event.pointerType !== "pen" || !event.pressure) return INK;
  return 1.2 + event.pressure * 2.4;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Point[], scale: number) {
  if (stroke.length === 0) return;
  ctx.beginPath();
  const first = stroke[0];
  ctx.moveTo(first.x * scale, first.y * scale);
  if (stroke.length === 1) {
    // A tap is a dot.
    ctx.lineWidth = first.w;
    ctx.lineTo(first.x * scale + 0.1, first.y * scale + 0.1);
    ctx.stroke();
    return;
  }
  for (let i = 1; i < stroke.length; i++) {
    const prev = stroke[i - 1];
    const cur = stroke[i];
    ctx.lineWidth = (prev.w + cur.w) / 2;
    ctx.quadraticCurveTo(
      prev.x * scale,
      prev.y * scale,
      ((prev.x + cur.x) / 2) * scale,
      ((prev.y + cur.y) / 2) * scale,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(((prev.x + cur.x) / 2) * scale, ((prev.y + cur.y) / 2) * scale);
  }
  const last = stroke[stroke.length - 1];
  ctx.lineTo(last.x * scale, last.y * scale);
  ctx.stroke();
}

function setInk(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/**
 * The strokes as a PNG data URL, in black on a clear ground whatever the theme (it is printed on the
 * white page of the signed PDF), at twice the pad's size.
 */
function exportPng(strokes: Point[][], width: number, height: number): string | null {
  if (typeof document === "undefined" || width === 0) return null;
  const out = document.createElement("canvas");
  out.width = Math.round(width * 2);
  out.height = Math.round(height * 2);
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.scale(2, 2);
  // The saved signature goes on a printed contract: black ink whatever the theme.
  setInk(ctx, "black");
  for (const stroke of strokes) drawStroke(ctx, stroke, width);
  return out.toDataURL("image/png");
}

export interface SignaturePadProps {
  /** The drawing as a PNG data URL after each stroke, or null once cleared. */
  onChange?: (png: string | null) => void;
  /** @default "Your signature" */
  label?: ReactNode;
  /**
   * One line under the pad. @default "Draw with a finger, a pen or a mouse." Say what the drawing is for:
   * the typed name beside it (the caller's field) is the binding signature.
   */
  description?: ReactNode;
  errorMessage?: string | null;
  isDisabled?: boolean;
  className?: string;
}

/**
 * A signature drawn with a finger, a pen or a mouse (pointer events, so all three; a pen's pressure
 * thickens the line). The pad fills its container's width and keeps the drawing's shape when resized.
 * Clear starts again. A drawing can't be made from a keyboard, so a form asks for the typed name too
 * and treats the drawing as optional.
 */
export function SignaturePad({
  onChange,
  label = "Your signature",
  description = "Draw with a finger, a pen or a mouse.",
  errorMessage,
  isDisabled,
  className,
}: SignaturePadProps) {
  const id = useId();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef<number | null>(null);
  const [inked, setInked] = useState(false);

  const paint = useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = el.getBoundingClientRect();
    const w = Math.round(width * ratio);
    const h = Math.round(height * ratio);
    if (el.width !== w || el.height !== h) {
      el.width = w;
      el.height = h;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    // The ink follows the theme on screen (the canvas's text colour); the export is always black.
    setInk(ctx, getComputedStyle(el).color);
    for (const stroke of strokes.current) drawStroke(ctx, stroke, width);
  }, []);

  useEffect(() => {
    paint();
    const el = canvas.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(el);
    // The theme can change while the pad is open: repaint in the new ink.
    const themeWatch = new MutationObserver(() => paint());
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      observer.disconnect();
      themeWatch.disconnect();
    };
  }, [paint]);

  const pointAt = (event: PointerEvent<HTMLCanvasElement>, native?: globalThis.PointerEvent): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (native ?? event).clientX - box.left;
    const y = (native ?? event).clientY - box.top;
    return { x: x / box.width, y: y / box.width, w: strokeWidth(event) };
  };

  const finish = () => {
    if (drawing.current === null) return;
    drawing.current = null;
    const el = canvas.current;
    if (!el || strokes.current.length === 0) return;
    const { width, height } = el.getBoundingClientRect();
    onChange?.(exportPng(strokes.current, width, height));
  };

  const clear = () => {
    strokes.current = [];
    drawing.current = null;
    setInked(false);
    paint();
    onChange?.(null);
  };

  const helpId = `${id}-help`;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-end justify-between gap-2">
        <Label id={`${id}-label`} elementType="span" isInvalid={Boolean(errorMessage)} isDisabled={isDisabled}>
          {label}
        </Label>
        <ActionButton icon="Eraser" size="sm" intent="ghost" onPress={clear} isDisabled={!inked || isDisabled}>
          Clear
        </ActionButton>
      </div>
      <div
        className={cx(
          "relative overflow-hidden rounded-lg border bg-field text-foreground",
          errorMessage ? "border-danger" : "border-field-border",
          isDisabled && "opacity-60",
        )}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-labelledby={`${id}-label`}
          aria-describedby={helpId}
          aria-disabled={isDisabled || undefined}
          className={cx(
            "block h-40 w-full touch-none select-none",
            isDisabled ? "cursor-not-allowed" : "cursor-crosshair",
          )}
          onPointerDown={(event) => {
            if (isDisabled || (event.pointerType === "mouse" && event.button !== 0)) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = event.pointerId;
            strokes.current.push([pointAt(event)]);
            setInked(true);
            paint();
          }}
          onPointerMove={(event) => {
            if (drawing.current !== event.pointerId) return;
            const stroke = strokes.current[strokes.current.length - 1];
            // Every sample since the last frame, so fast strokes stay smooth.
            const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
            if (samples.length > 0) for (const s of samples) stroke.push(pointAt(event, s));
            else stroke.push(pointAt(event));
            paint();
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
        />
        {/* Where to sign: a line and a mark, under the ink. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-border"
        />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-10 left-6 text-sm text-muted">
          ×
        </span>
        {!inked ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted"
          >
            Sign here
          </span>
        ) : null}
      </div>
      {errorMessage ? (
        <p role="alert" className="px-1 text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
      <p id={helpId} className={cx("px-1 text-xs text-pretty text-muted", errorMessage && "sr-only")}>
        {description}
        <span className="sr-only">{inked ? " A signature is drawn." : " Nothing is drawn yet."}</span>
      </p>
    </div>
  );
}
