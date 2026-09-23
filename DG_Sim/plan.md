# Hole Designer Plan

## Overview
A new "Hole Designer" scene accessible from the main menu. It provides a top-down canvas editor where the user can place and move objects (basket, tee, trees, bushes, OB zones), then download the result as a `.json` file matching the hole format.

## UI Layout
- **Top bar**: BACK button (left), hole name/par controls (center), DOWNLOAD button (right)
- **Canvas area**: Top-down grid view of the field (no camera rotation — axis-aligned, Y=up). Pan by dragging background, pinch/scroll to zoom.
- **Bottom toolbar**: Object type selector buttons — Basket, Tee, Tree, Bush, OB. Tap one to enter "place mode", then tap the canvas to place it.

## Interaction Model
1. **Place mode**: Tap a toolbar button (e.g. Tree), then tap on the canvas to place it at that location. After placing, returns to select mode.
2. **Select mode** (default): Tap an existing object to select it. Selected object shows handles. Drag to move it.
3. **Delete**: When an object is selected, a DELETE button appears in the toolbar. Tap to remove it.
4. **Resize**: OB zones, bushes, and trees show corner drag handles to resize width/height.
5. **Basket & Tee**: Only one of each allowed. Placing a new one moves the existing one.

## State
- `holeData` object: `{ name, par, basket, tee, trees[], bushes[], ob[] }`
- Starts with defaults: basket at (0, 50), tee at (0, 0), empty arrays
- Each object stored as `{ x, y, w, h }` (basket has no w/h)

## Rendering
- Reuse renderer's drawing functions where possible (drawTree, drawBush, drawOB, drawTeePad)
- But use a simpler non-rotated camera (cameraAngle = 0) since this is a top-down editor
- Draw grid, all objects, selection highlight, and toolbar

## Download
- Build JSON matching hole1.json format
- Use `URL.createObjectURL` + hidden `<a>` element to trigger download
- Filename: `hole1.json`

## Files to modify/create
1. **js/i18n.js** — Add keys: `designer`, `designer_help`, `download`, `place_basket`, `place_tee`, `place_tree`, `place_bush`, `place_ob`, `delete_item`, `hole_name_label`, `par_label_edit`, `tap_to_place`
2. **js/menu.js** — Add 5th button for Hole Designer
3. **js/designer.js** — New file: the entire hole designer scene
4. **js/main.js** — Add `import { createDesigner }` + `launchDesigner()` + route `'designer'`

## designer.js Internals
- `createDesigner(canvas, onBack)` returns `{ start(), stop() }`
- Own camera state: `camX, camY, zoom` (no rotation)
- Own `fieldToScreen` / `screenToField` (simple axis-aligned)
- Pointer handling: `pointerdown` → check toolbar hits, check object hits (select/start drag), or place new object. `pointermove` → drag selected or pan camera. `pointerup` → finalize.
- `draw()` loop: clear with grid, draw all objects using ctx directly (simple rectangles/circles), draw toolbar, draw selection handles
- Download function: assemble JSON, create blob, trigger download
