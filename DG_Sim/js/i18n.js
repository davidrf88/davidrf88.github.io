// i18n: simple translation module.
// Spanish is default. Toggle between 'en' and 'es'.

let lang = 'es';

const strings = {
    en: {
        // Menu
        title: 'DISC GOLF SIM',
        select_mode: 'Select a mode',
        throwing_lab: 'THROWING LAB',
        throwing_lab_help: 'Practice throws & see flight paths',
        putting_lab_title: 'PUTTING LAB',
        putting_lab_help: 'Precision putting minigame',
        play_hole: 'PLAY HOLE',
        play_hole_help: 'Play a full hole start to finish',
        courses: 'COURSES',
        courses_help: 'Choose a course to play',
        select_course: 'Select a course',
        select_layout: 'Select a layout',
        holes_label: 'Holes',
        par_label: 'Par',
        distance_label: 'Distance',

        // Buttons
        back: 'BACK',
        disc: 'DISC',
        cancel: 'CANCEL',
        continue_btn: 'CONTINUE',
        rethrow: 'RETHROW',
        explore: 'EXPLORE',
        putt: 'PUTT',
        retry: 'RETRY',
        menu: 'MENU',
        tap: 'TAP',

        // Throwing lab
        drag_to_aim: 'Drag to aim',
        tap_throw_again: 'Tap to throw again',

        // Debug labels
        debug_disc: 'Disc:',
        hand_label: 'Hand:',
        grip_label: 'Grip:',
        debug_power: 'Power:',
        debug_hyzer: 'Hyzer:',
        debug_angle: 'Angle:',
        debug_dist: 'Dist:',
        debug_phase: 'Phase:',
        debug_speed: 'Speed:',
        debug_maxfwd: 'MaxFwd:',
        debug_flat: 'Flat',

        // ThrowUI
        straight: 'STRAIGHT',
        hyzer: 'HYZER',
        anhyzer: 'ANHYZER',

        // Putting
        precision_help: 'Hit the center for best precision',
        rings_help: 'Stop between green & white rings',
        precision_label: 'Precision:',
        stop_suffix: 'stop',

        // Putting results
        made_it: 'MADE IT!',
        short: 'SHORT',
        long: 'LONG',
        close: 'CLOSE!',
        putt_suffix: 'putt',
        next_label: 'Next:',

        // Hole
        hole_name: 'HOLE 1',
        par: 'Par',
        to_pin: 'to pin',
        throw_label: 'Throw',
        remaining: 'remaining',
        ob_warning: 'OUT OF BOUNDS  +1 STROKE',
        next_hole: 'NEXT',

        // Score
        holed_out: 'HOLED OUT!',
        throw_in: 'THROW IN!',
        birdie: 'Birdie!',
        eagle: 'Eagle!',
        albatross: 'Albatross!',
        bogey: 'Bogey',
        double_bogey: 'Double Bogey',
        round_complete: 'ROUND COMPLETE',
        total: 'Total',
        hole_label: 'Hole',
        score_label: 'Score',

        // Renderer
        select_disc: 'SELECT DISC',
        cat_putters: 'PUTTERS',
        cat_mids: 'MIDS',
        cat_fairway: 'FAIRWAY',
        cat_distance: 'DISTANCE',
        ob_label: 'O.B.',

        // Designer
        designer: 'HOLE DESIGNER',
        designer_help: 'Design & export custom holes',
        download: 'DOWNLOAD',
        tap_to_place: 'Tap to place',
        delete_item: 'DELETE',

        // Settings
        righty: 'RIGHTY',
        lefty: 'LEFTY',
        backhand: 'BH',
        forehand: 'FH',
    },

    es: {
        // Menu
        title: 'DISC GOLF SIM',
        select_mode: 'Selecciona un modo',
        throwing_lab: 'LABORATORIO',
        throwing_lab_help: 'Practica tiros y ve trayectorias',
        putting_lab_title: 'PUTTING',
        putting_lab_help: 'Minijuego de precisión de putt',
        play_hole: 'JUGAR HOYO',
        play_hole_help: 'Juega un hoyo completo',
        courses: 'CAMPOS',
        courses_help: 'Elige un campo para jugar',
        select_course: 'Elige un campo',
        select_layout: 'Elige un trazado',
        holes_label: 'Hoyos',
        par_label: 'Par',
        distance_label: 'Distancia',

        // Buttons
        back: 'VOLVER',
        disc: 'DISCO',
        cancel: 'CANCELAR',
        continue_btn: 'CONTINUAR',
        rethrow: 'REPETIR',
        explore: 'EXPLORAR',
        putt: 'PUTT',
        retry: 'REINTENTAR',
        menu: 'MENÚ',
        tap: 'TOCA',

        // Throwing lab
        drag_to_aim: 'Arrastra para apuntar',
        tap_throw_again: 'Toca para tirar de nuevo',

        // Debug labels
        debug_disc: 'Disco:',
        hand_label: 'Mano:',
        grip_label: 'Agarre:',
        debug_power: 'Fuerza:',
        debug_hyzer: 'Hyzer:',
        debug_angle: 'Ángulo:',
        debug_dist: 'Dist:',
        debug_phase: 'Fase:',
        debug_speed: 'Veloc:',
        debug_maxfwd: 'MaxAdl:',
        debug_flat: 'Plano',

        // ThrowUI
        straight: 'RECTO',
        hyzer: 'HYZER',
        anhyzer: 'ANHYZER',

        // Putting
        precision_help: 'Apunta al centro para mejor precisión',
        rings_help: 'Detén entre los anillos verde y blanco',
        precision_label: 'Precisión:',
        stop_suffix: 'parada',

        // Putting results
        made_it: '¡ADENTRO!',
        short: 'CORTO',
        long: 'LARGO',
        close: '¡CERCA!',
        putt_suffix: 'putt',
        next_label: 'Sgte:',

        // Hole
        hole_name: 'HOYO 1',
        par: 'Par',
        to_pin: 'al pin',
        throw_label: 'Tiro',
        remaining: 'restante',
        ob_warning: 'FUERA DE LÍMITES  +1 TIRO',
        next_hole: 'SIGUIENTE',

        // Score
        holed_out: '¡EMBOCADO!',
        throw_in: 'THROW IN!',
        birdie: '¡Birdie!',
        eagle: '¡Eagle!',
        albatross: '¡Albatross!',
        bogey: 'Bogey',
        double_bogey: 'Doble Bogey',
        round_complete: 'RONDA COMPLETA',
        total: 'Total',
        hole_label: 'Hoyo',
        score_label: 'Puntaje',

        // Renderer
        select_disc: 'ELEGIR DISCO',
        cat_putters: 'PUTTERS',
        cat_mids: 'MEDIOS',
        cat_fairway: 'FAIRWAY',
        cat_distance: 'DISTANCIA',
        ob_label: 'F.L.',

        // Designer
        designer: 'DISEÑADOR',
        designer_help: 'Diseña y exporta hoyos',
        download: 'DESCARGAR',
        tap_to_place: 'Toca para colocar',
        delete_item: 'BORRAR',

        // Settings
        righty: 'DIESTRO',
        lefty: 'ZURDO',
        backhand: 'BH',
        forehand: 'FH',
    },
};

export function t(key) {
    return strings[lang]?.[key] ?? strings['en'][key] ?? key;
}

export function setLang(code) {
    lang = code;
}

export function getLang() {
    return lang;
}
