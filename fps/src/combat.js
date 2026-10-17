import * as THREE from 'three';

/** Visual + audio feedback for pistol shots: tracer, muzzle flash, impact puff. */
export class ShotEffects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.flash = new THREE.PointLight('#ffcc77', 0, 6, 2);
    scene.add(this.flash);
    this.puffGeo = new THREE.IcosahedronGeometry(0.08, 0);
    this.audio = null;
  }

  shoot(from, to, hitNormal) {
    // Tracer
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#fff2b0', transparent: true }));
    this.#spawn(tracer, 0.06);

    // Muzzle flash
    this.flash.position.copy(from);
    this.flash.intensity = 8;

    // Impact puff (dust/bark)
    if (hitNormal) {
      for (let i = 0; i < 5; i++) {
        const puff = new THREE.Mesh(this.puffGeo, new THREE.MeshBasicMaterial({ color: '#d8cbb0', transparent: true }));
        puff.position.copy(to).addScaledVector(hitNormal, 0.05);
        puff.userData.vel = hitNormal.clone().multiplyScalar(1.5)
          .add(new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(1.2));
        this.#spawn(puff, 0.45);
      }
    }
    this.#bang();
  }

  #spawn(obj, life) {
    obj.userData.life = life;
    obj.userData.maxLife = life;
    this.scene.add(obj);
    this.items.push(obj);
  }

  #bang() {
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      const len = 0.25 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
    } catch { /* audio is optional */ }
  }

  update(dt) {
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 160);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const o = this.items[i];
      o.userData.life -= dt;
      const t = Math.max(0, o.userData.life / o.userData.maxLife);
      o.material.opacity = t;
      if (o.userData.vel) {
        o.userData.vel.y -= 3 * dt;
        o.position.addScaledVector(o.userData.vel, dt);
        o.scale.setScalar(1 + (1 - t) * 1.5);
      }
      if (o.userData.life <= 0) {
        this.scene.remove(o);
        if (o.isLine) o.geometry.dispose();
        o.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
