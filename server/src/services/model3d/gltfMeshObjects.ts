import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Lists the mesh objects of a GLB/glTF file without starting Blender, so the Studio can
 * offer "combine only these objects". Names are the glTF node names, which is what
 * Blender's glTF importer uses as object names (combine_meshes.py also matches them
 * without Blender's ".001" suffix).
 */

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a; // "JSON"
const GLB_HEADER_BYTES = 12;
const GLB_CHUNK_HEADER_BYTES = 8;
const TRIANGLE_VERTEX_COUNT = 3;
const GLTF_MODE_TRIANGLES = 4;

export interface ModelMeshObject {
  name: string;
  triangles: number | null;
}

export interface ModelMeshObjectList {
  /** False for formats this reader cannot list (FBX, OBJ); the caller can still combine all. */
  supported: boolean;
  objects: ModelMeshObject[];
}

interface GltfJson {
  nodes?: Array<{ name?: string; mesh?: number }>;
  meshes?: Array<{ name?: string; primitives?: Array<{ indices?: number; mode?: number; attributes?: Record<string, number> }> }>;
  accessors?: Array<{ count?: number }>;
}

function readGlbJson(data: Buffer): GltfJson {
  if (data.length < GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES || data.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("Not a GLB file.");
  }
  const chunkLength = data.readUInt32LE(GLB_HEADER_BYTES);
  const chunkType = data.readUInt32LE(GLB_HEADER_BYTES + 4);
  if (chunkType !== GLB_JSON_CHUNK_TYPE) {
    throw new Error("GLB file does not start with a JSON chunk.");
  }
  const start = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES;
  return JSON.parse(data.subarray(start, start + chunkLength).toString("utf8")) as GltfJson;
}

function countTriangles(gltf: GltfJson, meshIndex: number): number | null {
  const mesh = gltf.meshes?.[meshIndex];
  if (!mesh?.primitives) {
    return null;
  }
  let total = 0;
  for (const primitive of mesh.primitives) {
    if (primitive.mode !== undefined && primitive.mode !== GLTF_MODE_TRIANGLES) {
      continue;
    }
    const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
    const count = accessorIndex === undefined ? undefined : gltf.accessors?.[accessorIndex]?.count;
    if (typeof count !== "number") {
      return null;
    }
    total += Math.floor(count / TRIANGLE_VERTEX_COUNT);
  }
  return total;
}

export async function listModelMeshObjects(modelPath: string): Promise<ModelMeshObjectList> {
  const extension = path.extname(modelPath).toLowerCase();
  if (extension !== ".glb" && extension !== ".gltf") {
    return { supported: false, objects: [] };
  }
  const data = await readFile(modelPath);
  const gltf = extension === ".glb" ? readGlbJson(data) : JSON.parse(data.toString("utf8")) as GltfJson;
  const objects: ModelMeshObject[] = [];
  const seen = new Set<string>();
  (gltf.nodes ?? []).forEach((node, index) => {
    if (typeof node.mesh !== "number") {
      return;
    }
    // Blender names unnamed nodes after their mesh; fall back to a stable index name.
    const name = (node.name || gltf.meshes?.[node.mesh]?.name || `Object_${index}`).trim();
    if (!name || seen.has(name)) {
      return;
    }
    seen.add(name);
    objects.push({ name, triangles: countTriangles(gltf, node.mesh) });
  });
  return { supported: true, objects };
}
