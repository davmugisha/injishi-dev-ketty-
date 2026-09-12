import type { Rating } from "@/data/properties";

/**
 * The word that goes beside a score.
 *
 * A bare "9.0/10" asks the reader to hold a scale in their head. The word does
 * that work for them, which is why every booking site prints one, and it costs
 * no new data: the band is derived from the score the property already
 * publishes, never stored alongside it.
 *
 * The band edges are a judgment call, recorded in ADR-022 rather than left
 * implicit here. They follow the convention the sourced scores come from
 * (Trip.com and its peers all cut at 9.0 / 8.5 / 8.0 / 7.0), so a guest who
 * has seen the score elsewhere reads the same word here.
 *
 * `outOf` is normalised rather than assumed to be 10. Every fixture is out of
 * ten today; a five-star source arriving later would otherwise land every
 * property in the bottom band without a single type error to warn us.
 */
export function ratingLabel(rating: Rating): string {
  const outOfTen = (rating.score / rating.outOf) * 10;

  if (outOfTen >= 9) return "Exceptional";
  if (outOfTen >= 8.5) return "Excellent";
  if (outOfTen >= 8) return "Very good";
  if (outOfTen >= 7) return "Good";
  return "Pleasant";
}
