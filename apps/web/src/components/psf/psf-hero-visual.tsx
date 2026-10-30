"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./psf-hero.module.css";

/**
 * The right half of the PSF hero (2026-10-20): a photograph of Kigali cut to a
 * soft shape that slowly changes, a green tint drifting behind it, a dashed
 * ring turning with a small dot travelling round it, PSF's leaves floating,
 * and a little parallax under the pointer.
 *
 * A client component for two things only: the parallax, and the shape's
 * morph, which is SMIL and so cannot be stopped from CSS. Both start after
 * mount and only when the visitor has not asked for less motion; until then
 * the picture is the still one.
 */

/** Three outlines of the shape, with the same commands so one can morph into the next. */
const BLOB_A =
  "M408 118c45 53 58 132 33 199-25 66-89 118-160 136-72 18-151 3-201-45-50-49-71-130-49-197 22-66 86-117 155-133 69-15 177-13 222 40z";
const BLOB_B =
  "M418 128c40 58 50 128 25 192-26 70-95 122-166 138-70 16-148-2-196-50-48-50-66-128-44-192 24-70 92-118 160-130 72-13 180-16 221 42z";
const BLOB_C =
  "M400 112c48 50 62 136 36 202-24 62-84 116-154 134-74 20-154 6-204-42-52-48-74-132-50-198 20-62 82-112 150-130 70-17 176-10 222 34z";

const MORPH = `${BLOB_A};${BLOB_B};${BLOB_C};${BLOB_A}`;

export function PsfHeroVisual({ photo, alt }: { photo: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMoving(!quiet.matches);
    const onChange = () => setMoving(!quiet.matches);
    quiet.addEventListener("change", onChange);
    return () => quiet.removeEventListener("change", onChange);
  }, []);

  // The pointer, as -1..1 across the picture, read by each layer at its own depth.
  useEffect(() => {
    const el = box.current;
    if (!el || !moving || !window.matchMedia("(pointer: fine)").matches) return;
    const section = el.closest("section") ?? el;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 1;
        const y = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 1;
        el.style.setProperty("--mx", Math.max(-1, Math.min(1, x)).toFixed(3));
        el.style.setProperty("--my", Math.max(-1, Math.min(1, y)).toFixed(3));
      });
    };
    const onLeave = () => {
      el.style.setProperty("--mx", "0");
      el.style.setProperty("--my", "0");
    };
    section.addEventListener("pointermove", onMove as EventListener);
    section.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      section.removeEventListener("pointermove", onMove as EventListener);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, [moving]);

  const depth = (d: number) => ({ "--depth": d }) as React.CSSProperties;

  return (
    <div ref={box} className={`relative mx-auto aspect-square w-full max-w-narrow lg:max-w-none ${styles.arrive}`}>
      <svg viewBox="0 0 500 500" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={alt}>
        <defs>
          <clipPath id="psf-hero-blob">
            <path d={BLOB_A}>
              {moving ? <animate attributeName="d" values={MORPH} dur="18s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" /> : null}
            </path>
          </clipPath>
        </defs>

        {/* The ring, furthest back. */}
        <g className={styles.layer} style={depth(-6)}>
          <circle cx="250" cy="250" r="238" fill="none" className={`stroke-(--psf-orange)/50 ${styles.ring}`} strokeWidth="1.5" strokeDasharray="4 8" />
        </g>

        {/* The tint, a step behind the photograph, out of phase with it. */}
        <g className={styles.layer} style={depth(-10)}>
          <path d={BLOB_B} transform="translate(18 16)" className={`fill-(--psf-orange)/25 ${styles.tint}`}>
            {moving ? <animate attributeName="d" values={`${BLOB_B};${BLOB_C};${BLOB_A};${BLOB_B}`} dur="18s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" /> : null}
          </path>
        </g>

        {/* The photograph, cut to the shape, panning slowly inside it. */}
        <g className={styles.layer} style={depth(8)}>
          <g clipPath="url(#psf-hero-blob)">
            <image href={photo} x="10" y="60" width="480" height="400" preserveAspectRatio="xMidYMid slice" className={styles.photo} />
          </g>
        </g>

        {/* A small dot travelling the ring. */}
        <g className={styles.layer} style={depth(-6)}>
          <Traveller moving={moving} />
        </g>
      </svg>

      {/* PSF's leaves, each floating at its own pace, nearest of all. */}
      <Leaf className="left-[4%] top-[12%] size-9" rotate={-30} delay="0s" dur="5.5s" depth={22} />
      <Leaf className="right-[10%] top-[4%] size-7" rotate={25} delay="1.2s" dur="6.5s" depth={30} />
      <Leaf className="bottom-[8%] right-[18%] size-6" rotate={60} delay="0.6s" dur="7s" depth={26} />
      <Leaf className="bottom-[26%] left-[0%] size-5" rotate={-70} delay="2s" dur="6s" depth={34} />
    </div>
  );
}

/** The ring as a path, starting at its top and going clockwise, for the traveller to follow. */
const ORBIT = "M250 12 a238 238 0 1 1 0 476 a238 238 0 1 1 0 -476";
const LAP = "40s";

/** A small orange dot going round the ring once every `LAP`. Still, it waits on the ring's upper right. */
function Traveller({ moving }: { moving: boolean }) {
  if (!moving) return <circle cx="418" cy="82" r="5" className="fill-(--psf-orange)" />;
  return (
    <circle r="5" className="fill-(--psf-orange)">
      <animateMotion dur={LAP} repeatCount="indefinite" path={ORBIT} begin="-6s" calcMode="linear" />
    </circle>
  );
}

/** One of PSF's leaves, as on its logo: placed, tilted, floating, and following the pointer. */
function Leaf({ className, rotate, delay, dur, depth }: { className: string; rotate: number; delay: string; dur: string; depth: number }) {
  return (
    <span aria-hidden className={`absolute ${styles.layer} ${className}`} style={{ "--depth": depth } as React.CSSProperties}>
      <span className={`block size-full ${styles.float}`} style={{ "--delay": delay, "--dur": dur } as React.CSSProperties}>
        <svg viewBox="0 0 40 40" className="size-full" style={{ transform: `rotate(${rotate}deg)` }}>
          <path d="M20 3 C 33 10, 35 26, 20 37 C 5 26, 7 10, 20 3 Z" className="fill-accent-brand" />
          <path d="M20 9 L 20 33" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </svg>
      </span>
    </span>
  );
}
