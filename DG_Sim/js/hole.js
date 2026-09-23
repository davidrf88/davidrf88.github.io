// Hole: play a disc golf hole with target basket.
// Reuses flight.js physics, throwUI, and renderer from the throwing lab.
// States: idle → disc-select → aiming → flying → landed → idle
//   When within 60ft: landed → putting-precision → putting-rings → putting-result
// After landing: shows remaining distance + Continue/Rethrow buttons.

import { DISCS } from './discs.js';
import { calculateFlight } from './flight.js';
import { createThrowUI } from './throwUI.js';
import { createRenderer } from './renderer.js';
import { t } from './i18n.js';
import { isForehand, setForehand, isLefty } from './settings.js';

// Default hole definition (used when no external data is provided)
const DEFAULT_HOLE = {
    name: 'HOLE 1',
    par: 3,
    basket: { x: -30.5, y: 97.5 },
    trees: [
        { x: -10, y: 45, w: 1.5, h: 1.5 },
    ],
    bushes: [
        { x: -18, y: 60, w: 3, h: 2 },
        { x: -5, y: 70, w: 2.5, h: 2 },
    ],
    ob: [
        { x: -45, y: 50, w: 20, h: 60 },
    ],
    tee: { x: 0, y: 0, w: 2, h: 3 },
};

