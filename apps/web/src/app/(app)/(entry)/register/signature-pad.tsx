"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Input } from "@heroui/react";
import { Eraser, Undo2 } from "lucide-react";

/**
 * A signature the registrant draws, with a pointer or a fingertip.
 *
 * THE STROKES ARE THE STATE, NOT THE PIXELS. Everything here is rebuilt from a
 * list of points every time it is painted, and that is the decision the rest of
 * the component follows from. Painting straight onto the canvas and keeping
 * only the bitmap is shorter and breaks in three ways this app would actually
 * hit: the mark blurs when the window is resized or the pad crosses a device
 * pixel ratio boundary, it cannot be undone one stroke at a time, and — the one
 * that matters most — it bakes in whatever ink colour was current when the line
 * was drawn.
 *
 * THE DARK THEME TRAP. This app has a dark mode, and a signature drawn in ink
 * the eye can see against a dark card is ink that vanishes on the white page it
 * is exported onto. So there are two renderings of the same strokes. The one on
 * screen takes its colour from the canvas element's own computed `color`, which
 * is the theme's foreground token and follows a theme switch mid-signature; the
 * one that leaves the app is drawn separately, in document ink on a transparent
 * ground, at three times the size so it stays crisp when printed. `black` there
 * is a deliberate literal and not a missed token: the exported PNG is ink on
 * paper, it is opened outside this app where no token exists, and reading the
 * theme for it is precisely the bug being avoided.
 *
 * KEYBOARD. A canvas cannot be drawn on with a keyboard, and a required step
 * that only a mouse can pass is a step that traps somebody. The pad is
 * therefore not the only way through: the typed alternative below sets the same
 * mark from the signer's own name, records itself as `typed` so the document
 * can say which it was, and is reachable by tab like any other control. The
 * controls around the pad — undo, clear, the alternative — are all real
 * buttons, and the live region announces every change for a screen reader that
 * cannot see the canvas at all.
 */

export interface SignatureCapture {
  /** PNG data URL, dark ink on a transparent ground. */
  dataUrl: string;
  method: "drawn" | "typed";
}

type Point = { x: number; y: number };

/** The CSS pixel geometry the pad draws in. The canvas is stretched to it. */
const PAD_WIDTH = 560;
const PAD_HEIGHT = 180;

/** How much bigger the exported mark is than the on-screen one. */
const EXPORT_SCALE = 3;

