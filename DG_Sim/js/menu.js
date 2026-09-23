// Menu: simple canvas-based scene selector.
// Draws title + buttons. Calls onSelect(sceneName) when a button is tapped.

import { t, getLang, setLang } from './i18n.js';
import { isLefty, setLefty } from './settings.js';

export function createMenu(canvas, onSelect) {
    const ctx = canvas.getContext('2d');
    let running = false;

    const buttons = [
        { labelKey: 'throwing_lab', scene: 'lab',     color: '80,200,80',  helpKey: 'throwing_lab_help' },
        { labelKey: 'putting_lab_title',  scene: 'putting', color: '200,180,80', helpKey: 'putting_lab_help' },
        { labelKey: 'play_hole',    scene: 'hole',    color: '80,160,220', helpKey: 'play_hole_help' },
        { labelKey: 'courses',      scene: 'courses', color: '180,120,220', helpKey: 'courses_help' },
        { labelKey: 'designer',     scene: 'designer', color: '220,160,80', helpKey: 'designer_help' },
    ];

    // Hit areas (recalculated each frame)
    let hitAreas = [];
    // Language toggle hit area
    let langBtn = { x: 0, y: 0, w: 0, h: 0 };
    // Hand toggle hit area
    let handBtn = { x: 0, y: 0, w: 0, h: 0 };

    function onPointerUp(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;

        // Language toggle
        if (px >= langBtn.x && px <= langBtn.x + langBtn.w &&
            py >= langBtn.y && py <= langBtn.y + langBtn.h) {
            setLang(getLang() === 'en' ? 'es' : 'en');
            return;
        }

        // Hand toggle
        if (px >= handBtn.x && px <= handBtn.x + handBtn.w &&
            py >= handBtn.y && py <= handBtn.y + handBtn.h) {
            setLefty(!isLefty());
            return;
        }

        for (const area of hitAreas) {
            if (px >= area.x && px <= area.x + area.w &&
                py >= area.y && py <= area.y + area.h) {
                onSelect(area.scene);
                return;
            }
        }
    }

    function draw() {
        if (!running) return;

        const W = canvas.width;
        const H = canvas.height;

        // Background
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(0, 0, W, H);

        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t('title'), W / 2, H * 0.18);

        // Subtitle
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '18px monospace';
        ctx.fillText(t('select_mode'), W / 2, H * 0.18 + 36);

        // Language toggle (top-right)
        const lbW = 70;
        const lbH = 50;
        const lbX = W - lbW - 16;
        const lbY = 16;
        langBtn = { x: lbX, y: lbY, w: lbW, h: lbH };

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(lbX, lbY, lbW, lbH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(lbX, lbY, lbW, lbH, 12);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(getLang().toUpperCase(), lbX + lbW / 2, lbY + lbH / 2 + 8);

        // Hand toggle (top-right, below language button)
        const hbW = 120;
        const hbH = 50;
        const hbX = W - hbW - 16;
        const hbY = lbY + lbH + 12;
        handBtn = { x: hbX, y: hbY, w: hbW, h: hbH };

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(hbX, hbY, hbW, hbH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(hbX, hbY, hbW, hbH, 12);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isLefty() ? t('lefty') : t('righty'), hbX + hbW / 2, hbY + hbH / 2 + 8);

        // Buttons — 80% width, large touch targets
        hitAreas = [];
        const btnW = W * 0.8;
        const btnH = 90;
        const gap = 14;
        const totalH = buttons.length * btnH + (buttons.length - 1) * gap;
        const startY = H * 0.30;

        buttons.forEach((btn, i) => {
            const x = (W - btnW) / 2;
            const y = startY + i * (btnH + gap);

            // Background
            ctx.fillStyle = `rgba(${btn.color},0.25)`;
            ctx.beginPath();
            ctx.roundRect(x, y, btnW, btnH, 14);
            ctx.fill();

            // Border
            ctx.strokeStyle = `rgba(${btn.color},0.7)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, y, btnW, btnH, 14);
            ctx.stroke();

            // Label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 28px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(t(btn.labelKey), W / 2, y + btnH / 2 + 2);

            // Help text
            ctx.fillStyle = `rgba(255,255,255,0.6)`;
            ctx.font = '16px monospace';
            ctx.fillText(t(btn.helpKey), W / 2, y + btnH / 2 + 24);

            hitAreas.push({ x, y, w: btnW, h: btnH, scene: btn.scene });
        });

        requestAnimationFrame(draw);
    }

    function start() {
        running = true;
        canvas.addEventListener('pointerup', onPointerUp);
        requestAnimationFrame(draw);
    }

    function stop() {
        running = false;
        canvas.removeEventListener('pointerup', onPointerUp);
    }

    return { start, stop };
}
