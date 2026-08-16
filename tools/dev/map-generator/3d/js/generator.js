import { createRandom, noise2 } from "./random.js";

function makeTile(x, z, height, kind) {
  return { x, z, y: 0, height, kind };
}

function cloneTile(tile, x, z) {
  return { ...tile, x, z };
}

function carveTopdownPath(map, config) {
  const centerX = Math.floor(config.width / 2);
  const centerZ = Math.floor(config.depth / 2);
  const radius = Math.max(1, Math.floor(config.pathWidth / 2));
  for (let z = 0; z < config.depth; z++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      if (map[z] && map[z][x]) {
        map[z][x].kind = "path";
        map[z][x].height = Math.max(0.08, map[z][x].height * 0.25);
      }
    }
  }
  for (let x = 0; x < config.width; x++) {
    for (let z = centerZ - radius; z <= centerZ + radius; z++) {
      if (map[z] && map[z][x]) {
        map[z][x].kind = "path";
        map[z][x].height = Math.max(0.08, map[z][x].height * 0.25);
      }
    }
  }
}

export function generateTopdown(config) {
  const random = createRandom(config.seed);
  const map = [];
  for (let z = 0; z < config.depth; z++) {
    const row = [];
    for (let x = 0; x < config.width; x++) {
      const edge = x === 0 || z === 0 || x === config.width - 1 || z === config.depth - 1;
      const fill = edge || noise2(random, x, z) < config.density / 100;
      const h = fill ? 0.35 + Math.floor(random() * config.height) * 0.32 : 0.04;
      row.push(makeTile(x, z, h, fill ? "block" : "ground"));
    }
    map.push(row);
  }
  carveTopdownPath(map, config);
  return map;
}

export function generateSidescroller(config) {
  const random = createRandom(config.seed);
  const map = [];
  const density = Math.max(0, Math.min(100, config.density || 0));
  const roughness = Math.max(1, Math.round(config.height || 1));
  const platformEvery = Math.max(2, Math.round(config.gap || 3));
  const platformBaseWidth = Math.max(1, Math.round(config.pathWidth || 3));
  let surface = Math.floor(config.depth * (0.66 - density * 0.0022));

  for (let z = 0; z < config.depth; z++) {
    map[z] = [];
  }

  for (let x = 0; x < config.width; x++) {
    const stepChance = 0.22 + roughness * 0.045;
    if (random() < stepChance) {
      surface += Math.floor(random() * 3) - 1;
    }
    surface = Math.max(2, Math.min(config.depth - 2, surface));
    const caveChance = Math.max(0, (70 - density) / 260);

    for (let z = 0; z < config.depth; z++) {
      const belowSurface = z >= surface;
      const smallCave = belowSurface && z > surface + 1 && random() < caveChance;
      const solid = belowSurface && !smallCave;
      map[z][x] = makeTile(x, z, solid ? 1 : 0.03, solid ? "block" : "empty");
    }
  }

  const platformCount = Math.max(1, Math.floor(config.width / platformEvery));
  for (let i = 0; i < platformCount; i++) {
    const width = platformBaseWidth + Math.floor(random() * Math.max(1, platformBaseWidth + 2));
    const start = Math.floor(random() * Math.max(1, config.width - width));
    const row = 2 + Math.floor(random() * Math.max(1, config.depth * 0.46));
    for (let x = start; x < start + width; x++) {
      map[row][x] = makeTile(x, row, 1, "path");
    }
  }

  return map;
}

function mirrorsX(config) {
  return config.mirrorPattern === "x" || config.mirrorPattern === "xy";
}

function mirrorsY(config) {
  return config.mirrorPattern === "y" || config.mirrorPattern === "xy";
}

function mirrorMap(map, config) {
  const sourceRows = map.length;
  const sourceCols = Math.max(...map.map(row => row.length));
  const repeatX = mirrorsX(config) ? Math.max(0, config.mirrorRepeatX || 0) : 0;
  const repeatY = mirrorsY(config) ? Math.max(0, config.mirrorRepeatY || 0) : 0;
  const out = [];
  for (let blockY = 0; blockY <= repeatY; blockY++) {
    for (let z = 0; z < sourceRows; z++) {
      const sourceZ = mirrorsY(config) && blockY % 2 === 1 ? sourceRows - 1 - z : z;
      const outZ = blockY * sourceRows + z;
      if (!out[outZ]) {
        out[outZ] = [];
      }
      for (let blockX = 0; blockX <= repeatX; blockX++) {
        for (let x = 0; x < sourceCols; x++) {
          const sourceX = mirrorsX(config) && blockX % 2 === 1 ? sourceCols - 1 - x : x;
          const sourceTile = map[sourceZ] && map[sourceZ][sourceX];
          if (!sourceTile) {
            continue;
          }
          const outX = blockX * sourceCols + x;
          out[outZ][outX] = cloneTile(sourceTile, outX, outZ);
        }
      }
    }
  }
  return out;
}

export function generateMap(config) {
  const map = config.mode === "sidescroller" ? generateSidescroller(config) : generateTopdown(config);
  return config.mirrorPattern === "none" ? map : mirrorMap(map, config);
}
