// Renderer: draws field, player, disc, flight path, disc selection, landing marker.
// Has no idea what state the game is in. Just draws what it's told.

import { t } from './i18n.js';

export function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');

    // Camera: offset in field-space meters. Adjusted to follow disc during flight.
    let cameraX = 0;
    let cameraY = 0;
    let cameraAngle = 0; // rotation so basket direction points up on screen

    // Visible field = 150 ft (~45.7m) tall by default. Can be overridden to zoom out.
    const DEFAULT_VISIBLE = 45.7; // 150 ft
    let visibleMeters = DEFAULT_VISIBLE;

    function getScale() {
        return canvas.height / visibleMeters;
    }

    function setVisibleMeters(m) {
        visibleMeters = m;
    }

    function resetZoom() {
        visibleMeters = DEFAULT_VISIBLE;
    }

    function setCameraAngle(angle) {
        cameraAngle = angle;
    }

    function fieldToScreen(fx, fy) {
        const scale = getScale();
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.85; // player near bottom

        // Offset from camera center
        let dx = fx - cameraX;
        let dy = fy - cameraY;

        // Rotate so basket direction (cameraAngle) points up on screen
        const cos = Math.cos(cameraAngle);
        const sin = Math.sin(cameraAngle);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        return {
            sx: cx + rx * scale,
            sy: cy - ry * scale, // flip Y
        };
    }

    const FAIRWAY_WIDTH = 12; // meters wide
    const DIST_SPACING_FT = 50; // distance markers every 50ft
    const DIST_SPACING_M = DIST_SPACING_FT * 0.3048; // ~15.24m

    function clear() {
        // Grass background
        ctx.fillStyle = '#2d7a3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const scale = getScale();

        // Generous visible field bounds (accounts for any camera rotation)
        const diagScreen = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
        const diagField = diagScreen / scale + 20;
        const leftM = cameraX - diagField;
        const rightM = cameraX + diagField;
        const topM = cameraY + diagField;
        const bottomM = cameraY - diagField;

        // --- Fairway (lighter central strip, drawn as rotated polygon) ---
        const fwHalf = FAIRWAY_WIDTH / 2;
        const fwCorners = [
            fieldToScreen(-fwHalf, bottomM),
            fieldToScreen(fwHalf, bottomM),
            fieldToScreen(fwHalf, topM),
            fieldToScreen(-fwHalf, topM),
        ];
        ctx.fillStyle = '#358a45';
        ctx.beginPath();
        ctx.moveTo(fwCorners[0].sx, fwCorners[0].sy);
        for (let i = 1; i < 4; i++) ctx.lineTo(fwCorners[i].sx, fwCorners[i].sy);
        ctx.closePath();
        ctx.fill();

        // --- Light grid (every 10m) ---
        const gridSpacing = 10;
        const gridPx = gridSpacing * scale;

        if (gridPx >= 5) {
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;

            // Vertical grid lines (fixed X, spanning field Y)
            const startX = Math.floor(leftM / gridSpacing) * gridSpacing;
            for (let fx = startX; fx <= rightM; fx += gridSpacing) {
                const p0 = fieldToScreen(fx, bottomM);
                const p1 = fieldToScreen(fx, topM);
                ctx.beginPath();
                ctx.moveTo(p0.sx, p0.sy);
                ctx.lineTo(p1.sx, p1.sy);
                ctx.stroke();
            }

            // Horizontal grid lines (fixed Y, spanning field X)
            const startY = Math.floor(bottomM / gridSpacing) * gridSpacing;
            for (let fy = startY; fy <= topM; fy += gridSpacing) {
                const p0 = fieldToScreen(leftM, fy);
                const p1 = fieldToScreen(rightM, fy);
                ctx.beginPath();
                ctx.moveTo(p0.sx, p0.sy);
                ctx.lineTo(p1.sx, p1.sy);
                ctx.stroke();
            }
        }

        // --- Distance markers every 50ft ---
        const startDist = Math.max(1, Math.floor(bottomM / DIST_SPACING_M)) * DIST_SPACING_M;
        for (let fy = startDist; fy <= topM; fy += DIST_SPACING_M) {
            const ft = Math.round(fy / 0.3048);
            if (ft <= 0) continue;

            // Line across fairway (field-space endpoints → screen)
            const lineLeft = fieldToScreen(-FAIRWAY_WIDTH / 2, fy);
            const lineRight = fieldToScreen(FAIRWAY_WIDTH / 2, fy);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(lineLeft.sx, lineLeft.sy);
            ctx.lineTo(lineRight.sx, lineRight.sy);
            ctx.stroke();
            ctx.setLineDash([]);

            // Distance sign (right edge of fairway in field space)
            const signPos = fieldToScreen(FAIRWAY_WIDTH / 2 + 1.5, fy);
            const fontSize = Math.max(8, Math.min(11, scale * 1.5));
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.font = `${Math.round(fontSize)}px monospace`;
            ctx.textAlign = 'left';
            ctx.fillText(`${ft}ft`, signPos.sx, signPos.sy + 3);
        }
    }

    // throwAnim: 0 = idle, 0→0.5 = reach back, 0.5→1 = release follow-through
    function drawPlayer(x, y, facingDeg, throwAnim) {
        const { sx, sy } = fieldToScreen(x, y);
        const s = getScale() * 1.8; // stick figure height ~1.8m
        const anim = throwAnim || 0;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(sx, sy - s, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();

        // Body (slight lean during throw)
        const lean = anim > 0 ? Math.sin(anim * Math.PI) * s * 0.08 : 0;
        ctx.beginPath();
        ctx.moveTo(sx + lean * 0.5, sy - s + s * 0.2);
        ctx.lineTo(sx + lean, sy - s * 0.35);
        ctx.stroke();

        // Arms — animate for throw
        const shoulderX = sx + lean * 0.7;
        const shoulderY = sy - s * 0.65;
        if (anim <= 0) {
            // Idle: arms out to sides
            ctx.beginPath();
            ctx.moveTo(shoulderX - s * 0.3, shoulderY);
            ctx.lineTo(shoulderX + s * 0.3, shoulderY);
            ctx.stroke();
        } else if (anim < 0.5) {
            // Reach back (right arm goes back-right, left arm forward)
            const reach = anim / 0.5; // 0→1
            ctx.beginPath();
            // Right arm reaches back
            ctx.moveTo(shoulderX, shoulderY);
            ctx.lineTo(shoulderX + s * 0.35 * reach, shoulderY + s * 0.1 * reach);
            ctx.stroke();
            // Left arm forward
            ctx.beginPath();
            ctx.moveTo(shoulderX, shoulderY);
            ctx.lineTo(shoulderX - s * 0.25, shoulderY - s * 0.1);
            ctx.stroke();
        } else {
            // Release / follow-through (right arm swings forward-left)
            const release = (anim - 0.5) / 0.5; // 0→1
            ctx.beginPath();
            // Right arm follows through to left
            ctx.moveTo(shoulderX, shoulderY);
            ctx.lineTo(
                shoulderX + s * 0.35 * (1 - release * 2),
                shoulderY - s * 0.15 * release
            );
            ctx.stroke();
            // Left arm tucks
            ctx.beginPath();
            ctx.moveTo(shoulderX, shoulderY);
            ctx.lineTo(shoulderX - s * 0.15, shoulderY + s * 0.15);
            ctx.stroke();
        }

        // Legs (slight step during throw)
        const step = anim > 0 ? Math.sin(anim * Math.PI) * s * 0.1 : 0;
        ctx.beginPath();
        ctx.moveTo(sx + lean, sy - s * 0.35);
        ctx.lineTo(sx - s * 0.25 + step, sy);
        ctx.moveTo(sx + lean, sy - s * 0.35);
        ctx.lineTo(sx + s * 0.25 - step, sy);
        ctx.stroke();
    }

    function drawDisc(x, y, color) {
        const { sx, sy } = fieldToScreen(x, y);
        ctx.fillStyle = color || '#fff';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Rim
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawFlightPath(points, currentIndex) {
        if (!points || points.length < 2) return;
        const end = Math.min(currentIndex, points.length - 1);

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();

        const first = fieldToScreen(points[0].x, points[0].y);
        ctx.moveTo(first.sx, first.sy);

        for (let i = 1; i <= end; i++) {
            const p = fieldToScreen(points[i].x, points[i].y);
            ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawLandingMarker(x, y, distance) {
        const { sx, sy } = fieldToScreen(x, y);

        // X marker
        const size = 8;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - size, sy - size);
        ctx.lineTo(sx + size, sy + size);
        ctx.moveTo(sx + size, sy - size);
        ctx.lineTo(sx - size, sy + size);
        ctx.stroke();

        // Distance label
        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(distance)}m / ${Math.round(distance * 3.281)}ft`, sx, sy - 14);
    }

    function drawDiscSelect(discs, selectedIndex, onSelect) {
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('select_disc'), canvas.width / 2, 40);

        const categories = ['putter', 'mid', 'fairway', 'distance'];
        const catLabels = [t('cat_putters'), t('cat_mids'), t('cat_fairway'), t('cat_distance')];
        const colWidth = canvas.width / 4;
        const startY = 70;

        // Store hit areas for tap detection
        const hitAreas = [];

        categories.forEach((cat, ci) => {
            const cx = colWidth * ci + colWidth / 2;

            // Category header
            ctx.fillStyle = '#aaa';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(catLabels[ci], cx, startY);

            const catDiscs = [];
            discs.forEach((d, i) => {
                if (d.category === cat) catDiscs.push({ disc: d, index: i });
            });

            catDiscs.forEach((item, ri) => {
                const y = startY + 30 + ri * 70;
                const isSelected = item.index === selectedIndex;

                // Card background
                ctx.fillStyle = isSelected ? 'rgba(100,200,100,0.3)' : 'rgba(255,255,255,0.1)';
                const cardX = cx - colWidth / 2 + 4;
                const cardW = colWidth - 8;
                const cardH = 60;
                ctx.fillRect(cardX, y - 5, cardW, cardH);

                // Border if selected
                if (isSelected) {
                    ctx.strokeStyle = '#4f4';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cardX, y - 5, cardW, cardH);
                }

                // Disc name
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 13px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(item.disc.name, cx, y + 14);

                // Flight numbers (use display numbers if available)
                ctx.fillStyle = '#ccc';
                ctx.font = '11px monospace';
                const dn = item.disc.numbers || [item.disc.speed, item.disc.glide, item.disc.turn, item.disc.fade];
                const nums = `${dn[0]}/${dn[1]}/${dn[2]}/${dn[3]}`;
                ctx.fillText(nums, cx, y + 32);

                hitAreas.push({
                    x: cardX, y: y - 5, w: cardW, h: cardH,
                    index: item.index,
                });
            });
        });

        // Return hit areas so game.js can handle taps
        return hitAreas;
    }

    function drawDirectionArrow(x, y, angleDeg) {
        const { sx, sy } = fieldToScreen(x, y);
        const angleRad = angleDeg * (Math.PI / 180);
        const arrowLenM = 4; // meters in field space

        // Compute tip in field space, then convert to screen (handles rotation)
        const tipFieldX = x + Math.sin(angleRad) * arrowLenM;
        const tipFieldY = y + Math.cos(angleRad) * arrowLenM;
        const tip = fieldToScreen(tipFieldX, tipFieldY);
        const tipX = tip.sx;
        const tipY = tip.sy;

        // Main line
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Arrowhead
        const headLen = 10;
        const headAngle = 0.4; // radians
        const baseAngle = Math.atan2(tipY - sy, tipX - sx);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX - headLen * Math.cos(baseAngle - headAngle),
            tipY - headLen * Math.sin(baseAngle - headAngle)
        );
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX - headLen * Math.cos(baseAngle + headAngle),
            tipY - headLen * Math.sin(baseAngle + headAngle)
        );
        ctx.stroke();

        // Angle label: show visual deviation from straight up (basket direction)
        const screenAngleDeg = Math.atan2(tipX - sx, -(tipY - sy)) * (180 / Math.PI);
        if (Math.abs(screenAngleDeg) > 0.5) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            const labelFieldX = x + Math.sin(angleRad) * (arrowLenM + 1.5);
            const labelFieldY = y + Math.cos(angleRad) * (arrowLenM + 1.5);
            const lbl = fieldToScreen(labelFieldX, labelFieldY);
            ctx.fillText(`${screenAngleDeg > 0 ? '+' : ''}${Math.round(screenAngleDeg)}°`, lbl.sx, lbl.sy);
        }
    }

    function drawBush(bx, by, bw, bh) {
        const { sx, sy } = fieldToScreen(bx, by);
        const scale = getScale();
        const sw = bw * scale;
        const sh = bh * scale;
        const rx = sw / 2;
        const ry = sh / 2;

        // Soft green ellipse
        ctx.fillStyle = 'rgba(50,120,50,0.6)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,80,30,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawOB(ox, oy, ow, oh) {
        const halfW = ow / 2;
        const halfH = oh / 2;
        const corners = [
            fieldToScreen(ox - halfW, oy + halfH),
            fieldToScreen(ox + halfW, oy + halfH),
            fieldToScreen(ox + halfW, oy - halfH),
            fieldToScreen(ox - halfW, oy - halfH),
        ];

        // Blue semi-transparent fill
        ctx.fillStyle = 'rgba(40,80,200,0.25)';
        ctx.beginPath();
        ctx.moveTo(corners[0].sx, corners[0].sy);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
        ctx.closePath();
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(40,80,200,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(corners[0].sx, corners[0].sy);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // OB label at center
        const center = fieldToScreen(ox, oy);
        ctx.fillStyle = 'rgba(40,80,200,0.5)';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('ob_label'), center.sx, center.sy);
    }

    function drawTeePad(tx, ty, tw, th, angleRad) {
        // Draw rotated rectangle oriented toward the basket
        // angleRad = atan2(dx, dy) from tee to basket in field space
        const halfW = tw / 2;
        const halfH = th / 2;

        // Forward (along th) and perpendicular (along tw) unit vectors
        const fwdX = Math.sin(angleRad);
        const fwdY = Math.cos(angleRad);
        const perpX = -fwdY;
        const perpY = fwdX;

        // Four corners in field space
        const corners = [
            fieldToScreen(tx - halfW * perpX - halfH * fwdX, ty - halfW * perpY - halfH * fwdY),
            fieldToScreen(tx + halfW * perpX - halfH * fwdX, ty + halfW * perpY - halfH * fwdY),
            fieldToScreen(tx + halfW * perpX + halfH * fwdX, ty + halfW * perpY + halfH * fwdY),
            fieldToScreen(tx - halfW * perpX + halfH * fwdX, ty - halfW * perpY + halfH * fwdY),
        ];

        // Concrete-colored rotated rectangle
        ctx.fillStyle = 'rgba(180,175,160,0.6)';
        ctx.beginPath();
        ctx.moveTo(corners[0].sx, corners[0].sy);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(140,135,120,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    function drawTree(tx, ty, tw, th) {
        const { sx, sy } = fieldToScreen(tx, ty);
        const scale = getScale();
        const sw = tw * scale;
        const sh = th * scale;

        // Trunk rectangle
        ctx.fillStyle = 'rgba(90,60,30,0.85)';
        ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
        ctx.strokeStyle = 'rgba(60,40,15,0.9)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);
    }

    function setCamera(x, y) {
        cameraX = x;
        cameraY = y;
    }

    return {
        ctx,
        clear,
        getScale,
        drawPlayer,
        drawDisc,
        drawBush,
        drawTree,
        drawOB,
        drawTeePad,
        drawFlightPath,
        drawLandingMarker,
        drawDiscSelect,
        drawDirectionArrow,
        setCamera,
        setCameraAngle,
        setVisibleMeters,
        resetZoom,
        fieldToScreen,
    };
}
