// Disc definitions
// speed/glide/turn/fade = engine-tuned values for simulation
// numbers = real flight numbers for display (Speed / Glide / Turn / Fade)
// Categories: putter (speed 1-3), mid (4-6), fairway (7-9), distance (10+)

export const DISCS = [
    // Putters
    { name: "Aviar",     category: "putter",   speed: 3,    glide: 3,   turn:  0,    fade: 1,   numbers: [2, 3, 0, 1] },
    { name: "Luna",      category: "putter",   speed: 3,    glide: 3.5, turn:  0,    fade: 3,   numbers: [3, 3, 0, 3] },
    { name: "Zone",      category: "putter",   speed: 3,    glide: 3,   turn:  1,    fade: 9,   numbers: [4, 3, 0, 3] },

    // Midranges
    { name: "Uplink",    category: "mid",      speed: 4,    glide: 4,   turn: -3,    fade: 1,   numbers: [5, 5, -3, 0.5] },
    { name: "Buzzz",     category: "mid",      speed: 4,    glide: 4,   turn: -1,    fade: 6,   numbers: [5, 4, -1, 1] },
    { name: "Roc3",       category: "mid",      speed: 4,    glide: 3.8, turn: -0.2,  fade: 8,   numbers: [5, 4, 0, 3] },

    // Fairway drivers
    { name: "Leopard",   category: "fairway",  speed: 4.5,  glide: 4.3, turn: -2,    fade: 1,   numbers: [6, 5, -2, 1] },
    { name: "Passion",   category: "fairway",  speed: 4.5,  glide: 4.3, turn: -1,    fade: 4,   numbers: [8, 5, -1, 1] },
    { name: "Firebird",  category: "fairway",  speed: 4.2,  glide: 4,   turn:  0.5,  fade: 6,   numbers: [9, 3, 0, 4] },

    // Distance drivers
    { name: "Diamond",   category: "distance", speed: 5,    glide: 5,   turn: -3.5,  fade: 2,   numbers: [8, 6, -3, 1] },
    { name: "Wave",      category: "distance", speed: 5,    glide: 5,   turn: -1,    fade: 6,   numbers: [11, 5, -1, 3] },
    { name: "Destroyer", category: "distance", speed: 6,    glide: 4.5, turn:  0,    fade: 8,   numbers: [12, 5, -1, 3] },

];
