import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vite-plus/test";

const itemGridSource = readFileSync(new URL("../../src/components/shared/item-grid.tsx", import.meta.url), "utf8");

test("left header title is anchored to the left gutter", () => {
  assert.match(itemGridSource, /const GRID_HEADER_LEFT = "clamp\(20px, 5vw, 52px\)";/);
  assert.match(
    itemGridSource,
    /fontSize:\s*compact \? "clamp\(12px,\s*3\.3vw,\s*24px\)" : "clamp\(20px,\s*2\.2vw,\s*32px\)"/,
  );
});

test("right header label is right-aligned on a single line", () => {
  assert.match(itemGridSource, /const GRID_HEADER_RIGHT = "clamp\(20px, 8vw, 104px\)";/);
  assert.match(
    itemGridSource,
    /fontSize:\s*compact \? "clamp\(13px,\s*3\.4vw,\s*24px\)" : "clamp\(20px,\s*2\.4vw,\s*34px\)"/,
  );
  assert.match(itemGridSource, /textAlign:\s*"right"/);
  assert.match(itemGridSource, /whiteSpace:\s*"nowrap"/);
});

test("grid header lays both titles out in one vertically centered row so they never overlap", () => {
  assert.match(itemGridSource, /function getGridHeaderStyle\(compact: boolean\): React\.CSSProperties \{/);
  assert.match(itemGridSource, /display: "flex",\s*alignItems: "center",\s*justifyContent: "space-between",/);
  assert.match(
    itemGridSource,
    /style=\{\{ \.\.\.getGridHeaderStyle\(compact\), display: showGrid \? "flex" : "none" \}\}/,
  );
  assert.match(itemGridSource, /minWidth: 0,\s*overflow: "hidden",\s*textOverflow: "ellipsis",/);
  assert.doesNotMatch(itemGridSource, /top: "clamp\(12px, 3vh, 32px\)"/);
});

test("ps2 text stretch is applied to the whole header row so layout matches the painted width", () => {
  assert.match(itemGridSource, /const PS2_TEXT_SCALE_X = 1\.18;/);
  assert.match(
    itemGridSource,
    /width: `calc\(\(100% - \$\{GRID_HEADER_LEFT\} - \$\{right\}\) \/ \$\{PS2_TEXT_SCALE_X\}\)`,/,
  );
  assert.match(itemGridSource, /transform: `scaleX\(\$\{PS2_TEXT_SCALE_X\}\)`,/);
  assert.match(itemGridSource, /const UNSCALED_TEXT_STYLE: React\.CSSProperties = \{ transform: "none" \};/);
});
