# Frontend Implementation & Validation Rules

Visual similarity is **not** sufficient for task completion.

A frontend change is complete only when it is structurally correct, responsive, usable, scrollable, and visually faithful across supported viewport sizes. Do not optimize for a single screenshot at the expense of actual interface behavior. Screenshot similarity is a validation signal, not the definition of correctness.

## 1. Core principle

Treat frontend work as a **layout and interaction system**, not as an image-reproduction task.

Before chasing pixel-level differences, establish a correct structural layout using normal document flow, flexbox, grid, intrinsic sizing, responsive constraints, and the project's existing design system.

Do not patch visible symptoms while leaving the underlying layout problem unresolved.

When a visual discrepancy appears:

1. Identify the affected DOM element.
2. Inspect its computed styles.
3. Inspect its parent and containing block.
4. Identify which element owns sizing.
5. Identify which element owns scrolling.
6. Identify the relevant flex/grid constraints.
7. Identify the breakpoint or responsive rule involved.
8. Fix the smallest underlying rule that causes the problem.
9. Re-test all required viewports after the change.

Do not immediately add another override.

---

## 2. Never hide layout problems

Do not use any of the following merely to conceal a broken layout:

* `overflow: hidden` on page-level or major layout containers
* arbitrary fixed heights
* unnecessary `position: absolute`
* unnecessary `position: fixed`
* negative margins used to force alignment
* `transform: translate(...)` used to compensate for incorrect layout
* arbitrary `z-index` escalation
* hardcoded widths that only work at one viewport
* arbitrary pixel offsets
* excessive breakpoint-specific overrides
* `!important` unless required to override an external library
* hiding elements because they do not fit
* clipping content instead of fixing its container

These techniques are not forbidden when structurally appropriate. They are forbidden as substitutes for fixing the actual layout.

If one is required, ensure its use is intentional and does not create failures at other viewport sizes.

---

## 3. Prefer structural CSS

Prefer:

* normal document flow
* flexbox
* CSS Grid
* intrinsic sizing
* `min-width` / `max-width`
* `min-height` / `max-height`
* `minmax()`
* `clamp()`
* responsive wrapping
* appropriate `flex-grow`, `flex-shrink`, and `flex-basis`
* `min-width: 0` where flex/grid children need to shrink
* content-aware sizing
* existing project breakpoints
* existing spacing variables
* existing typography tokens
* existing design tokens
* existing reusable components

Prefer these over coordinate-based positioning and one-off compensating CSS.

Do not duplicate an existing layout system merely because adding a local CSS rule is faster.

---

## 4. Inspect before modifying CSS

Before making meaningful structural CSS changes, inspect:

1. The existing component hierarchy.
2. The relevant DOM structure.
3. The project's current layout system.
4. Parent and ancestor sizing constraints.
5. Which element owns horizontal sizing.
6. Which element owns vertical sizing.
7. Which element owns scrolling.
8. The relevant containing block.
9. Flex/grid properties affecting the element.
10. Existing responsive breakpoints.
11. Existing global styles.
12. Existing design-system primitives.
13. Any inherited styles affecting the element.
14. Any `overflow`, `position`, `transform`, or `z-index` rules on ancestors.

Do not assume the visible element itself is the source of the problem.

A child appearing too wide may be caused by its parent.

A scrolling problem may be caused several ancestors above the visible content.

An overlap may be caused by document flow, containing blocks, stacking contexts, or fixed heights rather than by the overlapping elements themselves.

Fix root causes, not visual symptoms.

---

## 5. Responsive requirements

After every meaningful structural UI change, test at minimum:

* **320px**
* **375px**
* **768px**
* **1024px**
* **1440px**

Do not assume that passing one desktop viewport and one mobile viewport means the layout is responsive.

The interface must behave correctly **between breakpoints**, not only at the exact widths where screenshots are captured.

Pay particular attention to widths immediately before and after breakpoint transitions.

A layout that works at 375px and 768px but breaks at 600px is not responsive.

---

## 6. Mobile is a separate layout problem

Do not create mobile by simply shrinking the desktop layout.

At mobile widths explicitly inspect:

* primary navigation
* secondary navigation
* content ordering
* page hierarchy
* typography
* text wrapping
* buttons
* form controls
* tables
* cards
* lists
* dialogs
* drawers
* popovers
* dropdowns
* sidebars
* toolbars
* fixed elements
* sticky elements
* spacing
* touch target sizes
* horizontal overflow
* vertical scrolling
* long labels
* long content
* empty states
* error states

