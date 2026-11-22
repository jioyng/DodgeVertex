(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // 세로 버전: 게임 세계는 너비 600 고정, 높이는 화면 비율에 맞춰 800~1320 (세로가 긴 휴대폰에서 화면을 꽉 채움)
  const W = 600;
  let H = 800;
  const BY = 200; // 보스 기본 높이 (HUD 아래)
  let RES = 1; // 화면 해상도 배율 (휴대폰에서 선명하게)
  const TAU = Math.PI * 2;

  const overlay = document.getElementById('overlay');
  const panel = document.getElementById('panel');
  const pauseBtn = document.getElementById('pause-btn');
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const isStandalone = () => window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;

  // ---- 저장소 ----
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* 무시 */ } },
  };
  let bestScore = Number(store.get('dodgevertex-best-score', 0)) || 0;
  let maxStage = Math.min(STAGES.length, Math.max(1, Number(store.get('dodgevertex-max-stage', 1)) || 1));

  // ---- 연도별 스테이지 오픈: 기본 26단계, 2027년 1월 1일 27단계 ... 2030년 30단계 ----
  const query = new URLSearchParams(location.search);
  const debugYear = query.has('debug') ? Number(query.get('year')) || 0 : 0; // 테스트용: ?debug&year=2030
  const currentYear = () => debugYear || new Date().getFullYear();
  const isOpen = s => !s.openYear || s.openYear <= currentYear();
  const openCount = () => STAGES.filter(isOpen).length;

  // ---- 유틸 ----
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function weighted(obj) {
    const entries = Object.entries(obj);
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = Math.random() * total;
    for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
    return entries[0][0];
  }
  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
  }

  // ---- 게임 상태 ----
  let state = 'title'; // title | playing | paused | over | ending
  let phase = 'intro'; // intro | wave | warning | boss | clear
  let phaseT = 0, animT = 0;
  let stageIdx = 0, stage = STAGES[0];
  let lives = 3, score = 0;
  let player, bullets, particles, hazards, orbs, shots, boss;
  let spawnTimer = 0, eventTimer = 0, orbTimer = 0, shake = 0, flash = 0;
  let bossHintT = 0;
  let stageTime = 0, stageHits = 0, stageScore0 = 0;
  let slowT = 0, floaters = [];
  // 아이템 효과 타이머
  let freezeT = 0, magnetT = 0, miniT = 0, ghostT = 0, laserT = 0, laserTick = 0, drones = [], waveItemT = 0;
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0 };

  // 난이도 진행도: 1단계 0 → 마지막 스테이지 1
  const diff = () => STAGES[stageIdx].d; // 난이도: 1단계 0 → 20단계 1 → 30단계 1.8 (stages.js)
  const rageAt = b => b.def.rageAt ?? 0.5;  // 분노 모드가 시작되는 체력 비율

  function resetField() {
    player = { x: W / 2, y: H * 0.72, r: 8, speed: 270, inv: 0, shield: false };
    slowT = 0;
    freezeT = 0; magnetT = 0; miniT = 0; ghostT = 0; laserT = 0; laserTick = 0;
    drones = [];
    waveItemT = 7;
    floaters = [];
    bullets = [];
    particles = [];
    hazards = [];
    orbs = [];
    shots = [];
    boss = null;
  }
  resetField();

  // ==================================================================
  // 탄
  // ==================================================================
  function addBullet(x, y, angle, speed, opt = {}) {
    if (bullets.length > 700) return;
    const b = {
      x, y, bx: x, by: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: 5, kind: 'straight', t: 0,
      color: pick(stage.bullet),
      ...opt,
    };
    if (b.kind === 'zigzag') b.nextZig = b.zigT;
    if (b.kind === 'boomerang') { b.s = speed; b.ux = Math.cos(angle); b.uy = Math.sin(angle); }
    if (b.kind === 'orbit') { b.cx = x; b.cy = y; b.oa = angle; b.or = b.or ?? 18; }
    bullets.push(b);
  }

  // 탄 종류별 기본 파라미터
  function kindOptions(kind, base) {
    switch (kind) {
      case 'curve': { const w = rand(0.6, 1.1) * (Math.random() < 0.5 ? -1 : 1); return { kind, w, aimShift: -w * 0.55 }; }
      case 'wave': return { kind, amp: rand(22, 45), freq: rand(4, 7) };
      case 'accel': return { kind, speedMul: 0.4, acc: 170, max: base * 2.2, color: '#fb7185' };
      case 'homing': return { kind, homeT: 1.7, turn: 1.9, speedMul: 0.8, color: '#c084fc', r: 6 };
      case 'bounce': return { kind, bounces: 1, jitter: 0.9, color: '#4ade80' };
      case 'split': return { kind, fuse: rand(1.1, 1.9), parts: 8, speedMul: 0.7, r: 9, color: '#f8fafc' };
      case 'zigzag': return { kind, zigT: 0.32, zigA: 0.75, zigDir: 1, aimShift: -0.37, color: '#fde047' };
      // 천천히 들어와 멈칫한 뒤 플레이어를 조준해 돌진 (빨간 조준선 표시)
      case 'lock': return { kind, lockT: rand(0.6, 0.9), speedMul: 0.5, dash: base * 2.4, color: '#f87171', r: 6, jitter: 0.6 };
      // 들어왔다가 감속해서 되돌아 나감
      case 'boomerang': return { kind, speedMul: 1.3, dec: base * 1.2, color: '#fb923c', jitter: 0.25 };
      // 포물선을 그리며 아래로 떨어짐
      case 'gravity': return { kind, g: 170, color: '#93c5fd', aimShift: 0 };
      // 서로 꼬이며 날아오는 2발 한 쌍
      case 'helix': return { kind: 'wave', amp: 24, freq: 6.5, helix: true, color: '#f0abfc', r: 4.5 };
      default: return { kind: 'straight' };
    }
  }

  function edgePoint() {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: rand(0, W), y: -14 };
    if (side === 1) return { x: W + 14, y: rand(0, H) };
    if (side === 2) return { x: rand(0, W), y: H + 14 };
    return { x: -14, y: rand(0, H) };
  }

  function spawnEdgeBullet() {
    const kind = weighted(stage.kinds);
    const p = edgePoint();
    const base = stage.speed * rand(0.85, 1.2);
    const o = kindOptions(kind, base);
    const jitter = o.jitter ?? 0.45;
    const a = Math.atan2(player.y - p.y, player.x - p.x) + rand(-jitter, jitter) + (o.aimShift || 0);
    let sp = base * (o.speedMul || 1);
    // 포물선 탄: 아래쪽 벽에서 나오면 위로 높이 쏘아 올림
    if (kind === 'gravity' && p.y > H * 0.5) sp *= 1.5;
    const helix = o.helix;
    delete o.speedMul; delete o.aimShift; delete o.jitter; delete o.helix;
    addBullet(p.x, p.y, a, sp, o);
    if (helix) addBullet(p.x, p.y, a, sp, { ...o, phase: Math.PI });
  }

  function updateBullet(b, dt) {
    b.t += dt;
    switch (b.kind) {
      case 'curve': {
        const c = Math.cos(b.w * dt), s = Math.sin(b.w * dt);
        const vx = b.vx * c - b.vy * s;
        b.vy = b.vx * s + b.vy * c;
        b.vx = vx;
        break;
      }
      case 'accel': {
        const sp = Math.hypot(b.vx, b.vy);
        const ns = Math.min(b.max, sp + b.acc * dt);
        b.vx *= ns / sp; b.vy *= ns / sp;
        break;
      }
      case 'homing': {
        if (b.t < b.homeT) {
          const sp = Math.hypot(b.vx, b.vy);
          const cur = Math.atan2(b.vy, b.vx);
          const want = Math.atan2(player.y - b.y, player.x - b.x);
          const na = cur + clamp(angleDiff(cur, want), -b.turn * dt, b.turn * dt);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
        break;
      }
      case 'zigzag': {
        if (b.t >= b.nextZig) {
          b.nextZig += b.zigT;
          const a = b.zigA * b.zigDir;
          b.zigDir = -b.zigDir;
          const c = Math.cos(a), s = Math.sin(a);
          const vx = b.vx * c - b.vy * s;
          b.vy = b.vx * s + b.vy * c;
          b.vx = vx;
        }
        break;
      }
      case 'lock': {
        if (!b.locked) {
          const k = 1 - Math.min(1, 2.4 * dt);
          b.vx *= k; b.vy *= k;
          if (b.t >= b.lockT) {
            b.locked = true;
            const a = Math.atan2(player.y - b.y, player.x - b.x);
            b.vx = Math.cos(a) * b.dash; b.vy = Math.sin(a) * b.dash;
          }
        }
        break;
      }
      case 'boomerang': {
        b.s -= b.dec * dt;
        b.vx = b.ux * b.s; b.vy = b.uy * b.s;
        break;
      }
      case 'gravity': b.vy += b.g * dt; break;
    }

    if (b.kind === 'wave') {
      b.bx += b.vx * dt; b.by += b.vy * dt;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const off = Math.sin(b.t * b.freq + (b.phase || 0)) * b.amp;
      b.x = b.bx + (-b.vy / sp) * off;
      b.y = b.by + (b.vx / sp) * off;
    } else if (b.kind === 'orbit') {
      // 발사 지점을 중심으로 돌면서 점점 멀어지는 소용돌이
      b.oa += b.av * dt;
      b.or += b.rv * dt;
      b.x = b.cx + Math.cos(b.oa) * b.or;
      b.y = b.cy + Math.sin(b.oa) * b.or;
    } else {
      b.x += b.vx * dt; b.y += b.vy * dt;
    }

    if (b.kind === 'bounce' && b.bounces > 0) {
      if ((b.x < b.r && b.vx < 0) || (b.x > W - b.r && b.vx > 0)) { b.vx = -b.vx; b.bounces--; }
      if ((b.y < b.r && b.vy < 0) || (b.y > H - b.r && b.vy > 0)) { b.vy = -b.vy; b.bounces--; }
    }

    if (b.kind === 'split' && b.t >= b.fuse) {
      b.dead = true;
      const off = rand(0, TAU);
      for (let k = 0; k < b.parts; k++) {
        addBullet(b.x, b.y, off + (k / b.parts) * TAU, 150, { r: 4, color: '#fca5a5' });
      }
      burst(b.x, b.y, '#f8fafc', 8, 120);
    }
  }

  // ==================================================================
  // 웨이브 이벤트 (경고 후 발동하는 포탑 등)
  // ==================================================================
  function safePoint(minFromPlayer) {
    for (let k = 0; k < 20; k++) {
      const p = { x: rand(60, W - 60), y: rand(60, H - 60) };
      if (dist(p, player) >= minFromPlayer) return p;
    }
    return { x: player.x < W / 2 ? W - 80 : 80, y: player.y < H / 2 ? H - 80 : 80 };
  }

  function triggerEvent(type) {
    const sp = stage.speed;
    if (type === 'fan') {
      const p = edgePoint();
      const a0 = Math.atan2(player.y - p.y, player.x - p.x);
      const n = 5 + Math.floor(diff() * 6);
      for (let k = 0; k < n; k++) addBullet(p.x, p.y, a0 + (k - (n - 1) / 2) * 0.13, sp * 1.1);
    } else if (type === 'wall') {
      const fromTop = Math.random() < 0.5;
      const horizontal = Math.random() < 0.5;
      const len = horizontal ? H : W;
      const gap = rand(80, len - 160);
      const gapW = Math.max(66, 125 - diff() * 45);
      for (let v = 10; v < len; v += 26) {
        if (v > gap && v < gap + gapW) continue;
        if (horizontal) addBullet(fromTop ? -12 : W + 12, v, fromTop ? 0 : Math.PI, sp * 0.75, { r: 5 });
        else addBullet(v, fromTop ? -12 : H + 12, fromTop ? Math.PI / 2 : -Math.PI / 2, sp * 0.75, { r: 5 });
      }
    } else if (type === 'turretRing' || type === 'turretSpiral') {
      const p = safePoint(230);
      hazards.push({ x: p.x, y: p.y, type, t: 0, delay: 1.1, dur: type === 'turretSpiral' ? 2.2 : 0, cd: 0, ang: rand(0, TAU) });
    }
  }

  function updateHazards(dt) {
    for (const h of hazards) {
      h.t += dt;
      if (h.t < h.delay) continue;
      if (h.type === 'turretRing') {
        const n = 12 + Math.floor(diff() * 20);
        for (let k = 0; k < n; k++) addBullet(h.x, h.y, h.ang + (k / n) * TAU, stage.speed * 0.9);
        burst(h.x, h.y, stage.colors.accent, 12, 150);
        h.dead = true;
      } else if (h.type === 'turretSpiral') {
        h.cd -= dt;
        while (h.cd <= 0) {
          h.cd += 0.07;
          for (let k = 0; k < 2; k++) addBullet(h.x, h.y, h.ang + k * Math.PI, stage.speed * 0.8, { r: 4 });
          h.ang += 0.32;
        }
        if (h.t > h.delay + h.dur) h.dead = true;
      }
    }
    hazards = hazards.filter(h => !h.dead);
  }

  // ==================================================================
  // 보스
  // ==================================================================
  function makeBoss(def) {
    const hp = def.hp;
    return {
      def, x: W / 2, y: -80, r: def.r, hp, maxHp: hp, dispHp: hp, dying: 0,
      t: 0, entering: true, patIdx: 0, patT: 0, cd: 0.5, rest: 1.0, ang: 0,
      flash: 0, alpha: 1, tx: W / 2, ty: BY, moveT: 0, tpState: 0,
      pattern: def.patterns[0],
    };
  }

  function moveBoss(b, dt) {
    const m = b.def.move;
    const t = b.t;
    if (b.entering) {
      b.y += (BY - b.y) * Math.min(1, dt * 2.2);
      if (Math.abs(b.y - BY) < 2) { b.entering = false; b.t = 0; }
      return;
    }
    if (m === 'sway') { b.x = W / 2 + Math.sin(t * 0.8) * W * 0.36; b.y = BY + Math.sin(t * 1.6) * 24; }
    else if (m === 'float') { b.x = W / 2 + Math.sin(t * 0.5) * W * 0.3; b.y = BY + 20 + Math.sin(t * 1.1) * 60; }
    else if (m === 'center') { b.x = W / 2 + Math.sin(t * 1.3) * 40; b.y = BY + 50 + Math.sin(t * 0.9) * 30; }
    else if (m === 'orbit') { b.x = W / 2 + Math.cos(t * 0.7) * W * 0.33; b.y = H * 0.32 + Math.sin(t * 0.7) * 150; }
    else if (m === 'figure8') { b.x = W / 2 + Math.sin(t * 0.6) * W * 0.38; b.y = BY + 80 + Math.sin(t * 1.2) * 140; }
    else if (m === 'dash') {
      b.moveT -= dt;
      if (b.moveT <= 0) { b.moveT = 2.6; b.tx = rand(90, W - 90); b.ty = rand(BY - 40, H * 0.45); }
      b.x += (b.tx - b.x) * Math.min(1, dt * 3);
      b.y += (b.ty - b.y) * Math.min(1, dt * 3);
    } else if (m === 'teleport') {
      b.moveT -= dt;
      if (b.tpState === 0 && b.moveT <= 0) { b.tpState = 1; }
      if (b.tpState === 1) {
        b.alpha -= dt * 3;
        if (b.alpha <= 0) {
          b.alpha = 0;
          const p = safePoint(260);
          b.x = p.x; b.y = Math.min(p.y, H * 0.6);
          b.tpState = 2;
        }
      } else if (b.tpState === 2) {
        b.alpha += dt * 3;
        if (b.alpha >= 1) { b.alpha = 1; b.tpState = 0; b.moveT = 3.2; }
      }
    }
  }

  // 보스 공격 1회 발사 → 다음 발사까지의 대기 시간(초)을 돌려줌
  function firePattern(b, name) {
    // 보스 강도: 1단계 0.45(매우 쉬움) → 20단계 1.25
    const i = stageIdx;
    const d = diff();
    const power = 0.45 + d * 0.8;
    const dc = Math.min(d, 1.35); // 탄 개수는 지나치게 늘지 않도록 제한
    const sp = 105 + Math.min(d, 1.4) * 165;
    const enraged = i >= 2 && b.hp <= b.maxHp * rageAt(b);
    const rate = (enraged ? 0.75 : 1) / power;
    const N = n => Math.max(2, Math.round(n * (0.5 + dc * 1.1)));
    const toP = Math.atan2(player.y - b.y, player.x - b.x);
    let cd = 1;

    switch (name) {
      case 'aimed': {
        const n = N(3 + Math.floor(d * 3)) + (enraged ? 2 : 0);
        for (let k = 0; k < n; k++) addBullet(b.x, b.y, toP + (k - (n - 1) / 2) * 0.2, sp * 1.15);
        cd = 0.7; break;
      }
      case 'ring': {
        const n = N(14);
        b.ang += 0.3;
        for (let k = 0; k < n; k++) addBullet(b.x, b.y, b.ang + (k / n) * TAU, sp);
        cd = 1.1; break;
      }
      case 'spiral': {
        const arms = d >= 0.75 ? 4 : d >= 0.35 ? 3 : 2;
        for (let k = 0; k < arms; k++) addBullet(b.x, b.y, b.ang + (k / arms) * TAU, sp * 0.9, { r: 4 });
        b.ang += 0.22;
        cd = 0.075; break;
      }
      case 'curveRing': {
        const n = N(12);
        b.ang += 0.25;
        for (let k = 0; k < n; k++) {
          addBullet(b.x, b.y, b.ang + (k / n) * TAU, sp * 0.85, { kind: 'curve', w: k % 2 ? 0.8 : -0.8 });
        }
        cd = 1.3; break;
      }
      case 'waveFan': {
        for (let k = 0; k < 5; k++) addBullet(b.x, b.y, toP + (k - 2) * 0.32, sp * 0.9, { kind: 'wave', amp: 32, freq: 5, color: '#a5f3fc' });
        cd = 0.8; break;
      }
      case 'rain': {
        const kind = d >= 0.3 ? 'accel' : 'straight';
        addBullet(rand(10, W - 10), -12, Math.PI / 2 + rand(-0.12, 0.12), sp * rand(0.7, 1.2),
          kind === 'accel' ? { kind, acc: 160, max: sp * 2, color: '#fb923c' } : {});
        cd = 0.09; break;
      }
      case 'rainUp': {
        addBullet(rand(10, W - 10), H + 12, -Math.PI / 2 + rand(-0.1, 0.1), sp * rand(0.6, 1),
          { kind: 'wave', amp: rand(10, 25), freq: rand(3, 5), r: rand(4, 8), color: '#a5f3fc' });
        cd = 0.12; break;
      }
      case 'accelBurst': {
        const n = N(18);
        b.ang += 0.2;
        for (let k = 0; k < n; k++) addBullet(b.x, b.y, b.ang + (k / n) * TAU, 40, { kind: 'accel', acc: 230, max: sp * 2, color: '#fb7185' });
        cd = 1.2; break;
      }
      case 'homingVolley': {
        for (let k = 0; k < 4; k++) addBullet(b.x, b.y, rand(0, TAU), sp * 0.8, { kind: 'homing', homeT: 2, turn: 2, color: '#c084fc', r: 6 });
        cd = 1.6; break;
      }
      case 'bounceSpray': {
        addBullet(b.x, b.y, rand(0, TAU), sp * 1.05, { kind: 'bounce', bounces: 2, color: '#4ade80' });
        cd = 0.16; break;
      }
      case 'cross': {
        const arms = d >= 0.45 ? 6 : 4;
        for (let k = 0; k < arms; k++) addBullet(b.x, b.y, b.ang + (k / arms) * TAU, sp, { r: 4 });
        b.ang += 0.065;
        cd = 0.09; break;
      }
      case 'splitBomb': {
        addBullet(b.x, b.y, toP + rand(-0.2, 0.2), sp * 0.9, { kind: 'split', fuse: 1.0, parts: N(12), r: 10, color: '#f8fafc' });
        cd = 1.0; break;
      }
      case 'zigzagFan': {
        for (let k = 0; k < 4; k++) addBullet(b.x, b.y, toP + (k - 1.5) * 0.4 - 0.37, sp, { kind: 'zigzag', zigT: 0.3, zigA: 0.75, zigDir: 1, color: '#fde047' });
        cd = 0.9; break;
      }
      // ---- 새 패턴 ----
      case 'helixStream': { // 플레이어를 향해 꼬이며 날아오는 이중 나선 줄기
        const a = toP + Math.sin(b.t * 1.3) * 0.25;
        for (const ph of [0, Math.PI]) addBullet(b.x, b.y, a, sp * 1.05, { kind: 'wave', amp: 26, freq: 7, phase: ph, r: 4.5, color: '#f0abfc' });
        cd = 0.13; break;
      }
      case 'orbitBurst': { // 보스 주위를 돌면서 퍼져 나가는 소용돌이 고리
        const n = N(10);
        const dir = (b.patIdx % 2 ? 1 : -1);
        b.ang += 0.4;
        for (let k = 0; k < n; k++) {
          addBullet(b.x, b.y, b.ang + (k / n) * TAU, 0, { kind: 'orbit', av: dir * (1.3 + d * 0.6), rv: sp * 0.55, or: b.r * 0.8, color: '#e879f9' });
        }
        cd = 1.5; break;
      }
      case 'lockOn': { // 보스 주위에 탄을 깔고 잠시 후 일제히 조준 돌진
        const n = 2 + Math.floor(dc * 4) + (enraged ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const a = b.ang + (k / n) * TAU;
          addBullet(b.x + Math.cos(a) * (b.r + 24), b.y + Math.sin(a) * (b.r + 24), a, 60,
            { kind: 'lock', lockT: 0.9 + k * 0.08, dash: sp * 2.4, r: 6, color: '#f87171' });
        }
        b.ang += 0.7;
        cd = 1.7; break;
      }
      case 'boomerangFan': { // 부채꼴로 던졌다가 되돌아오는 부메랑
        const n = N(5);
        for (let k = 0; k < n; k++) {
          addBullet(b.x, b.y, toP + (k - (n - 1) / 2) * 0.28, sp * 1.5, { kind: 'boomerang', dec: sp * 1.35, color: '#fb923c' });
        }
        cd = 1.2; break;
      }
      case 'gravityFountain': { // 위로 솟구쳤다가 쏟아지는 분수
        for (let k = 0; k < 2; k++) {
          addBullet(b.x, b.y, -Math.PI / 2 + rand(-1.0, 1.0), sp * rand(0.9, 1.5), { kind: 'gravity', g: 300, color: '#93c5fd' });
        }
        cd = 0.09; break;
      }
      case 'flower': { // 빠른 탄과 느린 탄이 겹쳐 꽃잎 모양으로 퍼짐
        const n = N(14);
        b.ang += 0.17;
        for (let k = 0; k < n; k++) {
          addBullet(b.x, b.y, b.ang + (k / n) * TAU, sp * (k % 2 ? 1.1 : 0.65), { r: 4.5, color: k % 2 ? '#f9a8d4' : '#fde68a' });
        }
        cd = 0.55; break;
      }
      case 'sweep': { // 레이저처럼 촘촘한 탄 줄기가 좌우로 쓸어냄
        addBullet(b.x, b.y, toP + Math.sin(b.t * 2.2) * 0.95, sp * 1.7, { r: 4, color: '#fef08a' });
        cd = 0.035; break;
      }
      case 'mineField': { // 느리게 퍼지다 터지는 지뢰
        addBullet(b.x, b.y, rand(0, TAU), sp * rand(0.3, 0.5), { kind: 'split', fuse: rand(1.4, 2.0), parts: N(8), r: 9, color: '#a5b4fc' });
        cd = 0.55; break;
      }
      case 'summon': { // 화면 곳곳에 경고 후 터지는 포탑 소환
        const p = safePoint(200);
        hazards.push({ x: p.x, y: p.y, type: Math.random() < 0.5 ? 'turretRing' : 'turretSpiral', t: 0, delay: 1.1, dur: 2, cd: 0, ang: rand(0, TAU) });
        cd = 2.2; break;
      }
    }
    return cd * rate;
  }

  function updateBoss(dt) {
    const b = boss;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.dispHp += (b.hp - b.dispHp) * Math.min(1, dt * 8);

    // 체력이 0이 된 뒤의 폭발 연출 (이 동안 보스는 공격하지 않음)
    if (b.dying > 0) {
      b.dying -= dt;
      shake = Math.max(shake, 0.25);
      if (Math.random() < dt * 14) burst(b.x + rand(-b.r, b.r), b.y + rand(-b.r, b.r), pick([b.def.color, '#ffffff', '#fde047']), 10, 200);
      if (b.dying <= 0) bossDefeated();
      return;
    }

    moveBoss(b, dt);
    if (b.entering || b.alpha < 0.6) return;

    // 분노 모드(체력 절반 이하): 주 패턴과 별개로 추가 패턴을 동시에 사용
    if (b.def.rage && stageIdx >= 2 && b.hp <= b.maxHp * rageAt(b)) {
      b.rcd = (b.rcd ?? 1) - dt;
      if (b.rcd <= 0) b.rcd = firePattern(b, b.def.rage) * 1.8;
    }

    if (b.rest > 0) { b.rest -= dt; }
    else {
      b.patT += dt;
      b.cd -= dt;
      if (b.cd <= 0) b.cd = firePattern(b, b.pattern);
      if (b.patT > 4.5) {
        b.patT = 0;
        b.rest = Math.max(0.15, 0.5 + 0.9 * (1 - diff()));
        b.cd = 0.2;
        const list = b.def.patterns;
        b.pattern = b.def.random ? pick(list) : list[++b.patIdx % list.length];
      }
    }

    // 보스 공격 아이템 생성 (초반 스테이지일수록 자주)
    orbTimer -= dt;
    if (orbTimer <= 0 && orbs.length < 2) {
      orbTimer = 1.4 + Math.min(diff(), 1) * 1.2;
      for (let k = 0; k < 20; k++) {
        const p = { x: rand(50, W - 50), y: rand(80, H - 50) };
        if (dist(p, b) > 170 && dist(p, player) > 110) { orbs.push({ x: p.x, y: p.y, t: 0, life: 9, type: pickItem() }); break; }
      }
    }

    if (dist(b, player) < b.r + player.r - 2 && b.alpha > 0.8 && b.dying <= 0) hurt();
  }

  // ==================================================================
  // 보스 공격 아이템
  // ==================================================================
  const ITEMS = {
    orb:    { icon: '★', color: '#fde047', w: 40, label: '공격 +1' },
    triple: { icon: '⚡', color: '#38bdf8', w: 16, label: '트리플 샷! (3연타)' },
    bomb:   { icon: '💣', color: '#f43f5e', w: 10, label: '폭탄! 탄막 제거 + 2연타' },
    shield: { icon: '🛡', color: '#4ade80', w: 12, label: '방패 장착! (1회 방어)' },
    slow:   { icon: '⏳', color: '#c084fc', w: 13, label: '시간 감속! (5초)' },
    heart:  { icon: '❤', color: '#fb7185', w: 9, label: '생명 +1' },
    // ---- 새 아이템 ----
    laser:  { icon: '🔆', color: '#facc15', w: 9, label: '레이저! (2.4초 연속 공격)' },
    drone:  { icon: '🛸', color: '#a5b4fc', w: 9, label: '드론 소환! (자동 공격 + 탄 막기)' },
    freeze: { icon: '❄', color: '#7dd3fc', w: 9, label: '빙결! (탄 2.5초 정지)' },
    magnet: { icon: '🧲', color: '#fda4af', w: 8, label: '자석! (아이템 끌어당김)' },
    ghost:  { icon: '👻', color: '#e2e8f0', w: 8, label: '유령화! (3초 무적)' },
    mini:   { icon: '🔹', color: '#60a5fa', w: 8, label: '축소! (8초간 판정 절반)' },
  };
  // 버티기 구간에도 가끔 나오는 방어용 아이템 (보스가 없을 때는 공격 효과 없음)
  const WAVE_ITEMS = ['shield', 'slow', 'freeze', 'ghost', 'mini', 'drone', 'heart'];

  function pickItem(pool) {
    const w = {};
    for (const [k, v] of Object.entries(ITEMS)) {
      if (pool && !pool.includes(k)) continue;
      if (k === 'heart' && lives >= 5) continue;
      if (k === 'shield' && player.shield) continue;
      if (k === 'drone' && drones.length >= 2) continue;
      if (k === 'laser' && laserT > 0) continue;
      w[k] = k === 'heart' && pool ? v.w * 0.4 : v.w;
    }
    return weighted(w);
  }

  function fireShot(x, y, delay, dmg, color, size) {
    shots.push({ x, y, t: -delay, dmg, color, size });
  }

  function collectItem(o) {
    const it = ITEMS[o.type];
    score += 50;
    burst(o.x, o.y, it.color, 14, 170);
    floaters.push({ x: o.x, y: o.y - 18, text: it.label, color: it.color, t: 0 });
    switch (o.type) {
      case 'orb':
        Sound.sfx('orb');
        fireShot(o.x, o.y, 0, 1, it.color, 6);
        break;
      case 'triple':
        Sound.sfx('triple');
        for (let k = 0; k < 3; k++) fireShot(o.x, o.y, k * 0.15, 1, it.color, 5);
        break;
      case 'bomb':
        Sound.sfx('bomb');
        for (const b of bullets) burst(b.x, b.y, b.color, 2, 80);
        bullets = []; hazards = [];
        flash = 0.4; shake = 0.35;
        fireShot(o.x, o.y, 0, 1, it.color, 9);
        fireShot(o.x, o.y, 0.2, 1, it.color, 9);
        break;
      case 'shield':
        Sound.sfx('shield');
        player.shield = true;
        fireShot(o.x, o.y, 0, 1, it.color, 6);
        break;
      case 'slow':
        Sound.sfx('slow');
        slowT = 5;
        fireShot(o.x, o.y, 0, 1, it.color, 6);
        break;
      case 'heart':
        Sound.sfx('extraLife');
        lives = Math.min(5, lives + 1);
        fireShot(o.x, o.y, 0, 1, it.color, 6);
        break;
      case 'laser':
        Sound.sfx('laser');
        laserT = 2.4;
        laserTick = 0.15;
        break;
      case 'drone':
        Sound.sfx('drone');
        drones.push({ ang: drones.length ? drones[0].ang + Math.PI : 0, life: 12, cd: 0.8 });
        break;
      case 'freeze':
        Sound.sfx('freeze');
        freezeT = 2.5;
        fireShot(o.x, o.y, 0, 1, it.color, 6);
        break;
      case 'magnet':
        Sound.sfx('magnet');
        magnetT = 9;
        fireShot(o.x, o.y, 0, 1, it.color, 6);
        break;
      case 'ghost':
        Sound.sfx('ghost');
        ghostT = 3;
        player.inv = Math.max(player.inv, 3);
        fireShot(o.x, o.y, 0, 1, it.color, 6);
        break;
      case 'mini':
        Sound.sfx('mini');
        miniT = 8;
        fireShot(o.x, o.y, 0, 1, it.color, 6);
        break;
    }
  }

  // 아이템 효과 진행 (레이저, 드론, 자석, 축소 등)
  function updateItemEffects(dt) {
    freezeT = Math.max(0, freezeT - dt);
    magnetT = Math.max(0, magnetT - dt);
    miniT = Math.max(0, miniT - dt);
    ghostT = Math.max(0, ghostT - dt);
    player.r = miniT > 0 ? 4 : 8;

    // 레이저: 일정 간격으로 보스에 연속 피해
    if (laserT > 0) {
      laserT -= dt;
      laserTick -= dt;
      if (laserTick <= 0 && boss && boss.dying <= 0 && !boss.entering) {
        laserTick = 0.6;
        damageBoss(1);
      }
    }

    // 드론: 플레이어 주위를 돌며 보스를 자동 공격하고, 닿는 탄을 막음
    for (const dr of drones) {
      dr.life -= dt;
      dr.ang += 3 * dt;
      dr.x = player.x + Math.cos(dr.ang) * 34;
      dr.y = player.y + Math.sin(dr.ang) * 34;
      dr.cd -= dt;
      if (dr.cd <= 0 && boss && boss.dying <= 0 && !boss.entering) {
        dr.cd = 1.6;
        fireShot(dr.x, dr.y, 0, 1, '#a5b4fc', 4);
      }
      for (const b of bullets) {
        if (!b.dead && Math.hypot(b.x - dr.x, b.y - dr.y) < b.r + 8) { b.dead = true; burst(b.x, b.y, '#a5b4fc', 4, 90); }
      }
    }
    drones = drones.filter(dr => dr.life > 0);

    // 자석: 화면의 아이템을 플레이어 쪽으로 끌어당김
    if (magnetT > 0) {
      for (const o of orbs) {
        const dx = player.x - o.x, dy = player.y - o.y, dd = Math.hypot(dx, dy) || 1;
        const m = Math.min(dd, 340 * dt);
        o.x += (dx / dd) * m; o.y += (dy / dd) * m;
      }
    }
  }

  // 아이템 1개 = 보스 체력 1칸 이상. 체력이 정확히 0이 되어야만 쓰러집니다.
  function damageBoss(dmg = 1) {
    if (!boss || boss.dying > 0 || boss.hp <= 0) return;
    boss.hp = Math.max(0, boss.hp - dmg);
    boss.flash = 0.15;
    score += 100;
    shake = Math.max(shake, 0.15);
    burst(boss.x, boss.y, '#ffffff', 14, 220);
    Sound.sfx('bossHit');
    if (boss.hp === 0) {
      boss.dying = 1.8;
      for (const bl of bullets) burst(bl.x, bl.y, bl.color, 2, 60);
      bullets = []; hazards = []; orbs = []; shots = [];
      Sound.stopMusic();
      Sound.sfx('bossDie');
    }
  }

  function bossDefeated() {
    const b = boss;
    for (let k = 0; k < 6; k++) burst(b.x + rand(-40, 40), b.y + rand(-40, 40), pick([b.def.color, '#ffffff', stage.colors.accent]), 30, 360);
    bullets = []; hazards = []; orbs = []; shots = [];
    boss = null;
    flash = 0.6;
    shake = 0.6;
    score += 1000 * (stageIdx + 1);
    const gainedLife = lives < 5;
    lives = Math.min(5, lives + 1);
    Sound.sfx(stageIdx >= openCount() - 1 ? 'allClear' : 'stageClear');
    if (gainedLife) setTimeout(() => Sound.sfx('extraLife'), 1300);
    if (stageIdx + 2 > maxStage) {
      maxStage = Math.min(STAGES.length, stageIdx + 2);
      store.set('dodgevertex-max-stage', maxStage);
    }
    setPhase('clear');
  }

  // ==================================================================
  // 파티클
  // ==================================================================
  function burst(x, y, color, n, power) {
    if (particles.length > 900) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = power * (0.3 + Math.random());
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.7, color });
    }
  }

  // ==================================================================
  // 진행
  // ==================================================================
  function setPhase(p) {
    phase = p;
    phaseT = 0;
  }

  function startGame(stageNum) {
    const s = STAGES[stageNum - 1];
    if (!s || !isOpen(s)) return; // 없는 스테이지이거나 아직 열리지 않은 해의 스테이지
    score = 0;
    lives = 3;
    startStage(stageNum - 1);
    state = 'playing';
    hidePanel();
    Sound.sfx('start');
  }

  function startStage(i) {
    stageIdx = i;
    stage = STAGES[i];
    resetField();
    spawnTimer = 0.4;
    eventTimer = stage.eventEvery;
    orbTimer = 1.5;
    stageTime = 0;
    stageHits = 0;
    stageScore0 = score;
    setPhase('intro');
    Sound.playTheme(stage.music, false, i + 1);
  }

  function hurt() {
    if (player.inv > 0 || state !== 'playing' || (window.DodgeDebug && window.DodgeDebug.god)) return;
    if (player.shield) {
      player.shield = false;
      player.inv = 1.0;
      burst(player.x, player.y, '#4ade80', 20, 200);
      floaters.push({ x: player.x, y: player.y - 20, text: '방어!', color: '#4ade80', t: 0 });
      Sound.sfx('shield');
      bullets = bullets.filter(b => Math.hypot(b.x - player.x, b.y - player.y) > 110);
      return;
    }
    lives--;
    stageHits++;
    shake = 0.4;
    flash = 0.25;
    burst(player.x, player.y, '#5eead4', 24, 220);
    if (lives <= 0) { gameOver(); return; }
    Sound.sfx('hit');
    player.inv = 2.0;
    bullets = bullets.filter(b => Math.hypot(b.x - player.x, b.y - player.y) > 150);
  }

  function saveBest() {
    if (score > bestScore) {
      bestScore = Math.floor(score);
      store.set('dodgevertex-best-score', bestScore);
      return true;
    }
    return false;
  }

  function gameOver() {
    state = 'over';
    burst(player.x, player.y, '#5eead4', 40, 260);
    Sound.stopMusic();
    Sound.sfx('die');
    const isNew = saveBest();
    setTimeout(() => {
      showPanel(`
        <h1>GAME OVER</h1>
        <p>STAGE ${stageIdx + 1} · ${stage.name}에서 쓰러졌습니다.</p>
        <p class="score-line">점수 ${Math.floor(score).toLocaleString()}${isNew ? ' · 신기록!' : ''}</p>
        <div class="btn-row">
          <button class="primary" data-action="continue">📺 광고 보고 이어하기</button>
        </div>
        <p class="continue-note">STAGE ${stageIdx + 1}부터 생명 3개로 다시 시작하고, 점수 ${Math.floor(stageScore0).toLocaleString()}점을 이어 갑니다</p>
        <div class="btn-row">
          <button data-action="start" data-stage="1">처음부터</button>
          <button data-action="share">📤 점수 공유</button>
          <button data-action="title">타이틀</button>
        </div>`);
    }, 900);
  }

  // 점수 공유: 휴대폰은 공유 창(카카오톡, 문자 등), 지원하지 않으면 클립보드에 복사
  const SHARE_URL = 'https://jioyng.github.io/DodgeVertex/';
  async function shareScore(btn) {
    const pts = Math.floor(score).toLocaleString();
    const text = state === 'ending'
      ? (stageIdx >= STAGES.length - 1
        ? `DodgeVertex ${STAGES.length}개 스테이지 진짜 엔딩 달성! 최종 점수 ${pts}점 🏆 너도 도전해봐 👉`
        : `DodgeVertex ${stageIdx + 1}개 스테이지 ALL CLEAR! 최종 점수 ${pts}점 🏆 너도 도전해봐 👉`)
      : `DodgeVertex STAGE ${stageIdx + 1}(${stage.name})까지 ${pts}점! 너도 도전해봐 👉`;
    const label = btn.textContent;
    const say = msg => { btn.textContent = msg; setTimeout(() => { btn.textContent = label; }, 1800); };
    if (navigator.share) {
      try { await navigator.share({ title: 'DodgeVertex', text, url: SHARE_URL }); }
      catch (err) { if (err && err.name !== 'AbortError') say('공유 실패'); }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${SHARE_URL}`);
      say('✅ 복사됨');
    } catch {
      say('공유 불가');
    }
  }

  // 보상형 광고를 끝까지 보면 쓰러진 스테이지 처음부터, 그 스테이지 시작 때 점수로 이어 하기
  async function continueAfterAd() {
    if (state !== 'over') return;
    const rewarded = window.Ads ? await window.Ads.showRewarded() : true;
    if (!rewarded || state !== 'over') return;
    score = stageScore0;
    lives = 3;
    startStage(stageIdx);
    state = 'playing';
    hidePanel();
    Sound.sfx('start');
  }

  // 엔딩: 지금 열린 마지막 스테이지를 깨면 나옴.
  //  - 30단계(최종)를 깨면 진짜 엔딩
  //  - 그 전이면 축하 + 다음 스페셜 스테이지가 열리는 날짜 안내
  function ending() {
    state = 'ending';
    const isNew = saveBest();
    const cleared = stageIdx + 1;
    const trueEnd = cleared >= STAGES.length;
    const next = STAGES[cleared];
    Sound.playTheme(STAGES[1].music, false, 77);

    const roll = STAGES.slice(0, cleared)
      .map((s, i) => `<div class="cr-stage${s.special ? ' cr-special' : ''}"><b>STAGE ${i + 1}${s.special ? ' ★' : ''}</b> ${s.name}<br><span>BOSS · ${s.boss.name}</span></div>`)
      .join('');
    const tail = trueEnd
      ? `<div class="cr-big">THE END</div><div>모든 차원을 넘어선 당신에게</div>`
      : `<div class="cr-big">TO BE CONTINUED</div><div>SPECIAL STAGE ${cleared + 1} · ${next.openYear}. 1. 1 OPEN</div>`;
    const notice = trueEnd
      ? `<p class="ending-note">🏆 최종 보스 「${STAGES[STAGES.length - 1].boss.name}」까지 쓰러뜨렸습니다.<br>${STAGES.length}개 스테이지를 모두 정복한 <b>진짜 엔딩</b>입니다!</p>`
      : `<p class="ending-note">🔓 다음 <b>스페셜 STAGE ${cleared + 1}</b>은(는)<br><b>${next.openYear}년 1월 1일</b>에 열립니다. 그때 다시 도전하세요!</p>`;

    showPanel(`
      <h1>${trueEnd ? 'TRUE ENDING' : 'ALL CLEAR!'}</h1>
      <p>${trueEnd
        ? '축하합니다! 극악의 최종 스테이지까지 모두 돌파했습니다!'
        : `지금 열려 있는 ${cleared}개 스테이지를 모두 클리어했습니다. 축하합니다!`}</p>
      <div class="credits${trueEnd ? ' credits-true' : ''}"><div class="credits-roll">
        <div class="cr-big">DODGE VERTEX</div>
        ${roll}
        <div class="cr-stage"><b>GAME</b> DodgeVertex<br><span>Made by jioyng</span></div>
        <div class="cr-stage"><b>MUSIC &amp; SOUND</b><br><span>Web Audio 신시사이저</span></div>
        <div class="cr-stage"><b>PLAYER</b><br><span>바로 당신!</span></div>
        ${tail}
      </div></div>
      ${notice}
      <p class="score-line">최종 점수 ${Math.floor(score).toLocaleString()}${isNew ? ' · 신기록!' : ''}</p>
      <div class="btn-row">
        <button class="primary" data-action="start" data-stage="1">다시 도전</button>
        <button data-action="share">📤 점수 공유</button>
        <button data-action="title">타이틀</button>
      </div>`);
  }

  function update(dt) {
    animT += dt;
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt);

    if (state === 'playing') {
      phaseT += dt;
      if (phase !== 'clear') stageTime += dt;
      bossHintT = Math.max(0, bossHintT - dt);
      player.inv = Math.max(0, player.inv - dt);
      movePlayer(dt);

      if (phase === 'intro' && phaseT > 3) setPhase('wave');

      if (phase === 'wave') {
        score += dt * 10 * (stageIdx + 1);
        spawnTimer -= dt;
        const interval = stage.spawn * Math.max(0.6, 1 - phaseT / stage.waveTime * 0.35);
        while (spawnTimer <= 0) { spawnEdgeBullet(); spawnTimer += interval; }
        if (stage.events.length) {
          eventTimer -= dt;
          if (eventTimer <= 0) { eventTimer = stage.eventEvery * rand(0.8, 1.2); triggerEvent(pick(stage.events)); }
        }
        // 버티기 구간의 방어용 아이템 (2단계부터, 약 9초마다)
        if (stageIdx >= 1) {
          waveItemT -= dt;
          if (waveItemT <= 0 && orbs.length < 1) {
            waveItemT = rand(8, 10);
            const p = safePoint(140);
            orbs.push({ x: p.x, y: Math.max(140, p.y), t: 0, life: 7, type: pickItem(WAVE_ITEMS) });
          }
        }
        if (phaseT >= stage.waveTime) {
          setPhase('warning');
          Sound.stopMusic();
          Sound.sfx('warning');
        }
      }

      if (phase === 'warning' && phaseT > 2.4) {
        boss = makeBoss(stage.boss);
        setPhase('boss');
        bossHintT = stageIdx === 0 ? 6 : 3.5;
        Sound.playTheme(stage.music, true, stageIdx + 1);
      }

      if (phase === 'boss' && boss) {
        score += dt * 10 * (stageIdx + 1);
        updateBoss(dt);
      }

      // 클리어 연출 후 자동으로 다음 스테이지
      if (phase === 'clear' && phaseT > 3.8) {
        if (stageIdx >= openCount() - 1) ending();
        else { startStage(stageIdx + 1); Sound.sfx('start'); }
      }

      updateHazards(dt);
      slowT = Math.max(0, slowT - dt);
      updateItemEffects(dt);
      const bdt = freezeT > 0 ? 0 : slowT > 0 ? dt * 0.45 : dt;
      for (const b of bullets) updateBullet(b, bdt);
      bullets = bullets.filter(b => !b.dead && b.x > -60 && b.x < W + 60 && b.y > -60 && b.y < H + 60);

      // 충돌
      if (phase !== 'clear' && player.inv <= 0) {
        for (const b of bullets) {
          const dx = b.x - player.x, dy = b.y - player.y, rr = b.r + player.r - 2;
          if (dx * dx + dy * dy < rr * rr) { hurt(); break; }
        }
      }

      // 아이템 수집 → 보스 공격
      for (const o of orbs) {
        o.t += dt;
        if (dist(o, player) < 8 + 15) { o.dead = true; collectItem(o); }
        else if (o.t > o.life) o.dead = true;
      }
      orbs = orbs.filter(o => !o.dead);

      for (const s of shots) {
        s.t += dt;
        if (!boss || boss.dying > 0) { s.dead = true; continue; }
        if (s.t < 0) continue;
        const a = Math.atan2(boss.y - s.y, boss.x - s.x);
        const sp = 500 + s.t * 600;
        s.x += Math.cos(a) * sp * dt;
        s.y += Math.sin(a) * sp * dt;
        if (particles.length < 900) particles.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.25, color: s.color });
        if (dist(s, boss) < boss.r) { s.dead = true; damageBoss(s.dmg); if (!boss) break; }
      }
      shots = shots.filter(s => !s.dead);

      for (const f of floaters) f.t += dt;
      floaters = floaters.filter(f => f.t < 1.4);
    }

    if (state !== 'paused') {
      for (const p of particles) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.95; p.vy *= 0.95;
        p.life -= dt;
      }
      particles = particles.filter(p => p.life > 0);
    }
  }

  function movePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      player.x += (dx / len) * player.speed * dt;
      player.y += (dy / len) * player.speed * dt;
    } else if (pointer.active) {
      const px = pointer.x - player.x, py = pointer.y - player.y;
      const d = Math.hypot(px, py);
      if (d > 1) {
        const m = Math.min(player.speed * (touchStart ? 1.5 : 1) * dt, d);
        player.x += (px / d) * m;
        player.y += (py / d) * m;
      }
    }
    player.x = clamp(player.x, player.r, W - player.r);
    player.y = clamp(player.y, player.r, H - player.r);
  }

  // ==================================================================
  // 배경
  // ==================================================================
  const MAXH = 1320;
  const STARS = Array.from({ length: 200 }, () => ({ x: Math.random() * W, y: Math.random() * MAXH, z: Math.random() }));
  const EMBERS = Array.from({ length: 130 }, () => ({ x: Math.random() * W, y: Math.random() * MAXH, s: rand(20, 70), p: rand(0, TAU) }));
  const DROPS = Array.from({ length: 160 }, () => ({ x: Math.random() * (W + 200), y: Math.random() * MAXH, s: rand(500, 800) }));
  let lightning = 0;

  function gradientBg(c1, c2, vertical = true) {
    const g = vertical ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBackground(st, t, dt) {
    const c = st.colors;
    ctx.save();
    switch (st.bg) {
      case 'grid': {
        gradientBg(c.bg, c.bg2);
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1;
        const off = (t * 18) % 40;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = -40 + off; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
        break;
      }
      case 'stars': {
        gradientBg(c.bg, c.bg2);
        for (const s of STARS) {
          s.y += (20 + s.z * 70) * dt;
          if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
          const tw = 0.5 + 0.5 * Math.sin(t * 3 + s.x);
          ctx.globalAlpha = 0.25 + s.z * 0.6 * tw;
          ctx.fillStyle = s.z > 0.85 ? c.accent : '#ffffff';
          const sz = 1 + s.z * 2;
          ctx.fillRect(s.x, s.y, sz, sz);
        }
        break;
      }
      case 'waves': {
        gradientBg(c.bg2, c.bg);
        ctx.lineWidth = 2;
        for (let k = 0; k < 7; k++) {
          ctx.strokeStyle = c.line;
          ctx.globalAlpha = 0.4 + k * 0.08;
          ctx.beginPath();
          const base = (H / 8) * (k + 0.9);
          for (let x = 0; x <= W; x += 16) {
            const y = base + Math.sin(x * 0.012 + t * (0.6 + k * 0.15) + k) * (14 + k * 3);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      }
      case 'rain': {
        gradientBg(c.bg, c.bg2);
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of DROPS) {
          d.y += d.s * dt; d.x -= d.s * 0.25 * dt;
          if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 200); }
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 5, d.y - 20);
        }
        ctx.stroke();
        if (Math.random() < 0.004) lightning = 0.18;
        if (lightning > 0) {
          lightning -= dt;
          ctx.globalAlpha = Math.max(0, lightning) * 1.5;
          ctx.fillStyle = '#e0e7ff';
          ctx.fillRect(0, 0, W, H);
        }
        break;
      }
      case 'rings': {
        gradientBg(c.bg2, c.bg, false);
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 3;
        for (let k = 0; k < 8; k++) {
          const r = (t * 70 + k * 80) % 900;
          ctx.globalAlpha = Math.max(0, 1 - r / 900);
          ctx.beginPath();
          ctx.arc(W / 2, H / 2, r, 0, TAU);
          ctx.stroke();
        }
        break;
      }
      case 'circuit': {
        gradientBg(c.bg, c.bg2);
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = 30; y < H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        for (let x = 40; x < W; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        ctx.stroke();
        ctx.fillStyle = c.accent;
        for (let r = 0; r < 10; r++) {
          const y = 30 + r * 60;
          const x = (t * (120 + r * 23) + r * 137) % (W + 60) - 30;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x, y - 1.5, 24, 3);
        }
        for (let q = 0; q < 10; q++) {
          const x = 40 + q * 80;
          const y = (t * (90 + q * 17) + q * 211) % (H + 60) - 30;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(x - 1.5, y, 3, 20);
        }
        break;
      }
      case 'embers': {
        gradientBg(c.bg, c.bg2);
        ctx.fillStyle = c.line;
        for (const e of EMBERS) {
          e.y -= e.s * dt;
          if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W; }
          const x = e.x + Math.sin(t * 2 + e.p) * 10;
          ctx.globalAlpha = 0.3 + 0.7 * (e.y / H);
          ctx.fillRect(x, e.y, 3, 3);
        }
        break;
      }
      case 'hex': {
        gradientBg(c.bg, c.bg2);
        const s = 34;
        const hw = Math.sqrt(3) * s;
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let row = -1; row * s * 1.5 < H + s; row++) {
          for (let col = -1; col * hw < W + hw; col++) {
            const cx = col * hw + (row % 2 ? hw / 2 : 0);
            const cy = row * s * 1.5;
            for (let k = 0; k < 6; k++) {
              const a = Math.PI / 6 + k * Math.PI / 3;
              const px = cx + Math.cos(a) * s, py = cy + Math.sin(a) * s;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
          }
        }
        ctx.stroke();
        const sx = ((t * 120) % (W + 400)) - 200;
        const g = ctx.createLinearGradient(sx - 120, 0, sx + 120, H);
        g.addColorStop(0, 'rgba(165,243,252,0)');
        g.addColorStop(0.5, 'rgba(165,243,252,0.08)');
        g.addColorStop(1, 'rgba(165,243,252,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case 'aurora': {
        gradientBg(c.bg, c.bg2);
        const cols = ['rgba(134,239,172,', 'rgba(103,232,249,', 'rgba(192,132,252,'];
        for (let k = 0; k < 3; k++) {
          const base = 120 + k * (H * 0.18);
          ctx.beginPath();
          for (let x = 0; x <= W; x += 20) {
            const y = base + Math.sin(x * 0.006 + t * (0.4 + k * 0.1) + k * 2) * 45;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          for (let x = W; x >= 0; x -= 20) {
            const y = base + 110 + Math.sin(x * 0.005 + t * 0.3 + k) * 30;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          const g = ctx.createLinearGradient(0, base - 40, 0, base + 150);
          g.addColorStop(0, cols[k] + '0)');
          g.addColorStop(0.4, cols[k] + '0.22)');
          g.addColorStop(1, cols[k] + '0)');
          ctx.fillStyle = g;
          ctx.fill();
        }
        for (const s of STARS) {
          if (s.z < 0.6) continue;
          ctx.globalAlpha = 0.4 * s.z;
          ctx.fillStyle = '#fff';
          ctx.fillRect(s.x, s.y, 1.5, 1.5);
        }
        break;
      }
      case 'scan': { // 신스웨이브: 줄무늬 태양 + 원근 격자
        gradientBg(c.bg, c.bg2);
        const hz = H * 0.5, sx = W / 2, sy = H * 0.36, sr = W * 0.3;
        const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
        sg.addColorStop(0, '#fde047'); sg.addColorStop(1, c.accent);
        ctx.fillStyle = sg;
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.bg2;
        for (let k = 0; k < 7; k++) {
          const yy = sy + k * sr * 0.16 + ((t * 12) % (sr * 0.16));
          ctx.fillRect(sx - sr, yy, sr * 2, 3 + k * 1.2);
        }
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, hz, W, H - hz);
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = -12; k <= 12; k++) { ctx.moveTo(sx + k * 10, hz); ctx.lineTo(sx + k * 90, H); }
        for (let k = 0; k < 14; k++) {
          const z = ((k + (t * 0.8) % 1) / 14);
          const yy = hz + (H - hz) * z * z;
          ctx.moveTo(0, yy); ctx.lineTo(W, yy);
        }
        ctx.stroke();
        break;
      }
      case 'matrix': { // 떨어지는 디지털 문자 비
        gradientBg(c.bg, c.bg2);
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        for (let col = 0; col < 30; col++) {
          const x = col * 20 + 10;
          const spd = 90 + ((col * 37) % 7) * 25;
          const head = (t * spd + col * 173) % (H + 260);
          for (let k = 0; k < 13; k++) {
            const y = head - k * 20;
            if (y < -20 || y > H + 20) continue;
            ctx.globalAlpha = k === 0 ? 0.9 : 0.55 * (1 - k / 13);
            ctx.fillStyle = k === 0 ? '#dcfce7' : c.accent;
            ctx.fillText(((col * 7 + Math.floor(y / 20) + Math.floor(t * 3)) % 3) ? '1' : '0', x, y);
          }
        }
        break;
      }
      case 'nebula': { // 천천히 움직이는 성운 + 별
        gradientBg(c.bg, c.bg2);
        const blobs = [[0.3, 0.25, c.accent], [0.75, 0.45, '#f472b6'], [0.4, 0.75, '#38bdf8'], [0.8, 0.85, c.accent]];
        blobs.forEach(([bx, by, col], k) => {
          const x = W * bx + Math.sin(t * 0.2 + k) * 60;
          const y = H * by + Math.cos(t * 0.17 + k * 2) * 50;
          const r = W * (0.45 + 0.08 * Math.sin(t * 0.3 + k));
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, col);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        });
        for (const s of STARS) {
          if (s.y > H) continue;
          ctx.globalAlpha = 0.25 + 0.6 * s.z * (0.5 + 0.5 * Math.sin(t * 2 + s.x));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(s.x, s.y, 1.5 + s.z, 1.5 + s.z);
        }
        break;
      }
      case 'tunnel': { // 안쪽으로 빨려 들어가는 터널
        gradientBg(c.bg2, c.bg, false);
        const cx = W / 2, cy = H * 0.42;
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 2;
        for (let k = 0; k < 12; k++) {
          const z = ((k / 12) + (t * 0.35) % 1) % 1;
          const s = z * z;
          ctx.globalAlpha = 0.15 + 0.85 * s;
          ctx.strokeRect(cx - W * 0.75 * s, cy - H * 0.65 * s, W * 1.5 * s, H * 1.3 * s);
        }
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        for (const [ex, ey] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H], [0, H / 2], [W, H / 2]]) {
          ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
        }
        ctx.stroke();
        break;
      }
      case 'void': {
        gradientBg(c.bg2, c.bg, false);
        ctx.fillStyle = c.line;
        for (let arm = 0; arm < 6; arm++) {
          for (let r = 10; r < 760; r += 9) {
            const a = arm * (TAU / 6) + r * 0.012 + t * 0.35;
            ctx.globalAlpha = 0.85 * (1 - r / 760);
            ctx.fillRect(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 3, 3);
          }
        }
        if (Math.random() < 0.03) {
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = c.accent;
          ctx.fillRect(0, rand(0, H), W, rand(2, 10));
        }
        break;
      }
    }
    ctx.restore();
  }

  // ==================================================================
  // 그리기
  // ==================================================================
  function drawPolygon(x, y, r, sides, rot) {
    ctx.beginPath();
    if (sides === 0) { ctx.arc(x, y, r, 0, TAU); return; }
    if (sides >= 10) {
      // 가시 별 모양
      for (let k = 0; k < sides * 2; k++) {
        const rr = k % 2 ? r * 0.62 : r;
        const a = rot + (k / (sides * 2)) * TAU;
        if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
    } else {
      for (let k = 0; k < sides; k++) {
        const a = rot + (k / sides) * TAU;
        if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
    }
    ctx.closePath();
  }

  function drawBoss(b) {
    const d = b.def;
    ctx.save();
    ctx.globalAlpha = b.alpha;
    const enraged = b.hp <= b.maxHp * rageAt(b);
    const pulse = 1 + Math.sin(b.t * (enraged ? 10 : 4)) * 0.05;
    // 오라
    ctx.fillStyle = d.color;
    ctx.globalAlpha = b.alpha * 0.18;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.7 * pulse, 0, TAU); ctx.fill();
    ctx.globalAlpha = b.alpha;
    // 본체
    drawPolygon(b.x, b.y, b.r * pulse, d.sides, b.t * 0.8);
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : d.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = enraged ? '#fef2f2' : 'rgba(255,255,255,0.7)';
    ctx.stroke();
    // 해파리 촉수
    if (d.name === '심연의 해파리') {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 3;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        const sx = b.x + (k - 2) * 14;
        ctx.moveTo(sx, b.y + b.r * 0.6);
        for (let s = 1; s <= 6; s++) ctx.lineTo(sx + Math.sin(b.t * 4 + k + s) * 6, b.y + b.r * 0.6 + s * 9);
        ctx.stroke();
      }
    }
    // 핵
    drawPolygon(b.x, b.y, b.r * 0.38, d.sides === 0 ? 0 : d.sides, -b.t * 1.6);
    ctx.fillStyle = enraged ? '#fecaca' : '#0b0f1a';
    ctx.fill();
    // 눈
    const toP = Math.atan2(player.y - b.y, player.x - b.x);
    ctx.fillStyle = enraged ? '#e11d48' : '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x + Math.cos(toP) * b.r * 0.15, b.y + Math.sin(toP) * b.r * 0.15, b.r * 0.14, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawHeart(x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s * 0.3);
    ctx.bezierCurveTo(x - s / 2, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s / 2, y + s * 0.6, x + s / 2, y + s * 0.3);
    ctx.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3);
    ctx.fill();
  }

  function drawBanner(text, sub, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, H / 2 - 60, W, 120);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 46px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.fillText(text, W / 2, H / 2 + 4);
    if (sub) {
      ctx.font = '20px "Segoe UI", "Malgun Gothic", sans-serif';
      ctx.fillStyle = '#e8ecf5';
      ctx.fillText(sub, W / 2, H / 2 + 38);
    }
    ctx.restore();
  }

  // 오른쪽 아래: 지금 켜져 있는 아이템 효과와 남은 시간
  function drawBuffs() {
    const list = [];
    if (player.shield) list.push(['🛡', '']);
    if (laserT > 0) list.push(['🔆', laserT]);
    if (drones.length) list.push(['🛸', Math.max(...drones.map(d => d.life))]);
    if (freezeT > 0) list.push(['❄', freezeT]);
    if (slowT > 0) list.push(['⏳', slowT]);
    if (magnetT > 0) list.push(['🧲', magnetT]);
    if (ghostT > 0) list.push(['👻', ghostT]);
    if (miniT > 0) list.push(['🔹', miniT]);
    if (!list.length) return;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    list.forEach(([icon, t], k) => {
      const y = H - 34 - k * 34;
      ctx.fillStyle = 'rgba(15,23,42,0.6)';
      ctx.fillRect(W - 92, y - 15, 80, 30);
      ctx.font = '18px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(icon, W - 62, y + 1);
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.fillStyle = '#e8ecf5';
      ctx.fillText(t === '' ? '1회' : `${t.toFixed(1)}`, W - 18, y + 1);
    });
    ctx.restore();
  }

  function drawHUD() {
    const c = stage.colors;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = c.accent;
    ctx.font = 'bold 19px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.fillText(`STAGE ${stageIdx + 1} · ${stage.name}`, 18, 32);
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillText(Math.floor(score).toLocaleString(), 18, 62);

    for (let k = 0; k < 5; k++) {
      drawHeart(W - 28 - k * 32, 16, 22, k < lives ? '#f43f5e' : 'rgba(148,163,184,0.25)');
    }

    // 진행 바 / 보스 체력
    const bw = W - 36, bx = 18, by = 78;
    if (phase === 'wave' || phase === 'intro') {
      const p = phase === 'intro' ? 0 : clamp(phaseT / stage.waveTime, 0, 1);
      ctx.fillStyle = 'rgba(148,163,184,0.2)';
      ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = c.accent;
      ctx.fillRect(bx, by, bw * p, 8);
      ctx.textAlign = 'center';
      ctx.font = '15px "Segoe UI", "Malgun Gothic", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('보스 출현까지', W / 2, by + 27);
    } else if (phase === 'boss' && boss) {
      ctx.fillStyle = 'rgba(148,163,184,0.2)';
      ctx.fillRect(bx, by, bw, 10);
      ctx.fillStyle = boss.hp <= boss.maxHp * rageAt(boss) ? '#f43f5e' : boss.def.color;
      ctx.fillRect(bx, by, bw * clamp(boss.dispHp / boss.maxHp, 0, 1), 10);
      // 체력 칸 구분선
      ctx.fillStyle = 'rgba(11,15,26,0.7)';
      for (let k = 1; k < boss.maxHp; k++) ctx.fillRect(bx + (bw * k) / boss.maxHp - 1, by, 2, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(bx, by, bw, 10);
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px "Segoe UI", "Malgun Gothic", sans-serif';
      ctx.fillStyle = '#e8ecf5';
      ctx.fillText(`BOSS · ${boss.def.name}  ${boss.hp} / ${boss.maxHp}`, W / 2, by + 31);
    }
    ctx.restore();
  }

  function draw(dt) {
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-1, 1) * shake * 14, rand(-1, 1) * shake * 14);

    drawBackground(stage, animT, state === 'paused' ? 0 : dt);

    // 경고 포탑
    for (const h of hazards) {
      const p = Math.min(1, h.t / h.delay);
      ctx.save();
      ctx.strokeStyle = stage.colors.accent;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(h.t * 12));
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(h.x, h.y, 34 - p * 18, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = stage.colors.accent;
      ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // 보스 공격 아이템
    for (const o of orbs) {
      const it = ITEMS[o.type];
      const fade = o.life - o.t < 2 ? (Math.floor(o.t * 8) % 2 ? 0.35 : 1) : 1;
      const pr = 13 + Math.sin(o.t * 6) * 2;
      ctx.save();
      ctx.globalAlpha = 0.25 * fade;
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.arc(o.x, o.y, pr * 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = fade;
      if (o.type === 'orb') {
        drawPolygon(o.x, o.y, pr, 10, o.t * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(11,15,26,0.85)';
        ctx.beginPath(); ctx.arc(o.x, o.y, pr, 0, TAU); ctx.fill();
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = it.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '15px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillText(it.icon, o.x, o.y + 1);
      }
      ctx.restore();
    }

    if (boss) drawBoss(boss);

    // 조준 돌진 탄의 조준선 (돌진 직전 경고)
    ctx.save();
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 1.5;
    for (const b of bullets) {
      if (b.kind !== 'lock' || b.locked) continue;
      ctx.strokeStyle = `rgba(248,113,113,${0.25 + 0.5 * clamp(b.t / b.lockT, 0, 1)})`;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(player.x, player.y); ctx.stroke();
    }
    ctx.restore();

    // 탄
    for (const b of bullets) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      if (b.kind === 'split') {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 - b.t / b.fuse) + 2, 0, TAU); ctx.stroke();
      }
    }

    // 레이저 빔
    if (laserT > 0 && boss && boss.dying <= 0 && state !== 'over') {
      ctx.save();
      const wob = 1 + Math.sin(animT * 40) * 0.25;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(250,204,21,0.35)';
      ctx.lineWidth = 16 * wob;
      ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(boss.x, boss.y); ctx.stroke();
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(boss.x, boss.y); ctx.stroke();
      ctx.restore();
    }

    // 드론
    for (const dr of drones) {
      if (dr.x === undefined) continue;
      ctx.save();
      ctx.globalAlpha = dr.life < 2 && Math.floor(dr.life * 8) % 2 ? 0.35 : 1;
      ctx.fillStyle = 'rgba(165,180,252,0.3)';
      ctx.beginPath(); ctx.arc(dr.x, dr.y, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a5b4fc';
      drawPolygon(dr.x, dr.y, 7, 3, -dr.ang);
      ctx.fill();
      ctx.restore();
    }

    // 공격 탄
    for (const s of shots) {
      if (s.t < 0) continue;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, TAU); ctx.fill();
    }

    // 플레이어
    if (state !== 'title' && state !== 'over' && !(player.inv > 0 && Math.floor(player.inv * 12) % 2)) {
      ctx.save();
      ctx.fillStyle = '#5eead4';
      ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.arc(player.x, player.y, player.r * 2.2, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(player.x, player.y, 3, 0, TAU); ctx.fill();
      if (player.shield) {
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(animT * 8);
        ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 9, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }

    // 시간 감속 / 빙결 효과
    if (slowT > 0) {
      ctx.fillStyle = `rgba(192,132,252,${Math.min(0.12, slowT * 0.05)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (freezeT > 0) {
      ctx.fillStyle = `rgba(125,211,252,${Math.min(0.16, freezeT * 0.08)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 아이템 획득 문구
    for (const f of floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
      ctx.fillStyle = f.color;
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px "Segoe UI", "Malgun Gothic", sans-serif';
      ctx.fillText(f.text, clamp(f.x, 90, W - 90), f.y - f.t * 30);
      ctx.restore();
    }

    // 파티클
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (state === 'playing' || state === 'paused') {
      drawHUD();
      drawBuffs();
      if (phase === 'intro') {
        const a = phaseT < 0.3 ? phaseT / 0.3 : phaseT > 2.6 ? Math.max(0, (3 - phaseT) / 0.4) : 1;
        if (stage.special) {
          drawBanner(`★ SPECIAL ${stageIdx + 1} ★`, `${stage.name}${stage.final ? ' · 최종 스테이지' : ''}`, stage.colors.accent, a);
        } else {
          drawBanner(`STAGE ${stageIdx + 1}`, stage.name, stage.colors.accent, a);
        }
      } else if (phase === 'warning') {
        drawBanner('⚠ WARNING ⚠', `보스 「${stage.boss.name}」 접근 중`, '#f43f5e', Math.floor(phaseT * 4) % 2 ? 0.55 : 1);
      } else if (phase === 'clear') {
        const secs = Math.round(stageTime);
        const nextTxt = stageIdx < openCount() - 1 ? ` · 곧 STAGE ${stageIdx + 2}` : '';
        drawBanner('STAGE CLEAR!', `${secs}초 · 피격 ${stageHits}회 · +${Math.floor(score - stageScore0).toLocaleString()}점${nextTxt}`, '#fde047', Math.min(1, phaseT * 3));
      } else if (phase === 'boss' && bossHintT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, bossHintT);
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px "Segoe UI", "Malgun Gothic", sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.fillText('★ 아이템을 먹으면 보스를 공격합니다!', W / 2, H - 46);
        ctx.fillText('⚡3연타 💣폭탄 🔆레이저 🛸드론 ❄빙결 👻무적 등 12종', W / 2, H - 22);
        ctx.restore();
      }
    }
  }

  // ---- 루프 ----
  let lastTime = null;
  function frame(t) {
    const dt = Math.min(0.05, (t - (lastTime ?? t)) / 1000);
    lastTime = t;
    update(state === 'paused' ? 0 : dt);
    draw(dt);
    pauseBtn.classList.toggle('hidden', state !== 'playing');
    requestAnimationFrame(frame);
  }

  // ==================================================================
  // UI
  // ==================================================================
  function showPanel(html) {
    panel.innerHTML = html;
    overlay.classList.remove('hidden');
  }
  function hidePanel() { overlay.classList.add('hidden'); }

  function showTitle() {
    state = 'title';
    stageIdx = 0;
    stage = STAGES[0];
    resetField();
    Sound.stopMusic();
    let btns = '';
    STAGES.forEach((s, i) => {
      const n = i + 1;
      const cls = `stage-btn${s.special ? ' special' : ''}`;
      if (!isOpen(s)) {
        // 아직 오지 않은 해의 스페셜 스테이지
        btns += `<button class="${cls} future" disabled title="${s.openYear}년 1월 1일 오픈"><span class="yr">${s.openYear}</span></button>`;
      } else {
        const locked = n > maxStage;
        btns += `<button class="${cls}" data-action="start" data-stage="${n}" ${locked ? 'disabled' : ''} title="${s.name}">${locked ? '🔒' : n}</button>`;
      }
    });
    const nextSpecial = STAGES.find(s => !isOpen(s));
    showPanel(`
      <h1>DODGE<br><span class="h1-sub">VERTEX</span></h1>
      <p>${openCount()}개의 스테이지를 돌파하고 보스를 물리치세요!</p>
      ${nextSpecial ? `<p class="help">★ 스페셜 STAGE ${STAGES.indexOf(nextSpecial) + 1}이(가) ${nextSpecial.openYear}년 1월 1일에 열립니다 (매년 하나씩, ${STAGES.length}단계까지)</p>` : ''}
      <p class="score-line">${bestScore ? `최고 점수 ${bestScore.toLocaleString()}` : ''}</p>
      <button class="primary" data-action="start" data-stage="1">게임 시작</button>
      <div class="stage-select">
        <span>스테이지 선택</span>
        <div class="stage-grid">${btns}</div>
      </div>
      ${menuRow()}
      <p class="help">${isTouch
        ? '화면 아무 곳이나 손가락으로 드래그해 이동 · ⏸ 버튼으로 일시정지'
        : '이동: 방향키 / WASD / 마우스 · 일시정지: P · 소리: M'}<br>보스전에서는 아이템(★⚡💣🔆🛸 등 12종)을 먹어 보스를 공격하세요.</p>`);
  }

  // ---- 메뉴 공통 버튼 (소리 / 앱 설치 / 전체화면) ----
  function soundLabel() { return Sound.isMuted() ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'; }
  function menuRow() {
    const items = [`<button class="tool sound-btn" data-action="sound">${soundLabel()}</button>`];
    const canInstall = window.PWA && window.PWA.available;
    items.push(`<button class="tool install-btn ${canInstall ? '' : 'hidden'}" data-action="install">📲 앱 설치</button>`);
    if (document.fullscreenEnabled && !isStandalone()) items.push(`<button class="tool" data-action="fullscreen">⛶ 전체화면</button>`);
    return `<div class="btn-row menu-row">${items.join('')}</div>`;
  }

  function lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {});
    } catch (e) { /* 지원하지 않는 브라우저 */ }
  }
  function enterFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) { lockLandscape(); return; }
    el.requestFullscreen({ navigationUI: 'hide' }).then(lockLandscape).catch(() => {});
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    Sound.stopMusic();
    Sound.sfx('pause');
    showPanel(`
      <h1>PAUSED</h1>
      <p>STAGE ${stageIdx + 1} · ${stage.name}</p>
      <div class="btn-row">
        <button class="primary" data-action="resume">계속하기</button>
        <button data-action="title">타이틀</button>
      </div>
      ${menuRow()}`);
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    hidePanel();
    Sound.sfx('resume');
    if (phase !== 'warning' && phase !== 'clear') Sound.startMusic();
  }

  panel.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    btn.blur();
    const a = btn.dataset.action;
    if (a === 'start') {
      // 휴대폰에서는 게임 시작 시 전체화면 + 세로 고정
      if (isTouch) { if (isStandalone()) lockLandscape(); else enterFullscreen(); }
      startGame(Number(btn.dataset.stage) || 1);
    }
    else if (a === 'continue') {
      if (isTouch) { if (isStandalone()) lockLandscape(); else enterFullscreen(); }
      continueAfterAd();
    }
    else if (a === 'share') shareScore(btn);
    else if (a === 'resume') resume();
    else if (a === 'title') showTitle();
    else if (a === 'sound') toggleSound();
    else if (a === 'install' && window.PWA) window.PWA.install();
    else if (a === 'fullscreen') toggleFullscreen();
  });

  function toggleSound() {
    Sound.toggleMute();
    document.querySelectorAll('.sound-btn').forEach(b => { b.textContent = soundLabel(); });
  }

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === 'KeyP' || e.code === 'Escape') { if (state === 'playing') pause(); else if (state === 'paused') resume(); }
    if (e.code === 'KeyM') toggleSound();
    if ((e.code === 'Enter' || e.code === 'Space') && !overlay.classList.contains('hidden')) {
      const primary = panel.querySelector('button.primary');
      if (primary) primary.click();
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  function autoPause() {
    keys.clear();
    pointer.active = false;
    if (window.DodgeDebug && window.DodgeDebug.noAutoPause) return;
    pause();
  }
  window.addEventListener('blur', autoPause);
  // 휴대폰에서 다른 앱으로 전환하거나 화면이 꺼지면 자동 일시정지
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

  // 마우스: 누른 곳으로 이동. 터치: 손가락을 움직인 만큼 상대 이동(손가락이 캐릭터를 가리지 않음)
  let touchStart = null;
  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
  }
  function toCanvas(e) {
    const p = canvasPos(e);
    if (touchStart) {
      pointer.x = clamp(touchStart.px + (p.x - touchStart.x) * 1.3, 0, W);
      pointer.y = clamp(touchStart.py + (p.y - touchStart.y) * 1.3, 0, H);
    } else {
      pointer.x = p.x;
      pointer.y = p.y;
    }
  }
  canvas.addEventListener('pointerdown', e => {
    pointer.active = true;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      const p = canvasPos(e);
      touchStart = { x: p.x, y: p.y, px: player.x, py: player.y };
    } else touchStart = null;
    toCanvas(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => { if (pointer.active) toCanvas(e); });
  canvas.addEventListener('pointerup', () => { pointer.active = false; });
  canvas.addEventListener('pointercancel', () => { pointer.active = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // 화면 일시정지 버튼 (터치용)
  pauseBtn.addEventListener('click', () => { pauseBtn.blur(); pause(); });

  // ---- 화면 크기 맞추기: 화면 비율에 맞춰 게임 세계 너비와 해상도를 조절 ----
  function fitCanvas() {
    const stageEl = canvas.parentElement;
    const cw = stageEl.clientWidth, ch = stageEl.clientHeight;
    if (!cw || !ch) return;
    const aspect = clamp(ch / cw, 4 / 3, MAXH / W);
    H = Math.round(W * aspect);
    let cssW, cssH;
    if (ch / cw > aspect) { cssW = cw; cssH = cw * aspect; } else { cssH = ch; cssW = ch / aspect; }
    canvas.style.width = `${Math.floor(cssW)}px`;
    canvas.style.height = `${Math.floor(cssH)}px`;
    const dpr = window.devicePixelRatio || 1;
    RES = clamp((cssW * dpr) / W, 1, 2);
    canvas.width = Math.round(W * RES);
    canvas.height = Math.round(H * RES);
    if (player) player.y = clamp(player.y, player.r, H - player.r);
    // 휴대폰을 가로로 돌리면 자동 일시정지 (세로 안내 화면이 뜸)
    if (isTouch && window.innerWidth > window.innerHeight) autoPause();
  }
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 200));
  document.addEventListener('fullscreenchange', () => setTimeout(fitCanvas, 100));
  fitCanvas();

  // 테스트/디버그용: 주소 뒤에 ?debug 를 붙였을 때만 켜짐 (예: http://localhost:8765/?debug)
  if (new URLSearchParams(location.search).has('debug')) window.DodgeDebug = {
    god: false,
    noAutoPause: false,
    stage(n) { startGame(n); },
    skipIntro() { if (phase === 'intro') phaseT = 99; },
    hitBoss(n = 1) { for (let k = 0; k < n && boss; k++) damageBoss(); },
    item(type) { orbs.push({ x: player.x, y: player.y, t: 0, life: 9, type }); },
    boss() { if (state === 'playing') phaseT = stage.waveTime; },
    info() { return { year: currentYear(), open: openCount(), state, phase, stage: stageIdx + 1, lives, score: Math.floor(score), bullets: bullets.length, bossHp: boss && boss.hp }; },
    pattern(name) { if (boss) { boss.pattern = name; boss.rest = 0; boss.patT = 0; boss.cd = 0; } },
    rage() { if (boss) boss.hp = Math.floor(boss.maxHp / 2); },
    effects() { return { freezeT, magnetT, miniT, ghostT, laserT, drones: drones.length, playerR: player.r, inv: player.inv, shield: player.shield }; },
    sim(sec) { for (let k = 0; k < sec * 60; k++) update(1 / 60); return this.info(); },
    die() { if (state === 'playing') { player.inv = 0; player.shield = false; ghostT = 0; lives = 1; hurt(); } },
    kinds() { const c = {}; bullets.forEach(b => { c[b.kind] = (c[b.kind] || 0) + 1; }); return c; },
  };

  showTitle();
  requestAnimationFrame(frame);
})();
