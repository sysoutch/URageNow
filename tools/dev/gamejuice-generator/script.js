const profiles = {
  jump: ['lift', 8, 70, '0.004 / 70ms', 'easeOutBack → easeInQuad', 'whoosh 0ms, land -35ms', 'squash 70ms, stretch 90ms, settle 120ms'],
  hit: ['impact', 18, 120, '0.013 / 120ms', 'easeOutExpo → easeInOutCubic', 'thwack 0ms, low 18ms', 'freeze 55ms, recoil 110ms, recover 160ms'],
  explosion: ['blast', 58, 380, '0.028 / 380ms', 'easeOutCirc → easeOutQuart', 'boom 0ms, debris 90ms, tail 180ms', 'flash 45ms, expand 220ms, smoke 600ms'],
  pickup: ['reward', 22, 55, '0.003 / 55ms', 'easeOutBack → easeInSine', 'chime 0ms, sparkle 80ms', 'pop 80ms, float 180ms, vanish 140ms'],
  dash: ['speed', 28, 90, '0.006 / 90ms', 'easeOutQuint → easeOutSine', 'swipe 0ms, tick 45ms', 'compress 40ms, smear 130ms, settle 90ms'],
  land: ['weight', 20, 110, '0.011 / 110ms', 'easeOutBounce → easeOutQuad', 'thud 0ms, gravel 40ms', 'squash 80ms, rebound 110ms, idle 100ms'],
  coin: ['reward', 16, 45, '0.002 / 45ms', 'easeOutBack → easeOutCubic', 'ping 0ms, UI tick 100ms', 'scale 65ms, rotate 130ms, fade 120ms'],
  powerup: ['charge', 36, 220, '0.007 / 220ms', 'easeInOutSine → easeOutElastic', 'rise -120ms, activate 0ms', 'charge 280ms, flash 80ms, glow 500ms']
};

const spritePack = ['player_idle', 'player_squash', 'player_stretch', 'spark_star_01', 'spark_star_02', 'spark_dot_01', 'spark_cross_01', 'dust_puff_01', 'dust_puff_02', 'dust_cloud_01', 'dust_smear_01', 'shard_tri_01', 'shard_tri_02', 'shard_chip_01', 'shard_flash_01', 'ring_arc_01', 'ring_arc_02', 'ring_full_01', 'ring_slash_01'];
const groups = [['Player', spritePack.filter(x => x.startsWith('player'))], ['Spark / Reward', spritePack.filter(x => x.startsWith('spark'))], ['Dust / Movement', spritePack.filter(x => x.startsWith('dust'))], ['Shards / Impact', spritePack.filter(x => x.startsWith('shard'))], ['Rings / Shockwaves', spritePack.filter(x => x.startsWith('ring'))]];

const input = document.querySelector('#input');
const framework = document.querySelector('#framework');
const cards = document.querySelector('#cards');
const stage = document.querySelector('#stage');
const player = document.querySelector('#player');
const stageActions = document.querySelector('#stageActions');
const actionCount = document.querySelector('#actionCount');
const assetCount = document.querySelector('#assetCount');
const exportName = document.querySelector('#exportName');
const inspectGrid = document.querySelector('#inspectGrid');
const assetBrowser = document.querySelector('#assetBrowser');
const codeOutput = document.querySelector('#codeOutput');
const codeTitle = document.querySelector('#codeTitle');
let presets = [];

function getActions() { return input.value.split('\n').map(x => x.trim().toLowerCase()).filter(Boolean); }

function spriteFor(type) {
  if (type === 'lift' || type === 'weight') return 'dust_puff_01';
  if (type === 'blast' || type === 'impact') return 'shard_tri_01';
  if (type === 'reward' || type === 'charge') return 'spark_star_01';
  return 'ring_arc_01';
}

