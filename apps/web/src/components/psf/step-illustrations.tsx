/**
 * The four steps of joining PSF, drawn (2026-10-20): simple line pictures in
 * the brand green, one per step on the PSF page, so the steps read at a glance
 * instead of in sentences. Inline SVG so they take the theme's colours through
 * `currentColor` and need no file.
 */

const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** One form: a clipboard, three filled lines, a tick. */
export function FormIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden>
      <rect x="38" y="12" width="44" height="66" rx="5" {...LINE} />
      <rect x="50" y="7" width="20" height="10" rx="3" {...LINE} className="fill-card" />
      <path d="M47 32h18M47 44h26M47 56h14" {...LINE} opacity={0.55} />
      <circle cx="78" cy="66" r="11" className="fill-accent-brand" />
      <path d="M73 66l3.5 3.5L83 63" {...LINE} stroke="white" strokeWidth={2.4} />
    </svg>
  );
}

/** Pay once: a phone, a payment bubble, and the docID coming back. */
export function PayIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden>
      <rect x="40" y="10" width="32" height="70" rx="6" {...LINE} />
      <path d="M52 16h8" {...LINE} />
      <rect x="46" y="28" width="20" height="12" rx="3" className="fill-accent-brand/20" stroke="none" />
      <path d="M49 34h14" {...LINE} strokeWidth={1.6} />
      <path d="M46 50h20M46 57h13" {...LINE} opacity={0.55} strokeWidth={1.6} />
      <rect x="66" y="20" width="40" height="18" rx="5" className="fill-card" {...LINE} />
      <text x="86" y="32" textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fontWeight="700" fill="currentColor">
        PSF-···
      </text>
      <path d="M70 38l-4 6 9-6" {...LINE} className="fill-card" />
      <circle cx="30" cy="62" r="9" {...LINE} />
      <path d="M30 57v10M27 59.5c0-1.5 6-1.5 6 0s-6 2-6 3.5 6 1.5 6 0" {...LINE} strokeWidth={1.4} />
    </svg>
  );
}

/** PSF reviews: a document under a magnifier, an officer's check. */
export function ReviewIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden>
      <rect x="28" y="14" width="44" height="58" rx="4" {...LINE} />
      <path d="M36 28h28M36 38h22M36 48h26" {...LINE} opacity={0.55} />
      <circle cx="74" cy="54" r="15" className="fill-card" {...LINE} />
      <path d="M85 65l12 12" {...LINE} strokeWidth={3} />
      <path d="M68 54l4 4 8-8" {...LINE} className="text-accent-brand" stroke="currentColor" />
    </svg>
  );
}

/** Join: the certificate, with its seal. */
export function CertificateIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden>
      <rect x="18" y="16" width="84" height="56" rx="4" {...LINE} />
      <rect x="23" y="21" width="74" height="46" rx="2" {...LINE} strokeWidth={1} opacity={0.5} />
      <path d="M42 34h36" {...LINE} strokeWidth={3} />
      <path d="M46 44h28M50 52h20" {...LINE} opacity={0.55} />
      <circle cx="88" cy="66" r="10" className="fill-accent-brand" />
      <path d="M83 74l-3 10 8-4 8 4-3-10" className="fill-accent-brand" stroke="none" />
      <path d="M84 66l3 3 6-6" {...LINE} stroke="white" strokeWidth={2.2} />
    </svg>
  );
}
