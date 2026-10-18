# Task: Remove dead per-Studio generation queue renderers (*-bottom-queue-list) and the .studio-component-queue CSS, or restore a deliberate queue region (id=36)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-17T22:44:38.237Z
- **Tags:** UX

## Description

_No description._

## Comments (2)

> **rainer** — 2026-10-17T22:54:31.595Z
> Needs a product decision: should the Studios have a generation queue region again, or should it be removed for good?
> 
> Evidence:
> - d8d992c ("Integrate Studio workflows and tool resource API", no rationale in the message) removed all five per-Studio queue dock panels (image/model3d/audio/music/video *-bottom-queue-list). Each had a non-functional "Console" tab.
> - The client still renders into those missing containers: viewerHelpers.renderModel3dBottomQueue, audio uiHelpers, imageBottomDockHelpers, videoBottomDockHelpers, all via generationQueuePresenter.js. The .studio-component-queue and *-queue-* CSS in _media-docks.scss, _model3d.scss and _studio-workflow-components.scss is unused.
> - Checks still enforce the queue machinery: check-generation-queue-presenter (in check:studio-visual), check-image/video-bottom-dock-helpers, and the style architecture check requiring .audio-queue-list in _media-docks.scss.
> - memory-bank/studio-workflow-ux-plan.md and production-readiness-roadmap item 67 describe a stable queue region and a shared presenter.
> 
> Options:
> A) Restore a single shared queue region per Studio, without the fake Console tab, and wire it to the existing presenter (matches the UX plan).
> B) Remove the presenter, the four render call sites, the queue CSS and the three checks, and update the roadmap and UX plan to match.
> 
> Nothing was changed for this task.

> **rainer** — 2026-10-17T23:02:17.961Z
> Cause: d8d992c removed all five per-Studio queue dock panels without a rationale. The shared presenter, the render call sites and the queue CSS stayed, so the queue silently rendered nowhere.
> Solution: User chose option A. Commit 5e58763 restores one Generation Queue panel per Studio in its bottom dock: a heading in the dock header row (no fake Console tab), with the list as a role=status / aria-live=polite region the existing presenter renders into. Video moved from the sidebar to the dock for consistency, and the dead foldout special case is gone. The Audio/Music dock stacks at <=760px. The browser check asserts the queue contract again, and memory-bank/project-context.md documents the contract.
> Findings: Measured all five Studios at 1440/1024/768/375/320. Each queue renders its empty state inside its dock, with no overlap, no clipping and nothing covering it. The Image/3D/Video bottom docks are hidden at <=1024px by existing responsive rules, so their queues are hidden there and the status panel covers job state. Audio/Music phone layout is a pre-existing bug: the studio-workflow-layout grid resolves to "0px 280px", so the whole dock is 298px inside a 287px card, with or without the queue. check:dashboard and check:studio-visual pass.
> Todos: Audio/Music Studio phone layout: studio-workflow-layout resolves to 0px main + 280px side at <=375px, so the main column collapses and the bottom dock overflows the card

