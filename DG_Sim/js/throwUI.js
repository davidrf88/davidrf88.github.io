// Throw UI: self-contained aiming overlay.
// Handles its own pointer events and rendering.
// The game polls getAim() and isReleased() — no callbacks into the game.

import { t } from './i18n.js';
import { isForehand } from './settings.js';

export function createThrowUI(canvas) {
    let active = false;
    let dragging = false;
    let released = false;

    // Current aim state
    let aim = null; // { power, angleDeg, hyzer }

    // Geometry (computed on activate based on canvas size)
    let discCenterX = 0;
    let discCenterY = 0;
    let fanRadius = 0;
    let discRadius = 0; // size of the main disc circle
    const FAN_ANGLE_DEG = 90; // narrower fan so it doesn't span full screen width
    const FAN_HALF_RAD = (FAN_ANGLE_DEG / 2) * (Math.PI / 180);

    // Pointer position during drag
    let pointerX = 0;
    let pointerY = 0;

    // --- Event handlers ---
    function onPointerDown(e) {
        if (!active) return;
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        pointerX = (e.clientX - rect.left) * sx;
        pointerY = (e.clientY - rect.top) * sy;

        // Only start drag if pointer is on the disc icon
        const dx = pointerX - discCenterX;
        const dy = pointerY - discCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > discRadius * 1.5) return; // outside disc hit area

        e.preventDefault();
        dragging = true;
        updateAim();
    }

    function onPointerMove(e) {
        if (!active || !dragging) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        pointerX = (e.clientX - rect.left) * sx;
        pointerY = (e.clientY - rect.top) * sy;
        updateAim();
    }

    function onPointerUp(e) {
        if (!active || !dragging) return;
        e.preventDefault();
        dragging = false;
        if (aim && aim.power > CANCEL_THRESHOLD) {
            released = true;
        }
    }

    function updateAim() {
        // Vector from disc icon center to pointer (pulling downward)
        const dx = pointerX - discCenterX;
        const dy = pointerY - discCenterY; // positive = downward (pull direction)

        // Distance from disc icon = power
        const dist = Math.sqrt(dx * dx + dy * dy);
        const power = Math.min(1, dist / fanRadius);

        // Throw always goes straight ahead — angleDeg is always 0
        // The left/right pull position controls hyzer/anhyzer only
        const angleDeg = 0;

        // Hyzer/anhyzer: horizontal offset within the fan
        // Pulling left = hyzer (-1), pulling right = anhyzer (+1)
        // Use dx relative to fan width at current distance
        let angleRad = Math.atan2(dx, dy);
        angleRad = Math.max(-FAN_HALF_RAD, Math.min(FAN_HALF_RAD, angleRad));
        // Pulling left = hyzer (-1), pulling right = anhyzer (+1) for BH
        // For FH the meaning flips but the raw value stays — flight.js handles the physics
        const hyzer = dist > 10 ? -(angleRad / FAN_HALF_RAD) : 0;

        aim = { power, angleDeg, hyzer, _visualAngleRad: angleRad };
    }

    // --- Drawing ---
    function draw(ctx) {
        if (!active) return;
        ctx.save();

        // 1. Main disc icon (dotted circle)
        drawDiscIcon(ctx);

        // 2. Three power arc lines below the disc
        drawPowerArcs(ctx);

        // 3. Pull trail + drag disc (only while dragging)
        if (dragging && aim) {
            drawPullTrail(ctx);
        }

        // 4. Angle label at top
        if (aim) {
            drawAngleLabel(ctx);
        }

        ctx.restore();
    }

    const CANCEL_THRESHOLD = 0.05;

    function drawDiscIcon(ctx) {
        // Red when dragging near origin (release won't throw)
        const inCancelZone = dragging && aim && aim.power <= CANCEL_THRESHOLD;
        const color = inCancelZone ? '255,80,80' : '255,255,255';

        // Large dotted circle
        ctx.strokeStyle = inCancelZone ? `rgba(${color},0.8)` : `rgba(${color},0.6)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(discCenterX, discCenterY, discRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Red fill hint when in cancel zone
        if (inCancelZone) {
            ctx.fillStyle = 'rgba(255,80,80,0.15)';
            ctx.beginPath();
            ctx.arc(discCenterX, discCenterY, discRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Inner ring (solid, subtle)
        ctx.strokeStyle = `rgba(${color},0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(discCenterX, discCenterY, discRadius * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = `rgba(${color},0.4)`;
        ctx.beginPath();
        ctx.arc(discCenterX, discCenterY, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPowerArcs(ctx) {
        // Three curved arc lines at 33%, 66%, 100% of fanRadius
        // They span the fan angle below the disc
        const levels = [
            { frac: 0.33, alpha: 0.15 },
            { frac: 0.66, alpha: 0.20 },
            { frac: 1.00, alpha: 0.25 },
        ];

        levels.forEach(level => {
            const r = fanRadius * level.frac;
            ctx.strokeStyle = `rgba(255,255,255,${level.alpha})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            // Arc extends downward: PI/2 is center (down), spread by FAN_HALF_RAD
            ctx.arc(discCenterX, discCenterY, r,
                Math.PI / 2 - FAN_HALF_RAD,
                Math.PI / 2 + FAN_HALF_RAD);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }

    function drawPullTrail(ctx) {
        const angleRad = aim._visualAngleRad || 0;
        const dist = aim.power * fanRadius;

        // Target point (going downward from disc)
        const tx = discCenterX + Math.sin(angleRad) * dist;
        const ty = discCenterY + Math.cos(angleRad) * dist;

        // Trail line from disc center to drag point
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(discCenterX, discCenterY);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // Drag disc at finger position (same size as main disc dotted outline)
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, discRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring on drag disc
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tx, ty, discRadius * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // Fill drag disc slightly
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(tx, ty, discRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawAngleLabel(ctx) {
        let label = t('straight');
        let color = '#ffaa00';
        // For FH grip, pulling left = anhyzer, pulling right = hyzer (opposite of BH)
        if (aim.hyzer < -0.3) {
            label = isForehand() ? t('anhyzer') : t('hyzer');
            color = '#44dd44';
        } else if (aim.hyzer > 0.3) {
            label = isForehand() ? t('hyzer') : t('anhyzer');
            color = '#44dd44';
        }

        ctx.fillStyle = color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, canvas.width / 2, discCenterY - discRadius - 12);
    }

    // --- Public API ---
    function activate() {
        dragging = false;
        released = false;
        aim = null;

        // Disc icon near top-center, fan extends downward
        discCenterX = canvas.width / 2;
        discCenterY = canvas.height * 0.15;
        discRadius = canvas.width * 0.06;  // disc size relative to screen width
        fanRadius = canvas.height * 0.35;  // compact pull distance — fits comfortably on screen

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        active = true;
    }

    function deactivate() {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        active = false;
        dragging = false;
    }

    function getAim() {
        return aim;
    }

    function isReleased() {
        return released;
    }

    function isDragging() {
        return dragging;
    }

    function isOverDisc(px, py) {
        const dx = px - discCenterX;
        const dy = py - discCenterY;
        return Math.sqrt(dx * dx + dy * dy) <= discRadius * 1.5;
    }

    return { activate, deactivate, draw, getAim, isReleased, isDragging, isOverDisc };
}
