# Generate Music

Generate music from prompt text, optional tags, and optional lyrics.

## Inputs
- Optional prompt text for style, mood, or lyrics.
- Optional `tags: ...` line.
- Optional duration in seconds or minutes.

## Behavior
- Parse `tags:` from prompt when present.
- Use remaining prompt text as lyric/style input.
- Clamp duration to a safe range.

## Output
- Return music file name and audio id.

