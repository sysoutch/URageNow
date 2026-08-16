# 2D Map Generator

A browser-based procedural 2D map generation sandbox focused on fast experimentation, stylized level blockouts, and game-ready layout prototyping.

Generate pixel-art worlds across multiple 2D perspectives including topdown, angled 3/4 RPG view, isometric, tactical, and side-scroller layouts with live previews, procedural rules, sprite systems, seeded generation, animated assets, and export tooling.

The default sprite library is catalog-driven. Built-in map sprites, hidden image assets, player variants, and per-mode player counts are declared in `index.html` and consumed dynamically by the generator, so the tool no longer depends on hardcoded built-in ids in rendering or placement code.

Designed for indie developers, pixel artists, tool builders, game jam teams, and rapid gameplay iteration.

---

# Supported 2D Perspectives

## Topdown

Classic overhead generation for:

* Roguelikes.
* Dungeon crawlers.
* Tactical arenas.
* Zelda-style maps.
* Shooter layouts.

Features:

* Symmetrical layouts.
* Multi-axis mirroring.
* Diagonal reflections.
* Procedural decoration.
* Grid-based generation.

---

## 3/4 Topdown (Angled RPG View)

An angled perspective similar to:

* Stardew Valley.
* Harvest Moon.
* Pokémon GBA/DS.
* Classic JRPGs.

Features:

* Raised arena edges.
* Depth-facing wall rendering.
* Decorative edge generation.
* Top-surface tile placement.
* Sprite placement aware of visible depth.
* RPG-style arena framing.

Ideal for:

* Farming sims.
* RPG towns.
* Battle arenas.
* Social spaces.
* Sandbox builders.

---

## Isometric / 2.5D

Diamond-based procedural generation with visible tile depth.

Features:

* Isometric tile positioning.
* Visible side faces.
* Raised platforms.
* Multi-height illusion support.
* Tile-top sprite placement.
* Tactical map layouts.

Ideal for:

* Strategy games.
* Diablo-style layouts.
* City builders.
* Tactical RPGs.

---

## Side Scroller

Terrain-based procedural generation for side-view gameplay.

Features:

* Terrain shaping.
* Platform generation.
* Floating platforms.
* Hole generation.
* Platform-aware item placement.
* Side-scroller preview camera.
* Drag navigation for large maps.
* Bottom-left origin generation where rows grow upward.

Ideal for:

* Platformers.
* Metroidvanias.
* Action games.
* Sandbox terrain systems.

---

# Core Features

## Procedural Generation

* Randomized layouts.
* Reproducible seeded generation.
* Fast regeneration.
* Large-map support.
* Layout experimentation.
* Repeat mirroring expansion.
* Platform-aware generation logic.
* Procedural arena framing.

---

## Sprite System

Upload and manage custom sprites directly in the browser.

Supported formats:

* `.png`
* `.jpg`
* `.webp`
* `.gif`

Features:

* Replace sprites at runtime.
* Add unlimited custom sprite types.
* Runtime preview updates.
* Animated GIF support.
* Optional global auto-scaling.
* Tile-top placement.
* Placement rules shared across topdown, 3/4, isometric, and sidescroller modes.
* Hole sprite support.
* Transparent empty spaces.

---

## Placement Rules

Every sprite type can define procedural placement logic.

Supported rules:

* Anywhere.
* Only on platforms.
* Only inside holes.
* Only on empty tiles.
* On top of another sprite.
* Requires empty space above.
* Surface-only placement.

This allows creation of:

* Trees.
* Props.
* Decorations.
* Collectibles.
* Hazards.
* Spawn markers.
* Elevated structures.

---

## Background Images

Each perspective can use its own single canvas background image:

* Topdown background.
* 3/4 RPG background.
* Isometric background.
* Sidescroller background.

Background choices are saved with exported generator setup JSON.

---

## Mirroring System

Advanced symmetry and layout reflection support.

Available modes:

* X-axis.
* Y-axis.
* Both axes.
* Main diagonal.
* Anti diagonal.
* Both diagonals.
* Repeat mirroring.

