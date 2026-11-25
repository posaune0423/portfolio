import assert from "node:assert/strict";

import { test } from "vite-plus/test";

import { WORK_ITEMS } from "../../src/constants/work";
import { SCREEN_ASSETS } from "../../src/lib/app-screen";

const startYear = (period: string | undefined) => Number(period?.match(/\d{4}/)?.[0]);

test("work items are listed newest first by start year", () => {
  const years = WORK_ITEMS.map((item) => startYear(item.period));
  assert.deepEqual(
    years,
    years.toSorted((a, b) => b - a),
  );
  assert.equal(WORK_ITEMS[0]?.id, "luster");
});

test("work screen assets follow the work item order", () => {
  assert.deepEqual(
    SCREEN_ASSETS.memoryWork.filter((path) => path.startsWith("/3d/work/")),
    WORK_ITEMS.map((item) => item.modelPath),
  );
});
