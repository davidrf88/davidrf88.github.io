// Game: state machine that wires all modules together.
// States: idle → disc-select → aiming → flying → landed → idle
//   idle:        direction arrow visible + draggable. DISC button on left.
//   disc-select: overlay. Tap disc → aiming.
//   aiming:      throwUI active (pull to throw). CANCEL button on left.
//   flying/landed: disc in motion / on ground.

import { DISCS } from './discs.js';
import { calculateFlight } from './flight.js';
import { createThrowUI } from './throwUI.js';
import { createRenderer } from './renderer.js';
import { t } from './i18n.js';
import { isForehand, setForehand, isLefty } from './settings.js';

export function createGame(canvas, onBack) {
    const renderer = createRenderer(canvas);
    const throwUI = createThrowUI(canvas);

    let running = false;
    let state = 'idle';
    let selectedDisc = 0;
    let flightResult = null;
    let flightProgress = 0;
    let lastTimestamp = 0;
    let throwAnim = 0; // 0=idle, 0→1 over throw animation
    let lastThrowParams = null; // debug: stored throw input params

    // Player position in field-space (meters)
    const playerPos = { x: 0, y: 0 };

    // Disc select hit areas (set each frame when in disc-select state)
    let discSelectHitAreas = [];

    // --- Direction aiming ---
    let throwAngleDeg = 0;
    let aimDragStartX = null; // track horizontal drag for arrow rotation
    let aimDragStartAngle = 0;
    const DISC_BTN = { x: 0, y: 0, w: 100, h: 50 };   // left-side disc select button
    const CANCEL_BTN = { x: 0, y: 0, w: 100, h: 50 };  // right-side cancel button
    const BACK_BTN = { x: 0, y: 0, w: 100, h: 50 };    // top-left back button
    const GRIP_BTN = { x: 0, y: 0, w: 70, h: 44 };   // forehand/backhand toggle

    // --- Tap detection ---
    let tapStart = null;
    const TAP_THRESHOLD = 15; // max movement in px to count as tap
    const TAP_MAX_MS = 300;

    function hitTest(px, py, btn) {
        return px >= btn.x && px <= btn.x + btn.w &&
               py >= btn.y && py <= btn.y + btn.h;
    }

    function onPointerDown(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;

        // BACK button available in idle, aiming, landed
        if (state !== 'flying' && state !== 'disc-select' && onBack && hitTest(px, py, BACK_BTN)) {
            if (state === 'aiming') throwUI.deactivate();
            onBack();
            return;
        }

        if (state === 'aiming') {
            // Check CANCEL button (right side)
            if (hitTest(px, py, CANCEL_BTN)) {
                throwUI.deactivate();
                state = 'idle';
                return;
            }
            // Check DISC button (left side — change disc)
            if (hitTest(px, py, DISC_BTN)) {
                throwUI.deactivate();
                state = 'disc-select';
                return;
            }
            // Grip toggle
            if (hitTest(px, py, GRIP_BTN)) {
                setForehand(!isForehand());
                return;
            }
            // If pointer is not on the throw disc, allow direction dragging
            if (!throwUI.isOverDisc(px, py)) {
                aimDragStartX = e.clientX;
                aimDragStartAngle = throwAngleDeg;
            }
            return;
        }

        if (state === 'idle') {
            // Check DISC button
            if (hitTest(px, py, DISC_BTN)) {
                state = 'disc-select';
                return;
            }
            // Grip toggle
            if (hitTest(px, py, GRIP_BTN)) {
                setForehand(!isForehand());
                return;
            }
            // Start drag to rotate arrow
            aimDragStartX = e.clientX;
            aimDragStartAngle = throwAngleDeg;
            return;
        }

        tapStart = { x: e.clientX, y: e.clientY, time: performance.now() };
    }

    function onPointerMove(e) {
        if ((state === 'idle' || state === 'aiming') && aimDragStartX !== null) {
            const dx = e.clientX - aimDragStartX;
            // Sensitivity: 200px drag = 60 degrees
            throwAngleDeg = aimDragStartAngle + dx * 0.3;
        }
    }

    function onPointerUp(e) {
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

        // It's a tap — handle based on state
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const tx = (e.clientX - rect.left) * sx;
        const ty = (e.clientY - rect.top) * sy;

        handleTap(tx, ty);
    }

    function handleTap(tx, ty) {
        switch (state) {
            case 'disc-select':
                // Check if tap hit a disc card
                for (const area of discSelectHitAreas) {
                    if (tx >= area.x && tx <= area.x + area.w &&
                        ty >= area.y && ty <= area.y + area.h) {
                        selectedDisc = area.index;
                        state = 'aiming';
                        throwUI.activate();
                        return;
                    }
                }
                break;

            case 'landed':
                // Reset for next throw
                resetCamera();
                state = 'idle';
                break;
        }
    }

    // Pointer listeners are added/removed in start()/stop()

    // --- Camera ---
    // Smooth camera: current and target values for animated transitions
    let camCurrent = { x: 0, y: 0, zoom: 45.7 };
    let camTarget = { x: 0, y: 0, zoom: 45.7 };
    const CAM_LERP = 0.04; // smoothing factor per frame

    function resetCamera() {
        camTarget = { x: 0, y: 0, zoom: 45.7 };
        camCurrent = { ...camTarget };
        applyCamera();
    }

    function updateCamera() {
        camCurrent.x += (camTarget.x - camCurrent.x) * CAM_LERP;
        camCurrent.y += (camTarget.y - camCurrent.y) * CAM_LERP;
        camCurrent.zoom += (camTarget.zoom - camCurrent.zoom) * CAM_LERP;
        applyCamera();
    }

    function applyCamera() {
        renderer.setCamera(camCurrent.x, camCurrent.y);
        renderer.setVisibleMeters(camCurrent.zoom);
    }

    function zoomToFitDisc(discPoint) {
        // Calculate zoom needed to show both player (0,0) and current disc position
        // with padding, expanding progressively as disc flies farther

        const px = discPoint.x;
        const py = discPoint.y;

        // Vertical: need to fit both player and disc
        // Player is at 85% of screen height (85% above camera center, 15% below)
        let neededY;
        if (py >= 0) {
            // Disc is above player: need (py+8) to fit in the 75% above player
            neededY = (py + 8) / 0.75;
        } else {
            // Disc is below player: need |py|+8 to fit in the 15% below player
            // Also keep enough room above for context
            neededY = (Math.abs(py) + 8) / 0.15;
        }
        neededY = Math.max(neededY, 45.7);

        // Horizontal: need to show disc laterally from center
        const aspectRatio = canvas.width / canvas.height;
        const neededX = (Math.abs(px) + 8) * 2 / aspectRatio; // +8m padding on sides

        const visible = Math.max(neededY, neededX, 45.7);

        // Camera center: shift toward midpoint between player and disc
        const midX = px * 0.4;
        const camY = py * 0.3;

        camTarget = { x: midX, y: camY, zoom: visible };
    }

    // --- Update loop ---
    function update(timestamp) {
        if (!running) return;

        const dt = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        // Smooth camera every frame
        updateCamera();
        renderer.clear();

        switch (state) {
            case 'idle':
                renderer.drawPlayer(playerPos.x, playerPos.y, 0, 0);
                renderer.drawDirectionArrow(playerPos.x, playerPos.y, throwAngleDeg);
                drawDiscButton();
                drawGripButton();
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

                if (throwUI.isReleased()) {
                    const aim = throwUI.getAim();
                    const throwInput = { ...aim, angleDeg: throwAngleDeg };
                    flightResult = calculateFlight(DISCS[selectedDisc], throwInput);
                    lastThrowParams = throwInput;
                    flightProgress = 0;
                    throwAnim = 0;
                    throwUI.deactivate();
                    state = 'flying';
                }
                break;

            case 'flying': {
                // Advance throw animation (completes in ~400ms)
                if (throwAnim < 1) {
                    throwAnim = Math.min(1, throwAnim + dt / 400);
                }

                // Only advance disc flight after throw animation reaches release point (0.5)
                if (throwAnim >= 0.5 && flightResult && flightResult.flightTimeMs > 0) {
                    flightProgress += (dt / flightResult.flightTimeMs) * flightResult.points.length;
                }
                const idx = Math.min(
                    Math.floor(flightProgress),
                    flightResult.points.length - 1
                );

                // Interpolate between points for smooth motion
                const frac = flightProgress - idx;
                const nextIdx = Math.min(idx + 1, flightResult.points.length - 1);
                const p0 = flightResult.points[idx];
                const p1 = flightResult.points[nextIdx];
                const currentPoint = {
                    x: p0.x + (p1.x - p0.x) * frac,
                    y: p0.y + (p1.y - p0.y) * frac,
                };

                // Progressively zoom out to keep player + disc visible
                zoomToFitDisc(currentPoint);

                renderer.drawPlayer(playerPos.x, playerPos.y, 0, throwAnim);
                renderer.drawFlightPath(flightResult.points, idx);
                renderer.drawDisc(currentPoint.x, currentPoint.y, '#fff');

                // Show disc name + distance during flight
                drawFlightInfo(idx);
                drawDebugInfo();
                drawFlightDebug(idx);

                if (idx >= flightResult.points.length - 1) {
                    state = 'landed';
                }
                break;
            }

            case 'landed': {
                const lastPt = flightResult.points[flightResult.points.length - 1];
                // Keep final zoom framing
                zoomToFitDisc(lastPt);
                renderer.drawPlayer(playerPos.x, playerPos.y, 0, 1);
                renderer.drawFlightPath(flightResult.points, flightResult.points.length - 1);
                const straightDist = Math.sqrt(lastPt.x * lastPt.x + lastPt.y * lastPt.y);
                renderer.drawLandingMarker(lastPt.x, lastPt.y, straightDist);
                drawDebugInfo();
                drawFlightDebug(flightResult.points.length - 1);
                drawLandedPrompt();
                break;
            }
        }

        // Back button (always visible except during flight)
        if (onBack && state !== 'flying') {
            drawBackButton();
        }

        requestAnimationFrame(update);
    }

    // --- UI Buttons ---
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

        // Hint text
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

        // Disc name + display flight numbers at top
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

        // DISC button (left side — can change disc)
        drawDiscButton();

        // CANCEL button (right side)
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

    function drawFlightInfo(idx) {
        const ctx = renderer.ctx;
        const disc = DISCS[selectedDisc];
        const currentPt = flightResult.points[idx];
        const dist = Math.sqrt(currentPt.x * currentPt.x + currentPt.y * currentPt.y);

        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${disc.name}  ${Math.round(dist)}m`, canvas.width / 2, 26);
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
        // Max forward (Y) distance reached so far, ignoring lateral
        let maxY = 0;
        const limit = Math.min(idx, flightResult.points.length - 1);
        for (let j = 0; j <= limit; j++) {
            if (flightResult.points[j].y > maxY) maxY = flightResult.points[j].y;
        }
        line(t('debug_maxfwd'), `${Math.round(maxY)}m / ${Math.round(maxY * 3.281)}ft`);
        ctx.restore();
    }

    function drawLandedPrompt() {
        const ctx = renderer.ctx;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('tap_throw_again'), canvas.width / 2, canvas.height - 24);
    }

    function drawBackButton() {
        const btnW = 100;
        const btnH = 50;
        const btnX = 16;
        const btnY = 16;
        BACK_BTN.x = btnX;
        BACK_BTN.y = btnY;
        BACK_BTN.w = btnW;
        BACK_BTN.h = btnH;
        drawButton(BACK_BTN, t('back'), '255,255,255');
    }

    // --- Public API ---
    function start() {
        running = true;
        lastTimestamp = performance.now();
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
