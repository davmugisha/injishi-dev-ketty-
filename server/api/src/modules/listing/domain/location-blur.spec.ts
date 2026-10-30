import { describe, expect, it } from 'vitest';

import { LOCATION_CIRCLE_METRES, blurLocation } from './location-blur';

/** Metres between two points, by the haversine formula. */
function metresBetween(a: [number, number], b: [number, number]): number {
  const r = 6_371_000;
  const rad = (d: number): number => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

describe('blurLocation (mobile spec 0005, D-o, AC-24)', () => {
  it('leaves a property without privacy where it is', () => {
    expect(blurLocation(-1.6789, 29.2567, false)).toEqual({ latitude: -1.6789, longitude: 29.2567, approximate: false });
  });

  it('moves a flagged property to the centre of its 0.01 degree cell', () => {
    expect(blurLocation(-1.6789, 29.2567, true)).toEqual({ latitude: -1.675, longitude: 29.255, approximate: true });
  });

  it('is stable: the same property always answers the same centre', () => {
    const first = blurLocation(-1.94412, 30.06194, true);
    for (let i = 0; i < 5; i += 1) expect(blurLocation(-1.94412, 30.06194, true)).toEqual(first);
  });

  it('puts a point on a cell edge in its own cell', () => {
    expect(blurLocation(-1.95, 30.06, true)).toEqual({ latitude: -1.945, longitude: 30.065, approximate: true });
    expect(blurLocation(1.95, -30.06, true)).toEqual({ latitude: 1.955, longitude: -30.055, approximate: true });
  });

  it('keeps the true point inside the 800 m circle, across Rwanda', () => {
    let worst = 0;
    for (let lat = -2.84; lat <= -1.05; lat += 0.0037) {
      for (let lng = 28.86; lng <= 30.9; lng += 0.0041) {
        const blurred = blurLocation(lat, lng, true);
        const d = metresBetween([lat, lng], [blurred.latitude!, blurred.longitude!]);
        worst = Math.max(worst, d);
      }
    }
    expect(worst).toBeLessThan(LOCATION_CIRCLE_METRES);
    expect(worst).toBeGreaterThan(600);
  });

  it('never invents a point for a property with no coordinates', () => {
    expect(blurLocation(null, 29.2, true)).toEqual({ latitude: null, longitude: null, approximate: false });
    expect(blurLocation(-1.6, null, false)).toEqual({ latitude: null, longitude: null, approximate: false });
  });
});