export function SignaturePad({
  value,
  onChange,
  signerName,
  disabled = false,
}: {
  value: SignatureCapture | null;
  onChange: (next: SignatureCapture | null) => void;
  /** Prefills the typed alternative, so the fallback is one press for most people. */
  signerName: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Point[][]>([]);
  const drawingRef = useRef(false);
  const typedRef = useRef<string | null>(null);

  // Mirrors of the two refs, so the buttons re-render when the mark changes.
  // The refs stay the source of truth because a pointer move must not wait for
  // a React commit before the next segment is drawn.
  const [strokeCount, setStrokeCount] = useState(0);
  const [typedMark, setTypedMark] = useState<string | null>(null);
  const [typedDraft, setTypedDraft] = useState(signerName);
  const [announcement, setAnnouncement] = useState("");

  const typedFieldId = useId();
  const hintId = useId();

  const empty = strokeCount === 0 && typedMark === null;

  /** Repaint the visible pad from the strokes, in the theme's own ink. */
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The backing store is sized in DEVICE pixels and the drawing is scaled to
    // match, which is the whole of the "why is my signature fuzzy" problem.
    const dpr = window.devicePixelRatio || 1;
    const wanted = Math.round(PAD_WIDTH * dpr);
    const wantedH = Math.round(PAD_HEIGHT * dpr);
    if (canvas.width !== wanted || canvas.height !== wantedH) {
      canvas.width = wanted;
      canvas.height = wantedH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);

    const ink = window.getComputedStyle(canvas).color;
    paintMark(ctx, strokesRef.current, typedRef.current, ink, 2.2);
  }, []);

  // First paint, and again whenever the pixel ratio changes — dragging a window
  // between a laptop screen and an external monitor changes it mid-session, and
  // a pad that does not notice is a pad that goes soft.
  useEffect(() => {
    repaint();
    const media = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`,
    );
    media.addEventListener("change", repaint);
    return () => media.removeEventListener("change", repaint);
  }, [repaint]);

  // A theme switch changes the token this pad reads its ink from, and a mark
  // already on screen has to follow it. Watching the root element is how the
  // rest of this app learns about the switch, so it is what is watched here.
  useEffect(() => {
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    return () => observer.disconnect();
  }, [repaint]);

  /** Hand the finished mark up, exported for paper rather than for the screen. */
  const commit = useCallback(
    (method: "drawn" | "typed") => {
      const dataUrl = exportMark(strokesRef.current, typedRef.current);
      if (dataUrl === null) {
        onChange(null);
        return;
      }
      onChange({ dataUrl, method });
    },
    [onChange],
  );

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    // The element is stretched by CSS, so screen pixels are converted back into
    // the pad's own coordinate space before anything is stored. Without this a
    // signature drawn on a narrow phone lands in the top-left corner of the
    // exported image.
    return {
      x: ((event.clientX - rect.left) / rect.width) * PAD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * PAD_HEIGHT,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    // Pointer capture, so a stroke that runs off the edge of the pad keeps
    // being tracked instead of ending wherever the cursor happened to leave.
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    typedRef.current = null;
    setTypedMark(null);
    strokesRef.current = [...strokesRef.current, [pointFrom(event)]];
    setStrokeCount(strokesRef.current.length);
    repaint();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const strokes = strokesRef.current;
    strokes[strokes.length - 1].push(pointFrom(event));
    repaint();
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commit("drawn");
    setAnnouncement("Signature captured. Undo the last stroke or clear it and start again.");
  };

  const undo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    repaint();
    if (strokesRef.current.length === 0 && typedRef.current === null) {
      onChange(null);
      setAnnouncement("Last stroke removed. The signature area is empty.");
    } else {
      commit("drawn");
      setAnnouncement("Last stroke removed.");
    }
  };

  const clear = () => {
    strokesRef.current = [];
    typedRef.current = null;
    setStrokeCount(0);
    setTypedMark(null);
    repaint();
    onChange(null);
    setAnnouncement("Signature cleared. The signature area is empty.");
  };

  const useTypedName = () => {
    const name = typedDraft.trim();
    if (name.length === 0) return;
    strokesRef.current = [];
    typedRef.current = name;
    setStrokeCount(0);
    setTypedMark(name);
    repaint();
    const dataUrl = exportMark([], name);
    if (dataUrl !== null) onChange({ dataUrl, method: "typed" });
    setAnnouncement(`Signature set from the name ${name}.`);
  };

  return (
    <div className="space-y-3">
      <div
        className={[
          "relative overflow-hidden rounded-card border bg-card",
          value === null ? "border-input" : "border-accent-brand",
        ].join(" ")}
      >
        {/* The ruled line and the cross are CSS rather than paint, so they can
            never end up inside the exported image. A guide line baked into the
            signature is the classic version of this bug. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 bottom-10 border-b border-dashed border-input"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-10 left-8 -translate-x-full pr-1 text-sm text-muted-foreground"
        >
          ×
        </span>
        {empty ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-6 text-center text-xs text-muted-foreground"
          >
            Sign above the line
          </span>
        ) : null}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            empty
              ? "Signature area, empty. Draw your signature with the mouse or your finger."
              : "Signature area, signed."
          }
          aria-describedby={hintId}
          // `touch-action: none` is what stops a fingertip stroke from
          // scrolling the page out from under the pad on a phone.
          style={{ touchAction: "none" }}
          className={[
            "block h-44 w-full text-foreground",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair",
          ].join(" ")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
      </div>

      <p id={hintId} className="text-xs text-muted-foreground">
        Draw your signature with the mouse, a stylus or your finger. It is turned
        into an image that is printed on the copy you download.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onPress={undo}
          isDisabled={disabled || strokeCount === 0}
        >
          <Undo2 size={14} aria-hidden />
          Undo stroke
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onPress={clear}
          isDisabled={disabled || empty}
        >
          <Eraser size={14} aria-hidden />
          Clear and start again
        </Button>
      </div>

      {/* The way through for anyone who cannot draw: a pointer they do not
          have, a tremor, a screen reader. It produces the same kind of mark
          through the same export, and the document records that it was typed
          rather than drawn, because a reader is entitled to know that. */}
      <details className="rounded-card border border-border bg-secondary p-4">
        <summary className="cursor-pointer text-sm font-semibold text-secondary-foreground">
          Can&apos;t draw a signature?
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Type your full name and we will set it as your mark instead. The
          contract you download will say that it was typed rather than drawn.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block grow">
            <span className="text-xs font-semibold" id={`${typedFieldId}-label`}>
              Your full name
            </span>
            <Input
              id={typedFieldId}
              className="mt-1 w-full"
              value={typedDraft}
              disabled={disabled}
              onChange={(e) => setTypedDraft(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            onPress={useTypedName}
            isDisabled={disabled || typedDraft.trim().length === 0}
          >
            Use this as my signature
          </Button>
        </div>
        {typedMark !== null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Your mark is set from the name you typed. Draw on the pad above at
            any time to replace it.
          </p>
        ) : null}
      </details>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

/**
 * The one renderer both canvases go through.
 *
 * Keeping it single is what guarantees that what a person saw when they signed
 * and what ends up on the document are the same shape — two painters would
 * drift the first time one of them learned about line caps.
 */
function paintMark(
  ctx: CanvasRenderingContext2D,
  strokes: Point[][],
  typed: string | null,
  ink: string,
  width: number,
): void {
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (typed !== null) {
    // A cursive stack with a real fallback chain: the last entry is the generic
    // family, so a machine with none of the named faces still renders something
    // that reads as handwriting rather than as a form field.
    ctx.font = `italic 54px "Segoe Script", "Bradley Hand", "Snell Roundhand", cursive`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(typed, 40, PAD_HEIGHT - 56, PAD_WIDTH - 80);
    return;
  }

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    if (stroke.length === 1) {
      // A tap is a dot. Without this, a full stop or the dot of an "i" drawn as
      // a single press disappears, because a path of one point strokes nothing.
      ctx.beginPath();
      ctx.arc(stroke[0].x, stroke[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    // Quadratic segments through the midpoints, rather than straight lines
    // between the sampled points. A pointer samples about sixty times a second
    // and a fast signature at that rate is visibly a polygon.
    for (let i = 1; i < stroke.length - 1; i += 1) {
      const midX = (stroke[i].x + stroke[i + 1].x) / 2;
      const midY = (stroke[i].y + stroke[i + 1].y) / 2;
      ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, midX, midY);
    }
    const last = stroke[stroke.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

/**
 * The mark as it leaves the app: document ink, transparent ground, three times
 * the size.
 *
 * Transparent rather than white so the image sits on whatever the document's
 * own page is, and `black` because that page is ink on paper and carries none
 * of this app's tokens. Returns null when there is nothing to export, so the
 * caller can clear the signature rather than store an empty PNG that would look
 * like a signed contract with an invisible signature on it.
 */
function exportMark(strokes: Point[][], typed: string | null): string | null {
  if (typed === null && strokes.length === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = PAD_WIDTH * EXPORT_SCALE;
  canvas.height = PAD_HEIGHT * EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
  paintMark(ctx, strokes, typed, "black", 2.4);
  return canvas.toDataURL("image/png");
}
