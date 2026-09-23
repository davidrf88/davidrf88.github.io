// Hole Designer: top-down editor for creating hole layouts.
// Place basket, tee, trees, bushes, OB zones. Download as JSON.

import { t } from './i18n.js';

export function createDesigner(canvas, onBack) {
    const ctx = canvas.getContext('2d');
    let running = false;

    // --- Camera (no rotation, axis-aligned top-down) ---
    let camX = 0;
    let camY = 40; // start looking at middle of a typical hole
    let camZoom = 1.8; // pixels per meter

    function fieldToScreen(fx, fy) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        return {
            sx: cx + (fx - camX) * camZoom,
            sy: cy - (fy - camY) * camZoom,
        };
    }

    function screenToField(sx, sy) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        return {
            fx: (sx - cx) / camZoom + camX,
            fy: -(sy - cy) / camZoom + camY,
        };
    }

    // --- Hole data ---
    let holeData = {
        hole: 1,
        name: 'HOLE 1',
        par: 3,
        basket: { x: 0, y: 80 },
        tee: { x: 0, y: 0, w: 2, h: 3 },
        trees: [],
        bushes: [],
        ob: [],
    };

    // --- Editor state ---
    const TOOLS = ['select', 'basket', 'tee', 'tree', 'bush', 'ob'];
    let activeTool = 'select';
    let selectedObj = null; // { type, index } or { type: 'basket' } or { type: 'tee' }
    let dragging = false;
    let dragOffset = { fx: 0, fy: 0 };
    let panning = false;
    let panStart = { sx: 0, sy: 0, camX: 0, camY: 0 };
    let resizing = false;
    let resizeHandle = null; // 'nw','ne','sw','se'
    let resizeStart = null;  // { fx, fy, origX, origY, origW, origH }

    // Pinch-to-zoom state
    let pinching = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 0;

    // --- Hit areas for toolbar & top bar ---
    let toolbarHitAreas = [];
    let backBtnArea = { x: 0, y: 0, w: 0, h: 0 };
    let dlBtnArea = { x: 0, y: 0, w: 0, h: 0 };
    let delBtnArea = { x: 0, y: 0, w: 0, h: 0 };
    let parUpArea = { x: 0, y: 0, w: 0, h: 0 };
    let parDownArea = { x: 0, y: 0, w: 0, h: 0 };
    let zoomInArea = { x: 0, y: 0, w: 0, h: 0 };
    let zoomOutArea = { x: 0, y: 0, w: 0, h: 0 };

    // --- Helpers ---
    function getObj(sel) {
        if (!sel) return null;
        if (sel.type === 'basket') return holeData.basket;
        if (sel.type === 'tee') return holeData.tee;
        if (sel.type === 'tree') return holeData.trees[sel.index];
        if (sel.type === 'bush') return holeData.bushes[sel.index];
        if (sel.type === 'ob') return holeData.ob[sel.index];
        return null;
    }

    function objHasSize(sel) {
        return sel && (sel.type === 'tee' || sel.type === 'tree' || sel.type === 'bush' || sel.type === 'ob');
    }

    function hitTest(fx, fy) {
        const GRAB = 3 / camZoom; // grab radius in meters

        // Basket (point)
        const b = holeData.basket;
        if (Math.abs(fx - b.x) < GRAB && Math.abs(fy - b.y) < GRAB)
            return { type: 'basket' };

        // Tee
        const te = holeData.tee;
        if (Math.abs(fx - te.x) < te.w / 2 + GRAB && Math.abs(fy - te.y) < te.h / 2 + GRAB)
            return { type: 'tee' };

        // OB (check first — largest areas, behind other items)
        for (let i = holeData.ob.length - 1; i >= 0; i--) {
            const o = holeData.ob[i];
            if (Math.abs(fx - o.x) < o.w / 2 + GRAB && Math.abs(fy - o.y) < o.h / 2 + GRAB)
                return { type: 'ob', index: i };
        }

        // Trees
        for (let i = holeData.trees.length - 1; i >= 0; i--) {
            const tr = holeData.trees[i];
            if (Math.abs(fx - tr.x) < tr.w / 2 + GRAB && Math.abs(fy - tr.y) < tr.h / 2 + GRAB)
                return { type: 'tree', index: i };
        }

        // Bushes
        for (let i = holeData.bushes.length - 1; i >= 0; i--) {
            const bu = holeData.bushes[i];
            if (Math.abs(fx - bu.x) < bu.w / 2 + GRAB && Math.abs(fy - bu.y) < bu.h / 2 + GRAB)
                return { type: 'bush', index: i };
        }

        return null;
    }

    // Check if pointer is on a resize handle of the selected object
    function hitResizeHandle(fx, fy) {
        if (!selectedObj || !objHasSize(selectedObj)) return null;
        const obj = getObj(selectedObj);
        if (!obj || obj.w === undefined) return null;
        const hw = obj.w / 2;
        const hh = obj.h / 2;
        const GRAB = 4 / camZoom;
        const corners = {
            nw: { fx: obj.x - hw, fy: obj.y + hh },
            ne: { fx: obj.x + hw, fy: obj.y + hh },
            sw: { fx: obj.x - hw, fy: obj.y - hh },
            se: { fx: obj.x + hw, fy: obj.y - hh },
        };
        for (const [key, c] of Object.entries(corners)) {
            if (Math.abs(fx - c.fx) < GRAB && Math.abs(fy - c.fy) < GRAB)
                return key;
        }
        return null;
    }

    function deleteSelected() {
        if (!selectedObj) return;
        const { type, index } = selectedObj;
        if (type === 'tree') holeData.trees.splice(index, 1);
        else if (type === 'bush') holeData.bushes.splice(index, 1);
        else if (type === 'ob') holeData.ob.splice(index, 1);
        // Can't delete basket or tee
        selectedObj = null;
    }

    function canDelete() {
        return selectedObj && selectedObj.type !== 'basket' && selectedObj.type !== 'tee';
    }

    // --- Place a new object ---
    function placeObject(fx, fy) {
        if (activeTool === 'basket') {
            holeData.basket.x = Math.round(fx * 2) / 2;
            holeData.basket.y = Math.round(fy * 2) / 2;
            activeTool = 'select';
        } else if (activeTool === 'tee') {
            holeData.tee.x = Math.round(fx * 2) / 2;
            holeData.tee.y = Math.round(fy * 2) / 2;
            activeTool = 'select';
        } else if (activeTool === 'tree') {
            holeData.trees.push({ x: Math.round(fx * 2) / 2, y: Math.round(fy * 2) / 2, w: 1.5, h: 1.5 });
            activeTool = 'select';
        } else if (activeTool === 'bush') {
            holeData.bushes.push({ x: Math.round(fx * 2) / 2, y: Math.round(fy * 2) / 2, w: 3, h: 2 });
            activeTool = 'select';
        } else if (activeTool === 'ob') {
            holeData.ob.push({ x: Math.round(fx * 2) / 2, y: Math.round(fy * 2) / 2, w: 15, h: 15 });
            activeTool = 'select';
        }
    }

    // --- Download JSON ---
    function downloadJSON() {
        const out = {
            hole: holeData.hole,
            name: holeData.name,
            par: holeData.par,
            basket: { x: holeData.basket.x, y: holeData.basket.y },
            tee: { x: holeData.tee.x, y: holeData.tee.y, w: holeData.tee.w, h: holeData.tee.h },
            trees: holeData.trees.map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
            bushes: holeData.bushes.map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
            ob: holeData.ob.map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
        };
        const json = JSON.stringify(out, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hole1.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Pointer events ---
    function onPointerDown(e) {
        if (pinching) return; // ignore during pinch-to-zoom

        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;

        // Check toolbar & top bar first (handled in pointerup)
        // But we need to know if we're in the canvas area for dragging
        const toolbarY = canvas.height - 70;
        const topBarH = 48;
        if (py < topBarH || py > toolbarY) return; // let pointerup handle buttons

        const { fx, fy } = screenToField(px, py);

        // If in place mode, place and return
        if (activeTool !== 'select') {
            placeObject(fx, fy);
            return;
        }

        // Check resize handles first
        const handle = hitResizeHandle(fx, fy);
        if (handle && selectedObj) {
            const obj = getObj(selectedObj);
            resizing = true;
            resizeHandle = handle;
            resizeStart = { fx, fy, origX: obj.x, origY: obj.y, origW: obj.w, origH: obj.h };
            return;
        }

        // Hit test objects
        const hit = hitTest(fx, fy);
        if (hit) {
            selectedObj = hit;
            const obj = getObj(hit);
            dragging = true;
            dragOffset = { fx: fx - obj.x, fy: fy - obj.y };
            return;
        }

        // No hit → deselect and start panning
        selectedObj = null;
        panning = true;
        panStart = { sx: px, sy: py, camX, camY };
    }

    function onPointerMove(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;
        const { fx, fy } = screenToField(px, py);

        if (resizing && resizeStart && selectedObj) {
            const obj = getObj(selectedObj);
            const dfx = fx - resizeStart.fx;
            const dfy = fy - resizeStart.fy;
            const MIN_SIZE = 1;

            // Resize based on which corner handle
            if (resizeHandle === 'ne' || resizeHandle === 'se') {
                obj.w = Math.max(MIN_SIZE, resizeStart.origW + dfx * 2);
            } else {
                obj.w = Math.max(MIN_SIZE, resizeStart.origW - dfx * 2);
            }
            if (resizeHandle === 'ne' || resizeHandle === 'nw') {
                obj.h = Math.max(MIN_SIZE, resizeStart.origH + dfy * 2);
            } else {
                obj.h = Math.max(MIN_SIZE, resizeStart.origH - dfy * 2);
            }
            return;
        }

        if (dragging && selectedObj) {
            const obj = getObj(selectedObj);
            obj.x = Math.round((fx - dragOffset.fx) * 2) / 2;
            obj.y = Math.round((fy - dragOffset.fy) * 2) / 2;
            return;
        }

        if (panning) {
            const dx = (px - panStart.sx) / camZoom;
            const dy = (py - panStart.sy) / camZoom;
            camX = panStart.camX - dx;
            camY = panStart.camY + dy;
        }
    }

    function onPointerUp(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;

        // Finalize drag/pan/resize
        dragging = false;
        panning = false;
        resizing = false;
        resizeHandle = null;
        resizeStart = null;

        // Back button
        if (px >= backBtnArea.x && px <= backBtnArea.x + backBtnArea.w &&
            py >= backBtnArea.y && py <= backBtnArea.y + backBtnArea.h) {
            onBack();
            return;
        }

        // Download button
        if (px >= dlBtnArea.x && px <= dlBtnArea.x + dlBtnArea.w &&
            py >= dlBtnArea.y && py <= dlBtnArea.y + dlBtnArea.h) {
            downloadJSON();
            return;
        }

        // Delete button
        if (canDelete() &&
            px >= delBtnArea.x && px <= delBtnArea.x + delBtnArea.w &&
            py >= delBtnArea.y && py <= delBtnArea.y + delBtnArea.h) {
            deleteSelected();
            return;
        }

        // Par buttons
        if (px >= parUpArea.x && px <= parUpArea.x + parUpArea.w &&
            py >= parUpArea.y && py <= parUpArea.y + parUpArea.h) {
            holeData.par = Math.min(7, holeData.par + 1);
            return;
        }
        if (px >= parDownArea.x && px <= parDownArea.x + parDownArea.w &&
            py >= parDownArea.y && py <= parDownArea.y + parDownArea.h) {
            holeData.par = Math.max(2, holeData.par - 1);
            return;
        }

        // Zoom buttons
        if (px >= zoomInArea.x && px <= zoomInArea.x + zoomInArea.w &&
            py >= zoomInArea.y && py <= zoomInArea.y + zoomInArea.h) {
            applyZoom(1.4);
            return;
        }
        if (px >= zoomOutArea.x && px <= zoomOutArea.x + zoomOutArea.w &&
            py >= zoomOutArea.y && py <= zoomOutArea.y + zoomOutArea.h) {
            applyZoom(1 / 1.4);
            return;
        }

        // Toolbar buttons
        for (const area of toolbarHitAreas) {
            if (px >= area.x && px <= area.x + area.w &&
                py >= area.y && py <= area.y + area.h) {
                if (activeTool === area.tool) {
                    activeTool = 'select'; // toggle off
                } else {
                    activeTool = area.tool;
                }
                selectedObj = null;
                return;
            }
        }
    }

    function onWheel(e) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        camZoom = Math.max(0.5, Math.min(8, camZoom * factor));
    }

    function getTouchDist(e) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            pinching = true;
            pinchStartDist = getTouchDist(e);
            pinchStartZoom = camZoom;
            // Cancel any ongoing drag/pan
            dragging = false;
            panning = false;
        }
    }

    function onTouchMove(e) {
        if (pinching && e.touches.length === 2) {
            e.preventDefault();
            const dist = getTouchDist(e);
            const ratio = dist / pinchStartDist;
            camZoom = Math.max(0.5, Math.min(8, pinchStartZoom * ratio));
        }
    }

    function onTouchEnd(e) {
        if (e.touches.length < 2) {
            pinching = false;
        }
    }

    function applyZoom(factor) {
        camZoom = Math.max(0.5, Math.min(8, camZoom * factor));
    }

    // --- Drawing ---
    function drawGrid() {
        const spacing = 10; // 10m grid
        const halfW = (canvas.width / 2) / camZoom;
        const halfH = (canvas.height / 2) / camZoom;
        const left = camX - halfW;
        const right = camX + halfW;
        const bottom = camY - halfH;
        const top = camY + halfH;

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;

        const startX = Math.floor(left / spacing) * spacing;
        for (let x = startX; x <= right; x += spacing) {
            const p0 = fieldToScreen(x, bottom);
            const p1 = fieldToScreen(x, top);
            ctx.beginPath();
            ctx.moveTo(p0.sx, p0.sy);
            ctx.lineTo(p1.sx, p1.sy);
            ctx.stroke();
        }
        const startY = Math.floor(bottom / spacing) * spacing;
        for (let y = startY; y <= top; y += spacing) {
            const p0 = fieldToScreen(left, y);
            const p1 = fieldToScreen(right, y);
            ctx.beginPath();
            ctx.moveTo(p0.sx, p0.sy);
            ctx.lineTo(p1.sx, p1.sy);
            ctx.stroke();
        }

        // Origin crosshair
        const o = fieldToScreen(0, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(o.sx - 20, o.sy);
        ctx.lineTo(o.sx + 20, o.sy);
        ctx.moveTo(o.sx, o.sy - 20);
        ctx.lineTo(o.sx, o.sy + 20);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawOBRect(o, isSelected) {
        const hw = o.w / 2, hh = o.h / 2;
        const tl = fieldToScreen(o.x - hw, o.y + hh);
        const br = fieldToScreen(o.x + hw, o.y - hh);
        const w = br.sx - tl.sx;
        const h = br.sy - tl.sy;

        ctx.fillStyle = 'rgba(40,80,200,0.25)';
        ctx.fillRect(tl.sx, tl.sy, w, h);
        ctx.strokeStyle = isSelected ? '#fff' : 'rgba(40,80,200,0.6)';
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.setLineDash(isSelected ? [] : [6, 4]);
        ctx.strokeRect(tl.sx, tl.sy, w, h);
        ctx.setLineDash([]);

        // Label
        const c = fieldToScreen(o.x, o.y);
        ctx.fillStyle = 'rgba(40,80,200,0.6)';
        ctx.font = `${Math.max(9, Math.min(12, camZoom * 6))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('O.B.', c.sx, c.sy + 4);
    }

    function drawTreeRect(tr, isSelected) {
        const { sx, sy } = fieldToScreen(tr.x, tr.y);
        const sw = tr.w * camZoom;
        const sh = tr.h * camZoom;

        ctx.fillStyle = 'rgba(90,60,30,0.85)';
        ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
        ctx.strokeStyle = isSelected ? '#fff' : 'rgba(60,40,15,0.9)';
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);
    }

    function drawBushEllipse(bu, isSelected) {
        const { sx, sy } = fieldToScreen(bu.x, bu.y);
        const rx = (bu.w / 2) * camZoom;
        const ry = (bu.h / 2) * camZoom;

        ctx.fillStyle = 'rgba(50,120,50,0.6)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#fff' : 'rgba(30,80,30,0.7)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.beginPath();
        ctx.ellipse(sx, sy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawTeePadRect(te, isSelected) {
        const { sx, sy } = fieldToScreen(te.x, te.y);
        const sw = te.w * camZoom;
        const sh = te.h * camZoom;

        ctx.fillStyle = 'rgba(180,175,160,0.6)';
        ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
        ctx.strokeStyle = isSelected ? '#fff' : 'rgba(140,135,120,0.7)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);

        // "TEE" label
        ctx.fillStyle = 'rgba(100,95,80,0.8)';
        ctx.font = `${Math.max(8, Math.min(11, camZoom * 5))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('TEE', sx, sy + 3);
    }

    function drawBasketIcon(bk, isSelected) {
        const { sx, sy } = fieldToScreen(bk.x, bk.y);
        const r = Math.max(6, camZoom * 2);

        // Outer ring
        ctx.strokeStyle = isSelected ? '#fff' : '#ff6644';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Inner dot
        ctx.fillStyle = '#ff6644';
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Pole
        ctx.strokeStyle = '#cc5533';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy + r);
        ctx.lineTo(sx, sy + r + Math.max(8, camZoom * 4));
        ctx.stroke();
    }

    function drawResizeHandles(obj) {
        if (!obj || obj.w === undefined) return;
        const hw = obj.w / 2;
        const hh = obj.h / 2;
        const corners = [
            fieldToScreen(obj.x - hw, obj.y + hh),
            fieldToScreen(obj.x + hw, obj.y + hh),
            fieldToScreen(obj.x - hw, obj.y - hh),
            fieldToScreen(obj.x + hw, obj.y - hh),
        ];
        for (const c of corners) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(c.sx - 4, c.sy - 4, 8, 8);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(c.sx - 4, c.sy - 4, 8, 8);
        }
    }

    function drawDistanceLabel() {
        const dx = holeData.basket.x - holeData.tee.x;
        const dy = holeData.basket.y - holeData.tee.y;
        const distM = Math.sqrt(dx * dx + dy * dy);
        const distFt = Math.round(distM * 3.281);

        // Draw dashed line from tee to basket
        const t0 = fieldToScreen(holeData.tee.x, holeData.tee.y);
        const t1 = fieldToScreen(holeData.basket.x, holeData.basket.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(t0.sx, t0.sy);
        ctx.lineTo(t1.sx, t1.sy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label at midpoint
        const mx = (t0.sx + t1.sx) / 2;
        const my = (t0.sy + t1.sy) / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${distFt}ft / ${Math.round(distM)}m`, mx, my - 6);
    }

    function drawTopBar() {
        const barH = 48;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, barH);

        // Back button
        const bbW = 60, bbH = 28, bbX = 8, bbY = 10;
        backBtnArea = { x: bbX, y: bbY, w: bbW, h: bbH };
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(bbX, bbY, bbW, bbH, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bbX, bbY, bbW, bbH, 5);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('back'), bbX + bbW / 2, bbY + bbH / 2 + 4);

        // Par display with +/- buttons
        const parCX = canvas.width / 2;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Par ${holeData.par}`, parCX, 30);

        // Par -
        const pdW = 22, pdH = 22;
        const pdX = parCX - 50, pdY = 14;
        parDownArea = { x: pdX, y: pdY, w: pdW, h: pdH };
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(pdX, pdY, pdW, pdH, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('−', pdX + pdW / 2, pdY + pdH / 2 + 5);

        // Par +
        const puX = parCX + 28, puY = 14;
        parUpArea = { x: puX, y: puY, w: pdW, h: pdH };
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(puX, puY, pdW, pdH, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('+', puX + pdW / 2, puY + pdH / 2 + 5);

        // Download button
        const dbW = 70, dbH = 28, dbX = canvas.width - dbW - 8, dbY = 10;
        dlBtnArea = { x: dbX, y: dbY, w: dbW, h: dbH };
        ctx.fillStyle = 'rgba(80,200,120,0.25)';
        ctx.beginPath();
        ctx.roundRect(dbX, dbY, dbW, dbH, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,200,120,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(dbX, dbY, dbW, dbH, 5);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('JSON ↓', dbX + dbW / 2, dbY + dbH / 2 + 4);
    }

    function drawToolbar() {
        const barH = 70;
        const barY = canvas.height - barH;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, barY, canvas.width, barH);

        toolbarHitAreas = [];

        const tools = [
            { tool: 'basket', label: '🎯', sub: 'Basket' },
            { tool: 'tee', label: '⬜', sub: 'Tee' },
            { tool: 'tree', label: '🌲', sub: 'Tree' },
            { tool: 'bush', label: '🌿', sub: 'Bush' },
            { tool: 'ob', label: '🟦', sub: 'O.B.' },
        ];

        const btnSize = 42;
        const gap = 8;
        const totalW = tools.length * btnSize + (tools.length - 1) * gap;
        let startX = (canvas.width - totalW) / 2;

        // Delete button (left side, only if selection can be deleted)
        if (canDelete()) {
            const delW = 50, delH = 30;
            const delX = 8, delY = barY + 20;
            delBtnArea = { x: delX, y: delY, w: delW, h: delH };
            ctx.fillStyle = 'rgba(220,60,60,0.3)';
            ctx.beginPath();
            ctx.roundRect(delX, delY, delW, delH, 5);
            ctx.fill();
            ctx.strokeStyle = 'rgba(220,60,60,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(delX, delY, delW, delH, 5);
            ctx.stroke();
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(t('delete_item'), delX + delW / 2, delY + delH / 2 + 4);
        } else {
            delBtnArea = { x: -100, y: -100, w: 0, h: 0 };
        }

        tools.forEach((item, i) => {
            const x = startX + i * (btnSize + gap);
            const y = barY + 6;
            const isActive = activeTool === item.tool;

            ctx.fillStyle = isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.roundRect(x, y, btnSize, btnSize, 6);
            ctx.fill();

            if (isActive) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(x, y, btnSize, btnSize, 6);
                ctx.stroke();
            }

            // Icon
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, x + btnSize / 2, y + 26);

            // Sub label
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '8px monospace';
            ctx.fillText(item.sub, x + btnSize / 2, y + btnSize + 10);

            toolbarHitAreas.push({ x, y, w: btnSize, h: btnSize + 14, tool: item.tool });
        });

        // Place mode hint
        if (activeTool !== 'select') {
            ctx.fillStyle = 'rgba(255,255,200,0.7)';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(t('tap_to_place'), canvas.width / 2, barY - 8);
        }
    }

    function drawZoomButtons() {
        const btnSize = 36;
        const gap = 6;
        const rightMargin = 10;
        const x = canvas.width - btnSize - rightMargin;
        // Position vertically centered between top bar and toolbar
        const midY = (48 + canvas.height - 70) / 2;
        const yPlus = midY - btnSize - gap / 2;
        const yMinus = midY + gap / 2;

        zoomInArea = { x, y: yPlus, w: btnSize, h: btnSize };
        zoomOutArea = { x, y: yMinus, w: btnSize, h: btnSize };

        // + button
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(x, yPlus, btnSize, btnSize, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, yPlus, btnSize, btnSize, 8);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('+', x + btnSize / 2, yPlus + btnSize / 2 + 7);

        // − button
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(x, yMinus, btnSize, btnSize, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, yMinus, btnSize, btnSize, 8);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('−', x + btnSize / 2, yMinus + btnSize / 2 + 7);
    }

    function draw() {
        if (!running) return;

        // Background
        ctx.fillStyle = '#2d7a3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawGrid();

        // Distance line from tee to basket
        drawDistanceLabel();

        // Draw objects
        // OB first (background)
        holeData.ob.forEach((o, i) => {
            drawOBRect(o, selectedObj && selectedObj.type === 'ob' && selectedObj.index === i);
        });

        // Tee pad
        drawTeePadRect(holeData.tee, selectedObj && selectedObj.type === 'tee');

        // Trees
        holeData.trees.forEach((tr, i) => {
            drawTreeRect(tr, selectedObj && selectedObj.type === 'tree' && selectedObj.index === i);
        });

        // Bushes
        holeData.bushes.forEach((bu, i) => {
            drawBushEllipse(bu, selectedObj && selectedObj.type === 'bush' && selectedObj.index === i);
        });

        // Basket
        drawBasketIcon(holeData.basket, selectedObj && selectedObj.type === 'basket');

        // Resize handles for selected
        if (selectedObj && objHasSize(selectedObj)) {
            drawResizeHandles(getObj(selectedObj));
        }

        // UI overlays
        drawTopBar();
        drawToolbar();
        drawZoomButtons();

        requestAnimationFrame(draw);
    }

    // --- Lifecycle ---
    function start() {
        running = true;
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);
        requestAnimationFrame(draw);
    }

    function stop() {
        running = false;
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
    }

    return { start, stop };
}