Additional controls:

* Center row sharing.
* Center column sharing.
* Tile expansion mirroring.

Useful for:

* Arena maps.
* Competitive layouts.
* Puzzle maps.
* Structured procedural generation.

---

## Animated Sprites

GIF sprites remain animated inside the live canvas renderer.

Features:

* Continuous animated rendering.
* Mixed static and animated sprite support.
* Animated environmental decoration.
* Animated props and effects.

Ideal for:

* Water.
* Torches.
* Particles.
* Environmental effects.
* NPC indicators.

---

# Live Editor Dashboard

A polished browser-based generation dashboard designed for rapid iteration.

Features:

* Real-time canvas preview.
* Collapsible tool panels.
* Remembered UI state.
* Sprite management panels.
* Live generation statistics.
* Responsive layout support.
* Seed tracking.
* Mode-aware controls.
* Fast iteration workflow.

Live stats include:

* Active mode.
* Map size.
* Platform count.
* Item count.
* Seed value.

---

# Export & Import

## Image Export

Export generated maps directly as compressed images.

Features:

* Real file downloads.
* Adjustable JPEG quality.
* Large-map export support.
* Browser-based exporting.
* Generated map JSON export.

---

## Setup Presets

Export and import generator configurations.

Useful for:

* Sharing layouts.
* Preserving settings.
* Team workflows.
* Iteration snapshots.
* Testing procedural variations.
* Starter pack mode presets.

---

# Designed For

* Indie game development.
* Game jams.
* Pixel art prototyping.
* RPG generation.
* Sandbox world design.
* Arena prototyping.
* Procedural generation experiments.
* Tile-set testing.
* Rapid gameplay iteration.
* Visual blockout creation.

---

# Companion Tool

Use `tools/dev/map-generator/3d` when you want:

* Real Three.js previews.
* Perspective cameras.
* Orthographic cameras.
* Full 3D blockouts.
* 3D terrain previews.
* Hybrid 2D/3D workflows.

---

# Usage

1. Open `index.html` in your browser.
2. Select a generation mode.
3. Upload or replace sprites.
4. Configure layout settings.
5. Optionally provide a seed.
6. Generate the map.
7. Iterate until satisfied.
8. Export the result or save the preset.

---

# Technical Notes

* Fully client-side.
* No backend required.
* No external dependencies beyond included local libraries.
* Supports animated rendering loops.
* Syncs dashboard theme tokens when opened inside URage NOW.
* Optimized for rapid experimentation.
* Built for extensibility.

---

# Future Expansion Ideas

## Generation

* Tile adjacency rules.
* Biome generation.
* Cellular automata generation.
* Wave Function Collapse support.
* Terrain noise generation.
* Multi-layer maps.
* Height-map simulation.

---

## Gameplay Systems

* Collision preview.
* Spawn zone generation.
* Navigation overlays.
* Pathfinding preview.
* Enemy zone painting.
* Trigger regions.
* Procedural loot placement.

---

## Sprite & Tile Systems

* Sprite layering.
* Auto-tiling.
* Tile blending.
* Sprite sheet animation support.
* Connected texture rules.
* Material presets.
* Runtime palette swapping.

---

## Export Pipelines

* Full tilemap JSON export.
* Tiled export support.
* Unity Tilemap export.
* Godot TileMap export.
* Procedural metadata export.
* Chunked world export.

---

# Vision

The goal is to evolve this into a powerful all-in-one procedural 2D world prototyping toolkit capable of generating everything from tiny arenas to stylized RPG worlds, tactical battlefields, side-scrolling terrain systems, and game-ready layout foundations.

The focus is:

* Fast experimentation.
* Strong visual feedback.
* Modular procedural systems.
* Browser-based accessibility.
* Flexible art direction.
* Game-development-first workflows.

---

# Credits

Original concept and implementation by you.

Expanded with procedural systems, rendering improvements, dashboard tooling, generation workflows, UX improvements, and multi-perspective support.
