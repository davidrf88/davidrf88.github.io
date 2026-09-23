// Pure math flight model. No DOM, no canvas, no side effects.
// Based on real disc golf aerodynamics:
//   - Disc tilt (hyzer angle) is tracked dynamically through the flight
//   - Turn number controls how much the disc flips at high speed (understable = more flip)
//   - Fade number controls how hard the disc dumps to hyzer at low speed
//   - Overstable discs (high fade, turn=0) resist flipping and fight back to hyzer
//   - Glide effectiveness depends on current tilt: flat = max glide, tilted = reduced
//   - Flip lift: disc gains extra glide when transitioning toward flat (hyzer flip bonus)
//   - Speed rating determines whether turn activates (underpowering kills turn)
//
// Coordinate system: Y = forward (up the fairway), X = lateral (positive = right for RHBH).

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

    // --- Max potential distance (at perfect flat throw) ---
    const baseDistance = speed * 11;
    const glideMultiplier = 1.0 + (glide - 3) * 0.1;
    const powerFactor = 0.1 + power * 0.9;
    const maxDistance = baseDistance * glideMultiplier * powerFactor;

    // --- Speed rating vs throw power ---
    const armSpeedRatio = Math.min(1.5, (power * 14) / speed);

    // Turn activation: requires matching or exceeding disc speed
    const turnActivation = Math.max(0, Math.min(1, (armSpeedRatio - 0.5) / 0.5));
    const turnScale = turnActivation * Math.min(1.5, armSpeedRatio);

    // Fade amplification when underpowered
    const fadeScale = 1.0 + Math.max(0, 1.0 - armSpeedRatio) * 0.8;

    // --- Effective disc characteristics ---
    // Turn: negative = understable (flips to anhyzer at speed)
    // Fade: positive = overstable (dumps to hyzer when slow)
    const effectiveTurn = turn * turnScale; // e.g. Leopard: -2*1.5 = -3.0, Zone: 0
    const effectiveFade = fade * fadeScale;  // e.g. Zone: 3*1.0 = 3.0, Mako3: 0

    // --- Speed-based aerodynamic intensity ---
    // Faster discs generate more aerodynamic force, so turn/fade hit harder.
    // Normalized around speed 7 (midrange). Putter (speed 2) ≈ 0.53, Driver (speed 12) ≈ 1.31.
    const aeroFactor = Math.sqrt(speed / 7);

    // --- Simulate flight path with dynamic tilt ---
    const STEPS = 150;
    const maxStepDist = maxDistance / STEPS;

    // Initial direction from throw angle
    let dirRad = angleDeg * (Math.PI / 180);
    let x = 0;
    let y = 0;
    const points = [{ x: 0, y: 0 }];

    // Disc tilt angle in radians. Negative = hyzer, positive = anhyzer, 0 = flat.
    let tiltRad = hyzer * (Math.PI / 3); // ±60° max initial tilt
    let prevTiltRad = tiltRad;
    let totalDist = 0;

    for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;

        // --- Velocity decay ---
        const speedRatio = Math.max(0.05, 1.0 - t * (0.6 + t * 0.35));
        const slowness = 1.0 - speedRatio;

        // === TILT EVOLUTION ===
        // The disc's tilt changes each step based on two competing forces:
        //
        // 1. Turn torque (high speed): driven by turn NUMBER
        //    Turn range: -5 (very understable) to +1 (overstable)
        //    turn=0 is already stable — only negative turn flips toward anhyzer
        //    Scales with speedRatio^2 (aerodynamic force ~ V^2)
        const turnTorque = -effectiveTurn * speedRatio * speedRatio * 0.012 * aeroFactor;

        // 2. Fade torque (low speed): driven by fade NUMBER
        //    Always pulls toward hyzer (-tilt)
        //    Blended onset: starts earlier than pure slowness² so high-fade
        //    discs (Nuke OS, Firebird) begin curving by ~30% of flight
        const fadeOnset = slowness * (0.4 + 0.6 * slowness);
        const fadeTorque = -effectiveFade * fadeOnset * 0.016 * aeroFactor;

        // 3. Stability restoring force: resists any tilt away from slight hyzer
        //    Overstability = high fade + high turn (turn=0 is stable, turn=-3 is not)
        //    Stability score: fade contributes positively, negative turn reduces it
        //    Zone (0/3): score = 3 + 0 = 3.0 (very stable)
        //    Mako3 (0/0): score = 0 + 0 = 0.0 (no restoring force)
        //    Leopard (-2/1): score = 1 + (-2*0.5) = 0.0 (understable, no resistance)
        //    Buzzz (-1/1): score = 1 + (-1*0.5) = 0.5 (slightly stable)
        const stabilityScore = Math.max(0, effectiveFade + effectiveTurn * 0.5);

        // Force pulls toward slight hyzer, proportional to current tilt deviation.
        // Ramps up with t² so disc rides its initial angle early in the flight
        // before the gyroscopic precession overcomes the tilt.
        const targetTilt = -0.05; // slight natural hyzer bias
        const tiltDeviation = tiltRad - targetTilt;
        const stabilityRamp = Math.min(1, t * t * 4); // 0→1 over first ~50% of flight
        const stabilityForce = -stabilityScore * tiltDeviation * speedRatio * 0.012 * aeroFactor * stabilityRamp;

        // Apply all tilt forces
        tiltRad += turnTorque + fadeTorque + stabilityForce;

        // Clamp tilt to reasonable range (±70°)
        tiltRad = Math.max(-1.22, Math.min(1.22, tiltRad));

        // === GLIDE FROM TILT ===
        // Flat disc = max glide = full step distance
        // Tilted disc = reduced lift = shorter step = lands sooner
        const baseGlide = Math.max(0.2, Math.cos(tiltRad));

        // Flip lift bonus: when disc is transitioning toward flat (|tilt| decreasing),
        // it gains altitude from the changing angle of attack, extending flight.
        // This is why hyzer flips produce more distance than flat throws —
        // the disc actively gains lift as it flips up from hyzer to flat.
        const tiltDelta = Math.abs(prevTiltRad) - Math.abs(tiltRad);
        // tiltDelta > 0 means disc is flattening (gaining lift)
        // Scale with speed (more lift at high speed) and cap the bonus
        const flipLift = Math.max(0, tiltDelta * speedRatio * 8);
        const glideEfficiency = Math.min(1.3, baseGlide + flipLift);

        const stepDist = maxStepDist * glideEfficiency;
        prevTiltRad = tiltRad;

        // === LATERAL CURVATURE ===
        // Turn effect is handled entirely through tilt: turnTorque → tiltRad → bankForce.
        // No separate lateral turn force needed (would double-dip).

        // Fade force: all discs curve left at low speed (RHBH)
        const fadeForce = -effectiveFade * fadeOnset * 0.007 * aeroFactor;

        // Bank force: tilted disc banks in the direction of tilt
        // Anhyzer (+tilt) banks right, hyzer (-tilt) banks left
        // Stronger at high speed (more lift = more bank effect)
        const bankForce = tiltRad * 0.008 * speedRatio;

        dirRad += fadeForce + bankForce;

        // Step forward
        x += Math.sin(dirRad) * stepDist;
        y += Math.cos(dirRad) * stepDist;
        totalDist += stepDist;

        points.push({ x, y });
    }

    // Flight time based on actual distance traveled
    const flightTimeMs = totalDist * 12 * 3.5;

    return { points, totalDistance: totalDist, flightTimeMs };
}
