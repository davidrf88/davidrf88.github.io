import { createMenu } from './menu.js';
import { createGame } from './game.js';
import { createPutting } from './putting.js';
import { createHole } from './hole.js';
import { createDesigner } from './designer.js';
import { t } from './i18n.js';

const canvas = document.getElementById('game');

const ASPECT = 9 / 16; // portrait

function resize() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let w, h;
    if (winW / winH < ASPECT) {
        w = winW;
        h = winW / ASPECT;
    } else {
        h = winH;
        w = winH * ASPECT;
    }

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    // On small screens (mobile), reduce canvas resolution so CSS upscaling
    // makes all UI elements (fonts, buttons) appear physically larger.
    // Target ~420px logical width — below that, scale down proportionally.
    const TARGET_W = 420;
    const canvasW = w >= TARGET_W ? w : w * (w / TARGET_W);
    canvas.width = Math.round(canvasW);
    canvas.height = Math.round(canvasW / ASPECT);
}

resize();
window.addEventListener('resize', resize);

// --- Scene management ---
let currentScene = null;
let currentSceneName = 'menu';

function stopCurrent() {
    if (currentScene) {
        currentScene.stop();
        currentScene = null;
    }
}

function showMenu(pushState) {
    stopCurrent();
    currentSceneName = 'menu';
    if (pushState !== false) history.pushState({ scene: 'menu' }, '');
    currentScene = createMenu(canvas, (scene) => {
        if (scene === 'lab') launchLab();
        else if (scene === 'putting') launchPutting();
        else if (scene === 'hole') launchHole();
        else if (scene === 'courses') launchCourses();
        else if (scene === 'designer') launchDesigner();
    });
    currentScene.start();
}

function launchLab() {
    stopCurrent();
    currentSceneName = 'lab';
    history.pushState({ scene: 'lab' }, '');
    currentScene = createGame(canvas, showMenu);
    currentScene.start();
}

function launchPutting() {
    stopCurrent();
    currentSceneName = 'putting';
    history.pushState({ scene: 'putting' }, '');
    currentScene = createPutting(canvas, showMenu);
    currentScene.start();
}

function launchHole(holeData) {
    stopCurrent();
    currentSceneName = 'hole';
    history.pushState({ scene: 'hole' }, '');
    currentScene = createHole(canvas, showMenu, holeData);
    currentScene.start();
}

function launchDesigner() {
    stopCurrent();
    currentSceneName = 'designer';
    history.pushState({ scene: 'designer' }, '');
    currentScene = createDesigner(canvas, showMenu);
    currentScene.start();
}

function launchCourseRound(course, holes) {
    let holeIndex = 0;
    const scores = []; // { hole, par, strokes }

    function playNextHole() {
        stopCurrent();
        currentSceneName = 'hole';
        history.pushState({ scene: 'hole' }, '');
        const isLastHole = holeIndex >= holes.length - 1;
        const onComplete = (strokes) => {
            scores.push({
                hole: holes[holeIndex].hole,
                par: holes[holeIndex].par,
                strokes,
            });
            holeIndex++;
            if (holeIndex < holes.length) {
                playNextHole();
            } else {
                launchScorecard(course, scores);
            }
        };
        currentScene = createHole(canvas, showMenu, holes[holeIndex], onComplete);
        currentScene.start();
    }

    playNextHole();
}

