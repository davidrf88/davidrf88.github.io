// Phase-based disc golf flight model. No DOM, no canvas, no side effects.
//
// 4 flight phases with distinct physics:
//   Phase 1 - Launch (25%):  Mostly straight, flip force from turn at high speed
//   Phase 2 - Mid-flight (35%): Stability & glide dominate, fade starts growing
//   Phase 3 - Fade (25%):   Low speed, fade pulls hard toward hyzer
//   Phase 4 - Ground (15%): Slide or skip depending on remaining speed
//
// Coordinate system: Y = forward (up the fairway), X = lateral (positive = right for RHBH).
// Tilt: negative = hyzer (banks left), positive = anhyzer (banks right), 0 = flat.
import { isLefty, isForehand } from './settings.js';

// Reference distance table: speed → max distance in meters (at full power, flat, avg glide).
const DIST_TABLE = [
    // [speed, meters]
    [2,  61],   // 200 ft
    [3,  70],   // 250 ft
    [4,  80],   // 280 ft
    [5,  90],   // 300 ft
    [6,  98],   // 320 ft
    [7,  107],  // 350 ft
    [9,  115],  // 380 ft
    [11, 120],  // 400 ft
    [12, 125],  // 420 ft
    [13, 128],  // 450 ft
    [14, 133],  // 500 ft
];

function distanceForSpeed(spd) {
    if (spd <= DIST_TABLE[0][0]) return DIST_TABLE[0][1];
    if (spd >= DIST_TABLE[DIST_TABLE.length - 1][0]) return DIST_TABLE[DIST_TABLE.length - 1][1];
    for (let i = 0; i < DIST_TABLE.length - 1; i++) {
        const [s0, d0] = DIST_TABLE[i];
        const [s1, d1] = DIST_TABLE[i + 1];
        if (spd >= s0 && spd <= s1) {
            const t = (spd - s0) / (s1 - s0);
            return d0 + (d1 - d0) * t;
        }
    }
    return DIST_TABLE[DIST_TABLE.length - 1][1];
}

// Smoothly interpolate between two values over a normalized range
function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
}

// Smooth 0→1 transition (cubic hermite)
function smoothstep(x) {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
}

/**
 * @param {Object} disc - { speed, glide, turn, fade }
 * @param {Object} throwInput - { power: 0-1, angleDeg: -60 to 60, hyzer: -1 to 1 }
 *   power:    0 = dribble, 1 = max throw
 *   angleDeg: throw direction relative to straight ahead (negative=left, positive=right)
 *   hyzer:    -1 = full hyzer, 0 = flat, +1 = full anhyzer
 * @returns {{ points: {x:number, y:number}[], totalDistance: number, flightTimeMs: number }}
 */
