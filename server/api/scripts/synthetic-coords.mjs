// Dev-only map coordinates for demo properties. The real ones were dropped when
// the businesses were renamed to fictional ones (see seed-demo-catalogue.mjs
// header). These are approximate centroids of the districts the demo touches —
// public geography, not tied to any business — with per-property jitter so pins
// do not stack on top of each other in the Explore map. NOT a real address; the
// production catalogue carries its own coordinates.

const SYNTHETIC_DISTRICT_CENTROID = {
  gasabo: [-1.9375, 30.1075],
  nyarugenge: [-1.9536, 30.0605],
  kicukiro: [-1.9738, 30.1030],
  musanze: [-1.4989, 29.6349],
  rubavu: [-1.6810, 29.2624],
  rusizi: [-2.4899, 28.9075],
  karongi: [-2.0567, 29.3833],
  nyagatare: [-1.2925, 30.3273],
  kayonza: [-1.8836, 30.6152],
  huye: [-2.5924, 29.7378],
};

/** Deterministic jitter in [-0.02, +0.02] degrees from a seed string. */
function jitterFromSeed(seed, salt) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ salt, 16777619);
  const unit = ((h >>> 0) % 20000) / 10000 - 1;
  return unit * 0.02;
}

/**
 * A synthetic [lat, lng] for a demo property, or [null, null] when the
 * district has no centroid entry. `seed` is a stable string per property
 * (slug, id) so re-runs produce the same jitter.
 */
export function syntheticCoordFor({ district, seed }) {
  if (district == null || seed == null) return [null, null];
  const centroid = SYNTHETIC_DISTRICT_CENTROID[String(district).toLowerCase()];
  if (!centroid) return [null, null];
  return [
    String(centroid[0] + jitterFromSeed(String(seed), 1)),
    String(centroid[1] + jitterFromSeed(String(seed), 2)),
  ];
}