function presetFor(action) {
  const p = profiles[action] || profiles[action.replace('boss ', '')] || ['custom', 18, 100, '0.007 / 100ms', 'easeOutBack → easeOutCubic', `${action} 0ms, sweetener 70ms`, 'anticipate 60ms, action 120ms, settle 140ms'];
  return {action, type: p[0], particles: p[1], shakeMs: p[2], shake: p[3], easing: p[4], sound: p[5], animation: p[6], sprite: spriteFor(p[0])};
}

function generate() {
  presets = getActions().map(presetFor);
  actionCount.textContent = presets.length;
  assetCount.textContent = `${spritePack.length} PNGs`;
  cards.innerHTML = presets.map(cardHtml).join('');
  stageActions.innerHTML = presets.map((p, i) => `<button data-play="${i}" class="${i === 0 ? 'active' : ''}">${esc(p.action)}</button>`).join('');
  stageActions.querySelectorAll('button').forEach(btn => btn.onclick = () => play(presets[Number(btn.dataset.play)], btn));
  renderCode();
  renderAssets();
  if (presets[0]) play(presets[0], stageActions.querySelector('button'));
}

function cardHtml(p) {
  return `<article class="juice-card"><span class="badge">${esc(p.type)}</span><h3>${esc(p.action)}</h3><div class="stat-grid">${stat('Sprite', `${p.sprite}.png`)}${stat('Particles', `${p.particles} sprite particles`)}${stat('Screenshake', p.shake)}${stat('Easing', p.easing)}${stat('Sound', p.sound)}${stat('Animation', p.animation)}</div></article>`;
}

function stat(label, value) { return `<div class="stat"><span>${label}</span><strong>${esc(value)}</strong></div>`; }

function updateInspector(p) {
  inspectGrid.innerHTML = `<div class="inspect-card"><span>Action</span><strong>${esc(p.action)}</strong></div><div class="inspect-card"><span>Type</span><strong>${esc(p.type)}</strong></div><div class="inspect-card"><span>Sprite</span><strong>${esc(p.sprite)}.png</strong></div><div class="inspect-card"><span>Particles</span><strong>${p.particles}</strong></div><div class="inspect-card"><span>Shake</span><strong>${esc(p.shake)}</strong></div><div class="inspect-card"><span>Easing</span><strong>${esc(p.easing)}</strong></div>`;
}

function play(p, btn) {
  stageActions.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateInspector(p);
  [...stage.querySelectorAll('.particle,.ring,.flash,.label-pop')].forEach(x => x.remove());
  player.style.animation = 'none'; stage.style.animation = 'none'; player.offsetHeight;
  const anim = p.type === 'blast' ? 'explosion' : p.type === 'impact' ? 'hit' : p.type === 'reward' || p.type === 'charge' ? 'pickup' : 'jump';
  player.style.animation = `${anim} .62s cubic-bezier(.2,1.35,.2,1)`;
  stage.style.animation = `shake ${Math.max(120, p.shakeMs)}ms linear`;
  const rect = stage.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height - 84;
  const ring = el('div', 'ring');
  ring.style.left = `${cx - 9}px`;
  ring.style.top = `${cy - 9}px`;
  stage.appendChild(ring);
  if (p.type === 'blast' || p.type === 'impact') stage.appendChild(el('div', 'flash'));
  const label = el('div', 'label-pop');
  label.textContent = p.action.toUpperCase();
  stage.appendChild(label);
  for (let i = 0; i < p.particles; i++) {
    const dot = el('div', 'particle');
    const size = 4 + Math.random() * (p.type === 'blast' ? 10 : 7);
    const angle = Math.random() * Math.PI * 2;
    const power = 45 + Math.random() * (p.type === 'blast' ? 190 : 120);
    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.background = particleColor(p.sprite);
    dot.style.boxShadow = '0 0 18px currentColor';
    dot.style.setProperty('--x', `${Math.cos(angle) * power}px`);
    dot.style.setProperty('--y', `${Math.sin(angle) * power - 30}px`);
    dot.style.setProperty('--dur', `${350 + Math.random() * 520}ms`);
    stage.appendChild(dot);
  }
}

