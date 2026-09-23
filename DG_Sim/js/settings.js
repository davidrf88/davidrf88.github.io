// Shared game settings (persisted in localStorage).

let lefty = localStorage.getItem('dg_lefty') === 'true';
let forehand = localStorage.getItem('dg_forehand') === 'true';

export function isLefty() {
    return lefty;
}

export function setLefty(val) {
    lefty = !!val;
    localStorage.setItem('dg_lefty', lefty);
}

export function isForehand() {
    return forehand;
}

export function setForehand(val) {
    forehand = !!val;
    localStorage.setItem('dg_forehand', forehand);
}
