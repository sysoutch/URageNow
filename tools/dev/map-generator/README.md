# Map Generator Tool

A combined 2D and 3D map generator tool with a unified interface. Accessible via tabs: **2D** and **3D**.

## Structure

```
map-generator/
├── index.html          # Main entry point (tab bar + iframe switcher)
├── README.md           # This file
├── css/
│   ├── tab-bar.css     # Tab bar styling
│   └── styles.css      # Shared layout styles
├── images/             # Shared icons and backgrounds
├── js/
│   └── tab-bar.js      # Tab switching logic
├── 2d/                 # 2D Map Generator (standalone)
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── images/
└── 3d/                 # 3D Map Generator (standalone)
    ├── index.html
    ├── css/
    └── js/
```

## Usage

Open `index.html` in a browser. Use the **2D** tab for tile-based map generation (topdown, isometric, sidescroller) and the **3D** tab for 3D blockout generation and model viewing.

### 2D Tab Features
- **Topdown Mode**: Flat or 3/4 RPG depth rendering
- **Isometric Mode**: Angled 2.5D diamond-tile style
- **Sidescroller Mode**: Left-to-right terrain generation
- Sprite upload and management
- Mirror options (horizontal, vertical, diagonal)
- Map export as JSON, image, or ZIP archive

### 3D Tab Features
- Three.js-based 3D map/blockout generator and model viewer
- Model rotation, zoom, pan controls
- Theme customization
- Screenshot capture
- Export PNG, JSON, or ZIP archive

### ZIP Export (Both Tabs)
Click **Export ZIP** to download a complete package containing:
- `map.json` - Structured map data with tiles, items, and players
- `settings.json` - Current generator settings and options
- `sprite-catalog.json` (2D) / `models/` folder (3D) - Sprite or model metadata
- `images/` - All sprite/background images used in the map (2D) or preview render
- `preview.png` - Canvas/render screenshot

The ZIP bundles everything needed to import the map into a game engine or share with a team.

Unity import notes: 2D ZIP exports include sprite images and `sprite-catalog.json`, which the Unity importer uses to bind sprites automatically. 3D ZIP exports include blockout JSON; the Unity importer creates cubes by default for cell kinds like `block`, `ground`, and `path` unless matching prefabs are assigned.

### Dashboard / Game Engine Handoff

The 2D and 3D generator tabs now expose current outputs through the shared dashboard tool bridge:
- PNG preview image
- `map.json`
- ZIP package with JSON, settings, preview image, and sprite/model metadata

The combined tab shell forwards dashboard requests to the active 2D or 3D iframe, so **Send to Game Engine** can use the currently selected generator tab. The tab shell exposes the 2D/3D tab buttons and asks the dashboard to include the active nested generator sidebar, so the dashboard sidebar contains both the tab selector and the full active generator controls. When the dashboard externalizes a sidebar, the embedded copies are hidden inside the parent frame and active child frame; mirrored controls keep foldout state and use dashboard-native spacing, borders, and theme colors.

## Dependencies

### Shared
- Font Awesome 6+ (via `../../shared/libs/fontawesome/`)
- Dashboard theme bridge (`../../shared/dashboard-theme.js`)

### 2D Tab (CDN)
- Bootstrap 5.3+ (jsdelivr CDN)
- Popper.js 2.x (jsdelivr CDN)

### 3D Tab (local)
- Three.js (via `../../shared/libs/three/`)

## Development Notes

- Each tab's content is loaded in an `<iframe>` for isolation
- Tab state persists via URL hash (`#2d` or `#3d`)
- The main `index.html` handles only the tab bar UI
- All 2D and 3D logic lives inside their respective subdirectories

## License

See individual `LICENSE` files in each subdirectory for component licenses.