function launchScorecard(course, scores) {
    stopCurrent();
    currentSceneName = 'scorecard';
    history.pushState({ scene: 'scorecard' }, '');

    const ctx = canvas.getContext('2d');
    let running = true;
    let menuBtn = { x: 0, y: 0, w: 0, h: 0 };

    function onPointerUp(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;

        if (px >= menuBtn.x && px <= menuBtn.x + menuBtn.w &&
            py >= menuBtn.y && py <= menuBtn.y + menuBtn.h) {
            stopScene();
            showMenu();
        }
    }

    function draw() {
        if (!running) return;

        ctx.fillStyle = '#1a2a3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Title
        ctx.fillStyle = '#44ff44';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('round_complete'), canvas.width / 2, 60);

        // Course name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(course.name, canvas.width / 2, 95);

        // Scorecard table
        const colHole = canvas.width * 0.15;
        const colPar = canvas.width * 0.45;
        const colScore = canvas.width * 0.70;
        const colDiff = canvas.width * 0.88;
        const startY = 140;
        const rowH = 34;

        // Header row
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('hole_label'), colHole, startY);
        ctx.fillText(t('par'), colPar, startY);
        ctx.fillText(t('score_label'), colScore, startY);
        ctx.fillText('+/-', colDiff, startY);

        // Divider
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.08, startY + 10);
        ctx.lineTo(canvas.width * 0.92, startY + 10);
        ctx.stroke();

        let totalPar = 0;
        let totalStrokes = 0;

        scores.forEach((s, i) => {
            const y = startY + (i + 1) * rowH + 10;
            totalPar += s.par;
            totalStrokes += s.strokes;
            const diff = s.strokes - s.par;

            ctx.font = '18px monospace';
            ctx.textAlign = 'center';

            // Hole number
            ctx.fillStyle = '#fff';
            ctx.fillText(`${s.hole}`, colHole, y);

            // Par
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(`${s.par}`, colPar, y);

            // Strokes
            ctx.fillStyle = diff < 0 ? '#44ff44' : diff > 0 ? '#ff6644' : '#fff';
            ctx.fillText(`${s.strokes}`, colScore, y);

            // +/-
            ctx.fillStyle = diff < 0 ? '#44ff44' : diff > 0 ? '#ff6644' : 'rgba(255,255,255,0.4)';
            ctx.fillText(diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`), colDiff, y);
        });

        // Total row divider
        const totalY = startY + (scores.length + 1) * rowH + 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.08, totalY - 20);
        ctx.lineTo(canvas.width * 0.92, totalY - 20);
        ctx.stroke();

        // Total row
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(t('total'), colHole, totalY);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(`${totalPar}`, colPar, totalY);

        const totalDiff = totalStrokes - totalPar;
        ctx.fillStyle = totalDiff < 0 ? '#44ff44' : totalDiff > 0 ? '#ff6644' : '#fff';
        ctx.fillText(`${totalStrokes}`, colScore, totalY);
        ctx.fillStyle = totalDiff < 0 ? '#44ff44' : totalDiff > 0 ? '#ff6644' : 'rgba(255,255,255,0.4)';
        ctx.fillText(totalDiff === 0 ? 'E' : (totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`), colDiff, totalY);

        // Menu button
        const btnW = 120;
        const btnH = 50;
        const btnX = (canvas.width - btnW) / 2;
        const btnY = canvas.height - btnH - 40;
        menuBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

        ctx.fillStyle = 'rgba(80,200,80,0.3)';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,200,80,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 12);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('menu'), btnX + btnW / 2, btnY + btnH / 2 + 8);

        requestAnimationFrame(draw);
    }

    function stopScene() {
        running = false;
        canvas.removeEventListener('pointerup', onPointerUp);
    }

    canvas.addEventListener('pointerup', onPointerUp);
    requestAnimationFrame(draw);

    currentScene = {
        start() {},
        stop() { stopScene(); }
    };
}

// Intercept browser back button — navigate to menu instead of leaving the site
window.addEventListener('popstate', () => {
    if (currentSceneName !== 'menu') {
        showMenu(false);
    }
});

