/**
 * The POS reads its four boards from its own table (`features/pos/pos-boards.ts`) rather than the screen
 * registry, which is demo data under ADR-074. Until the registry retires, the two describe the same boards,
 * so a path or a title changed in one and not the other fails here.
 *
 *   pnpm --filter @injishi/app exec tsx --test tests/pos-boards.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BOARDS, screens } from "@injishi/data";
import { POS_BOARDS, type PosBoard } from "../src/features/pos/pos-boards";

test("every POS board is a board the registry knows, with the same path and title", () => {
  for (const board of Object.keys(POS_BOARDS) as PosBoard[]) {
    assert.ok((BOARDS as readonly string[]).includes(board), `${board} is not in the screen registry`);
    assert.equal(POS_BOARDS[board].href, screens[board].href, `${board}: path`);
    assert.equal(POS_BOARDS[board].pageTitle, screens[board].pageTitle, `${board}: page title`);
  }
});