If desktop structure cannot reasonably fit on mobile, restructure it.

Examples of legitimate responsive restructuring include:

* sidebar → drawer
* horizontal toolbar → wrapped or condensed toolbar
* multi-column layout → stacked layout
* large table → responsive table/card presentation
* inline controls → vertically stacked controls
* desktop navigation → mobile navigation

Do not preserve desktop geometry merely for screenshot similarity.

Mobile usability takes precedence over preserving a desktop arrangement that cannot reasonably fit.

---

## 7. Scrolling must have a clear owner

For every major page or panel, determine which element is supposed to scroll.

Avoid accidental nested scrolling.

Do not create multiple competing scroll containers unless the interface explicitly requires them.

Check:

* document scrolling
* panel scrolling
* modal scrolling
* sidebar scrolling
* table scrolling
* nested overflow containers
* sticky behavior inside scrolling containers

Do not solve overflow by disabling scrolling.

Do not use `overflow: hidden` merely to make scrollbars disappear.

Page content must remain reachable from top to bottom.

---

## 8. Automated layout validation

Before declaring a frontend task complete, use the browser and DOM inspection to validate actual layout behavior.

Do **not** infer these properties from screenshots alone.

Inspect DOM geometry, bounding boxes, computed styles, scroll dimensions, and viewport dimensions.

### Horizontal overflow

Check that:

```js
document.documentElement.scrollWidth <= window.innerWidth
```

unless horizontal scrolling is explicitly part of the design.

If this fails, find the offending element instead of globally hiding horizontal overflow.

### Overlap detection

Verify that visible:

* text
* buttons
* inputs
* navigation
* cards
* dialogs
* menus
* content regions
* toolbars
* headers
* footers

do not overlap unintentionally.

Use element bounding boxes when necessary.

Do not mark an overlap check as passed merely because the overlap is difficult to notice in a screenshot.

### Clipping

Verify that:

* interactive elements are not clipped
* text is not unintentionally clipped
* content is not hidden by incorrect parent height
* content is not hidden by incorrect overflow rules
* menus and dialogs remain accessible
* fixed/sticky elements do not cover important content

### Reachability

Every interactive element intended for the current state must remain reachable.

Check that important controls are not:

* outside the viewport
* underneath another element
* hidden behind fixed navigation
* clipped by a parent
* unreachable because scrolling stops prematurely

### Realistic content

Test realistic and adverse content cases where relevant:

* long titles
* long names
* long button labels
* multiple-line descriptions
* large data values
* empty states
* dense lists
* validation errors
* translated-length text where appropriate

Do not validate only against unusually convenient placeholder content.

### Navigation

Verify that navigation remains usable at mobile widths.

Check opening, closing, scrolling, focus, menu positioning, and whether content remains accessible after navigation is expanded.

### Overlays

Verify:

* modals
* dropdowns
* popovers
* tooltips
* drawers
* context menus

remain inside the usable viewport or intentionally scroll when necessary.

### Scrolling

Verify the page can be scrolled from its intended beginning to its intended end.

Ensure that:

* content is not trapped inside a non-scrollable container
* sticky elements behave correctly
* fixed elements do not obscure the final content
* nested scrolling does not make important content inaccessible

---

## 9. Programmatic verification beats visual guessing

Screenshots are useful for checking visual appearance.

They are **not sufficient** for proving layout correctness.

Where possible, programmatically inspect:

* `scrollWidth`
* `clientWidth`
* `scrollHeight`
* `clientHeight`
* `getBoundingClientRect()`
* computed `overflow`
* computed `position`
* computed dimensions
* viewport dimensions
* element intersections
* offscreen controls
* clipped elements

When the screenshot and DOM measurements disagree, investigate the DOM behavior rather than trusting visual intuition.

---

## 10. Structural validation comes before visual refinement

Do not begin detailed pixel matching until the structural layout passes validation.

Use this order:

### A. Structural differences

Fix:

* wrong layout model
* wrong content hierarchy
* incorrect column structure
* incorrect responsive behavior
* incorrect element ordering
* scrolling problems
* clipping
* overlap
* incorrect sizing ownership

### B. Spacing differences

Then fix:

