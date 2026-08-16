# Tilemap Creator

A powerful browser-based 2D tilemap editor designed for fast level building, layered environment painting, procedural workflows, and game-ready export pipelines.

## Compact Brush Controls

The Brush foldout is designed to remain usable inside the dashboard's narrow tool sidebar. Brush action, source mode, shape, transforms, and selection operations use icon-first controls with accessible labels and hover tooltips; keyboard shortcuts remain available without forcing long text into tiny buttons.

## Compact Brush Controls

The Brush foldout is designed to remain usable inside the dashboard's narrow tool sidebar. Brush action, source mode, shape, transforms, and selection operations use icon-first controls with accessible labels and hover tooltips; keyboard shortcuts remain available without forcing long text into tiny buttons.

Unity package source for an EditorWindow version now lives in `unity-package/com.urage.tilemap-creator/`.

Built for indie developers, pixel artists, level designers, RPG creators, sandbox builders, and rapid prototyping workflows.

Supports layered editing, smart wall auto-tiling, multiple tilesets, advanced painting tools, mirrored workflows, Tiled compatibility, and export pipelines for real game integration.

---

# Core Features

## Multi-Tileset Workflow

Load and work with multiple tilesets simultaneously.

Features:

* Multiple active tilesets.
* Fast tileset switching.
* Multi-image upload as separate tilesets or one combined tileset.
* Floating tileset browser.
* Floating layer manager with layer selection, visibility, erase, reorder, and opacity controls.
* Floating layer rows are rendered through `js/layerPanel.js`, keeping row controls and action binding out of the main editor script.
* Paint source selection is backed by `js/paintOptions.js`, keeping random and ordered tile-pool picking separate from the canvas paint loop.
* Hover tile previews.
* Tab and Shift+Tab switching.
* Ctrl-click or Ctrl-drag additive tile selection inside the active tileset.
* Combined global tile indexing.
* Runtime tileset management.
* Paint source modes now read both rectangular brush selections and additive flat tile pools correctly.
* Grid projection can switch between the current orthogonal canvas and an isometric diamond canvas for fitting transparent isometric sprites.

Ideal for:

* Large RPG worlds.
* Multi-biome environments.
* Layered environments.
* Complex tile pipelines.

---

# Advanced Painting System

A flexible painting workflow designed for both precision editing and rapid level construction.

## Brush Modes

Supported tools:

* Paint.
* Erase.
* Fill.
* Rectangle.
* Rectangle outline.
* Circle.
* Single-tile.
* Move.
* Pick.
* Full-tileset brushes.

Features:

* Click painting.
* Drag painting.
* Paint Options source modes: Stamp, Random, Forward, Reverse, Ping-pong, and Cell noise.
* Non-stamp source modes now override smart-wall stamping for normal paint/fill strokes instead of collapsing back to the first selected tile.
* Ordered paint-source modes now only advance after the cursor enters a different map cell, so lingering on one tile does not keep stepping the sequence.
* Straight-line painting.
* Rectangle erasing.
* Brush flipping.
* Brush mirroring.
* Selection transforms.
* Tile movement.
* Embedded tileset project export and reload.

---

## Smart Wall Brush System

A procedural auto-wall painting workflow for creating connected environments quickly.

Supports:

* Starts.
* Middles.
* Corners.
* T-junctions.
* Intersections.
* Edge transitions.

Features:

* Visual assignment cards.
* Connection preview icons.
* Tile previews.
* Auto role mapping.
* Auto role mapping now preserves preview cards when the source brush is a multi-tile or cropped nested selection.
* Auto role mapping now commits through the same per-role assignment path as manual role edits, so mapped roles stay usable for previews and connected painting.
* Auto role mapping treats the largest selected island as the main wall block, feeds any additional detached full 2x2 islands into inner corners, and can also peel any valid inline 2x2 block out of one connected selection footprint when the inner-corner sprites are packed right next to the main brush.
* Per-profile Smart Wall inner-corner source X/Y toggles only affect how the selected 2x2 inner-corner block is assigned during auto-map, letting you choose whether the first source tile maps to top-left or to the mirrored opposite direction without changing normal wall-role picking.
* Rect-outline smart-wall painting now evaluates role masks against the full rectangle footprint, so perimeter strokes use terrain edge/corner roles instead of collapsing to line-only roles.
* Runtime smart brush editing.
* Connected tile placement.

Ideal for:

* Dungeon generation.
* RPG interiors.
* Cave systems.
* Terrain walls.
* Connected structures.

---

# Layered Tilemap Editing

Build complex environments using layered painting.

Features:

* Unlimited layered workflows.
* Layer duplication.
* Layer visibility toggles.
* Layer opacity controls.
* Per-layer editing.
* Full layer erase.
* Global erase.

Useful for:

* Backgrounds.
* Decorations.
* Collision layers.
* Lighting layers.
* Detail overlays.
* Gameplay markup.

---

# Mirroring & Symmetry

Speed up environment construction using live map mirroring.

Supported modes:

* Map Mirror X.
* Map Mirror Y.
* Brush Mirror X.
* Brush Mirror Y.
* Selection flipping.
* Horizontal transforms.
* Vertical transforms.

Ideal for:

* Arena maps.
* Symmetrical layouts.
* Puzzle maps.
* Competitive level design.
* Fast environmental iteration.

---

# Selection & Editing Tools

Advanced selection tooling for large-scale editing.

Features:

* Full-map selection.
* Full active-tileset selection.
* Horizontal selection flipping.
* Vertical selection flipping.
* Tile movement.
* Brush copying.
* Region editing.
* Drag relocation.

Supports rapid iteration on:

* Dungeon layouts.
* Terrain regions.
* Decorative passes.
* Gameplay zones.