export function calculateFlight(disc, throwInput) {
    const { speed, glide, turn, fade } = disc;
    const { power, angleDeg, hyzer } = throwInput;

    // Mirror curve for left-handed players and/or forehand grip.
    // Instead of flipping X coordinates, we negate the turn/fade forces directly
    // so the curve reverses naturally while aim direction and hyzer stay correct.
    const mirrorLefty = isLefty() ? -1 : 1;
    const mirrorGrip = isForehand() ? -1 : 1;
    const mirrorX = mirrorLefty * mirrorGrip;

    // --- Max potential distance (at perfect flat throw) ---
    const baseDistance = distanceForSpeed(speed);
    const glideMultiplier = 1.0 + (glide - 3) * 0.10;
    const powerFactor = 0.1 + power * 0.9;
    const maxDistance = baseDistance * glideMultiplier * powerFactor;

    // --- Arm speed vs disc speed ---
    const armSpeedRatio = Math.min(1.5, (power * 14) / speed);

    // Turn activation: need enough arm speed to engage turn
    // Below ratio 0.7 turn barely activates; at 1.0+ full activation
    // Also scales directly with power — low power = less spin = less turn
    const armTurnActivation = Math.max(0, Math.min(1, (armSpeedRatio - 0.5) / 0.5));
    const powerTurnScale = Math.pow(Math.max(0, Math.min(1, (power - 0.25) / 0.55)), 2.0); // ramps 0.25→0.80, steep curve
    const turnActivation = armTurnActivation * powerTurnScale;

    // Fade amplification when underpowered — slower arm = disc dumps out harder
    // At 50% power: ~2x fade, at 25% power: ~2.5x fade, at 100%: 1x (no amp)
    const fadeAmp = 1.0 + (1.0 - power) * 2.0;

    // --- Simulation setup ---
    const STEPS = 150;
    const maxStepDist = maxDistance / STEPS;

    // Phase boundaries (step indices)
    const LAUNCH_END = 30;    // 20% — steps 0-30
    const MID_END = 42;       // 8%  — steps 31-42  (brief, transitions into fade early)
    const FADE_END = 132;     // 60% — steps 43-132 (long fade, gradual speed decay)
    // Ground: steps 133-150   // 12%

    // Initial state
    let dirRad = angleDeg * (Math.PI / 180);
    let x = 0;
    let y = 0;
    const points = [{ x: 0, y: 0 }];

    // Disc tilt: ±60° max initial tilt from hyzer input
    // Negate hyzer for mirrored grip — FH wrist angle is reversed
    let tiltRad = (hyzer * mirrorX) * (Math.PI / 3);
    let prevTiltRad = tiltRad;

    const PHASE_NAMES = ['Launch', 'Mid-flight', 'Fade', 'Ground'];
    let height = 1.5; // start at release height (~1.5m)
    const meta = [{ speed: 1.0, angle: tiltRad * (180 / Math.PI), phase: 'Launch', height }];
    let totalDist = 0;

    // Speed at phase entry points (for continuous decay)
    // Launch:  1.0 → 0.80
    // Mid:     0.80 → 0.65
    // Fade:    0.65 → 0.30  (gradual decay over long phase — disc keeps moving through hook)
    // Ground:  0.30 → 0.0
    const PHASE_SPEEDS = [1.0, 0.80, 0.65, 0.30, 0.0];

    // Track speed at ground entry for skip detection
    let speedAtGroundEntry = PHASE_SPEEDS[3];

    // Blend radius: transitions happen over ±BLEND steps around each boundary
    const BLEND = 8;

    // Skip threshold for ground phase
    const SKIP_THRESHOLD = 0.20;

    // Accumulated tilt drag penalty — flat disc retains more speed
    let tiltDragAccum = 0;

    for (let i = 1; i <= STEPS; i++) {
        // --- Speed ratio: base decay from phase schedule ---
        let baseSpeed;
        if (i <= LAUNCH_END) {
            baseSpeed = lerp(PHASE_SPEEDS[0], PHASE_SPEEDS[1], i / LAUNCH_END);
        } else if (i <= MID_END) {
            baseSpeed = lerp(PHASE_SPEEDS[1], PHASE_SPEEDS[2], (i - LAUNCH_END) / (MID_END - LAUNCH_END));
        } else if (i <= FADE_END) {
            baseSpeed = lerp(PHASE_SPEEDS[2], PHASE_SPEEDS[3], (i - MID_END) / (FADE_END - MID_END));
        } else {
            baseSpeed = lerp(PHASE_SPEEDS[3], PHASE_SPEEDS[4], (i - FADE_END) / (STEPS - FADE_END));
        }

        // Tilt drag: tilted disc creates more air resistance, decelerating faster.
        // Flat disc (tilt=0) adds no extra drag. Max tilt adds ~30% extra decay.
        const tiltDragRate = Math.abs(tiltRad) * 0.002;
        tiltDragAccum += tiltDragRate;
        const speedRatio = Math.max(0.05, baseSpeed * (1.0 - Math.min(0.3, tiltDragAccum)));

        const v2 = speedRatio * speedRatio;

        // === SMOOTH PHASE WEIGHTS ===
        // Each transition blends over 2*BLEND steps centered on the boundary.
        // Weights sum to 1.0 and transition smoothly (no abrupt jumps).
        const t_lm = smoothstep((i - LAUNCH_END + BLEND) / (2 * BLEND)); // launch→mid
        const t_mf = smoothstep((i - MID_END + BLEND) / (2 * BLEND));    // mid→fade
        const t_fg = smoothstep((i - FADE_END + BLEND) / (2 * BLEND));   // fade→ground

        const launchW = 1 - t_lm;
        const midW    = t_lm * (1 - t_mf);
        const fadeW   = t_mf * (1 - t_fg);
        const groundW = t_fg;
        const airW    = 1 - groundW; // combined air weight

        // Dominant phase label for debug display
        let phase;
        if (launchW >= midW && launchW >= fadeW && launchW >= groundW) phase = 0;
        else if (midW >= fadeW && midW >= groundW) phase = 1;
        else if (fadeW >= groundW) phase = 2;
        else phase = 3;

        // === TILT FORCES (smoothly blended) ===
        // Turn: negative turn value → positive flip toward anhyzer (right for RHBH)
        //   turn = 0: barely turns, -1: slight, -2: decent, -5: extreme flip
        //   Coefficient blends: launch(0.004) → mid(0.005) → fade(0.001) → ground(0)
        const turnCoeff = launchW * 0.0045 + midW * 0.0035 + fadeW * 0.0005;
        const turnTilt = -turn * turnActivation * turnCoeff * v2;

        // Fade: always pulls toward hyzer (negative tilt = left for RHBH)
        //   Coefficients tuned so fade=4 disc reaches ~20-25° tilt (not clamped at 70°).
        //   Too much tilt kills glide via cos(tilt), destroying distance.
        const fadeTilt = launchW * (-fade * fadeAmp * 0.0005 * (1.0 - speedRatio))
                       + midW * (-fade * fadeAmp * 0.0040 * (1.0 - speedRatio))
                       + fadeW * (-fade * fadeAmp * 0.0030);

        const tiltForce = turnTilt + fadeTilt;

        // Damping + apply (scaled by airW so ground phase freezes tilt)
        const damping = -tiltRad * 0.012;
        tiltRad += (tiltForce + damping) * airW;
        tiltRad = Math.max(-1.22, Math.min(1.22, tiltRad));

        // === GLIDE EFFICIENCY ===
        // Softened: tilt reduces glide but not as harshly as raw cos(tilt).
        // A disc fading at 30° tilt shouldn't lose half its glide — it's still flying.
        const baseGlide = Math.max(0.3, Math.cos(tiltRad * 0.5));

        // Flip lift bonus: when disc transitions toward flat (|tilt| decreasing),
        // the changing angle of attack generates extra lift. This is why hyzer flips
        // and flex shots produce more distance than flat throws — the disc rides
        // through the peak glide zone with a bonus from the transition.
        const tiltDelta = Math.abs(prevTiltRad) - Math.abs(tiltRad);
        const flipLift = Math.max(0, tiltDelta * speedRatio * 6.0);
        const glideEff = Math.min(1.3, baseGlide + flipLift);
        prevTiltRad = tiltRad;

        // Glide bonus peaks in mid-flight (blended in/out smoothly)
        const glideBonus = 1.0 + midW * (glide - 3) * 0.04;

        // === LATERAL CURVATURE (smoothly blended) ===
        const bankCoeff = (launchW + midW) * 0.022 + fadeW * 0.028;
        const speedFloor = (launchW + midW) * 0.15 + fadeW * 0.30;
        // mirrorX flips lateral curve for lefty/forehand without changing tilt dynamics
        const bankForce = tiltRad * bankCoeff * Math.max(speedFloor, speedRatio) * airW * mirrorX;
        dirRad += bankForce;

        // === STEP DISTANCE ===
        // Air: forward momentum blended across phases
        const fwdMomentum = launchW * 1.0
                          + midW * (0.85 + 0.15 * speedRatio)
                          + fadeW * (0.45 + 0.45 * speedRatio);
        const airStepDist = maxStepDist * speedRatio * glideEff * glideBonus * fwdMomentum * 2.2;

        // Ground: skip or slide
        let groundStepDist = maxStepDist * speedRatio * 0.3; // default slide
        if (speedAtGroundEntry > SKIP_THRESHOLD) {
            const skipIntensity = (speedAtGroundEntry - SKIP_THRESHOLD) / (1.0 - SKIP_THRESHOLD);
            const groundLocalT = Math.max(0, (i - FADE_END) / (STEPS - FADE_END));
            const skipAngle = tiltRad * 0.08 * skipIntensity * (1.0 - groundLocalT) * mirrorX;
            dirRad += skipAngle * groundW;
            groundStepDist = maxStepDist * speedRatio * 0.6;
        }

        // Blend air and ground step distances
        const stepDist = airStepDist * airW + groundStepDist * groundW;

        // Step forward
        x += Math.sin(dirRad) * stepDist;
        y += Math.cos(dirRad) * stepDist;
        totalDist += stepDist;

        // === HEIGHT (vertical) ===
        // Disc rises during launch/mid (lift from speed + glide), descends during fade/ground.
        // Lift proportional to speed and glide; gravity always pulls down.
        const lift = speedRatio * glideEff * 0.08 * (glide / 4);
        const gravity = 0.045;
        height += (lift - gravity) * airW;
        if (phase === 3) height -= 0.12; // ground phase: rapid descent
        height = Math.max(0, height);

        points.push({ x, y });
        meta.push({
            speed: speedRatio,
            angle: tiltRad * (180 / Math.PI),
            phase: PHASE_NAMES[phase],
            height,
        });
    }

    // Flight time based on actual distance traveled
    const flightTimeMs = totalDist * 12 * 3.5;

    return { points, meta, totalDistance: totalDist, flightTimeMs };
}
