import * as THREE from 'three';

/** Visual + audio feedback for shots (tracer, muzzle flash, impact puff) and explosions. */
export class ShotEffects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.flash = new THREE.PointLight('#ffcc77', 0, 6, 2);
    scene.add(this.flash);
    this.puffGeo = new THREE.IcosahedronGeometry(0.08, 0);
    this.audio = null;
    this.blast = new THREE.PointLight('#ffb35c', 0, 30, 1.5);
    scene.add(this.blast);
    this.fireGeo = new THREE.IcosahedronGeometry(1, 1);
    this.dirtGeo = new THREE.IcosahedronGeometry(0.12, 0);
  }

  /** Frag explosion at `pos`; `distance` from the listener scales the boom. */
  explode(pos, distance = 0) {
    this.blast.position.copy(pos).y += 1;
    this.blast.intensity = 60;
    // Fireball: a few bright blobs that swell and fade fast.
    for (let i = 0; i < 6; i++) {
      const ball = new THREE.Mesh(this.fireGeo, new THREE.MeshBasicMaterial({ color: i < 2 ? '#fff1b0' : '#ff8a2a', transparent: true, depthWrite: false }));
      ball.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2));
      ball.userData.grow = 2.2 + Math.random() * 1.5;
      ball.scale.setScalar(0.3);
      this.#spawn(ball, 0.35 + Math.random() * 0.15);
    }
    // Dark smoke and dirt thrown out.
    for (let i = 0; i < 14; i++) {
      const dark = i < 6;
      const bit = new THREE.Mesh(dark ? this.fireGeo : this.dirtGeo, new THREE.MeshBasicMaterial({ color: dark ? '#3b3a36' : '#6b5a40', transparent: true, depthWrite: false }));
      bit.position.copy(pos).y += 0.3;
      if (dark) { bit.scale.setScalar(0.5); bit.userData.grow = 1.3 + Math.random() * 0.8; bit.userData.alpha = 0.45; }
      bit.userData.vel = new THREE.Vector3(Math.random() - 0.5, dark ? 0.6 + Math.random() * 0.6 : 1 + Math.random(), Math.random() - 0.5)
        .multiplyScalar(dark ? 2.5 : 9);
      this.#spawn(bit, dark ? 1.6 : 0.9);
    }
    this.#boom(distance);
  }

  #boom(distance) {
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      const len = 1.4 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.value = 0.9 / (1 + distance / 25);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
    } catch { /* audio is optional */ }
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
    this.blast.intensity = Math.max(0, this.blast.intensity - dt * 200);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const o = this.items[i];
      o.userData.life -= dt;
      const t = Math.max(0, o.userData.life / o.userData.maxLife);
      o.material.opacity = t * (o.userData.alpha ?? 1);
      if (o.userData.grow) {
        o.scale.setScalar(o.userData.grow * (1 - t * t) + 0.3);
        if (o.userData.vel) { o.userData.vel.multiplyScalar(1 - dt * 2); o.position.addScaledVector(o.userData.vel, dt); }
      } else if (o.userData.vel) {
        o.userData.vel.y -= (o.geometry === this.dirtGeo ? 20 : 3) * dt;
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