---

# Canvas Navigation

A smooth editor-style navigation system designed for large maps.

Features:

* Middle-mouse panning.
* Shift-drag panning.
* Mouse-wheel zoom.
* Viewport fitting.
* Floating helper panels.
* Responsive dashboard layout.
* Fast large-map navigation.
* Isometric projection mode keeps painting, hover previews, selection overlays, and PNG export aligned to the diamond grid.

---

# Editor Dashboard

A polished browser-based dashboard interface designed for real production workflows.

Features:

* Floating helper panels.
* Collapsible sidebar sections.
* Remembered UI state.
* Dashboard media tray support.
* Responsive editor layout.
* Tool-focused workflow design.
* Fast-access painting tools.

The UI is designed to feel closer to a lightweight professional level editor than a simple demo tool.

---

# Import & Export Pipelines

## Native Project Export

Export fully editable project data.

Features:

* Native JSON format.
* Embedded tileset image data.
* Self-contained projects.
* Layer preservation.
* Brush-compatible reloading.
* Persistent editing workflows.

---

## Tiled Compatibility

Supports importing and exporting Tiled-compatible JSON.

Useful for:

* Existing pipelines.
* Game engine integration.
* Team workflows.
* External editing.

---

## PNG Export

Export composited tilemaps directly as images.

Features:

* Visible-layer rendering.
* Browser-based exporting.
* Quick previews.
* Sharing-ready exports.
* Documentation screenshots.
* Transparent PNG output is preserved; editor and tileset canvases use checkerboard backdrops so sprite alpha can be inspected while painting.

---

# Workflow Features

## Undo & Redo

Full editing history support.

* Undo.
* Redo.
* Fast iteration.
* Experimental editing.

---

## Grid Resizing

Resize maps without destroying existing layouts.

Features:

* Tile preservation.
* Non-destructive resizing.
* Large-map support.
* Layout iteration.

---

## Runtime Editing

All editing occurs directly inside the browser.

Features:

* No backend required.
* Instant editing feedback.
* Live tile updates.
* Fast experimentation.
* Local workflow support.

---

# Designed For

* Indie game development.
* RPG creation.
* Pixel-art workflows.
* Sandbox games.
* Dungeon editors.
* Tactical maps.
* Platformer level design.
* Game jams.
* Rapid prototyping.
* Environment blockouts.

---

# Example Use Cases

## RPG World Building

* Town layouts.
* Dungeon interiors.
* Overworld maps.
* Decorative environments.
* Collision markup.

---

## Procedural Workflow Support

Use the editor alongside procedural generators.

Ideal for:

* Touch-up passes.
* Manual cleanup.
* Hybrid procedural pipelines.
* Gameplay markup.
* Tile corrections.

---

## Arena & Competitive Maps

Mirror systems and fast editing tools make the editor ideal for:

* Symmetrical arenas.
* Competitive layouts.
* Puzzle rooms.
* Tactical combat spaces.

---

# Controls

| Action                           | Input                                       |
| -------------------------------- | ------------------------------------------- |
| Paint mode                       | P                                           |
| Erase mode                       | E                                           |
| Fill mode                        | F                                           |
| Rectangle mode                   | R                                           |
| Rect Outline shape               | 4 or O                                      |
| Pick tile mode                   | I                                           |
| Move mode                        | M                                           |
| Switch active tileset            | Tab / Shift+Tab                             |
| Paint tile                       | Left click or drag                          |
| Erase tile                       | Erase mode or right click                   |
| Straight-line paint              | Hold Ctrl while painting                    |
| Rectangle erase                  | Hold Ctrl while erasing or right-dragging   |
| Select full map layer            | Ctrl+A while not hovering tileset           |
| Select full active tileset brush | Ctrl+A while hovering tileset               |
| Flip selected map area           | Use the Selection buttons                   |
| Undo                             | Ctrl+Z                                      |
| Redo                             | Ctrl+Y or Ctrl+Shift+Z                      |
| Pan view                         | Middle mouse or Shift-drag                  |
| Zoom view                        | Mouse wheel                                 |
| Select tile/brush                | Click or drag in the floating tileset panel |
| Toggle smart wall brush          | W                                           |
| Toggle map mirror X              | X                                           |
| Toggle map mirror Y              | Y                                           |
| Flip current brush horizontally  | [                                           |
| Flip current brush vertically    | ]                                           |
| Toggle grid preview              | G                                           |

---

# Export Format

```json
{
  "tileSize": 32,
  "gridMode": "orthogonal",
  "width": 30,
  "height": 20,
  "layers": [
    [
      [0, 1, -1, 2],
      [1, 0, 0, -1]
    ]
  ],
  "tilesets": [
    {
      "name": "terrain.png",
      "columns": 8,
      "rows": 8,
      "tileCount": 64,
      "firstTile": 0
    }
  ]
}
```

`-1` represents an empty tile.

Tile indexes are global across all loaded tilesets.

The first loaded tileset starts at `0`, and additional tilesets continue indexing after the previous tileset's tile count.

---

# Technical Notes

* Fully browser-based.
* Runs completely client-side.
* No backend required.
* Fast canvas rendering.
* Optimized for large maps.
* Designed for extensibility.
* Compatible with external pipelines.
* Syncs dashboard theme tokens when opened inside URage NOW.

---

# Future Expansion Ideas

## Editing Systems

* Tile animation support.
* Auto-tiling terrain brushes.
* Layer groups.
* Tile metadata.
* Stamp libraries.
* Terrain painting.
* Procedural brushes.

---

## Gameplay Integration

* Collision editing.
* Spawn zones.
* Trigger regions.
* Navigation overlay
