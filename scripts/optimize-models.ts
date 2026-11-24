/**
 * Optimizes the GLB models under public/3d for fast mobile loading.
 *
 * - Draco -> EXT_meshopt_compression (decodes synchronously from the bundled decoder,
 *   no CDN fetch for the Draco WASM decoder)
 * - Removes flat (constant) normal maps, which contribute nothing visually
 * - Re-encodes textures as WebP at most 1024px (models render far smaller than that)
 *
 * Meshes are intentionally not simplified: even a 0.01% error bound breaks the shading on the
 * sculpted SNS logo meshes (visible speckles on LinkedIn / X), so geometry stays lossless.
 *
 * - Applies per-model material overrides (e.g. the Velvett "V" is shaded as solid gold)
 *
 * Already optimized files (using EXT_meshopt_compression) are skipped, so the script is idempotent.
 *
 * Usage: bun scripts/optimize-models.ts [files...]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { Document, Texture } from "@gltf-transform/core";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const MODEL_ROOT = "public/3d";
const MAX_TEXTURE_SIZE = 1024;
const WEBP_QUALITY = 90;
const FLAT_STDEV_THRESHOLD = 0.5;

interface MaterialOverride {
  /** sRGB hex color; replaces the base color and metallic-roughness textures. */
  baseColor: string;
  metallic: number;
  roughness: number;
}

const MATERIAL_OVERRIDES: Record<string, MaterialOverride> = {
  // The scanned texture is near-white and fully metallic, which renders as dull grey without an env map.
  "public/3d/work/velvett.glb": { baseColor: "#F0AC2E", metallic: 0.25, roughness: 0.4 },
};

function srgbToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function hexToLinearRgba(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [value >> 16, (value >> 8) % 256, value % 256].map((channel) => srgbToLinear(channel / 255));
  return [r, g, b, 1];
}

function applyMaterialOverride(document: Document, override: MaterialOverride) {
  for (const material of document.getRoot().listMaterials()) {
    material
      .setBaseColorTexture(null)
      .setMetallicRoughnessTexture(null)
      .setBaseColorFactor(hexToLinearRgba(override.baseColor))
      .setMetallicFactor(override.metallic)
      .setRoughnessFactor(override.roughness);
  }
}

function listModels(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listModels(path);
    return entry.name.endsWith(".glb") ? [path] : [];
  });
}

async function isFlatTexture(texture: Texture): Promise<boolean> {
  const image = texture.getImage();
  if (!image) return false;
  const { channels } = await sharp(Buffer.from(image)).stats();
  return channels.every((channel) => channel.stdev < FLAT_STDEV_THRESHOLD);
}

async function removeFlatNormalMaps(document: Document) {
  for (const material of document.getRoot().listMaterials()) {
    const normalTexture = material.getNormalTexture();
    if (normalTexture && (await isFlatTexture(normalTexture))) {
      material.setNormalTexture(null);
    }
  }
}

function isOptimized(document: Document) {
  return document
    .getRoot()
    .listExtensionsUsed()
    .some((extension) => extension.extensionName === "EXT_meshopt_compression");
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "meshopt.decoder": MeshoptDecoder,
  "meshopt.encoder": MeshoptEncoder,
});

const targets = process.argv.length > 2 ? process.argv.slice(2) : listModels(MODEL_ROOT);

for (const path of targets) {
  const document = await io.read(path);
  if (isOptimized(document)) {
    console.log(`skip  ${path} (already optimized)`);
    continue;
  }

  const draco = document
    .getRoot()
    .listExtensionsUsed()
    .find((extension) => extension.extensionName === "KHR_draco_mesh_compression");
  draco?.dispose();

  await removeFlatNormalMaps(document);
  const override = MATERIAL_OVERRIDES[path];
  if (override) applyMaterialOverride(document, override);
  await document.transform(
    dedup(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      quality: WEBP_QUALITY,
      resize: [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE],
    }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );

  await io.write(path, document);
  console.log(`done  ${path}`);
}
