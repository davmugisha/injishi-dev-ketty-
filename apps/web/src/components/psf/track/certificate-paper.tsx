"use client";

import { psfLevelColours, psfPaperPattern, type PsfTrackView } from "@injishi/contracts";
import { type CSSProperties, useEffect, useState } from "react";

import { QrCode } from "@/components/shared/qr-code";
import { psfLogoSrc, psfMemberPhotoSrc } from "@/data/psf";

import styles from "./certificate.module.css";

/** A date as the PDF prints it. */
function longDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" });
}

/**
 * The membership certificate on screen (2026-11-06): the same paper as the PDF from
 * `psf-certificate.renderer.ts`, with the same colours and member's pattern, from the shared
 * `psf-papers` contract. On a phone the panel sits above the paper.
 */
export function CertificatePaper({ view }: { view: PsfTrackView }) {
  const m = view.membership;
  // The QR opens the member's card; the origin is only known in the browser.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const levelCode = m?.family ?? view.request.family;
  const levelName = m?.familyName ?? view.request.familyName;
  const colours = psfLevelColours(levelCode);
  const number = m?.number ?? view.docId;
  const pattern = psfPaperPattern(number, 226, 595);
  const sector = [view.business.clusterName, view.business.subsectorName].filter(Boolean).join(" · ");
  const where = [view.business.code ? `Business code ${view.business.code}` : null, view.business.districtName].filter(Boolean).join("  ·  ");
  const level = m?.badge ? `${levelName}  ·  ${m.badge}` : levelName;

  return (
    <div
      className={`${styles.paper} overflow-hidden rounded-card border border-border shadow-sm`}
      style={{ "--ground": colours.ground, "--accent": colours.accent } as CSSProperties}
    >
      <div className={styles.sheet}>
        <div className={styles.panel}>
          <svg aria-hidden className={styles.pattern} viewBox="0 0 226 595" preserveAspectRatio="xMidYMid slice" strokeWidth={pattern.strokeWidth}>
            {pattern.paths.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          <div>
            {/* biome-ignore lint/performance/noImgElement: a fixed asset on a printed sheet */}
            <img src="/assets/partners/psf.png" alt="PSF" className={`${styles.logo} mx-auto`} />
            <p className={styles.federation}>Private Sector Federation</p>
            <p className={styles.country}>RWANDA</p>
          </div>
          {m?.hasPhoto ? (
            <div>
              {/* biome-ignore lint/performance/noImgElement: served by the API for this number; next/image would need it allow-listed for nothing */}
              <img src={psfMemberPhotoSrc(m.number)} alt={view.contact.name} className={`${styles.photo} mx-auto`} />
              <p className={styles.holder}>{view.contact.name}</p>
            </div>
          ) : (
            <p className={styles.holder}>{view.contact.name}</p>
          )}
          <div className={styles.verify}>
            {origin && m?.number ? (
              <QrCode value={`${origin}/psf/card?number=${encodeURIComponent(m.number)}`} size={88} light="white" ink="black" label={`Verify ${m.number}`} />
            ) : (
              <span className="size-22" />
            )}
            <p className={styles.scan}>SCAN TO VERIFY</p>
            {m?.number ? <p className={styles.number}>{m.number}</p> : null}
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.reference}>
            <p>Membership certificate</p>
            <p className="mt-1">docID {view.docId}</p>
          </div>

          <div className={styles.main}>
            <h2 className={`${styles.serif} ${styles.title}`}>Certificate of Membership</h2>
            <span aria-hidden className={styles.rule} />
            <p className={styles.certifies}>THIS CERTIFIES THAT</p>
            {/* The business and its sector are the biggest things on it (2026-11-05), as on the PDF. */}
            <p className={`${styles.serif} ${styles.business}`}>{view.business.name}</p>
            {sector ? <p className={styles.sector}>{sector}</p> : null}
            {where ? <p className={styles.where}>{where}</p> : null}
            <p className={styles.line}>is a member of the Private Sector Federation, at the level of</p>
            <p className={styles.level}>{level}</p>

            <dl className={styles.facts}>
              <Fact k="Membership number" v={m?.number ?? "—"} />
              <Fact k="Valid from" v={longDay(m?.startsOn)} />
              <Fact k="Valid until" v={longDay(m?.expiresOn)} />
            </dl>
            {view.stage === "lapsed" ? <p className={styles.lapsed}>This membership has ended. Renew it above to carry on.</p> : null}
          </div>

          <div className={styles.foot}>
            <div className={styles.issued}>
              <p className={styles.issuedOn}>{longDay(m?.startsOn)}</p>
              <span aria-hidden className={styles.issuedRule} />
              <p className={styles.issuedBy}>ISSUED BY</p>
              <p className={styles.office}>{view.reviewingOffice}</p>
            </div>
            {view.business.logoUrl ? (
              // biome-ignore lint/performance/noImgElement: served by the API for this docID
              <img src={psfLogoSrc(view.business.logoUrl)} alt={`${view.business.name} logo`} className={styles.mark} />
            ) : null}
          </div>
          <p className={styles.hub}>PSF Membership Hub · Powered by Hangaa Softwares</p>
        </div>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.fact}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
