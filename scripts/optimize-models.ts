/**
 * Optimizes the GLB models under public/3d for fast mobile loading.
 *
 * - Draco -> EXT_meshopt_compression (decodes synchronously from the bundled decoder,
 *   no CDN fetch for the Draco WASM decoder)
 * - Removes flat (constant) normal maps, which contribute nothing visually
 * - Simplifies meshes within a visually lossless error bound
 * - Re-encodes textures as WebP at most 1024px (models render far smaller than that)
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
import { dedup, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const MODEL_ROOT = "public/3d";
const MAX_TEXTURE_SIZE = 1024;
const WEBP_QUALITY = 90;
/** Simplification error relative to mesh extent (0.01%), below one pixel at any render size used. */
const SIMPLIFY_ERROR = 0.0001;
const FLAT_STDEV_THRESHOLD = 0.5;

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

await MeshoptSimplifier.ready;

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
  await document.transform(
    dedup(),
    prune(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: SIMPLIFY_ERROR }),
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
