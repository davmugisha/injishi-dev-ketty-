"use client";

import { useEffect, useRef } from "react";

/**
 * The footer wordmark, rasterised into a live ASCII grid.
 *
 * It replaces the outlined `Injishi` band that stood here — a single `<p>` with
 * a `-webkit-text-stroke`, which is still the no-JS fallback at the bottom of
 * this file. The word is drawn once to an offscreen canvas, downsampled to one
 * sample per grid cell, and every cell brighter than the threshold becomes a
 * flickering glyph. A cursor force field shoves those glyphs outward on a
 * spring; they overshoot, tint toward the accent and ease back.
 *
 * THREE THINGS MAKE IT A FOOTER COMPONENT rather than a demo page, and each is
 * a deliberate departure from the effect as it is usually written:
 *
 *  1. EVERY COLOUR IS A TOKEN, resolved at runtime. A canvas cannot read
 *     `var(--foreground)`, so a 1x1 scratch canvas converts each role to sRGB
 *     bytes: assign the computed value to `fillStyle`, paint one pixel, read it
 *     back. That is the only conversion that survives a palette authored in
 *     `oklch()` — `fillStyle` serialises an oklch colour back as `oklch(...)`,
 *     which cannot be interpolated by hand. A `MutationObserver` on the `class`
 *     attribute re-reads all three roles when the theme flips, so the wordmark
 *     is correct in light AND dark with no reload and no React state. This is
 *     what `footer-glass.tsx` beside it could not do: that shader parses colour
 *     strings itself, which is why it carries two literals and a recorded
 *     exception. This component needs neither.
 *
 *  2. IT ONLY RUNS WHILE IT IS ON SCREEN. `footer-glass.tsx` pins `speed={0}`
 *     and says why: the footer must not cost anything after first paint. A
 *     wordmark that shimmers cannot honour that literally, so it honours the
 *     reasoning — an `IntersectionObserver` starts the loop when the band
 *     scrolls in and stops it when it leaves, and `visibilitychange` stops it
 *     for a backgrounded tab. Scrolled past, this costs what the band it
 *     replaced cost: nothing.
 *
 *  3. THE IDLE CURSOR IS VIRTUAL. The footer is the last thing on the page and
 *     most visitors never point at it — on a touch screen nobody can. So while
 *     no pointer is over the stage a virtual cursor roams the word on a
 *     Lissajous path at a gentler force. A real pointer takes over, and the two
 *     cross-fade through `roamMix` rather than cutting, so neither arriving nor
 *     leaving snaps.
 *
 * Everything is written straight to one canvas from one rAF loop. React renders
 * this component exactly once.
 */

/** The word, and the glyphs it shimmers through. Its own letters are folded in. */
const WORD = "injishi";
const GLYPHS = ".:-+*=#%@INJISHI";

/** Sampled luma above which a cell is lit. */
const LIT_THRESHOLD = 0.45;
/** How often every lit glyph is re-rolled, in ms. */
const FLICKER_MS = 50;
/**
 * The flicker is biased toward the dense end of the set.
 *
 * A uniform re-roll is what the effect is usually written with, and it costs the
 * wordmark its weight: half of `GLYPHS` is `.`, `:` and `-`, so on any given
 * frame half the word is nearly blank and it reads as grey noise rather than as
 * letters. An exponent below one skews `Math.random()` toward the high indices —
 * the heavy ramp characters and the brand letters — so the word keeps its ink
 * while every cell still changes 20 times a second.
 */
const FLICKER_BIAS = 0.6;

/**
 * The force field, in CELL units.
 *
 * The canonical recipe for this effect uses radius 10 and force 42 over a full
 * viewport. Both are wrong for a band. The push repeats every frame until a
 * glyph leaves the radius, so the RADIUS — not the force — sets how big a hole
 * the cursor carves, and a 10-cell hole is 200px across in a band whose ink is
 * about 200px tall: the cursor would erase the word rather than part it. Force
 * 42 then compounds it, covering 21 cells in the first frame and throwing the
 * glyph clean out of the band before the spring ever acts. Seven and nine keep
 * the same `(1 - d/R)^2` law and the same spring, sized to the band.
 */
const PUSH_RADIUS = 7;
const PUSH_FORCE = 9;
/** Per-axis jitter on the same falloff, so the cluster keeps boiling. */
const TURBULENCE = 2.4;
const SPRING = 0.025;
const DAMPING = 0.5;
/** Below this a glyph is snapped home, so a resting cell costs no arithmetic. */
const REST_EPSILON = 0.01;
/** No glyph travels further than this, so the band cannot clip the word. */
const MAX_OFFSET = 8;

