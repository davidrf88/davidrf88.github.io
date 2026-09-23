// Putting Lab: 2D top-down putting practice.
// Two-phase minigame:
//   1. Precision bar — vertical bar moves up/down, tap to stop. Center = perfect.
//   2. Ring game — 3 rings: static inner (basket), white (proximity-scaled),
//      yellow (pulsating). Tap to stop yellow ring. Precision determines stopping force.
//
// Uses same top-down renderer as throwing lab.

import { createRenderer } from './renderer.js';
import { t } from './i18n.js';

export function createPutting(canvas, onBack) {
    const renderer = createRenderer(canvas);
    const ctx = renderer.ctx;
    let running = false;
    let lastTimestamp = 0;

    // Putting config
    const MAX_PUTT_DIST_M = 18.3; // 60 ft in meters
    let puttDist = 10; // current distance to basket in meters

    // State: idle → precision → rings → result
    let state = 'idle';

    // Buttons
    const BACK_BTN = { x: 16, y: 16, w: 100, h: 50 };
    const RETRY_BTN = { x: 0, y: 0, w: 120, h: 50 };
    const PUTT_BTN = { x: 0, y: 0, w: 120, h: 50 };

    // Distance slider
    const MIN_PUTT_DIST_M = 3.05; // 10 ft
    const DIST_SLIDER = { x: 0, y: 0, w: 0, h: 0 }; // track area
    let distSliderDragging = false;

    // --- Precision bar state ---
    // Bar indicator moves between 0 and 1 (0=top, 1=bottom). 0.5 = center = perfect.
    let barPos = 0;
    let barDir = 1; // 1=moving down, -1=moving up
    const BAR_SPEED = 1.8; // full traversals per second
    let barStopped = false;
    let barPrecision = 0; // 0=perfect, 1=worst

    // --- Ring game state ---
    // Yellow ring pulsates between minR and maxR
    let yellowAngle = 0; // phase of pulsation (radians)
    const YELLOW_SPEED = 3.5; // radians per second (pulsation speed)
    let yellowStopping = false;
    let yellowStopForce = 0; // deceleration per second (set by precision)
    let yellowCurrentSpeed = 0;
    let yellowRadius = 0; // current yellow ring radius in pixels
    let yellowFrozen = false;

    // Ring sizes (in pixels, computed per frame based on canvas)
    let innerR = 0; // basket (static, green)
    let whiteR = 0; // proximity ring (static, white)
    let ringCenterX = 0;
    let ringCenterY = 0;

    // Result
    let resultText = '';
    let resultColor = '';

    // --- Helpers ---
    function hitTest(px, py, btn) {
        return px >= btn.x && px <= btn.x + btn.w &&
               py >= btn.y && py <= btn.y + btn.h;
    }

    function drawButton(btn, label, color) {
        ctx.fillStyle = `rgba(${color},0.3)`;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 12);
        ctx.fill();
        ctx.strokeStyle = `rgba(${color},0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 12);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 8);
    }

    // --- Precision bar drawing ---
    function drawPrecisionBar() {
        const barW = 20;
        const barH = canvas.height * 0.5;
        const barX = canvas.width / 2 - barW / 2;
        const barY = canvas.height * 0.2;

        // Background track
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 6);
        ctx.fill();

        // Center zone highlight (sweet spot)
        const sweetH = barH * 0.08;
        const sweetY = barY + barH * 0.5 - sweetH / 2;
        ctx.fillStyle = 'rgba(80,220,80,0.3)';
        ctx.fillRect(barX, sweetY, barW, sweetH);

        // Gradient zones from center outward
        const zones = [
            { frac: 0.15, color: 'rgba(80,220,80,0.15)' },
            { frac: 0.30, color: 'rgba(220,220,80,0.10)' },
        ];
        for (const z of zones) {
            const zH = barH * z.frac;
            ctx.fillStyle = z.color;
            ctx.fillRect(barX, barY + barH * 0.5 - zH, barW, zH * 2);
        }

        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 6);
        ctx.stroke();

        // Moving indicator
        const indicatorY = barY + barPos * barH;
        const indicatorH = 6;
        const indicatorColor = barStopped
            ? (barPrecision < 0.1 ? '#44ff44' : barPrecision < 0.3 ? '#ffff44' : '#ff8844')
            : '#fff';

        ctx.fillStyle = indicatorColor;
        ctx.beginPath();
        ctx.roundRect(barX - 4, indicatorY - indicatorH / 2, barW + 8, indicatorH, 3);
        ctx.fill();

        // Label
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

    // --- Ring game drawing ---
    function computeRingSizes() {
        ringCenterX = canvas.width / 2;
        ringCenterY = canvas.height * 0.45;

        // Inner ring (basket) — fixed small size
        innerR = canvas.width * 0.06;

        // White ring — bigger when closer to basket
        // At 60ft (max) white ring is barely bigger than inner
        // At 10ft (close) white ring is much bigger
        const closeness = 1 - (puttDist / MAX_PUTT_DIST_M); // 0=far, 1=close
        const whiteMin = innerR * 1.3;
        const whiteMax = innerR * 3.5;
        whiteR = whiteMin + closeness * (whiteMax - whiteMin);
    }

    function getYellowMinMax() {
        const minR = innerR * 0.5;
        const maxR = whiteR * 1.8;
        return { minR, maxR };
    }

    function drawRings() {
        computeRingSizes();
        const cx = ringCenterX;
        const cy = ringCenterY;

        // Yellow ring (pulsating or stopping)
        ctx.strokeStyle = 'rgba(255,220,40,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, yellowRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Yellow fill
        ctx.fillStyle = 'rgba(255,220,40,0.08)';
        ctx.beginPath();
        ctx.arc(cx, cy, yellowRadius, 0, Math.PI * 2);
        ctx.fill();

        // White ring (static, proximity-scaled)
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, whiteR, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring (basket, static, green)
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

        // Precision & stop time display (inside the rings)
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

        // Label
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

    // --- Result display ---
    function drawResult() {
        const cx = canvas.width / 2;

        // Show final ring positions
        drawRings();

        // Result text
        ctx.fillStyle = resultColor;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t(resultText), cx, ringCenterY + whiteR * 1.8 + 20);

        // Distance info
        const distFt = Math.round(puttDist * 3.281);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '16px monospace';
        ctx.fillText(`${Math.round(puttDist)}m / ${distFt}ft ${t('putt_suffix')}`, cx, ringCenterY + whiteR * 1.8 + 44);

        // Retry button
        const btnW = 120;
        const btnH = 50;
        RETRY_BTN.x = (canvas.width - btnW) / 2;
        RETRY_BTN.y = canvas.height * 0.82;
        RETRY_BTN.w = btnW;
        RETRY_BTN.h = btnH;
        drawButton(RETRY_BTN, t('retry'), '80,200,80');
    }

    // --- HUD ---
    function drawHUD() {
        const distFt = Math.round(puttDist * 3.281);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(canvas.width - 170, 6, 164, 60);
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.round(puttDist)}m / ${distFt}ft`, canvas.width - 16, 30);

        // Precision
        const pct = Math.round((1 - barPrecision) * 100);
        const precColor = barPrecision < 0.1 ? '#44ff44' : barPrecision < 0.3 ? '#ffff44' : '#ff8844';
        ctx.fillStyle = precColor;
        ctx.font = '16px monospace';
        ctx.fillText(`${t('precision_label')} ${pct}%`, canvas.width - 16, 52);
    }

    function drawIdleUI() {
        const cx = canvas.width / 2;

        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('putting_lab_title'), cx, canvas.height * 0.18);

        // Distance label
        const distFt = Math.round(puttDist * 3.281);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`${distFt} ft`, cx, canvas.height * 0.32);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '18px monospace';
        ctx.fillText(`${Math.round(puttDist * 10) / 10}m`, cx, canvas.height * 0.32 + 26);

        // Horizontal distance slider
        const sliderW = canvas.width * 0.7;
        const sliderH = 8;
        const sliderX = (canvas.width - sliderW) / 2;
        const sliderY = canvas.height * 0.45;

        DIST_SLIDER.x = sliderX;
        DIST_SLIDER.y = sliderY - 20; // hit area taller than visual
        DIST_SLIDER.w = sliderW;
        DIST_SLIDER.h = 40;

        // Track background
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(sliderX, sliderY, sliderW, sliderH, 4);
        ctx.fill();

        // Track fill (up to thumb)
        const frac = (puttDist - MIN_PUTT_DIST_M) / (MAX_PUTT_DIST_M - MIN_PUTT_DIST_M);
        const fillW = frac * sliderW;
        ctx.fillStyle = 'rgba(200,180,80,0.4)';
        ctx.beginPath();
        ctx.roundRect(sliderX, sliderY, fillW, sliderH, 4);
        ctx.fill();

        // Thumb
        const thumbX = sliderX + t * sliderW;
        const thumbR = 14;
        ctx.fillStyle = distSliderDragging ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(thumbX, sliderY + sliderH / 2, thumbR, 0, Math.PI * 2);
        ctx.fill();

        // Min/max labels
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('10ft', sliderX, sliderY + sliderH + 20);
        ctx.textAlign = 'right';
        ctx.fillText('60ft', sliderX + sliderW, sliderY + sliderH + 20);

        // PUTT button
        const btnW = 120;
        const btnH = 50;
        PUTT_BTN.x = (canvas.width - btnW) / 2;
        PUTT_BTN.y = canvas.height * 0.62;
        PUTT_BTN.w = btnW;
        PUTT_BTN.h = btnH;
        drawButton(PUTT_BTN, t('putt'), '80,200,80');
    }

    function hitTestDistSlider(px, py) {
        const pad = 10;
        return px >= DIST_SLIDER.x - pad && px <= DIST_SLIDER.x + DIST_SLIDER.w + pad &&
               py >= DIST_SLIDER.y - pad && py <= DIST_SLIDER.y + DIST_SLIDER.h + pad;
    }

    function updateDistFromPointer(px) {
        const frac = Math.max(0, Math.min(1, (px - DIST_SLIDER.x) / DIST_SLIDER.w));
        puttDist = MIN_PUTT_DIST_M + frac * (MAX_PUTT_DIST_M - MIN_PUTT_DIST_M);
    }

    // --- Pointer events ---
    function onPointerDown(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;

        // BACK button (always)
        if (hitTest(px, py, BACK_BTN)) {
            onBack();
            return;
        }

        if (state === 'idle') {
            // Distance slider
            if (hitTestDistSlider(px, py)) {
                distSliderDragging = true;
                updateDistFromPointer(px);
                return;
            }
            // PUTT button
            if (hitTest(px, py, PUTT_BTN)) {
                barPos = 0;
                barDir = 1;
                barStopped = false;
                barPrecision = 0;
                state = 'precision';
                return;
            }
            return;
        }

        if (state === 'precision' && !barStopped) {
            // Stop the bar
            barStopped = true;
            // Precision: distance from center (0.5). 0 = perfect, 1 = worst.
            barPrecision = Math.abs(barPos - 0.5) * 2;
            // Brief pause then start rings
            setTimeout(() => {
                if (state === 'precision') {
                    startRingGame();
                }
            }, 600);
            return;
        }

        if (state === 'rings' && !yellowStopping && !yellowFrozen) {
            // Tap to stop yellow ring
            yellowStopping = true;
            // Stop force: perfect precision → very fast stop, bad → slow stop
            // At perfect (barPrecision=0): stops in ~0.5s (high deceleration)
            // At worst (barPrecision=1): stops in ~3s (low deceleration)
            const minStopTime = 0.3;  // seconds at perfect precision
            const maxStopTime = 3.0;  // seconds at worst precision
            const stopTime = minStopTime + barPrecision * (maxStopTime - minStopTime);
            yellowStopForce = yellowCurrentSpeed / stopTime;
            return;
        }

        if (state === 'result') {
            if (hitTest(px, py, RETRY_BTN)) {
                state = 'idle';
                return;
            }
        }
    }

    function onPointerMove(e) {
        if (distSliderDragging) {
            const rect = canvas.getBoundingClientRect();
            const sx = canvas.width / rect.width;
            const px = (e.clientX - rect.left) * sx;
            updateDistFromPointer(px);
        }
    }

    function onPointerUp(e) {
        distSliderDragging = false;
    }

    function startRingGame() {
        state = 'rings';
        computeRingSizes();
        yellowAngle = 0;
        yellowStopping = false;
        yellowFrozen = false;
        yellowCurrentSpeed = YELLOW_SPEED;
        // Start yellow at max size
        const { minR, maxR } = getYellowMinMax();
        yellowRadius = maxR;
    }

    // --- Update loop ---
    function update(timestamp) {
        if (!running) return;

        const dt = Math.min(timestamp - lastTimestamp, 50); // cap dt
        lastTimestamp = timestamp;
        const dtSec = dt / 1000;

        // Background
        renderer.clear();

        // State updates
        if (state === 'precision' && !barStopped) {
            barPos += barDir * BAR_SPEED * dtSec;
            if (barPos >= 1) { barPos = 1; barDir = -1; }
            if (barPos <= 0) { barPos = 0; barDir = 1; }
        }

        if (state === 'rings') {
            computeRingSizes();
            const { minR, maxR } = getYellowMinMax();

            if (!yellowFrozen) {
                if (yellowStopping) {
                    // Decelerate
                    yellowCurrentSpeed -= yellowStopForce * dtSec;
                    if (yellowCurrentSpeed <= 0) {
                        yellowCurrentSpeed = 0;
                        yellowFrozen = true;
                        evaluateResult();
                    }
                }

                // Speed boost when yellow is inside green ring:
                // farther putts = faster through the sweet spot
                const distFactor = puttDist / MAX_PUTT_DIST_M; // 0 (close) to 1 (far)
                const speedBoost = 1 + distFactor * 3.0; // up to 4x faster inside green
                const insideGreen = yellowRadius < innerR;
                const effectiveSpeed = insideGreen
                    ? yellowCurrentSpeed * speedBoost
                    : yellowCurrentSpeed;

                yellowAngle += effectiveSpeed * dtSec;
                // Pulsate: use sine wave mapped to [minR, maxR]
                const frac = (Math.sin(yellowAngle) + 1) / 2; // 0 to 1
                yellowRadius = minR + frac * (maxR - minR);
            }
        }

        // Draw based on state
        switch (state) {
            case 'idle':
                drawIdleUI();
                break;

            case 'precision':
                drawPrecisionBar();
                break;

            case 'rings':
                drawRings();
                drawHUD();
                break;

            case 'result':
                drawResult();
                break;
        }

        // Back button always
        drawButton(BACK_BTN, t('back'), '255,255,255');

        requestAnimationFrame(update);
    }

    function evaluateResult() {
        // Success: yellow ring is between green (inner) and white ring
        if (yellowRadius >= innerR && yellowRadius <= whiteR) {
            resultText = 'made_it';
            resultColor = '#44ff44';
        } else if (yellowRadius < innerR) {
            // Too small — under the basket
            const diff = innerR - yellowRadius;
            if (diff < innerR * 0.3) {
                resultText = 'close';
                resultColor = '#ffdd44';
            } else {
                resultText = 'short';
                resultColor = '#ff6644';
            }
        } else {
            // Too big — past the basket
            const diff = yellowRadius - whiteR;
            if (diff < innerR * 0.3) {
                resultText = 'close';
                resultColor = '#ffdd44';
            } else {
                resultText = 'long';
                resultColor = '#ff6644';
            }
        }

        state = 'result';
    }

    // --- Public API ---
    function start() {
        running = true;
        state = 'idle';
        lastTimestamp = performance.now();
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        requestAnimationFrame(update);
    }

    function stop() {
        running = false;
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
    }

    return { start, stop };
}
