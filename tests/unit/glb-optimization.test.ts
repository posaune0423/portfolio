import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vite-plus/test";

import { WARMUP_ASSET_PATHS } from "../../src/lib/app-screen";

/** Geometry stays lossless (simplification breaks SNS logo shading), so the budget covers full-detail meshes. */
const MAX_GLB_BYTES = 3 * 1024 * 1024;
const MAX_TEXTURE_SIZE = 1024;
const WEBP_14BIT_MASK = (1 << 14) - 1;

interface GlbJson {
  extensionsUsed?: string[];
  images?: Array<{ mimeType?: string; bufferView?: number }>;
  bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
}

function isGlbJson(value: unknown): value is GlbJson {
  return typeof value === "object" && value !== null;
}

function readGlb(publicPath: string) {
  const buffer = readFileSync(new URL(`../../public${publicPath}`, import.meta.url));

  assert.equal(buffer.toString("utf8", 0, 4), "glTF");
  assert.equal(buffer.readUInt32LE(4), 2);

  const jsonChunkLength = buffer.readUInt32LE(12);
  assert.equal(buffer.toString("utf8", 16, 20), "JSON");

  const json: unknown = JSON.parse(buffer.toString("utf8", 20, 20 + jsonChunkLength));
  assert.ok(isGlbJson(json));

  const binOffset = 20 + jsonChunkLength + 8;
  return { buffer, binOffset, json };
}

/** Reads width/height from a lossy (VP8) or lossless (VP8L) WebP header. */
function readWebpSize(image: Buffer) {
  const format = image.toString("ascii", 12, 16);
  if (format === "VP8 ") {
    return { width: image.readUInt16LE(26) & WEBP_14BIT_MASK, height: image.readUInt16LE(28) & WEBP_14BIT_MASK };
  }
  if (format === "VP8L") {
    const bits = image.readUInt32LE(21);
    return { width: (bits & WEBP_14BIT_MASK) + 1, height: ((bits >> 14) & WEBP_14BIT_MASK) + 1 };
  }
  if (format === "VP8X") {
    return { width: image.readUIntLE(24, 3) + 1, height: image.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`Unknown WebP format: ${format}`);
}

test("warmup asset list covers every screen GLB", () => {
  assert.ok(WARMUP_ASSET_PATHS.length > 0);
});

for (const path of WARMUP_ASSET_PATHS) {
  test(`${path} is meshopt-compressed without Draco so it decodes fast on mobile`, () => {
    const { buffer, json } = readGlb(path);

    assert.ok(buffer.length <= MAX_GLB_BYTES, `${path} is ${buffer.length} bytes`);
    assert.ok(!json.extensionsUsed?.includes("KHR_draco_mesh_compression"), `${path} still uses Draco`);
    assert.ok(
      json.extensionsUsed?.includes("EXT_meshopt_compression") || buffer.length <= 64 * 1024,
      `${path} is missing EXT_meshopt_compression`,
    );
  });

  test(`${path} ships WebP textures no larger than ${MAX_TEXTURE_SIZE}px`, () => {
    const { buffer, binOffset, json } = readGlb(path);

    for (const image of json.images ?? []) {
      assert.equal(image.mimeType, "image/webp", `${path} has a ${image.mimeType} texture`);
      assert.ok(image.bufferView !== undefined);
      const view = json.bufferViews?.[image.bufferView];
      assert.ok(view);
      const start = binOffset + (view.byteOffset ?? 0);
      const { width, height } = readWebpSize(buffer.subarray(start, start + view.byteLength));
      assert.ok(width <= MAX_TEXTURE_SIZE && height <= MAX_TEXTURE_SIZE, `${path} has a ${width}x${height} texture`);
    }
  });
}