/** The idle cursor: gentler than a hand, and slow enough to read as drift. */
const ROAM_FORCE = 0.55;
const ROAM_SPEED = 0.02;
/** Per-frame ease between the roaming cursor and a real one. */
const HANDOVER = 0.08;

/** Displacement, in cells, at which a glyph is fully accent-tinted. */
const TINT_SPAN = 3;
/**
 * Alpha at rest, and fully disturbed — the disturbance brightens as well.
 *
 * REST IS TWO NUMBERS BECAUSE THE TWO THEMES ARE NOT SYMMETRIC. A pale glyph on
 * a dark ground blooms: anti-aliasing spreads light outward and the eye reads
 * more ink than is there. The same glyph in dark ink on a light ground loses
 * exactly that, and one alpha tuned on the dark band left the light one reading
 * as grey texture rather than as a word. Which one applies is decided by
 * MEASURING the resolved background, not by naming a theme, so a palette that
 * ever inverts corrects itself.
 */
const REST_ALPHA_ON_DARK = 0.82;
const REST_ALPHA_ON_LIGHT = 0.92;
const PUSHED_ALPHA = 1;
/**
 * Glyph weight, compensating the same asymmetry.
 *
 * Alpha alone could not close it, because the gap is not opacity — it is stroke
 * COVERAGE. An 11px monospace glyph is a hairline, and a hairline of dark ink on
 * a near-white ground simply puts less pigment on the band than the same
 * hairline of light ink puts glow on a black one. Weight adds the coverage back.
 */
const WEIGHT_ON_DARK = 400;
const WEIGHT_ON_LIGHT = 700;
/** Luma above which the resolved background counts as a light ground. */
const LIGHT_GROUND = 0.5;
/** Tint steps. Quantising lets one `fillStyle` string serve many glyphs. */
const TINT_STEPS = 12;

/** Cell size and gap: coarse above the breakpoint, fine below it. */
const DESKTOP_CELL = 8;
const DESKTOP_GAP = 2;
const MOBILE_CELL = 3;
const MOBILE_GAP = 1;
const MOBILE_MAX_WIDTH = 768;

/** The banner the word is rasterised into, as a share of the stage. */
const BANNER_WIDTH_RATIO = 0.82;
const BANNER_MAX_WIDTH = 1100;
const BANNER_ASPECT = 0.24;

/**
 * How much foreground is mixed into the background to get a resting dot.
 *
 * NOT `--border`. That role is a HAIRLINE — a line one pixel wide reads at a
 * contrast a field of 8px squares covering 64% of the band does not, and on the
 * light ground the grid came out as graph paper the word had to fight through.
 * Seven percent is the same step the effect uses on its own near-black stage,
 * and deriving it from the two grounds rather than naming a third role means it
 * stays that step in both themes instead of only in the one it was checked in.
 */
const DOT_MIX = 0.07;

/**
 * The elliptical falloff that melts the grid into the page, in half-stage units.
 *
 * A rectangle of dots butting into the accent panel below reads as a texture
 * swatch, not a wordmark. The word spans 0.82 of the stage width, so the fade
 * has to begin outside that or it dims the word's own ends.
 */
const FADE_START = 0.62;
const FADE_END = 1.15;

/** The three roles this component paints with. Nothing else here is a colour. */
const ROLES = ["--foreground", "--accent-text", "--background"] as const;

