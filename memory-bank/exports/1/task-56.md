# Task: Interaction polish: hover/pressed/focus states, radius token, view transitions (id=56)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Ideas + Nice to have (id=7)
- **Added:** 2026-10-18T14:52:05.124Z
- **Tags:** Visual, Animation

## Description

Cool-factor pass once the structural tasks land. (1) Every button computes border-radius 0 in the current profile because the Appearance tokens (--dashboard-*-radius) default to 0px; review the default appearance profile so cards/buttons/chips get a consistent radius scale (e.g. 6/10/14px) unless the user picks "square". (2) Define one hover (lift + border accent), pressed (scale .98) and focus-visible (2px accent ring) treatment for button, chip, card and rail item, and remove per-component variants (35 scattered focus-visible rules today). (3) Add a short view transition (opacity/translate 120–160ms) when switching studios, tools and bots tabs, gated by prefers-reduced-motion (37 reduced-motion blocks already exist). (4) Accent-tinted active states for rail categories so the current area reads at a glance in every theme.

## Comments (0)

_No comments._