function renderAssets() {
  assetBrowser.innerHTML = groups.map(([title, names]) => `<section class="asset-group"><div class="asset-title">${title}</div><div class="asset-grid">${names.map(assetHtml).join('')}</div></section>`).join('');
  assetBrowser.querySelectorAll('canvas').forEach(canvas => drawSprite(canvas, canvas.dataset.sprite));
  assetBrowser.querySelectorAll('[data-download]').forEach(button => button.onclick = () => downloadSprite(button.dataset.download));
}

function assetHtml(name) {
  return `<article class="asset-card"><div class="asset-preview"><canvas width="32" height="32" data-sprite="${name}"></canvas></div><div class="asset-meta"><strong title="${name}.png">${name}.png</strong><span>32×32 transparent PNG</span><button data-download="${name}">Download</button></div></article>`;
}

function particleColor(sprite) {
  if (sprite.startsWith('dust')) return '#c9b38a';
  if (sprite.startsWith('shard')) return '#9da9ff';
  if (sprite.startsWith('ring')) return '#ffd36e';
  return '#79ffd7';
}

function drawSprite(canvas, name) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 32, 32);
  ctx.imageSmoothingEnabled = false;
  ctx.shadowBlur = 7;
  ctx.shadowColor = particleColor(name);
  ctx.fillStyle = particleColor(name);
  ctx.strokeStyle = particleColor(name);
  ctx.lineWidth = 3;
  if (name.startsWith('player')) return drawPlayer(ctx, name);
  if (name.startsWith('dust')) return drawDust(ctx, name);
  if (name.startsWith('shard')) return drawShard(ctx, name);
  if (name.startsWith('ring')) return drawRing(ctx, name);
  drawSpark(ctx, name);
}

function drawPlayer(ctx, name) {
  const w = name === 'player_squash' ? 24 : name === 'player_stretch' ? 16 : 20;
  const h = name === 'player_squash' ? 16 : name === 'player_stretch' ? 25 : 20;
  const x = 16 - w / 2;
  const y = 17 - h / 2;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#07101e';
  ctx.fillRect(x + w * .32, y + h * .38, 2, 2);
  ctx.fillRect(x + w * .62, y + h * .38, 2, 2);
}

