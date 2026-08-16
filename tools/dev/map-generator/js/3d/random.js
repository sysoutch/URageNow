export function createRandom(seedInput) {
  let seed = Math.max(1, Math.floor(Number(seedInput) || 1)) >>> 0;
  return function random() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function noise2(random, x, z) {
  const a = Math.sin((x + 13.37) * 12.9898 + (z - 4.2) * 78.233) * 43758.5453;
  return (a - Math.floor(a) + random() * 0.38) % 1;
}