function launchCourses() {
    stopCurrent();
    currentSceneName = 'courses';
    history.pushState({ scene: 'courses' }, '');

    const ctx = canvas.getContext('2d');
    let running = true;
    let courses = null;
    let hitAreas = [];
    let backBtn = { x: 0, y: 0, w: 0, h: 0 };

    // Fetch course index, then all course metadata
    fetch('data/courses/index.json')
        .then(r => r.json())
        .then(ids => Promise.all(
            ids.map(id => fetch(`data/courses/${id}.json`).then(r => r.json()))
        ))
        .then(data => { courses = data; });

    function onPointerUp(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;

        // Back button
        if (px >= backBtn.x && px <= backBtn.x + backBtn.w &&
            py >= backBtn.y && py <= backBtn.y + backBtn.h) {
            stopScene();
            showMenu();
            return;
        }

        // Course cards
        for (const area of hitAreas) {
            if (px >= area.x && px <= area.x + area.w &&
                py >= area.y && py <= area.y + area.h) {
                stopScene();
                launchLayouts(area.course);
                return;
            }
        }
    }

    function draw() {
        if (!running) return;

        // Background
        ctx.fillStyle = '#1a2a3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Back button (top-left)
        const bbW = 100, bbH = 50, bbX = 16, bbY = 16;
        backBtn = { x: bbX, y: bbY, w: bbW, h: bbH };
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(bbX, bbY, bbW, bbH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bbX, bbY, bbW, bbH, 12);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('back'), bbX + bbW / 2, bbY + bbH / 2 + 8);

        // Header
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('select_course'), canvas.width / 2, 100);

        if (!courses) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '22px monospace';
            ctx.fillText('...', canvas.width / 2, canvas.height / 2);
            requestAnimationFrame(draw);
            return;
        }

        // Draw course cards
        hitAreas = [];
        const cardW = canvas.width * 0.8;
        const cardH = 110;
        const gap = 16;
        const startY = 130;
        const colors = ['80,200,120', '100,160,220', '180,120,220'];

        courses.forEach((course, i) => {
            const x = (canvas.width - cardW) / 2;
            const y = startY + i * (cardH + gap);
            const color = colors[i % colors.length];

            // Card background
            ctx.fillStyle = `rgba(${color},0.18)`;
            ctx.beginPath();
            ctx.roundRect(x, y, cardW, cardH, 14);
            ctx.fill();

            // Card border
            ctx.strokeStyle = `rgba(${color},0.6)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, y, cardW, cardH, 14);
            ctx.stroke();

            // Course name
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(course.name, x + 18, y + 36);

            // Details line
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '18px monospace';
            const details = `${t('holes_label')}: ${course.holes}  |  ${t('par_label')}: ${course.par}`;
            ctx.fillText(details, x + 18, y + 66);

            // Layouts count
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '16px monospace';
            ctx.fillText(`${course.distance_ft}ft  •  ${course.layouts.length} layout${course.layouts.length > 1 ? 's' : ''}`, x + 18, y + 92);

            hitAreas.push({ x, y, w: cardW, h: cardH, course });
        });

        requestAnimationFrame(draw);
    }

    function stopScene() {
        running = false;
        canvas.removeEventListener('pointerup', onPointerUp);
    }

    canvas.addEventListener('pointerup', onPointerUp);
    requestAnimationFrame(draw);

    currentScene = {
        start() {},
        stop() { stopScene(); }
    };
}

function launchLayouts(course) {
    stopCurrent();
    currentSceneName = 'layouts';
    history.pushState({ scene: 'layouts' }, '');

    const ctx = canvas.getContext('2d');
    let running = true;
    let hitAreas = [];
    let backBtn = { x: 0, y: 0, w: 0, h: 0 };

    function onPointerUp(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * sx;
        const py = (e.clientY - rect.top) * sy;

        // Back button → return to course list
        if (px >= backBtn.x && px <= backBtn.x + backBtn.w &&
            py >= backBtn.y && py <= backBtn.y + backBtn.h) {
            stopScene();
            launchCourses();
            return;
        }

        // Layout cards
        for (const area of hitAreas) {
            if (px >= area.x && px <= area.x + area.w &&
                py >= area.y && py <= area.y + area.h) {
                const layoutId = area.layoutId;
                // Fetch all holes for this layout
                const holePromises = [];
                for (let h = 1; h <= course.holes; h++) {
                    holePromises.push(
                        fetch(`data/courses/${course.id}/${layoutId}/hole${h}.json`)
                            .then(r => r.json())
                    );
                }
                Promise.all(holePromises).then(holes => {
                    stopScene();
                    launchCourseRound(course, holes);
                });
                return;
            }
        }
    }

    function draw() {
        if (!running) return;

        // Background
        ctx.fillStyle = '#1a2a3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Back button (top-left)
        const bbW = 100, bbH = 50, bbX = 16, bbY = 16;
        backBtn = { x: bbX, y: bbY, w: bbW, h: bbH };
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(bbX, bbY, bbW, bbH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bbX, bbY, bbW, bbH, 12);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('back'), bbX + bbW / 2, bbY + bbH / 2 + 8);

        // Course name header
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(course.name, canvas.width / 2, 100);

        // Subtitle
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '18px monospace';
        ctx.fillText(t('select_layout'), canvas.width / 2, 130);

        // Draw layout cards
        hitAreas = [];
        const cardW = canvas.width * 0.8;
        const cardH = 90;
        const gap = 16;
        const startY = 160;
        const colors = ['100,200,160', '140,160,220', '200,140,180'];

        course.layouts.forEach((layoutId, i) => {
            const x = (canvas.width - cardW) / 2;
            const y = startY + i * (cardH + gap);
            const color = colors[i % colors.length];

            // Card background
            ctx.fillStyle = `rgba(${color},0.18)`;
            ctx.beginPath();
            ctx.roundRect(x, y, cardW, cardH, 14);
            ctx.fill();

            // Card border
            ctx.strokeStyle = `rgba(${color},0.6)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, y, cardW, cardH, 14);
            ctx.stroke();

            // Layout name
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(layoutId.charAt(0).toUpperCase() + layoutId.slice(1), x + 18, y + 36);

            // Details
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '18px monospace';
            ctx.fillText(`${t('holes_label')}: ${course.holes}  |  ${t('par_label')}: ${course.par}`, x + 18, y + 64);

            hitAreas.push({ x, y, w: cardW, h: cardH, layoutId });
        });

        requestAnimationFrame(draw);
    }

    function stopScene() {
        running = false;
        canvas.removeEventListener('pointerup', onPointerUp);
    }

    canvas.addEventListener('pointerup', onPointerUp);
    requestAnimationFrame(draw);

    currentScene = {
        start() {},
        stop() { stopScene(); }
    };
}

// Replace initial history entry and start at menu
history.replaceState({ scene: 'menu' }, '');
showMenu(false);
