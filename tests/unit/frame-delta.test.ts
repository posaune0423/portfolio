import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vite-plus/test";

import { clampFrameDelta, MAX_FRAME_DELTA } from "../../src/lib/frame-delta";

const itemGridSource = readFileSync(new URL("../../src/components/shared/item-grid.tsx", import.meta.url), "utf8");

test("clampFrameDelta passes normal frame deltas through", () => {
  assert.equal(clampFrameDelta(1 / 60), 1 / 60);
});

test("clampFrameDelta caps long frames so animations never skip ahead", () => {
  assert.equal(clampFrameDelta(0.17), MAX_FRAME_DELTA);
  assert.ok(MAX_FRAME_DELTA <= 1 / 30);
});

test("item grid selection animations advance with the clamped delta", () => {
  assert.match(itemGridSource, /const step = clampFrameDelta\(delta\);/);
  assert.doesNotMatch(itemGridSource, /\.current \+= delta;/);
});
