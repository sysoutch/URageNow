# Interactive Book Creator

Dashboard tool for assembling image, GIF, and video pages into a themed flip-book preview.

## Features

- Multiple books with editable title and description.
- Disk uploads, dashboard image pools, and recent generated images as page sources.
- Image plus optional text per page.
- Draggable Dashboard Media Tray with add-selected and add-all insertion flows.
- Direct dashboard asset loading that inserts generated images by URL without cloning them into large in-memory file payloads.
- Current Book Pages sidebar for renaming, reordering, inserting, and removing pages.
- Canvas flip-book preview with closed-cover, open-spread, and sealed-book states.

## Rendering Notes

- Pages are prerendered by content key so changed or reordered pages do not reuse stale canvases.
- Page-turn animations now snapshot all required canvases before the turn starts.
- The moving page uses a center-hinge projection so right pages travel to the left side and left pages travel to the right side instead of compressing and snapping.
- The moving sheet does not fall back to the opposite side image while a target page is loading.
- Clicked cover turns use a dedicated cover-frame renderer so only the active cover side widens from the closed book while the opposite side stays planted and the glued boundary leaf turns over it.
- Cover turns still use the shared center-hinge page deformation for the moving leaf, but the outer shell now has its own physically matched widening frame instead of piggybacking on the ordinary spread compositor.
- The active shell side now starts from the thin closed-book thickness rather than a half-open leaf width, so the first click frame does not begin oversized.
- That shell width now stays thin until the cover crosses the spine and only expands after the leaf has swapped sides; closing does the opposite, shrinking immediately and finishing once the leaf reaches the spine.
- Click-open now slides the closed book into its open-side slot before the cover starts turning; click-close performs the cover turn first and slides the closed book home afterward.
- Cover turns suppress the redundant static first/last spread side while the cover itself is folding, so those boundary pages are only rendered once.
- Closed front and back covers now draw the same slim yellow outer-border language as the open book, plus an explicit side rail on the outside edge matching the visible spine border on the closed-book artwork.
- The area inside that closed yellow frame is filled with the same red cover material instead of leaving a transparent gap around the page art.
- Closed-book idle presentation now sits slightly zoomed back until hover, then eases up to full scale before any click-open slide starts.
- Closed first/last cover rails now use the same gold trim language as the rest of the cover art, and the old bright vertical accent line was removed.
- The exposed interior side still waits until late in the cover turn before it scales in, so click-open and click-close do not flash a duplicate boundary spread early.
- Clicked cover turns now interpolate the whole book toward the real closed/open target offset during the fold instead of snapping the book position after the animation ends, and boundary turns hide the decorative page-edge rail while the glued cover sheet is moving.
- Open-book backing no longer paints a second spine shadow under the spread; the single center shadow is now clipped to full white-page height instead.
- Closed-book hover presentation now eases through a dedicated hover-progress value instead of snapping between zoom states, so front/back covers rest slightly farther away and glide in on hover.
- Closed-book hover presentation now drives the zoom-in directly on pointer enter/leave, while click-open no longer adds a separate extra pop before sliding into the spread slot.
- Right-clicking the closed book now performs a dedicated horizontal side flip between the front and back closed covers instead of opening the spread.
- Closed-book inspect mode can now be toggled from the canvas with `T` while hovered or from the icon-only inspect button under the closed book, and the closed-book footer button stays in sync during centered front/back and side-flip states.
- The live drag renderer for boundary turns now mirrors the same front/back page selection rules used by the click animation path, preventing the final sealed page from appearing early on the wrong side while closing from the end.
- A circular magnifier lens can now be toggled from the preview toolbar, sampling the live canvas into a proper zoomed glass overlay that tracks the pointer inside the book stage.

## Module Layout

- `script.js` is now a thin module entry that boots `js/main.js`.
- `js/core/context.js` owns DOM lookup, canvas sizing, constants, and shared state.
- `js/runtime/bookState.js` handles book data, dashboard media, tray actions, context menus, zoom/fullscreen, and export.
- `js/runtime/rendering.js` handles page prerendering, media overlays, and canvas drawing.
- `js/runtime/animation.js` handles page-flip planning, offsets, drag-release behavior, and animation timing.
- `js/runtime/events.js` wires DOM events and bootstraps the tool.
