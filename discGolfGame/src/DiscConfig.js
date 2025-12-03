// Disc flight configuration constants
export const DiscConfig = {
    // World/Map configuration
    world: {
        width: 8000,
        height: 8000,
        gridSize: 100          // Grid line spacing
    },
    
    // Speed configuration
    speed: {
        base: 5,              // Base speed value
        range: { min: 1, max: 15 },  // Speed range
        baseMovement: 3       // Base pixels per frame movement speed
    },
    
    // Glide configuration
    glide: {
        base: 4,              // Base glide value
        range: { min: 1, max: 7 },   // Glide range
        maxBonus: 1.5         // Maximum time bonus in seconds at extremes (±1.5s)
    },
    
    // Turn configuration
    turn: {
        base: 0,              // Base turn value (no turn)
        range: { min: -5, max: 3 },  // Turn range
        angleChangeRate: 0.5, // Base rate of angle change per frame
        phases: {
            beginning: 0.6,   // Turn intensity at beginning phase (30%)
            mid: 1.0,         // Turn intensity at mid phase (100%)
            end: 0.3          // Turn intensity at end phase (10%)
        }
    },
    
    // Fade configuration
    fade: {
        base: 0,              // Base fade value (no fade)
        range: { min: 0, max: 4 },   // Fade range
        angleDecreaseRate: 1,  // Rate of angle decrease per frame
        phases: {
            early: 0.33333,   // First third of fade phase (33%)
            mid: 0.33333,     // Second third of fade phase (33%)
            late: 0.33333     // Final third of fade phase (33%)
        },
        forwardSpeedMultiplier: {
            early: 0.5,       // Full forward speed in early fade
            mid: 0.3,         // 50% forward speed in mid fade
            late: 0.1         // 20% forward speed in late fade
        },
        aggressiveness: {
            early: 6.0,       // Normal fade aggressiveness in early phase
            mid: 9.5,         // 1.5x more aggressive in mid phase
            late: 10.0         // 2x more aggressive in late phase
        }
    },
    
    // Power configuration
    power: {
        base: 80,             // Base power for turn multiplier calculations (80%)
        exaggerationFactor: 0.25  // Additional turn at 100% power (1.25x total)
    },
    
    // Angle configuration
    angle: {
        base: 0,              // Base angle (flat)
        range: { min: -90, max: 90 },  // Angle range (hyzer to anhyzer)
        clamp: { min: -45, max: 45 }   // Throw parameter clamp
    },
    
    // Movement force
    movement: {
        angleTurnForce: 0.15  // Force multiplier for angle-based turning
    },
    
    // Flying time configuration
    flyingTime: {
        base: 6,              // Base flying time in seconds at power=100 and angle=0
        angleReduction: 0.5,  // Angle factor reduction (0.5 at ±45 degrees)
        endedDelay: 5         // Seconds to wait in 'ended' state before returning to 'not thrown'
    },
    
    // Flight phases (percentages of total flight time)
    phases: {
        turning: 0.5,         // Turning phase is 80% of flight
        fading: 0.5,          // Fading phase is 20% of flight
        turnPhases: {
            beginning: 0.33333,  // First third of turning phase
            mid: 0.33333,        // Second third of turning phase
            end: 0.33333         // Final third of turning phase
        }
    }
};