function drawSpark(ctx, name) {
  if (name.includes('dot')) { ctx.beginPath(); ctx.arc(16, 16, 6, 0, Math.PI * 2); ctx.fill(); return; }
  if (name.includes('cross')) { ctx.fillRect(14, 4, 4, 24); ctx.fillRect(4, 14, 24, 4); return; }
  const r1 = name.includes('02') ? 13 : 15;
  const r2 = name.includes('02') ? 5 : 4;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    const r = i % 2 ? r2 : r1;
    const x = 16 + Math.cos(a) * r;
    const y = 16 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDust(ctx, name) {
  ctx.globalAlpha = .92;
  if (name.includes('smear')) { roundRect(ctx, 4, 15, 24, 8, 5); ctx.fill(); return; }
  ctx.beginPath(); ctx.ellipse(14, 18, 9, 6, -.25, 0, Math.PI * 2); ctx.fill();
  if (name.includes('02') || name.includes('cloud')) { ctx.beginPath(); ctx.ellipse(21, 16, 6, 5, .2, 0, Math.PI * 2); ctx.fill(); }
  if (name.includes('cloud')) { ctx.beginPath(); ctx.ellipse(9, 20, 5, 4, .1, 0, Math.PI * 2); ctx.fill(); }
}

function drawShard(ctx, name) {
  ctx.beginPath();
  if (name.includes('flash')) { ctx.moveTo(16, 2); ctx.lineTo(20, 13); ctx.lineTo(30, 16); ctx.lineTo(19, 20); ctx.lineTo(16, 30); ctx.lineTo(12, 20); ctx.lineTo(2, 16); ctx.lineTo(13, 13); }
  else if (name.includes('chip')) { ctx.moveTo(8, 8); ctx.lineTo(26, 13); ctx.lineTo(20, 27); ctx.lineTo(6, 21); }
  else if (name.includes('02')) { ctx.moveTo(14, 3); ctx.lineTo(28, 25); ctx.lineTo(8, 28); }
  else { ctx.moveTo(16, 3); ctx.lineTo(27, 28); ctx.lineTo(6, 22); }
  ctx.closePath();
  ctx.fill();
}

function drawRing(ctx, name) {
  if (name.includes('full')) { ctx.beginPath(); ctx.arc(16, 16, 10, 0, Math.PI * 2); ctx.stroke(); return; }
  if (name.includes('slash')) { ctx.beginPath(); ctx.moveTo(7, 25); ctx.lineTo(25, 7); ctx.stroke(); return; }
  ctx.beginPath();
  const start = name.includes('02') ? .6 : -.8;
  ctx.arc(16, 16, 10, start, start + 4.8);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function downloadSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  drawSprite(canvas, name);
  const link = document.createElement('a');
  link.download = `${name}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function downloadAllSprites() { spritePack.forEach((name, i) => setTimeout(() => downloadSprite(name), i * 80)); }

function buildSpriteDescriptor(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  drawSprite(canvas, name);
  const dataUrl = canvas.toDataURL('image/png');
  return {
    kind: 'image',
    title: `${name}.png`,
    fileName: `${name}.png`,
    mimeType: 'image/png',
    dataUrl,
    width: 32,
    height: 32,
    previewKind: 'image',
    previewUrl: dataUrl,
    sourceDetail: 'Procedural game-juice sprite PNG.',
    metadata: { sourceTool: 'gamejuice-generator', spriteName: name }
  };
}

function describeCurrentAssets() {
  const presetText = JSON.stringify({ version: 1, framework: framework.value, actions: presets }, null, 2);
  const codeText = codeOutput.textContent || '';
  return [
    ...spritePack.map(buildSpriteDescriptor),
    {
      kind: 'text',
      title: 'Game Juice Presets JSON',
      fileName: 'game-juice-presets.json',
      mimeType: 'application/json',
      textContent: presetText,
      previewKind: 'text',
      previewText: presetText,
      sourceDetail: 'Generated action timing, particle, shake, and sprite preset data.',
      metadata: { sourceTool: 'gamejuice-generator', resourceFormat: 'juice-presets-json' }
    },
    {
      kind: 'text',
      title: `${exportName.textContent || 'Engine'} Juice Snippet`,
      fileName: 'game-juice-snippet.txt',
      mimeType: 'text/plain',
      textContent: codeText,
      previewKind: 'text',
      previewText: codeText,
      sourceDetail: 'Generated engine integration snippet.',
      metadata: { sourceTool: 'gamejuice-generator', framework: framework.value }
    }
  ];
}

function renderCode() {
  const fw = framework.value;
  const name = fw === 'pixijs' ? 'PixiJS' : fw === 'babylon' ? 'Babylon.js' : fw === 'unity' ? 'Unity C#' : 'Phaser';
  exportName.textContent = name;
  codeTitle.textContent = name;
  document.querySelectorAll('[data-fw]').forEach(btn => btn.classList.toggle('active', btn.dataset.fw === fw));
  codeOutput.textContent = snippets[fw](presets);
}

const snippets = {
  phaser: ps => `const juice = ${JSON.stringify(ps, null, 2)};

function playJuice(scene, action, x, y) {
const p = juice.find(v => v.action === action);
if (!p) return;

scene.cameras.main.shake(p.shakeMs, Number(p.shake.split(' ')[0]));
const fx = scene.add.particles(x, y, 'particleAtlas', {
frame: p.sprite + '.png',
quantity: p.particles,
speed: { min: 80, max: 280 },
rotate: { min: -180, max: 180 },
lifespan: 450,
scale: { start: 1, end: 0 },
blendMode: 'ADD'
});
scene.time.delayedCall(500, () => fx.destroy());
}`,
  pixijs: ps => `const juice = ${JSON.stringify(ps, null, 2)};

function playJuice(container, action, x, y) {
const p = juice.find(v => v.action === action);
if (!p) return;

for (let i = 0; i < p.particles; i++) {
const dot = PIXI.Sprite.from(p.sprite + '.png');
dot.anchor.set(.5);
dot.scale.set(.45 + Math.random() * .65);
dot.position.set(x, y);
container.addChild(dot);
}
shake(container, Number(p.shake.split(' ')[0]), p.shakeMs);
}`,
  babylon: ps => `const juice = ${JSON.stringify(ps, null, 2)};

function playJuice(scene, camera, action, position) {
const p = juice.find(v => v.action === action);
if (!p) return;

const particles = new BABYLON.ParticleSystem(action + 'Juice', p.particles, scene);
particles.particleTexture = new BABYLON.Texture(p.sprite + '.png', scene);
particles.emitter = position;
particles.emitRate = 900;
particles.start();
setTimeout(() => particles.dispose(), 520);
}`,
  unity: ps => `using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class JuicePlayer : MonoBehaviour
{
[System.Serializable]
public class JuicePreset
{
    public string action;
    public int particles;
    public float shakeIntensity;
    public float shakeSeconds;
    public Sprite particleSprite;
    public string easing;
    public string soundTiming;
    public string animationTiming;
}

public Camera targetCamera;
public ParticleSystem burstPrefab;
public List<JuicePreset> presets = new List<JuicePreset>();

public void PlayJuice(string action, Vector3 position)
{
    JuicePreset preset = presets.Find(p => p.action == action);
    if (preset == null) return;

    if (burstPrefab != null)
    {
        ParticleSystem burst = Instantiate(burstPrefab, position, Quaternion.identity);
        ParticleSystem.TextureSheetAnimationModule sheet = burst.textureSheetAnimation;
        if (preset.particleSprite != null)
        {
            sheet.enabled = true;
            sheet.mode = ParticleSystemAnimationMode.Sprites;
            sheet.AddSprite(preset.particleSprite);
        }
        ParticleSystem.EmissionModule emission = burst.emission;
        emission.SetBursts(new[] { new ParticleSystem.Burst(0f, (short)preset.particles) });
        burst.Play();
        Destroy(burst.gameObject, 1.2f);
    }

    if (targetCamera != null) StartCoroutine(ShakeCamera(preset.shakeIntensity, preset.shakeSeconds));
}

IEnumerator ShakeCamera(float intensity, float seconds)
{
    Vector3 start = targetCamera.transform.localPosition;
    float timer = 0f;
    while (timer < seconds)
    {
        float fade = 1f - timer / seconds;
        Vector2 offset = Random.insideUnitCircle * intensity * fade;
        targetCamera.transform.localPosition = start + new Vector3(offset.x, offset.y, 0f);
        timer += Time.deltaTime;
        yield return null;
    }
    targetCamera.transform.localPosition = start;
}
}`
};

function el(tag, cls) { const node = document.createElement(tag); node.className = cls; return node; }
function esc(value) { return String(value).replace(/[&<>"]/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[char])); }

document.querySelector('#generateBtn').onclick = generate;
document.querySelector('#resetBtn').onclick = () => { input.value = 'jump\nhit\nexplosion\npickup'; generate(); };
document.querySelector('#downloadAllSprites').onclick = downloadAllSprites;
document.querySelectorAll('[data-add]').forEach(btn => btn.onclick = () => { input.value = [...new Set([...getActions(), btn.dataset.add])].join('\n'); generate(); });
document.querySelectorAll('[data-fw]').forEach(btn => btn.onclick = () => { framework.value = btn.dataset.fw; renderCode(); });
framework.onchange = renderCode;
generate();
window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;
