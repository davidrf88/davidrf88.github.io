import * as THREE from 'three';
import { outsideBy } from './zone.js';
import * as ui from './ui.js';

const WALL_BOTTOM = -40, WALL_TOP = 160;
const BLUE = new THREE.Color('#3f6fd8');

const fmt = (s) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Draws the blue zone: a shimmering wall at the zone edge, and — while the viewer is outside
 * it — blue fog that cuts visibility plus a blue screen tint, both stronger in later phases.
 * Also the zone timer and "zone is closing" alerts.
 */
export class ZoneView {
  /** @param horizon  the sky's horizon color, kept in step with the fog */
  constructor(scene, horizon) {
    this.scene = scene;
    this.horizon = horizon;
    this.baseFog = { color: scene.fog.color.clone(), density: scene.fog.density };
    this.out = 0; // eased 0..1 "outside the zone" amount
    this.lastStage = null;
    this.infoEl = document.getElementById('zone-info');
    this.tintEl = document.getElementById('zone-tint');

    const geo = new THREE.CylinderGeometry(1, 1, WALL_TOP - WALL_BOTTOM, 160, 1, true);
    geo.translate(0, (WALL_TOP + WALL_BOTTOM) / 2, 0);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uCirc: { value: 100 }, uColor: { value: BLUE.clone() } },
      vertexShader: `varying vec2 vUv; varying float vY;
        void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; uniform float uCirc; uniform vec3 uColor; varying vec2 vUv; varying float vY;
        void main() {
          float u = vUv.x * uCirc;                              // meters around the wall
          float grid = max(step(0.94, fract(u / 3.0)), step(0.94, fract(vY / 3.0 - uTime * 0.15)));
          float shimmer = 0.5 + 0.5 * sin(u * 0.7 + vY * 0.35 + uTime * 2.2);
          float a = 0.16 + shimmer * 0.08 + grid * 0.22;
          gl_FragColor = vec4(uColor + grid * 0.25, a);
        }`,
    });
    this.wall = new THREE.Mesh(geo, this.material);
    this.wall.frustumCulled = false;
    this.wall.renderOrder = 5;
    this.wall.visible = false;
    scene.add(this.wall);
  }

  /** @param zone  zoneAt(...) result or null; @param viewer  position the camera follows */
  update(zone, viewer, dt) {
    const fog = this.scene.fog;
    if (!zone) {
      this.wall.visible = false;
      this.out = 0;
      fog.color.copy(this.baseFog.color);
      fog.density = this.baseFog.density;
      this.scene.background = fog.color;
      this.horizon.copy(fog.color);
      this.tintEl.style.opacity = 0;
      this.infoEl.hidden = true;
      this.lastStage = null;
      return;
    }

    this.wall.visible = zone.r > 0.3;
    this.wall.position.set(zone.x, 0, zone.z);
    this.wall.scale.set(Math.max(zone.r, 0.01), 1, Math.max(zone.r, 0.01));
    this.material.uniforms.uTime.value += dt;
    this.material.uniforms.uCirc.value = 2 * Math.PI * zone.r;

    // Outside the wall: visibility drops and the screen tints blue — harder in later phases.
    const outside = outsideBy(zone, viewer.x, viewer.z) > 0;
    this.out = THREE.MathUtils.damp(this.out, outside ? 1 : 0, 3, dt);
    const severity = Math.min(1, 0.45 + zone.phase * 0.1);
    fog.color.copy(this.baseFog.color).lerp(BLUE, this.out * 0.7);
    fog.density = this.baseFog.density + this.out * severity * 0.035;
    this.scene.background = fog.color;
    this.horizon.copy(fog.color);
    this.tintEl.style.opacity = (this.out * severity * 0.75).toFixed(3);

    this.#hud(zone, viewer, outside);
  }

  #hud(zone, viewer, outside) {
    const el = this.infoEl;
    el.hidden = false;
    let text;
    if (zone.stage === 'grace') text = `Zone appears in ${fmt(zone.timeLeft)}`;
    else if (zone.stage === 'wait') text = `Zone shrinks in ${fmt(zone.timeLeft)}`;
    else if (zone.stage === 'shrink') text = `Zone closing ${fmt(zone.timeLeft)}`;
    else text = 'Final zone';
    const target = zone.next ?? zone;
    const toSafe = Math.hypot(viewer.x - target.x, viewer.z - target.z) - target.r;
    if (toSafe > 1) text += ` · safe zone ${Math.round(toSafe)} m`;
    el.textContent = text;
    el.classList.toggle('urgent', zone.stage === 'shrink' || outside);

    if (zone.stage !== this.lastStage) {
      if (this.lastStage !== null) {
        if (zone.stage === 'wait') ui.alert(zone.phase === 1 ? 'Play area marked — head for the white circle' : 'New play area marked');
        if (zone.stage === 'shrink') ui.alert('The blue zone is closing in!');
        if (zone.stage === 'final') ui.alert('Final zone');
      }
      this.lastStage = zone.stage;
    }
  }
}
