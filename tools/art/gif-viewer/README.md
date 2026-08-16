# GIF Viewer

Complete fixed standalone version.

## Includes

- Play / pause
- Playback speed
- Pingpong
- Start/end markers
- Visual frame strip
- Mousewheel frame scrubbing
- Left/right arrow frame navigation
- Home/end marker jumps
- Download original GIF
- Download selected frames as `gif_frames.zip`
- Guarded dashboard loading so non-GIF image payloads are ignored
- Receives converted GIF resources from Media Converter through Dashboard Send Resource
- Chunked frame decoding with a memory-based frame cap
- Sampled timeline thumbnails for large GIFs to avoid browser lockups

## Browser

Use Chrome or Edge because this uses the built-in `ImageDecoder` API.

Large GIFs are decoded progressively and may be capped before the source frame count if the estimated bitmap memory would be too high for the browser session.


## Reverse Playback

Use the `Reverse` checkbox to play the selected marker range from end to start.

Behavior:

- Normal: `start → end → start`
- Reverse: `end → start → end`
- Reverse + Pingpong: starts backward, then bounces between markers


## GIF Export

`Download GIF` now exports a new animated GIF instead of the original source file.

It respects:

- selected start/end frame markers
- playback speed
- reverse state
- pingpong state

The encoder is dependency-free and uses a fixed 256-color palette for standalone offline use.


## Flip Frames

`Flip Frames` permanently reverses the currently loaded frame order instantly.

Unlike the old reverse playback toggle:
- playback direction remains normal
- exported GIFs use the flipped frame order directly
- speed export still works


## Mirror Frames

`Mirror Frames` duplicates the full current frame list in reverse order.

Modes:

- `Mirror After`: `0 1 2 3 3 2 1 0`
- `Mirror Before`: `3 2 1 0 0 1 2 3`

This changes the actual frame list, so playback and exported GIFs use the mirrored frames.

After `Flip Frames`, mirroring keeps the currently viewed frame selected, so `Mirror After` and `Mirror Before` continue from the flipped order instead of snapping back to the first frame.


## GIF Export Fix

Replaced the GIF encoder with a safer standalone encoder. Files may be larger, but should be valid animated GIFs.