* gaps
* padding
* margins
* alignment
* section spacing
* component density

### C. Typography differences

Then fix:

* font family
* font size
* line-height
* font weight
* letter spacing
* wrapping
* text hierarchy

### D. Decorative differences

Finally fix:

* colors
* borders
* shadows
* radii
* gradients
* icons
* subtle visual effects

Fix these categories in this order.

Do not sacrifice structural correctness or responsive behavior to improve screenshot similarity.

---

## 11. Reference images

When a reference screenshot or generated design image is available, use it to understand:

* visual hierarchy
* relative dimensions
* intended spacing
* composition
* typography
* visual weight
* component relationships

Do **not** interpret the screenshot as instructions to hardcode its coordinates.

A reference image represents the appearance of the interface at one state and viewport. The implementation must generalize beyond that image.

When matching a reference, distinguish between:

1. structural mismatch
2. sizing mismatch
3. spacing mismatch
4. typography mismatch
5. decorative mismatch

Never use absolute positioning merely because it makes one screenshot line up.

---

## 12. Minimize compensating overrides

When fixing CSS, prefer modifying the existing responsible rule rather than adding another rule later in the cascade.

Avoid patterns such as:

```css
.component {
  ...
}

.component {
  ...
}

@media (...) {
  .component {
    ...
  }
}

.some-page .component {
  ...
}

.some-page .container .component {
  ...
}
```

when the problem can instead be fixed in the original component or layout rule.

Before adding an override, ask:

* Why is the existing rule wrong?
* Can the original rule be corrected?
* Will this override create contradictory behavior elsewhere?
* Is the override compensating for a parent-level problem?

Do not accumulate CSS patches merely because each individual patch improves the current screenshot.

---

## 13. Regression discipline

After any meaningful structural change, re-check all required viewport sizes.

Do not assume a desktop fix is isolated from mobile.

Do not assume a mobile fix is isolated from tablet.

Do not assume changing one component cannot affect another component through:

* flex sizing
* grid sizing
* inherited styles
* wrapping
* viewport height
* stacking contexts
* overflow
* sticky positioning
* shared component rules

A fix that introduces a regression elsewhere is not a successful fix.

---

## 14. Do not stop at the first visually acceptable result

Continue iterating if any structural validation fails.

Do not report completion because:

* the desktop screenshot looks close
* the generated comparison image looks better
* the major visual differences are gone
* one viewport passes
* the page “looks good”

Visual quality is only one completion criterion.

---

## 15. Required final verification

Before reporting completion, perform a final validation pass at:

| Viewport | Horizontal overflow | Overlaps  | Clipped content | Page scroll | Navigation usable |
| -------- | ------------------- | --------- | --------------- | ----------- | ----------------- |
| 320px    | PASS/FAIL           | PASS/FAIL | PASS/FAIL       | PASS/FAIL   | PASS/FAIL         |
| 375px    | PASS/FAIL           | PASS/FAIL | PASS/FAIL       | PASS/FAIL   | PASS/FAIL         |
| 768px    | PASS/FAIL           | PASS/FAIL | PASS/FAIL       | PASS/FAIL   | PASS/FAIL         |
| 1024px   | PASS/FAIL           | PASS/FAIL | PASS/FAIL       | PASS/FAIL   | PASS/FAIL         |
| 1440px   | PASS/FAIL           | PASS/FAIL | PASS/FAIL       | PASS/FAIL   | PASS/FAIL         |

Do not mark a result as `PASS` based only on visual inspection.

Use DOM measurements and browser inspection.

If a row contains a failure, continue debugging before reporting task completion.

---

## 16. Completion gate

You are **NOT finished when the screenshot looks good**.

You are finished only when all relevant conditions are satisfied:

* reference fidelity is good
* structural layout is correct
* desktop works
* tablet works
* mobile works
* intermediate widths behave correctly
* horizontal overflow is intentional or absent
* vertical scrolling works
* scrolling ownership is correct
* content does not overlap unintentionally
* content is not clipped
* interactive controls are reachable
* navigation is usable
* dialogs and overlays are usable
* realistic content does not destroy the layout
* responsive restructuring is appropriate
* existing design-system conventions are respected
* unnecessary CSS overrides were not introduced
* automated layout checks pass
* regressions at other viewports were checked

If any validation fails, continue debugging before reporting completion.

**A visually convincing but structurally broken interface is a failed implementation.**
