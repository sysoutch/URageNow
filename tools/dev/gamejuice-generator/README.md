# Game Juice Generator

![Thumbnail](thumbnail.png)

An interactive HTML5 dashboard for prototyping and previewing game "juice" — the visual and audio feedback effects that make games feel satisfying. Generate particles, screenshake, easing animations, sound timing, sprite animations, and export ready-to-use code snippets for popular game engines.

## Features

- **Action-Based Generation**: Type action names (jump, hit, explosion, pickup, dash, land, coin, powerup) to generate corresponding juice profiles
- **Quick Add Chips**: One-click buttons for common actions — dash, land, coin, boss hit, powerup
- **Particle Effects**: Configurable sprite-based particle bursts with randomized size, angle, and velocity
- **Screenshake Profiles**: Adjustable shake intensity and duration per action type
- **Easing Presets**: Pre-configured easing curves (easeOutBack, easeInQuad, easeOutExpo, etc.) for smooth animations
- **Sound Timing**: Visual sound effect timing cues with relative offsets (e.g., "whoosh 0ms, land -35ms")
- **Sprite Animation Timings**: Squash & stretch, freeze frames, recoil, and settle animation timings
- **Editable Presets**: Modify any preset parameter directly in the inspector panel
- **Live Preview Stage**: Real-time animated preview with particles, screenshake, and sprite animations
- **Engine Code Export**: Generate ready-to-use code snippets for:
  - **Phaser** — Emitter + sprite frame setup
  - **PixiJS** — Sprite burst particles
  - **Babylon.js** — ParticleSystem texture setup
  - **Unity C#** — ParticleSystem sprites configuration
- **Sprite Pack Browser**: Browse and download 19 built-in 32×32 transparent PNG sprite assets
- **Downloadable Assets**: Download individual sprites or all sprites at once as PNG files
- **Responsive Layout**: Three-panel docked sidebar layout on desktop, collapses gracefully on mobile

## How to Use

1. **Enter Actions**: Type action names in the textarea (one per line) — e.g., "jump", "hit", "explosion"
2. **Generate**: Click "Generate" to create juice profiles for all listed actions
3. **Preview**: Click any action button on the stage to preview its effects
4. **Customize**: Edit preset parameters in the inspector panel on the right
5. **Export**: Select your target engine and copy the generated code snippet

## Built-in Action Profiles

| Action | Type | Particles | Duration | Easing | Effects |
|--------|------|-----------|----------|--------|---------|
| jump | lift | 8 | 70ms | easeOutBack → easeInQuad | squash, stretch, settle |
| hit | impact | 18 | 120ms | easeOutExpo → easeInOutCubic | freeze, recoil, recover |
| explosion | blast | 58 | 380ms | easeOutCirc → easeOutQuart | flash, expand, smoke |
| pickup | reward | 22 | 55ms | easeOutBack → easeInSine | pop, float, vanish |
| dash | speed | 28 | 90ms | easeOutQuint → easeOutSine | compress, smear, settle |
| land | weight | 20 | 110ms | easeOutBounce → easeOutQuad | thud, squash, rebound |
| coin | reward | 16 | 45ms | easeOutBack → easeOutCubic | scale, rotate, fade |
| powerup | charge | 36 | 220ms | easeInOutSine → easeOutElastic | charge, flash, glow |

## Sprite Pack

The tool includes 19 built-in sprites organized into groups:

- **Player**: player_idle, player_squash, player_stretch
- **Spark / Reward**: spark_star_01, spark_star_02, spark_dot_01, spark_cross_01
- **Dust / Movement**: dust_puff_01, dust_puff_02, dust_cloud_01, dust_smear_01
- **Shards / Impact**: shard_tri_01, shard_tri_02, shard_chip_01, shard_flash_01
- **Rings / Shockwaves**: ring_arc_01, ring_arc_02, ring_full_01, ring_slash_01

## Technical Details

This tool uses CSS animations and JavaScript for real-time particle simulation:

- Particles are rendered as styled DOM elements with CSS custom properties for position and velocity
- Screenshake is implemented via CSS keyframe animations on the stage container
- Sprite rendering uses Canvas API with procedural drawing (no external image dependencies)
- Code generation produces engine-specific configuration matching the previewed parameters

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 10+
- Edge 16+
- Opera 47+

## License

This project is licensed under the MIT License — see the [LICENSE](../LICENSE) file for details.

## Author

URageTools — A collection of web-based creative tools for artists and developers

For more information about this tool or other projects in the URageTools collection, visit the [main repository](../README.md).