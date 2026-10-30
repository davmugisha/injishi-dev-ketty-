import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitView, project, RWANDA_BOUNDS, tilesFor, unproject } from "../src/map.ts";

describe("map arithmetic", () => {
  it("projects and unprojects a place back to itself", () => {
    const kigali = { lat: -1.9441, lng: 30.0619 };
    const back = unproject(project(kigali, 12), 12);
    assert.ok(Math.abs(back.lat - kigali.lat) < 1e-6);
    assert.ok(Math.abs(back.lng - kigali.lng) < 1e-6);
  });

  it("puts the equator and the meridian in the middle of the world", () => {
    assert.deepEqual(project({ lat: 0, lng: 0 }, 0), { x: 128, y: 128 });
  });

  it("covers a box with whole tiles, none outside the world", () => {
    const tiles = tilesFor({ lat: -1.9441, lng: 30.0619 }, 10, { width: 600, height: 400 });
    assert.ok(tiles.length >= 6 && tiles.length <= 12);
    for (const t of tiles) assert.ok(t.y >= 0 && t.y < 1024 && t.wrappedX >= 0 && t.wrappedX < 1024);
  });

  it("fits all of Rwanda at a country zoom, and one street closer", () => {
    const country = fitView(RWANDA_BOUNDS, { width: 640, height: 480 }, { min: 6, max: 14, padding: 48 });
    assert.ok(country.zoom >= 7 && country.zoom <= 9);
    const street = fitView([{ lat: -1.94, lng: 30.06 }], { width: 640, height: 480 }, { min: 6, max: 14, padding: 48 });
    assert.equal(street.zoom, 14);
  });
});
