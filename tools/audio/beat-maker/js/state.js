// =========================================================
// STATE HELPERS & UTILITIES
// =========================================================

const clone = (v) => JSON.parse(JSON.stringify(v));

// Auto Random configuration state
const autoRandomState = {
  enabled: false,
  loopsUntilRandom: 4,       // how many loops before re-randomizing
  varietyMode: 'evolution',   // 'full' | 'evolution' | 'drift'
  intensity: 50,              // probability % for each step toggle (10-90)
  lockedLanes: [],            // lane keys to exclude from randomization
  scope: 'all',               // 'all' | 'selected' | 'single'
  selectedLanes: [],          // when scope is 'selected'
  singleLane: 'kick',         // when scope is 'single'
  autoStopAfterLoops: 0,      // 0 = infinite, otherwise stop after X loops
  loopCount: 0,               // current loop counter
  lastRandomizeTime: 0,       // timestamp of last randomization for drift
  
  // === "After X Loops" scheduling ===
  fillEveryXLoops: 8,         // add a drum fill every N loops (0 = disabled)
  breakdownInterval: 16,      // start breakdown every N loops (0 = disabled)
  buildupInterval: 32,        // trigger buildup every N loops (0 = disabled)
  
  // === Swing & groove variation ===
  swingVariation: false,      // toggle swing variation on/off
  swingRange: 3,              // max swing change per cycle (1-10)
  stepVariation: false,       // toggle step count variation
  stepVaryAmount: 2,          // ±steps to vary (1-8)
  
  // === Probability & density modes ===
  probMode: 'beat',           // 'uniform' | 'beat' | 'syncopate'
  
  // === Humanize ===
  humanize: false,            // add slight randomness for organic feel
  humanizeAmount: 15,         // % chance to flip each step (5-40)
  
  // === Breakdown mode ===
  breakdownMode: false,       // gradually strip elements then rebuild
  breakdownRate: 2,           // steps removed per loop during breakdown (1-5)
  breakdownMinDensity: 0.1,   // minimum density floor (0.05-0.4)
  
  // === Buildup mode ===
  buildupMode: false,         // gradually layer in elements
  buildupRate: 2,             // steps added per loop during buildup (1-5)
  buildupMaxDensity: 0.7,     // maximum density ceiling (0.3-0.9)
  
  // === BPM drift ===
  randomBPM: false,           // slowly drift tempo
  bpmDriftRange: 5,           // ±BPM variation (1-20)
  bpmDriftStep: 4,            // change BPM every N loops
  
  // === Pattern transition ===
  patternTransition: false,   // crossfade patterns during chain mode
  transitionDuration: 800,    // ms for pattern crossfade (200-4000)
  
  // === Accent & fill generation ===
  accentChance: 15,           // extra accent probability for percussion/fx lanes (0-60)
  bassPulse: false,           // sync bass to kick pattern
  chordStab: false,           // chord stabs on beat boundaries
  fillChance: 20,             // base chance for drum fills when enabled (5-50)
  
  // === Randomize on stop ===
  randomizeOnStop: true       // re-randomize when stop is pressed
};

// Per-lane intensity overrides (allows different density per lane)
const laneIntensityOverrides = Object.fromEntries(laneMeta.map(l => [l.key, null]));

function currentPattern() { return state.patterns[state.activePattern]; }

// Theme management
function applyDashboardTheme(theme) {
  const allowed = new Set(['fire', 'water', 'nature', 'rock']);
  const nextTheme = allowed.has(String(theme || '').trim()) ? String(theme).trim() : 'fire';
  document.body.setAttribute('data-dashboard-theme', nextTheme);
}

function readStoredDashboardTheme() {
  try {
    return localStorage.getItem('urage-dashboard-theme') || '';
  } catch (e) {
    return '';
  }
}