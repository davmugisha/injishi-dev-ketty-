/**
 * Which platforms an over the air update may go to (mobile spec 0001, D-ad, AC-10). Pure, so
 * publish-update.test.mjs can hold it; publish-update.mjs gathers the facts from EAS and asks this.
 *
 * Each platform is judged on its own, by two proofs in this order:
 *
 *   1. a finished build on the target channel has the runtime version this update would get there;
 *   2. for production only, the newest update on branch `preview` for that platform was built from
 *      this commit. A rollback, or anything newer, on preview means no: what testers run there is
 *      no longer this commit.
 *
 * Every failing reason is kept, so the script can print them all.
 */

export const PLATFORMS = ["android", "ios"];

/**
 * @typedef {{ group: string, gitCommitHash?: string, isRollBackToEmbedded?: boolean }} PreviewUpdate
 * @typedef {{
 *   platform: string,
 *   runtimeVersion: string,
 *   hasBuild: boolean,
 *   newestPreview?: PreviewUpdate | null,
 * }} PlatformFacts
 *
 * @param {{ to: "preview" | "production", head: string, platforms: PlatformFacts[] }} input
 * @returns {{
 *   kept: { platform: string, runtimeVersion: string }[],
 *   skipped: { platform: string, runtimeVersion: string, reasons: string[] }[],
 *   publishPlatform: string | null,
 * }} `publishPlatform` is what `eas update --platform` takes: `all`, one platform, or null for none.
 */
export function judgePlatforms({ to, head, platforms }) {
  const kept = [];
  const skipped = [];
  for (const { platform, runtimeVersion, hasBuild, newestPreview } of platforms) {
    const reasons = [];
    if (!hasBuild) {
      reasons.push(
        `no finished ${to} build has runtime ${runtimeVersion}; a native change needs a new ${platform} build first`,
      );
    }
    if (to === "production") {
      const proof = previewProof(platform, head, newestPreview);
      if (proof) reasons.push(proof);
    }
    if (reasons.length > 0) skipped.push({ platform, runtimeVersion, reasons });
    else kept.push({ platform, runtimeVersion });
  }
  let publishPlatform = null;
  if (kept.length === platforms.length && kept.length > 1) publishPlatform = "all";
  else if (kept.length === 1) publishPlatform = kept[0].platform;
  return { kept, skipped, publishPlatform };
}

/** Why the newest preview update is not proof this commit ran on preview, or null when it is. */
function previewProof(platform, head, newest) {
  if (!newest) {
    return `branch preview has no ${platform} update; publish this commit with --to preview first and try it there`;
  }
  if (newest.isRollBackToEmbedded) {
    return `the newest ${platform} update on preview (${newest.group}) rolls back to the build's own code, so this commit is not what preview runs`;
  }
  if (newest.gitCommitHash !== head) {
    const from = newest.gitCommitHash ? newest.gitCommitHash.slice(0, 8) : "an unknown commit";
    return `the newest ${platform} update on preview (${newest.group}) was built from ${from}, not this commit; publish this commit with --to preview first`;
  }
  return null;
}