export function createHole(canvas, onBack, holeData, onComplete) {
    const HOLE = holeData || DEFAULT_HOLE;
    const renderer = createRenderer(canvas);
    const throwUI = createThrowUI(canvas);

    let running = false;
    let state = 'idle'; // idle, disc-select, aiming, flying, landed, putting-precision, putting-rings, putting-result
    let selectedDisc = 0;
    let flightResult = null;
    let flightProgress = 0;
    let lastTimestamp = 0;
    let throwAnim = 0;
    let lastThrowParams = null;
    let throwCount = 0;

    // Current lie (player position) — starts at tee
    let playerPos = { x: HOLE.tee.x, y: HOLE.tee.y };
    // Previous lie for rethrow
    let prevPlayerPos = { x: HOLE.tee.x, y: HOLE.tee.y };

    // Disc select hit areas
    let discSelectHitAreas = [];

    // --- Direction aiming ---
    let throwAngleDeg = 0;
    let aimDragStartX = null;
    let aimDragStartAngle = 0;
    const DISC_BTN = { x: 0, y: 0, w: 100, h: 50 };
    const CANCEL_BTN = { x: 0, y: 0, w: 100, h: 50 };
    const BACK_BTN = { x: 0, y: 0, w: 100, h: 50 };
    const CONTINUE_BTN = { x: 0, y: 0, w: 120, h: 50 };
    const RETHROW_BTN = { x: 0, y: 0, w: 120, h: 50 };
    const EXPLORE_BTN = { x: 0, y: 0, w: 100, h: 50 };
    const EXPLORE_CANCEL_BTN = { x: 0, y: 0, w: 100, h: 50 };
    const GRIP_BTN = { x: 0, y: 0, w: 70, h: 44 };

    // --- Explore mode ---
    let exploring = false;
    let exploreDragStart = null; // { x, y, camX, camY }

    // --- Zoom slider ---
    const MIN_ZOOM = 45.7;  // default visible meters
    const MAX_ZOOM = 200;   // max zoom out
    let userZoom = MIN_ZOOM;
    let zoomDragging = false;
    const ZOOM_SLIDER = { x: 0, y: 0, w: 0, h: 0 }; // track area (recalculated each frame)

    // --- Putting minigame state ---
    const MAX_PUTT_DIST_M = 18.3; // 60 ft
    let puttDist = 0;

    // Precision bar
    let barPos = 0;
    let barDir = 1;
    const BAR_SPEED = 1.8;
    let barStopped = false;
    let barPrecision = 0;

    // Ring game
    let yellowAngle = 0;
    const YELLOW_SPEED = 3.5;
    let yellowStopping = false;
    let yellowStopForce = 0;
    let yellowCurrentSpeed = 0;
    let yellowRadius = 0;
    let yellowFrozen = false;
    let innerR = 0;
    let whiteR = 0;
    let ringCenterX = 0;
    let ringCenterY = 0;

    // Putting result
    let puttResultText = '';
    let puttResultColor = '';
    let isThrowIn = false;
    const PUTT_RETRY_BTN = { x: 0, y: 0, w: 120, h: 50 };

    // --- Tap detection ---
    let tapStart = null;
    const TAP_THRESHOLD = 15;
    const TAP_MAX_MS = 300;

    function hitTest(px, py, btn) {
        return px >= btn.x && px <= btn.x + btn.w &&
               py >= btn.y && py <= btn.y + btn.h;
    }

    function distToBasket(pos) {
        const dx = HOLE.basket.x - pos.x;
        const dy = HOLE.basket.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Auto-select disc based on distance to basket (in feet)
    function autoSelectDisc() {
        const distFt = distToBasket(playerPos) * 3.281;
        let targetCat;
        if (distFt <= 150) targetCat = 'putter';
        else if (distFt <= 260) targetCat = 'mid';
        else targetCat = 'distance';
        const idx = DISCS.findIndex(d => d.category === targetCat);
        if (idx >= 0) selectedDisc = idx;
    }

    // --- Pointer events ---
    function onPointerDown(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;

        // Zoom slider (available in idle, aiming, landed, and explore)
        if ((state === 'idle' || state === 'aiming' || state === 'landed' || exploring) && hitTestZoomSlider(px, py)) {
            zoomDragging = true;
            updateZoomFromPointer(py);
            return;
        }

        // Explore mode: cancel button or start pan drag
        if (exploring) {
            if (hitTest(px, py, EXPLORE_CANCEL_BTN)) {
                exploring = false;
                // Smoothly return camera to player
                camTarget = { x: playerPos.x, y: playerPos.y, zoom: userZoom, angle: camTarget.angle };
                // Reactivate throwUI if returning to aiming
                if (state === 'aiming') throwUI.activate();
                return;
            }
            // Start pan drag
            exploreDragStart = { x: e.clientX, y: e.clientY, camX: camTarget.x, camY: camTarget.y };
            return;
        }

        // BACK button
        if (state !== 'flying' && state !== 'disc-select' && onBack && hitTest(px, py, BACK_BTN)) {
            if (state === 'aiming') throwUI.deactivate();
            onBack();
            return;
        }

        // EXPLORE button (available in idle, aiming, and landed)
        if ((state === 'idle' || state === 'aiming' || state === 'landed') && hitTest(px, py, EXPLORE_BTN)) {
            if (state === 'aiming') throwUI.deactivate();
            exploring = true;
            // Zoom out to show full hole
            const dx = HOLE.basket.x - playerPos.x;
            const dy = HOLE.basket.y - playerPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const midX = (playerPos.x + HOLE.basket.x) / 2;
            const midY = (playerPos.y + HOLE.basket.y) / 2;
            const aspectRatio = canvas.width / canvas.height;
            const zoomX = (Math.abs(dx) + 20) / aspectRatio;
            const zoom = Math.max(45.7, dist + 20, zoomX);
            camTarget = { x: midX, y: midY, zoom, angle: camTarget.angle };
            return;
        }

        if (state === 'aiming') {
            if (hitTest(px, py, CANCEL_BTN)) {
                throwUI.deactivate();
                state = 'idle';
                return;
            }
            if (hitTest(px, py, DISC_BTN)) {
                throwUI.deactivate();
                state = 'disc-select';
                return;
            }
            if (hitTest(px, py, GRIP_BTN)) {
                setForehand(!isForehand());
                return;
            }
            if (!throwUI.isOverDisc(px, py)) {
                aimDragStartX = e.clientX;
                aimDragStartAngle = throwAngleDeg;
            }
            return;
        }

        if (state === 'idle') {
            if (hitTest(px, py, DISC_BTN)) {
                state = 'disc-select';
                return;
            }
            if (hitTest(px, py, GRIP_BTN)) {
                setForehand(!isForehand());
                return;
            }
            aimDragStartX = e.clientX;
            aimDragStartAngle = throwAngleDeg;
            return;
        }

        if (state === 'landed') {
            if (hitTest(px, py, CONTINUE_BTN)) {
                // Determine landing position
                const lastPt = flightResult.points[flightResult.points.length - 1];
                const landingWorld = { x: playerPos.x + lastPt.x, y: playerPos.y + lastPt.y };

                // Check OB
                if (isInOB(landingWorld.x, landingWorld.y)) {
                    // Penalty stroke
                    throwCount++;
                    // Move to last inbound position
                    const inbound = findLastInboundPosition(flightResult);
                    prevPlayerPos = { ...playerPos };
                    playerPos = { x: inbound.x, y: inbound.y };
                } else {
                    // Normal: move lie to landing spot
                    prevPlayerPos = { ...playerPos };
                    playerPos = { x: landingWorld.x, y: landingWorld.y };
                }

                flightResult = null;
                // Auto-aim toward basket
                const dx = HOLE.basket.x - playerPos.x;
                const dy = HOLE.basket.y - playerPos.y;
                throwAngleDeg = Math.atan2(dx, dy) * (180 / Math.PI);
                resetCamera();

                // If within 60ft, start putting minigame
                const dist = distToBasket(playerPos);
                if (dist <= MAX_PUTT_DIST_M) {
                    throwCount++;
                    startPutting();
                } else {
                    autoSelectDisc();
                    state = 'aiming';
                    throwUI.activate();
                }
                return;
            }
            if (hitTest(px, py, RETHROW_BTN)) {
                // Undo: go back to previous lie
                flightResult = null;
                throwCount--;
                resetCamera();
                state = 'idle';
                return;
            }
            return;
        }

        // Putting: precision bar tap
        if (state === 'putting-precision' && !barStopped) {
            barStopped = true;
            barPrecision = Math.abs(barPos - 0.5) * 2;
            setTimeout(() => {
                if (state === 'putting-precision') {
                    startRingGame();
                }
            }, 600);
            return;
        }

        // Putting: ring game tap
        if (state === 'putting-rings' && !yellowStopping && !yellowFrozen) {
            yellowStopping = true;
            const minStopTime = 0.3;
            const maxStopTime = 3.0;
            const stopTime = minStopTime + barPrecision * (maxStopTime - minStopTime);
            yellowStopForce = yellowCurrentSpeed / stopTime;
            return;
        }

        // Putting: result
        if (state === 'putting-result') {
            if (hitTest(px, py, PUTT_RETRY_BTN)) {
                if (puttResultText === 'made_it') {
                    if (onComplete) {
                        onComplete(throwCount);
                    } else {
                        onBack();
                    }
                } else {
                    // Putt again from new distance
                    throwCount++;
                    puttDist = nextPuttDist;
                    barPos = 0;
                    barDir = 1;
                    barStopped = false;
                    barPrecision = 0;
                    state = 'putting-precision';
                }
                return;
            }
        }

        tapStart = { x: e.clientX, y: e.clientY, time: performance.now() };
    }

    function onPointerMove(e) {
        // Zoom slider drag
        if (zoomDragging) {
            const rect = canvas.getBoundingClientRect();
            const sy = canvas.height / rect.height;
            updateZoomFromPointer((e.clientY - rect.top) * sy);
            return;
        }

        // Explore pan
        if (exploring && exploreDragStart) {
            const rect = canvas.getBoundingClientRect();
            const cssScale = canvas.width / rect.width;
            const scale = canvas.height / camCurrent.zoom;
            const dx = (e.clientX - exploreDragStart.x) * cssScale;
            const dy = (e.clientY - exploreDragStart.y) * cssScale;
            camTarget.x = exploreDragStart.camX - dx / scale;
            camTarget.y = exploreDragStart.camY + dy / scale; // Y is flipped
            camCurrent.x = camTarget.x;
            camCurrent.y = camTarget.y;
            applyCamera();
            return;
        }

        if ((state === 'idle' || state === 'aiming') && aimDragStartX !== null) {
            const dx = e.clientX - aimDragStartX;
            throwAngleDeg = aimDragStartAngle + dx * 0.3;
        }
    }

    function onPointerUp(e) {
        if (zoomDragging) {
            zoomDragging = false;
            return;
        }

        if (exploring) {
            exploreDragStart = null;
            return;
        }

        if (state === 'idle' || state === 'aiming') {
            aimDragStartX = null;
            if (state === 'idle') return;
        }

        if (!tapStart) return;
        if (state === 'aiming') { tapStart = null; return; }

        const dx = e.clientX - tapStart.x;
        const dy = e.clientY - tapStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const elapsed = performance.now() - tapStart.time;
        tapStart = null;

        if (dist > TAP_THRESHOLD || elapsed > TAP_MAX_MS) return;

        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const tx = (e.clientX - rect.left) * sx;
        const ty = (e.clientY - rect.top) * sy;
        handleTap(tx, ty);
    }

    function handleTap(tx, ty) {
        if (state === 'disc-select') {
            for (const area of discSelectHitAreas) {
                if (tx >= area.x && tx <= area.x + area.w &&
                    ty >= area.y && ty <= area.y + area.h) {
                    selectedDisc = area.index;
                    state = 'aiming';
                    throwUI.activate();
                    return;
                }
            }
        }
    }

    // --- Camera ---
    let camCurrent = { x: 0, y: 0, zoom: 45.7, angle: 0 };
    let camTarget = { x: 0, y: 0, zoom: 45.7, angle: 0 };
    const CAM_LERP = 0.04;

    function resetCamera() {
        // Center on player at user's zoom level, rotated so basket is up
        const dx = HOLE.basket.x - playerPos.x;
        const dy = HOLE.basket.y - playerPos.y;
        const angle = Math.atan2(dx, dy);
        camTarget = { x: playerPos.x, y: playerPos.y, zoom: userZoom, angle };
        camCurrent = { ...camTarget };
        applyCamera();
    }

    function updateCamera() {
        camCurrent.x += (camTarget.x - camCurrent.x) * CAM_LERP;
        camCurrent.y += (camTarget.y - camCurrent.y) * CAM_LERP;
        camCurrent.zoom += (camTarget.zoom - camCurrent.zoom) * CAM_LERP;
        camCurrent.angle += (camTarget.angle - camCurrent.angle) * CAM_LERP;
        applyCamera();
    }

    function applyCamera() {
        renderer.setCamera(camCurrent.x, camCurrent.y);
        renderer.setVisibleMeters(camCurrent.zoom);
        renderer.setCameraAngle(camCurrent.angle);
    }

    function zoomToFitAll(extraPoint) {
        // Fit player, basket, and optionally an extra point (disc in flight)
        const points = [playerPos, HOLE.basket];
        if (extraPoint) points.push(extraPoint);

        // Work in rotated frame (matches screen orientation)
        const angle = camTarget.angle;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        let minRx = Infinity, maxRx = -Infinity;
        let minRy = Infinity, maxRy = -Infinity;
        for (const p of points) {
            const rx = p.x * cosA - p.y * sinA;
            const ry = p.x * sinA + p.y * cosA;
            if (rx < minRx) minRx = rx;
            if (rx > maxRx) maxRx = rx;
            if (ry < minRy) minRy = ry;
            if (ry > maxRy) maxRy = ry;
        }

        // Padding
        const pad = 10;
        minRx -= pad; maxRx += pad;
        minRy -= pad; maxRy += pad;

        // Screen center is at 85% from top, so 85% room above and 15% below.
        // Place camera center so both ends fit proportionally:
        // centerRy = 0.15 * maxRy + 0.85 * minRy
        const centerRy = 0.15 * maxRy + 0.85 * minRy;
        const centerRx = (minRx + maxRx) / 2;

        // Convert rotated center back to field space
        const invCos = Math.cos(-angle);
        const invSin = Math.sin(-angle);
        const camFieldX = centerRx * invCos - centerRy * invSin;
        const camFieldY = centerRx * invSin + centerRy * invCos;

        // Zoom: compute visible meters needed for each axis
        const zoomVertical = (maxRy - centerRy) / 0.85;
        const zoomHorizontal = (maxRx - minRx) / (canvas.width / canvas.height);
        const zoom = Math.max(45.7, zoomVertical, zoomHorizontal);

        camTarget = {
            x: camFieldX,
            y: camFieldY,
            zoom,
            angle: camTarget.angle,
        };
    }

    // --- Drawing helpers ---
    function drawButton(btn, label, color) {
        const ctx = renderer.ctx;
        const { x, y, w, h } = btn;
        ctx.fillStyle = `rgba(${color},0.3)`;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 12);
        ctx.fill();
        ctx.strokeStyle = `rgba(${color},0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 12);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + w / 2, y + h / 2 + 8);
    }

    function drawBackButton() {
        BACK_BTN.x = 16;
        BACK_BTN.y = 16;
        BACK_BTN.w = 100;
        BACK_BTN.h = 50;
        drawButton(BACK_BTN, t('back'), '255,255,255');
    }

    function drawBasket(bx, by) {
        const { sx, sy } = renderer.fieldToScreen(bx, by);
        const ctx = renderer.ctx;

        // Pole
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - 14);
        ctx.stroke();

        // Basket cage (chains)
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - 8, sy - 14);
        ctx.lineTo(sx, sy - 8);
        ctx.lineTo(sx + 8, sy - 14);
        ctx.stroke();

        // Top cap
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 10, sy - 14);
        ctx.lineTo(sx + 10, sy - 14);
        ctx.stroke();

        // Band/tray
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - 7, sy - 4);
        ctx.lineTo(sx + 7, sy - 4);
        ctx.stroke();
    }

    function drawHoleInfo() {
        const ctx = renderer.ctx;
        const remaining = distToBasket(playerPos);
        const remainFt = Math.round(remaining * 3.281);

        // Hole name + par + distance to basket
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(canvas.width - 180, 6, 174, 60);
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${(HOLE.name || t('hole_name'))}  ${t('par')} ${HOLE.par}`, canvas.width - 16, 30);
        ctx.font = '16px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`${Math.round(remaining)}m / ${remainFt}ft ${t('to_pin')}`, canvas.width - 16, 52);
    }

    function drawThrowCount() {
        const ctx = renderer.ctx;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '18px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${t('throw_label')} ${throwCount}`, canvas.width - 16, 82);
    }

    function drawDebugInfo() {
        if (!lastThrowParams) return;
        const ctx = renderer.ctx;
        const disc = DISCS[selectedDisc];
        const p = lastThrowParams;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(4, canvas.height - 118, 160, 114);
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        const x = 10;
        let ly = canvas.height - 102;
        const line = (label, val) => {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(label, x, ly);
            ctx.fillStyle = '#fff';
            ctx.fillText(val, x + 70, ly);
            ly += 14;
        };
        line(t('debug_disc'), disc.name);
        line(t('hand_label'), isLefty() ? t('lefty') : t('righty'));
        line(t('grip_label'), isForehand() ? t('forehand') : t('backhand'));
        line(t('debug_power'), `${(p.power * 100).toFixed(0)}%`);
        line(t('debug_hyzer'), p.hyzer < -0.01 ? `H ${(-p.hyzer * 100).toFixed(0)}%` :
                       p.hyzer > 0.01 ? `A ${(p.hyzer * 100).toFixed(0)}%` : t('debug_flat'));
        line(t('debug_angle'), `${p.angleDeg >= 0 ? '+' : ''}${p.angleDeg.toFixed(1)}°`);
        const lastPt = flightResult.points[flightResult.points.length - 1];
        const straight = Math.sqrt(lastPt.x * lastPt.x + lastPt.y * lastPt.y);
        line(t('debug_dist'), `${Math.round(straight)}m / ${Math.round(straight * 3.281)}ft`);
        ctx.restore();
    }

    function drawFlightDebug(idx) {
        if (!flightResult || !flightResult.meta) return;
        const m = flightResult.meta[Math.min(idx, flightResult.meta.length - 1)];
        const ctx = renderer.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(4, 4, 170, 66);
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        const x = 10;
        let ly = 18;
        const line = (label, val) => {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(label, x, ly);
            ctx.fillStyle = '#fff';
            ctx.fillText(val, x + 60, ly);
            ly += 14;
        };
        line(t('debug_phase'), m.phase);
        line(t('debug_speed'), `${(m.speed * 100).toFixed(0)}%`);
        line(t('debug_angle'), `${m.angle >= 0 ? '+' : ''}${m.angle.toFixed(1)}°`);
        let maxY = 0;
        const limit = Math.min(idx, flightResult.points.length - 1);
        for (let j = 0; j <= limit; j++) {
            if (flightResult.points[j].y > maxY) maxY = flightResult.points[j].y;
        }
        line(t('debug_maxfwd'), `${Math.round(maxY)}m / ${Math.round(maxY * 3.281)}ft`);
        ctx.restore();
    }

    function drawDiscButton() {
        const btnW = 100;
        const btnH = 50;
        const btnX = 16;
        const btnY = canvas.height * 0.78;
        DISC_BTN.x = btnX;
        DISC_BTN.y = btnY;
        DISC_BTN.w = btnW;
        DISC_BTN.h = btnH;
        drawButton(DISC_BTN, t('disc'), '80,200,80');

        const ctx = renderer.ctx;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('drag_to_aim'), canvas.width / 2, canvas.height * 0.65);
    }

    function drawAimingUI() {
        const ctx = renderer.ctx;
        const disc = DISCS[selectedDisc];
        const nums = disc.numbers || [disc.speed, disc.glide, disc.turn, disc.fade];

        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(disc.name, canvas.width / 2, 30);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '18px monospace';
        ctx.fillText(
            `${nums[0]} / ${nums[1]} / ${nums[2]} / ${nums[3]}`,
            canvas.width / 2, 54
        );

        drawDiscButton();

        const btnW = 100;
        const btnH = 50;
        const btnX = canvas.width - btnW - 16;
        const btnY = canvas.height * 0.78;
        CANCEL_BTN.x = btnX;
        CANCEL_BTN.y = btnY;
        CANCEL_BTN.w = btnW;
        CANCEL_BTN.h = btnH;
        drawButton(CANCEL_BTN, t('cancel'), '200,80,80');
    }

    function drawLandedUI() {
        const ctx = renderer.ctx;
        const lastPt = flightResult.points[flightResult.points.length - 1];
        const landingWorld = { x: playerPos.x + lastPt.x, y: playerPos.y + lastPt.y };
        const remaining = distToBasket(landingWorld);
        const remainFt = Math.round(remaining * 3.281);
        const landedInOB = isInOB(landingWorld.x, landingWorld.y);

        // OB warning
        if (landedInOB) {
            ctx.fillStyle = 'rgba(40,80,200,0.7)';
            ctx.font = 'bold 22px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(t('ob_warning'), canvas.width / 2, canvas.height * 0.50);
        }

        // Remaining distance label
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(canvas.width / 2 - 120, canvas.height * 0.55, 240, 36);
        ctx.fillStyle = landedInOB ? '#6699ff' : '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(remaining)}m / ${remainFt}ft ${t('remaining')}`, canvas.width / 2, canvas.height * 0.55 + 26);

        // Continue button (left)
        const btnW = 120;
        const btnH = 50;
        const gap = 16;
        const totalW = btnW * 2 + gap;
        const startX = (canvas.width - totalW) / 2;
        const btnY = canvas.height * 0.78;

        CONTINUE_BTN.x = startX;
        CONTINUE_BTN.y = btnY;
        CONTINUE_BTN.w = btnW;
        CONTINUE_BTN.h = btnH;
        drawButton(CONTINUE_BTN, t('continue_btn'), '80,200,80');

        // Rethrow button (right)
        RETHROW_BTN.x = startX + btnW + gap;
        RETHROW_BTN.y = btnY;
        RETHROW_BTN.w = btnW;
        RETHROW_BTN.h = btnH;
        drawButton(RETHROW_BTN, t('rethrow'), '200,160,60');
    }

    function hitTestZoomSlider(px, py) {
        // Wider hit area than visual for easy touch
        const hitPad = 16;
        return px >= ZOOM_SLIDER.x - hitPad && px <= ZOOM_SLIDER.x + ZOOM_SLIDER.w + hitPad &&
               py >= ZOOM_SLIDER.y - hitPad && py <= ZOOM_SLIDER.y + ZOOM_SLIDER.h + hitPad;
    }

    function updateZoomFromPointer(py) {
        // Map pointer Y to zoom: top of slider = max zoom, bottom = min zoom
        const t = Math.max(0, Math.min(1, (py - ZOOM_SLIDER.y) / ZOOM_SLIDER.h));
        // t=0 is top (zoomed out), t=1 is bottom (zoomed in / default)
        userZoom = MIN_ZOOM + (1 - t) * (MAX_ZOOM - MIN_ZOOM);
        // Apply zoom, keep camera on player
        camTarget.zoom = userZoom;
        if (!exploring) {
            camTarget.x = playerPos.x;
            camTarget.y = playerPos.y;
        }
        camCurrent.zoom = userZoom;
        applyCamera();
    }

    function drawZoomSlider() {
        const ctx = renderer.ctx;
        const sliderW = 6;
        const sliderH = canvas.height * 0.35;
        const sliderX = canvas.width - 24;
        const sliderY = canvas.height * 0.25;

        // Update hit area
        ZOOM_SLIDER.x = sliderX;
        ZOOM_SLIDER.y = sliderY;
        ZOOM_SLIDER.w = sliderW;
        ZOOM_SLIDER.h = sliderH;

        // Track background
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(sliderX, sliderY, sliderW, sliderH, 3);
        ctx.fill();

        // Thumb position: map userZoom to slider position
        const t = 1 - (userZoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
        const thumbY = sliderY + t * sliderH;
        const thumbR = 10;

        // Thumb
        ctx.fillStyle = zoomDragging ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(sliderX + sliderW / 2, thumbY, thumbR, 0, Math.PI * 2);
        ctx.fill();

        // + / - labels
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('−', sliderX + sliderW / 2, sliderY - 8);
        ctx.fillText('+', sliderX + sliderW / 2, sliderY + sliderH + 16);
    }

    function drawGripButton() {
        const btnW = 70;
        const btnH = 44;
        const btnX = 16;
        const btnY = canvas.height * 0.78 + 58; // below the DISC button
        GRIP_BTN.x = btnX;
        GRIP_BTN.y = btnY;
        GRIP_BTN.w = btnW;
        GRIP_BTN.h = btnH;
        const label = isForehand() ? t('forehand') : t('backhand');
        const color = isForehand() ? '220,160,80' : '120,180,220';
        drawButton(GRIP_BTN, label, color);
    }

    function drawExploreButton() {
        const btnW = 100;
        const btnH = 50;
        const btnX = (canvas.width - btnW) / 2;
        const btnY = canvas.height - btnH - 16;
        EXPLORE_BTN.x = btnX;
        EXPLORE_BTN.y = btnY;
        EXPLORE_BTN.w = btnW;
        EXPLORE_BTN.h = btnH;
        drawButton(EXPLORE_BTN, t('explore'), '160,160,220');
    }

    function drawExploreCancelButton() {
        const btnW = 100;
        const btnH = 50;
        const btnX = (canvas.width - btnW) / 2;
        const btnY = canvas.height - btnH - 16;
        EXPLORE_CANCEL_BTN.x = btnX;
        EXPLORE_CANCEL_BTN.y = btnY;
        EXPLORE_CANCEL_BTN.w = btnW;
        EXPLORE_CANCEL_BTN.h = btnH;
        drawButton(EXPLORE_CANCEL_BTN, t('cancel'), '200,80,80');
    }

    // --- Putting minigame drawing ---
    function computeRingSizes() {
        ringCenterX = canvas.width / 2;
        ringCenterY = canvas.height * 0.45;
        innerR = canvas.width * 0.06;
        const closeness = 1 - (puttDist / MAX_PUTT_DIST_M);
        const whiteMin = innerR * 1.3;
        const whiteMax = innerR * 3.5;
        whiteR = whiteMin + closeness * (whiteMax - whiteMin);
    }

    function getYellowMinMax() {
        const minR = innerR * 0.5;
        const maxR = whiteR * 1.8;
        return { minR, maxR };
    }

    function drawPrecisionBar() {
        const ctx = renderer.ctx;
        const barW = 20;
        const barH = canvas.height * 0.5;
        const barX = canvas.width / 2 - barW / 2;
        const barY = canvas.height * 0.2;

        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 6);
        ctx.fill();

        const sweetH = barH * 0.08;
        const sweetY = barY + barH * 0.5 - sweetH / 2;
        ctx.fillStyle = 'rgba(80,220,80,0.3)';
        ctx.fillRect(barX, sweetY, barW, sweetH);

        const zones = [
            { frac: 0.15, color: 'rgba(80,220,80,0.15)' },
            { frac: 0.30, color: 'rgba(220,220,80,0.10)' },
        ];
        for (const z of zones) {
            const zH = barH * z.frac;
            ctx.fillStyle = z.color;
            ctx.fillRect(barX, barY + barH * 0.5 - zH, barW, zH * 2);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 6);
        ctx.stroke();

        const indicatorY = barY + barPos * barH;
        const indicatorH = 6;
        const indicatorColor = barStopped
            ? (barPrecision < 0.1 ? '#44ff44' : barPrecision < 0.3 ? '#ffff44' : '#ff8844')
            : '#fff';
        ctx.fillStyle = indicatorColor;
        ctx.beginPath();
        ctx.roundRect(barX - 4, indicatorY - indicatorH / 2, barW + 8, indicatorH, 3);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('tap'), canvas.width / 2, barY - 18);
        ctx.font = '13px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(t('precision_help'), canvas.width / 2, barY - 4);

        if (barStopped) {
            const pctText = Math.round((1 - barPrecision) * 100) + '%';
            ctx.fillStyle = indicatorColor;
            ctx.font = 'bold 16px monospace';
            ctx.fillText(pctText, canvas.width / 2, barY + barH + 28);
        }
    }

    function drawPuttRings() {
        const ctx = renderer.ctx;
        computeRingSizes();
        const cx = ringCenterX;
        const cy = ringCenterY;

        // Yellow ring
        ctx.strokeStyle = 'rgba(255,220,40,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, yellowRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,220,40,0.08)';
        ctx.beginPath();
        ctx.arc(cx, cy, yellowRadius, 0, Math.PI * 2);
        ctx.fill();

        // White ring
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, whiteR, 0, Math.PI * 2);
        ctx.stroke();

        // Green ring (basket)
        ctx.strokeStyle = 'rgba(80,220,80,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(80,220,80,0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fill();

        // Center dot
        ctx.fillStyle = 'rgba(80,220,80,0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        // Precision & stop time
        const pct = Math.round((1 - barPrecision) * 100);
        const precColor = barPrecision < 0.1 ? '#44ff44' : barPrecision < 0.3 ? '#ffff44' : '#ff8844';
        const minStopTime = 0.3;
        const maxStopTime = 3.0;
        const stopTimeSec = minStopTime + barPrecision * (maxStopTime - minStopTime);
        ctx.textAlign = 'center';
        ctx.fillStyle = precColor;
        ctx.font = 'bold 15px monospace';
        ctx.fillText(`${pct}%`, cx, cy - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '12px monospace';
        ctx.fillText(`${stopTimeSec.toFixed(1)}s ${t('stop_suffix')}`, cx, cy + 10);

        // Tap label
        if (!yellowStopping && !yellowFrozen) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(t('tap'), cx, cy + whiteR * 1.8 + 16);
            ctx.font = '13px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(t('rings_help'), cx, cy + whiteR * 1.8 + 32);
        }
    }

    function drawPuttHUD() {
        const ctx = renderer.ctx;
        const distFt = Math.round(puttDist * 3.281);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(canvas.width - 170, 6, 164, 60);
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.round(puttDist)}m / ${distFt}ft`, canvas.width - 16, 30);
        const pct = Math.round((1 - barPrecision) * 100);
        const precColor = barPrecision < 0.1 ? '#44ff44' : barPrecision < 0.3 ? '#ffff44' : '#ff8844';
        ctx.fillStyle = precColor;
        ctx.font = '16px monospace';
        ctx.fillText(`${t('precision_label')} ${pct}%`, canvas.width - 16, 52);
    }

    function drawPuttResult() {
        const ctx = renderer.ctx;
        const cx = canvas.width / 2;
        const made = puttResultText === 'made_it';

        if (made) {
            // Vertical center for text layout
            const textCY = canvas.height * 0.40;

            if (!isThrowIn) {
                // Show final ring positions (only for putts, not throw-ins)
                drawPuttRings();
            }

            // Holed out / throw-in text
            ctx.fillStyle = '#44ff44';
            ctx.font = 'bold 28px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(isThrowIn ? t('throw_in') : t('holed_out'), cx, textCY);

            // Score relative to par
            const score = throwCount;
            const diff = score - HOLE.par;
            let scoreLabel = `${score} (`;
            if (diff === 0) scoreLabel += `${t('par')})`;
            else if (diff === -1) scoreLabel += `${t('birdie')})`;
            else if (diff === -2) scoreLabel += `${t('eagle')})`;
            else if (diff === -3) scoreLabel += `${t('albatross')})`;
            else if (diff === 1) scoreLabel += `${t('bogey')})`;
            else if (diff === 2) scoreLabel += `${t('double_bogey')})`;
            else if (diff > 0) scoreLabel += `+${diff})`;
            else scoreLabel += `${diff})`;

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px monospace';
            ctx.fillText(scoreLabel, cx, textCY + 40);

            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '13px monospace';
            ctx.fillText(`${(HOLE.name || t('hole_name'))}  ${t('par')} ${HOLE.par}`, cx, textCY + 62);

            // Back to menu button
            const btnW = 120;
            const btnH = 50;
            PUTT_RETRY_BTN.x = (canvas.width - btnW) / 2;
            PUTT_RETRY_BTN.y = canvas.height * 0.82;
            PUTT_RETRY_BTN.w = btnW;
            PUTT_RETRY_BTN.h = btnH;
            drawButton(PUTT_RETRY_BTN, onComplete ? t('next_hole') : t('menu'), '80,200,80');
        } else {
            // Missed putt
            drawPuttRings();

            ctx.fillStyle = puttResultColor;
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(t(puttResultText), cx, ringCenterY + whiteR * 1.8 + 20);

            const distFt = Math.round(puttDist * 3.281);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '16px monospace';
            ctx.fillText(`${Math.round(puttDist)}m / ${distFt}ft ${t('putt_suffix')}`, cx, ringCenterY + whiteR * 1.8 + 44);

            // Show next putt distance
            const nextFt = Math.round(nextPuttDist * 3.281);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(`${t('next_label')} ${Math.round(nextPuttDist * 10) / 10}m / ${nextFt}ft`, cx, ringCenterY + whiteR * 1.8 + 60);

            const btnW = 120;
            const btnH = 50;
            PUTT_RETRY_BTN.x = (canvas.width - btnW) / 2;
            PUTT_RETRY_BTN.y = canvas.height * 0.82;
            PUTT_RETRY_BTN.w = btnW;
            PUTT_RETRY_BTN.h = btnH;
            drawButton(PUTT_RETRY_BTN, t('continue_btn'), '80,200,80');
        }
    }

    function startPutting() {
        puttDist = distToBasket(playerPos);
        barPos = 0;
        barDir = 1;
        barStopped = false;
        barPrecision = 0;
        state = 'putting-precision';
    }

    function startRingGame() {
        state = 'putting-rings';
        computeRingSizes();
        yellowAngle = 0;
        yellowStopping = false;
        yellowFrozen = false;
        yellowCurrentSpeed = YELLOW_SPEED;
        const { maxR } = getYellowMinMax();
        yellowRadius = maxR;
    }

    let nextPuttDist = 0; // calculated new distance after a miss

    function evaluatePutt() {
        const { minR, maxR } = getYellowMinMax();

        if (yellowRadius >= innerR && yellowRadius <= whiteR) {
            puttResultText = 'made_it';
            puttResultColor = '#44ff44';
            nextPuttDist = 0;
        } else if (yellowRadius < innerR) {
            // SHORT — disc didn't reach the basket
            const missRatio = (innerR - yellowRadius) / innerR; // 0=barely short, ~1=very short
            nextPuttDist = Math.max(1, missRatio * puttDist * 0.4);
            const diff = innerR - yellowRadius;
            if (diff < innerR * 0.3) {
                puttResultText = 'close';
                puttResultColor = '#ffdd44';
            } else {
                puttResultText = 'short';
                puttResultColor = '#ff6644';
            }
        } else {
            // LONG — disc went past the basket
            const missRatio = (yellowRadius - whiteR) / (maxR - whiteR); // 0=barely long, ~1=way past
            nextPuttDist = Math.max(1, missRatio * puttDist * 0.35);
            const diff = yellowRadius - whiteR;
            if (diff < innerR * 0.3) {
                puttResultText = 'close';
                puttResultColor = '#ffdd44';
            } else {
                puttResultText = 'long';
                puttResultColor = '#ff6644';
            }
        }
        state = 'putting-result';
    }

    // --- OB detection ---
    function isInOB(wx, wy) {
        for (const ob of HOLE.ob) {
            const halfW = ob.w / 2;
            const halfH = ob.h / 2;
            if (wx >= ob.x - halfW && wx <= ob.x + halfW &&
                wy >= ob.y - halfH && wy <= ob.y + halfH) {
                return true;
            }
        }
        return false;
    }

    function findLastInboundPosition(flightRes) {
        const pts = flightRes.points;
        // Scan backward from landing to find last point NOT in OB
        for (let i = pts.length - 1; i >= 0; i--) {
            const wx = playerPos.x + pts[i].x;
            const wy = playerPos.y + pts[i].y;
            if (!isInOB(wx, wy)) {
                return { x: wx, y: wy };
            }
        }
        // Fallback: return current player position (tee/previous lie)
        return { ...playerPos };
    }

    // --- Tree collision detection & bounce ---
    function applyTreeCollision(flightRes) {
        const pts = flightRes.points;
        for (let i = 1; i < pts.length; i++) {
            const wx = playerPos.x + pts[i].x;
            const wy = playerPos.y + pts[i].y;

            for (const tree of HOLE.trees) {
                const halfW = tree.w / 2;
                const halfH = tree.h / 2;
                if (wx >= tree.x - halfW && wx <= tree.x + halfW &&
                    wy >= tree.y - halfH && wy <= tree.y + halfH) {
                    // Collision found at point i
                    applyBounce(flightRes, i, tree, wx);
                    return;
                }
            }
        }
    }

    function applyBounce(flightRes, collIdx, tree, hitWorldX) {
        const pts = flightRes.points;

        // Travel direction at collision (radians, 0=forward/+Y)
        const prev = pts[Math.max(0, collIdx - 1)];
        const curr = pts[collIdx];
        const travelRad = Math.atan2(curr.x - prev.x, curr.y - prev.y);

        // Determine which third of the tree was hit
        const relX = hitWorldX - tree.x; // negative=left, positive=right
        const thirdW = tree.w / 3;
        let bounceRad;

        if (relX < -thirdW / 2) {
            // Left third — bounce left (yellow zone): 210°-300° relative to travel
            const angle = (210 + Math.random() * 90) * Math.PI / 180;
            bounceRad = travelRad + angle;
        } else if (relX > thirdW / 2) {
            // Right third — bounce right (yellow zone): 60°-150° relative to travel
            const angle = (60 + Math.random() * 90) * Math.PI / 180;
            bounceRad = travelRad + angle;
        } else {
            // Center third — bounce backward (pink zone): 150°-210° relative to travel
            const angle = (150 + Math.random() * 60) * Math.PI / 180;
            bounceRad = travelRad + angle;
        }

        // Remaining energy → bounce distance
        const remainFrac = 1 - (collIdx / pts.length);
        const totalDist = flightRes.totalDistance;
        const bounceDist = Math.max(2, remainFrac * totalDist * 0.25);

        // Generate bounce path (~20 points, straight line with deceleration)
        const BOUNCE_STEPS = 20;
        const collPt = pts[collIdx];
        const bouncePoints = [];
        for (let s = 1; s <= BOUNCE_STEPS; s++) {
            const t = s / BOUNCE_STEPS;
            // Decelerate: distance covered follows sqrt curve
            const d = bounceDist * Math.sqrt(t);
            bouncePoints.push({
                x: collPt.x + Math.sin(bounceRad) * d,
                y: collPt.y + Math.cos(bounceRad) * d,
            });
        }

        // Truncate original path at collision, append bounce
        flightRes.points = pts.slice(0, collIdx + 1).concat(bouncePoints);
        // Adjust flight time proportionally
        const newLen = flightRes.points.length;
        const origLen = pts.length;
        flightRes.flightTimeMs = flightRes.flightTimeMs * (newLen / origLen);
    }

    // --- Bush collision: soft redirect + slow down ---
    function applyBushCollision(flightRes) {
        const pts = flightRes.points;
        for (let i = 1; i < pts.length; i++) {
            const wx = playerPos.x + pts[i].x;
            const wy = playerPos.y + pts[i].y;

            for (const bush of HOLE.bushes) {
                const halfW = bush.w / 2;
                const halfH = bush.h / 2;
                if (wx >= bush.x - halfW && wx <= bush.x + halfW &&
                    wy >= bush.y - halfH && wy <= bush.y + halfH) {
                    // Disc entered bush at point i
                    applyBushEffect(flightRes, i);
                    return;
                }
            }
        }
    }

    function applyBushEffect(flightRes, entryIdx) {
        const pts = flightRes.points;
        const remaining = pts.length - entryIdx;
        if (remaining < 2) return;

        // Small random direction nudge: ±15°
        const nudgeRad = ((Math.random() - 0.5) * 30) * Math.PI / 180;

        // Slow down factor: remaining points are compressed (disc loses ~40% distance)
        const slowFactor = 0.6;

        const entryPt = pts[entryIdx];
        for (let i = entryIdx + 1; i < pts.length; i++) {
            // Get original offset from entry point
            const dx = pts[i].x - entryPt.x;
            const dy = pts[i].y - entryPt.y;

            // Apply rotation (nudge) and scale (slow)
            const cosN = Math.cos(nudgeRad);
            const sinN = Math.sin(nudgeRad);
            pts[i].x = entryPt.x + (dx * cosN - dy * sinN) * slowFactor;
            pts[i].y = entryPt.y + (dx * sinN + dy * cosN) * slowFactor;
        }
    }

    // --- Update loop ---
    function update(timestamp) {
        if (!running) return;

        const dt = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        updateCamera();
        renderer.clear();

        // Always draw tee pad, OB areas, basket, trees, and bushes
        const teeAngle = Math.atan2(HOLE.basket.x - HOLE.tee.x, HOLE.basket.y - HOLE.tee.y);
        renderer.drawTeePad(HOLE.tee.x, HOLE.tee.y, HOLE.tee.w, HOLE.tee.h, teeAngle);
        for (const ob of HOLE.ob) {
            renderer.drawOB(ob.x, ob.y, ob.w, ob.h);
        }
        drawBasket(HOLE.basket.x, HOLE.basket.y);
        for (const tree of HOLE.trees) {
            renderer.drawTree(tree.x, tree.y, tree.w, tree.h);
        }
        for (const bush of HOLE.bushes) {
            renderer.drawBush(bush.x, bush.y, bush.w, bush.h);
        }

        // Explore mode: draw field elements + cancel button, skip normal UI
        if (exploring) {
            renderer.drawPlayer(playerPos.x, playerPos.y, 0, 0);
            // Draw previous flight path if exists
            if (flightResult) {
                const worldPoints = flightResult.points.map(p => ({
                    x: playerPos.x + p.x,
                    y: playerPos.y + p.y,
                }));
                renderer.drawFlightPath(worldPoints, flightResult.points.length - 1);
                const lastPt = flightResult.points[flightResult.points.length - 1];
                const landingWorld = {
                    x: playerPos.x + lastPt.x,
                    y: playerPos.y + lastPt.y,
                };
                const straightDist = Math.sqrt(lastPt.x * lastPt.x + lastPt.y * lastPt.y);
                renderer.drawLandingMarker(landingWorld.x, landingWorld.y, straightDist);
            }
            drawHoleInfo();
            drawZoomSlider();
            drawExploreCancelButton();
            requestAnimationFrame(update);
            return;
        }

        // --- Putting physics update ---
        const dtSec = Math.min(dt, 50) / 1000;

        if (state === 'putting-precision' && !barStopped) {
            barPos += barDir * BAR_SPEED * dtSec;
            if (barPos >= 1) { barPos = 1; barDir = -1; }
            if (barPos <= 0) { barPos = 0; barDir = 1; }
        }

        if (state === 'putting-rings' && !yellowFrozen) {
            computeRingSizes();
            const { minR, maxR } = getYellowMinMax();

            if (yellowStopping) {
                yellowCurrentSpeed -= yellowStopForce * dtSec;
                if (yellowCurrentSpeed <= 0) {
                    yellowCurrentSpeed = 0;
                    yellowFrozen = true;
                    evaluatePutt();
                }
            }

            const distFactor = puttDist / MAX_PUTT_DIST_M;
            const speedBoost = 1 + distFactor * 3.0;
            const insideGreen = yellowRadius < innerR;
            const effectiveSpeed = insideGreen
                ? yellowCurrentSpeed * speedBoost
                : yellowCurrentSpeed;

            yellowAngle += effectiveSpeed * dtSec;
            const t = (Math.sin(yellowAngle) + 1) / 2;
            yellowRadius = minR + t * (maxR - minR);
        }

        switch (state) {
            case 'idle':
                renderer.drawPlayer(playerPos.x, playerPos.y, 0, 0);
                renderer.drawDirectionArrow(playerPos.x, playerPos.y, throwAngleDeg);
                drawDiscButton();
                drawGripButton();
                drawHoleInfo();
                drawThrowCount();
                drawZoomSlider();
                drawExploreButton();
                break;

            case 'disc-select':
                renderer.drawPlayer(playerPos.x, playerPos.y, 0, 0);
                renderer.drawDirectionArrow(playerPos.x, playerPos.y, throwAngleDeg);
                discSelectHitAreas = renderer.drawDiscSelect(DISCS, selectedDisc) || [];
                break;

            case 'aiming':
                renderer.drawPlayer(playerPos.x, playerPos.y, 0, 0);
                renderer.drawDirectionArrow(playerPos.x, playerPos.y, throwAngleDeg);
                drawAimingUI();
                drawGripButton();
                throwUI.draw(renderer.ctx);
                drawHoleInfo();
                drawThrowCount();
                drawZoomSlider();
                drawExploreButton();

                if (throwUI.isReleased()) {
                    const aim = throwUI.getAim();
                    const throwInput = { ...aim, angleDeg: throwAngleDeg };
                    flightResult = calculateFlight(DISCS[selectedDisc], throwInput);
                    applyTreeCollision(flightResult);
                    applyBushCollision(flightResult);
                    lastThrowParams = throwInput;
                    flightProgress = 0;
                    throwAnim = 0;
                    throwCount++;
                    prevPlayerPos = { ...playerPos };
                    throwUI.deactivate();
                    state = 'flying';
                }
                break;

            case 'flying': {
                if (throwAnim < 1) {
                    throwAnim = Math.min(1, throwAnim + dt / 400);
                }

                if (throwAnim >= 0.5 && flightResult && flightResult.flightTimeMs > 0) {
                    flightProgress += (dt / flightResult.flightTimeMs) * flightResult.points.length;
                }
                const idx = Math.min(
                    Math.floor(flightProgress),
                    flightResult.points.length - 1
                );

                const frac = flightProgress - idx;
                const nextIdx = Math.min(idx + 1, flightResult.points.length - 1);
                const p0 = flightResult.points[idx];
                const p1 = flightResult.points[nextIdx];
                const localPoint = {
                    x: p0.x + (p1.x - p0.x) * frac,
                    y: p0.y + (p1.y - p0.y) * frac,
                };
                const worldPoint = {
                    x: playerPos.x + localPoint.x,
                    y: playerPos.y + localPoint.y,
                };

                zoomToFitAll(worldPoint);

                renderer.drawPlayer(playerPos.x, playerPos.y, 0, throwAnim);

                // Draw flight path in world space
                const worldPoints = flightResult.points.map(p => ({
                    x: playerPos.x + p.x,
                    y: playerPos.y + p.y,
                }));
                renderer.drawFlightPath(worldPoints, idx);
                renderer.drawDisc(worldPoint.x, worldPoint.y, '#fff');

                drawHoleInfo();
                drawThrowCount();
                drawDebugInfo();
                drawFlightDebug(idx);

                if (idx >= flightResult.points.length - 1) {
                    // Check throw-in: disc landed within 3ft of basket
                    const lastPt = flightResult.points[flightResult.points.length - 1];
                    const landWorld = { x: playerPos.x + lastPt.x, y: playerPos.y + lastPt.y };
                    const distToPin = distToBasket(landWorld);
                    const THROW_IN_M = 0.914; // 3 ft
                    if (distToPin <= THROW_IN_M && !isInOB(landWorld.x, landWorld.y)) {
                        state = 'landed';
                        // Brief pause to show landing, then auto-trigger throw-in
                        setTimeout(() => {
                            prevPlayerPos = { ...playerPos };
                            playerPos = { x: landWorld.x, y: landWorld.y };
                            flightResult = null;
                            isThrowIn = true;
                            puttResultText = 'made_it';
                            puttResultColor = '#44ff44';
                            state = 'putting-result';
                        }, 800);
                    } else {
                        state = 'landed';
                    }
                }
                break;
            }

            case 'landed': {
                const lastPt = flightResult.points[flightResult.points.length - 1];
                const landingWorld = {
                    x: playerPos.x + lastPt.x,
                    y: playerPos.y + lastPt.y,
                };

                zoomToFitAll(landingWorld);

                renderer.drawPlayer(playerPos.x, playerPos.y, 0, 1);

                const worldPoints = flightResult.points.map(p => ({
                    x: playerPos.x + p.x,
                    y: playerPos.y + p.y,
                }));
                renderer.drawFlightPath(worldPoints, flightResult.points.length - 1);

                const straightDist = Math.sqrt(lastPt.x * lastPt.x + lastPt.y * lastPt.y);
                renderer.drawLandingMarker(landingWorld.x, landingWorld.y, straightDist);

                drawHoleInfo();
                drawThrowCount();
                drawDebugInfo();
                drawFlightDebug(flightResult.points.length - 1);
                drawLandedUI();
                drawZoomSlider();
                drawExploreButton();
                break;
            }

            case 'putting-precision':
                renderer.clear();
                drawPrecisionBar();
                drawHoleInfo();
                drawThrowCount();
                break;

            case 'putting-rings':
                renderer.clear();
                drawPuttRings();
                drawPuttHUD();
                drawThrowCount();
                break;

            case 'putting-result':
                renderer.clear();
                drawPuttResult();
                drawThrowCount();
                break;
        }

        // Back button (always visible except during flight, explore, and putting)
        if (onBack && state !== 'flying' && !state.startsWith('putting-')) {
            drawBackButton();
        }

        requestAnimationFrame(update);
    }

    // --- Public API ---
    function start() {
        running = true;
        throwCount = 0;
        isThrowIn = false;
        playerPos = { x: HOLE.tee.x, y: HOLE.tee.y };
        prevPlayerPos = { x: HOLE.tee.x, y: HOLE.tee.y };
        flightResult = null;
        userZoom = MIN_ZOOM;
        exploring = false;

        // Auto-aim toward basket from tee
        const dx = HOLE.basket.x - playerPos.x;
        const dy = HOLE.basket.y - playerPos.y;
        throwAngleDeg = Math.atan2(dx, dy) * (180 / Math.PI);

        // Auto-select disc and go straight to aiming
        autoSelectDisc();
        state = 'aiming';
        throwUI.activate();

        lastTimestamp = performance.now();
        resetCamera();
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        requestAnimationFrame(update);
    }

    function stop() {
        running = false;
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        if (state === 'aiming') throwUI.deactivate();
    }

    return { start, stop };
}