type Rgb = [number, number, number];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function AsciiWordmark() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* ── colour: a token in, sRGB bytes out ───────────────────────────────── */

    // One scratch pixel. `fillStyle` readback hands an oklch colour straight
    // back as `oklch(...)`, so the PIXEL is the conversion: the browser
    // rasterises the colour and we read the bytes it actually painted.
    const swatch = document.createElement("canvas");
    swatch.width = 1;
    swatch.height = 1;
    const swatchCtx = swatch.getContext("2d", { willReadFrequently: true });

    function resolve(role: string): Rgb {
      const value = getComputedStyle(stage as HTMLElement).getPropertyValue(role).trim();
      if (!swatchCtx || !value) return [128, 128, 128];
      swatchCtx.clearRect(0, 0, 1, 1);
      // A colour the browser cannot parse leaves `fillStyle` untouched, so this
      // line is the reset and the fallback at once.
      swatchCtx.fillStyle = "rgb(0, 0, 0)";
      swatchCtx.fillStyle = value;
      swatchCtx.fillRect(0, 0, 1, 1);
      const pixel = swatchCtx.getImageData(0, 0, 1, 1).data;
      return [pixel[0], pixel[1], pixel[2]];
    }

    let dotColour = "rgb(0, 0, 0)";
    let tints: string[] = [];
    let glyphWeight = WEIGHT_ON_DARK;

    function readPalette() {
      const [foreground, accent, background] = ROLES.map(resolve);
      const dot = background.map((channel, i) =>
        Math.round(lerp(channel, foreground[i], DOT_MIX)),
      );
      dotColour = `rgb(${dot[0]}, ${dot[1]}, ${dot[2]})`;
      const groundLuma =
        (background[0] * 0.299 + background[1] * 0.587 + background[2] * 0.114) / 255;
      const onLight = groundLuma > LIGHT_GROUND;
      const restAlpha = onLight ? REST_ALPHA_ON_LIGHT : REST_ALPHA_ON_DARK;
      glyphWeight = onLight ? WEIGHT_ON_LIGHT : WEIGHT_ON_DARK;
      // One string per tint step, built once. A frame sets `fillStyle` a couple
      // of thousand times; building the string each time is pure garbage.
      tints = Array.from({ length: TINT_STEPS }, (_, stepIndex) => {
        const t = stepIndex / (TINT_STEPS - 1);
        const r = Math.round(lerp(foreground[0], accent[0], t));
        const g = Math.round(lerp(foreground[1], accent[1], t));
        const b = Math.round(lerp(foreground[2], accent[2], t));
        const alpha = lerp(restAlpha, PUSHED_ALPHA, t).toFixed(3);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      });
    }

    /* ── the grid, and the word rasterised into it ────────────────────────── */

    let width = 0;
    let height = 0;
    let cell = DESKTOP_CELL;
    let step = DESKTOP_CELL + DESKTOP_GAP;
    let columns = 0;
    let rows = 0;

    // The lit cells, in parallel typed arrays. One object per cell would be tens
    // of thousands of allocations to walk on every frame.
    let litCount = 0;
    let litCol = new Int16Array(0);
    let litRow = new Int16Array(0);
    let offsetX = new Float32Array(0);
    let offsetY = new Float32Array(0);
    let velocityX = new Float32Array(0);
    let velocityY = new Float32Array(0);
    let glyphIndex = new Uint8Array(0);

    // The resting dots never move, so they are painted once and blitted.
    const dots = document.createElement("canvas");
    const dotsCtx = dots.getContext("2d");

    function measure() {
      const rect = stage!.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const fine = width < MOBILE_MAX_WIDTH;
      cell = fine ? MOBILE_CELL : DESKTOP_CELL;
      step = cell + (fine ? MOBILE_GAP : DESKTOP_GAP);
      columns = Math.max(1, Math.floor(width / step));
      rows = Math.max(1, Math.floor(height / step));
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /**
     * Paint the resting grid once, faded elliptically so it pools around the
     * word rather than filling the band.
     *
     * The falloff is per dot rather than a gradient mask over the whole layer: a
     * radial gradient is a CIRCLE, and a band is four times wider than it is
     * tall, so the circle that reaches the left and right edges has already left
     * the canvas top and bottom without fading anything. Normalising each axis
     * by its own half-extent gives an ellipse the shape of the band. This runs
     * once per resize, never per frame.
     */
    function paintDots() {
      if (!dotsCtx) return;
      dots.width = Math.round(width * dpr);
      dots.height = Math.round(height * dpr);
      dotsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dotsCtx.clearRect(0, 0, width, height);
      dotsCtx.fillStyle = dotColour;
      const centreX = width / 2;
      const centreY = height / 2;
      for (let row = 0; row < rows; row++) {
        const y = row * step + cell / 2;
        const ny = (y - centreY) / centreY;
        for (let column = 0; column < columns; column++) {
          const x = column * step + cell / 2;
          const nx = (x - centreX) / centreX;
          const distance = Math.hypot(nx, ny);
          if (distance >= FADE_END) continue;
          const t = (distance - FADE_START) / (FADE_END - FADE_START);
          const eased = t <= 0 ? 0 : t * t * (3 - 2 * t);
          dotsCtx.globalAlpha = 1 - eased;
          dotsCtx.fillRect(column * step, row * step, cell, cell);
        }
      }
      dotsCtx.globalAlpha = 1;
    }

    /** Draw the word big, downsample to one pixel per cell, keep what is lit. */
    function rasterise() {
      const bannerWidth = Math.min(width * BANNER_WIDTH_RATIO, BANNER_MAX_WIDTH);
      const bannerHeight = Math.min(bannerWidth * BANNER_ASPECT, height);
      const firstColumn = Math.max(0, Math.floor((width - bannerWidth) / 2 / step));
      const firstRow = Math.max(0, Math.floor((height - bannerHeight) / 2 / step));
      const bannerColumns = Math.max(1, Math.ceil(bannerWidth / step));
      const bannerRows = Math.max(1, Math.ceil(bannerHeight / step));

      const type = document.createElement("canvas");
      type.width = Math.max(2, Math.round(bannerWidth));
      type.height = Math.max(2, Math.round(bannerHeight));
      const typeCtx = type.getContext("2d");
      if (!typeCtx) return;
      typeCtx.fillStyle = "rgb(0, 0, 0)";
      typeCtx.fillRect(0, 0, type.width, type.height);
      typeCtx.fillStyle = "rgb(255, 255, 255)";
      typeCtx.textAlign = "center";
      typeCtx.textBaseline = "middle";
      const face = (size: number) =>
        `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
      let size = type.height * 0.92;
      typeCtx.font = face(size);
      while (typeCtx.measureText(WORD).width > type.width * 0.96 && size > 4) {
        size -= 2;
        typeCtx.font = face(size);
      }
      typeCtx.fillText(WORD, type.width / 2, type.height / 2);

      const sample = document.createElement("canvas");
      sample.width = bannerColumns;
      sample.height = bannerRows;
      const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleCtx) return;
      sampleCtx.fillStyle = "rgb(0, 0, 0)";
      sampleCtx.fillRect(0, 0, bannerColumns, bannerRows);
      sampleCtx.drawImage(type, 0, 0, bannerColumns, bannerRows);
      const { data } = sampleCtx.getImageData(0, 0, bannerColumns, bannerRows);

      const cols: number[] = [];
      const rowsOut: number[] = [];
      const seeds: number[] = [];
      for (let row = 0; row < bannerRows; row++) {
        const gridRow = firstRow + row;
        if (gridRow >= rows) break;
        for (let column = 0; column < bannerColumns; column++) {
          const gridColumn = firstColumn + column;
          if (gridColumn >= columns) break;
          const i = (row * bannerColumns + column) * 4;
          const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
          if (luma <= LIT_THRESHOLD) continue;
          cols.push(gridColumn);
          rowsOut.push(gridRow);
          // Seeded by brightness, so the very first frame reads as a word rather
          // than as noise that happens to settle into one.
          seeds.push(Math.min(GLYPHS.length - 1, Math.floor(luma * GLYPHS.length)));
        }
      }

      litCount = cols.length;
      litCol = Int16Array.from(cols);
      litRow = Int16Array.from(rowsOut);
      glyphIndex = Uint8Array.from(seeds);
      offsetX = new Float32Array(litCount);
      offsetY = new Float32Array(litCount);
      velocityX = new Float32Array(litCount);
      velocityY = new Float32Array(litCount);
    }

    /* ── the force field and the loop ─────────────────────────────────────── */

    const pointer = { column: 0, row: 0, over: false };
    let roamMix = 1;
    let roamClock = 0;

    function applyField(centreColumn: number, centreRow: number, scale: number) {
      if (scale <= 0.01) return;
      for (let i = 0; i < litCount; i++) {
        const dx = litCol[i] + offsetX[i] - centreColumn;
        const dy = litRow[i] + offsetY[i] - centreRow;
        const squared = dx * dx + dy * dy;
        if (squared >= PUSH_RADIUS * PUSH_RADIUS || squared === 0) continue;
        const distance = Math.sqrt(squared);
        const weight = 1 - distance / PUSH_RADIUS;
        const force = weight * weight * PUSH_FORCE * scale;
        velocityX[i] += (dx / distance) * force;
        velocityY[i] += (dy / distance) * force;
        const turbulence = TURBULENCE * weight * scale;
        velocityX[i] += (Math.random() - 0.5) * turbulence;
        velocityY[i] += (Math.random() - 0.5) * turbulence;
      }
    }

    function integrate() {
      for (let i = 0; i < litCount; i++) {
        let vx = velocityX[i];
        let vy = velocityY[i];
        let x = offsetX[i];
        let y = offsetY[i];
        if (vx === 0 && vy === 0 && x === 0 && y === 0) continue;
        vx = (vx - x * SPRING) * DAMPING;
        vy = (vy - y * SPRING) * DAMPING;
        x += vx;
        y += vy;
        const travel = Math.hypot(x, y);
        if (travel > MAX_OFFSET) {
          const clamp = MAX_OFFSET / travel;
          x *= clamp;
          y *= clamp;
        }
        if (Math.abs(x) < REST_EPSILON && Math.abs(vx) < REST_EPSILON) {
          x = 0;
          vx = 0;
        }
        if (Math.abs(y) < REST_EPSILON && Math.abs(vy) < REST_EPSILON) {
          y = 0;
          vy = 0;
        }
        offsetX[i] = x;
        offsetY[i] = y;
        velocityX[i] = vx;
        velocityY[i] = vy;
      }
    }

    function render() {
      ctx!.clearRect(0, 0, width, height);
      if (dots.width > 0) ctx!.drawImage(dots, 0, 0, width, height);
      ctx!.font = `${glyphWeight} ${cell + 3}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      const half = cell / 2;
      let painted = -1;
      for (let i = 0; i < litCount; i++) {
        const x = offsetX[i];
        const y = offsetY[i];
        const displacement = Math.min(1, Math.hypot(x, y) / TINT_SPAN);
        const tint = Math.min(TINT_STEPS - 1, Math.round(displacement * (TINT_STEPS - 1)));
        if (tint !== painted) {
          ctx!.fillStyle = tints[tint];
          painted = tint;
        }
        ctx!.fillText(
          GLYPHS[glyphIndex[i]],
          (litCol[i] + Math.round(x)) * step + half,
          (litRow[i] + Math.round(y)) * step + half,
        );
      }
    }

    function rebuild() {
      readPalette();
      measure();
      paintDots();
      rasterise();
      render();
    }

    let frame = 0;
    let running = false;
    let lastFlicker = 0;

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (now - lastFlicker >= FLICKER_MS) {
        lastFlicker = now;
        for (let i = 0; i < litCount; i++) {
          glyphIndex[i] = (Math.pow(Math.random(), FLICKER_BIAS) * GLYPHS.length) | 0;
        }
      }
      roamClock += ROAM_SPEED;
      roamMix += ((pointer.over ? 0 : 1) - roamMix) * HANDOVER;
      if (roamMix > 0.01) {
        const roamX = width * (0.5 + 0.34 * Math.sin(roamClock));
        const roamY = height * (0.5 + 0.16 * Math.sin(roamClock * 1.7));
        applyField(roamX / step, roamY / step, ROAM_FORCE * roamMix);
      }
      applyField(pointer.column, pointer.row, 1 - roamMix);
      integrate();
      render();
    }

    function start() {
      if (running || motionQuery.matches) return;
      running = true;
      lastFlicker = 0;
      frame = requestAnimationFrame(tick);
    }

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
      frame = 0;
    }

    /* ── wiring ───────────────────────────────────────────────────────────── */

    rebuild();

    let onScreen = false;
    const sync = () => {
      if (onScreen && !document.hidden && !motionQuery.matches) start();
      else stop();
    };

    const visibility = new IntersectionObserver(
      (entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        sync();
      },
      { rootMargin: "120px" },
    );
    visibility.observe(stage);

    const resize = new ResizeObserver(() => rebuild());
    resize.observe(stage);

    // The theme is a class on <html>: next-themes writes it here, and the
    // signed-in groups' pre-paint script writes the same one. Watching the
    // attribute is what keeps the wordmark correct in both themes with no
    // re-render and no reload.
    const theme = new MutationObserver(() => {
      readPalette();
      paintDots();
      render();
    });
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onPointerMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      pointer.column = (event.clientX - rect.left) / step;
      pointer.row = (event.clientY - rect.top) / step;
      pointer.over = true;
    };
    const onPointerLeave = () => {
      pointer.over = false;
    };
    const onMotionChange = () => {
      if (!motionQuery.matches) {
        sync();
        return;
      }
      stop();
      offsetX.fill(0);
      offsetY.fill(0);
      velocityX.fill(0);
      velocityY.fill(0);
      rasterise();
      render();
    };

    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerleave", onPointerLeave);
    stage.addEventListener("pointercancel", onPointerLeave);
    document.addEventListener("visibilitychange", sync);
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      stop();
      visibility.disconnect();
      resize.disconnect();
      theme.disconnect();
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      stage.removeEventListener("pointercancel", onPointerLeave);
      document.removeEventListener("visibilitychange", sync);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      data-slot="ascii-wordmark"
      className="relative isolate h-[clamp(9rem,24vw,22rem)] w-full cursor-crosshair select-none overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" />

      {/* Without script the canvas never paints, so the band the ASCII grid
          replaced is still here: the same outlined wordmark, unchanged. */}
      <noscript>
        <div className="flex size-full items-center justify-center">
          <p className="select-none pb-[0.18em] text-[clamp(4rem,17vw,13rem)] font-semibold leading-none text-transparent opacity-60 [-webkit-text-stroke:1px_color-mix(in_oklch,var(--foreground)_45%,transparent)]">
            Injishi
          </p>
        </div>
      </noscript>
    </div>
  );
}
