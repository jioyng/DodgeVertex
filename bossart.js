// 보스 외형: stages.js 의 boss.look 이름별로 모양을 그립니다.
// BossArt.draw(ctx, b, o)
//   b: 보스 (x, y, r, t, def)   o: { col 본체 색(피격 시 흰색), en 분노 여부, aim 플레이어 방향(rad), pulse }
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

  // ---- 공통 도구 ----
  function poly(c, x, y, r, n, rot) {
    c.beginPath();
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * TAU;
      k ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  function star(c, x, y, r, r2, n, rot) {
    c.beginPath();
    for (let k = 0; k < n * 2; k++) {
      const rr = k % 2 ? r2 : r;
      const a = rot + (k / (n * 2)) * TAU;
      k ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function fillC(c, x, y, r, col) { circle(c, x, y, r); c.fillStyle = col; c.fill(); }
  function outline(c, o, w = 3) { c.lineWidth = w; c.strokeStyle = o.en ? '#fef2f2' : 'rgba(255,255,255,0.7)'; c.stroke(); }
  function shade(c, a) { c.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`; c.fill(); }
  // 플레이어를 쳐다보는 눈
  function eye(c, x, y, r, o, iris = '#0b0f1a') {
    fillC(c, x, y, r, '#ffffff');
    const ox = Math.cos(o.aim) * r * 0.4, oy = Math.sin(o.aim) * r * 0.4;
    fillC(c, x + ox, y + oy, r * 0.55, o.en ? '#e11d48' : iris);
    fillC(c, x + ox - r * 0.15, y + oy - r * 0.15, r * 0.15, 'rgba(255,255,255,0.8)');
  }
  // 가늘게 뜬 성난 눈 (위쪽을 사선으로 자름)
  function angryEye(c, x, y, r, o, flip) {
    c.save();
    c.beginPath();
    c.moveTo(x - r * 1.3, y - r * (flip ? 0.9 : 0.1));
    c.lineTo(x + r * 1.3, y - r * (flip ? 0.1 : 0.9));
    c.lineTo(x + r * 1.3, y + r * 1.4);
    c.lineTo(x - r * 1.3, y + r * 1.4);
    c.closePath();
    c.clip();
    eye(c, x, y, r, o);
    c.restore();
  }
  function slitVisor(c, x, y, w, h, o, t) {
    c.fillStyle = '#05070d';
    c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, h / 2); c.fill();
    const px = x + Math.cos(o.aim) * w * 0.32;
    c.fillStyle = o.en ? '#ff1744' : '#f87171';
    c.shadowColor = c.fillStyle; c.shadowBlur = 12;
    c.beginPath(); c.roundRect(px - h * 0.9, y - h * 0.3, h * 1.8, h * 0.6, h * 0.3); c.fill();
    c.shadowBlur = 0;
  }

  const LOOKS = {
    // 1 큐브 가디언: 회전하는 입체 큐브 + 바이저
    cube(c, b, o) {
      const { x, y, r, t } = b;
      const R = r * 1.05, rot = t * 0.6;
      const P = k => [x + Math.cos(rot + k * TAU / 6 - Math.PI / 2) * R, y + Math.sin(rot + k * TAU / 6 - Math.PI / 2) * R];
      const faces = [[0, 1, 2], [2, 3, 4], [4, 5, 0]];
      faces.forEach((f, i) => {
        c.beginPath(); c.moveTo(x, y);
        f.forEach(k => c.lineTo(...P(k)));
        c.closePath();
        c.fillStyle = o.col; c.fill();
        shade(c, [0.25, -0.15, -0.35][i]);
        outline(c, o, 2);
      });
      slitVisor(c, x, y + r * 0.05, r * 1.0, r * 0.22, o, t);
    },

    // 2 별의 직조자: 별 + 궤도를 도는 작은 별과 실
    star(c, b, o) {
      const { x, y, r, t } = b;
      c.strokeStyle = 'rgba(253,224,71,0.45)'; c.lineWidth = 1.5;
      const pts = [0, 1, 2].map(k => [x + Math.cos(t * 1.2 + k * TAU / 3) * r * 1.6, y + Math.sin(t * 1.2 + k * TAU / 3) * r * 1.6]);
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p))); c.closePath(); c.stroke();
      pts.forEach(p => { star(c, p[0], p[1], 9, 4, 5, t * 3); c.fillStyle = '#fef08a'; c.fill(); });
      star(c, x, y, r * 1.1, r * 0.48, 5, t * 0.5 - Math.PI / 2);
      c.fillStyle = o.col; c.fill(); outline(c, o);
      eye(c, x, y, r * 0.28, o);
    },

    // 3 심연의 해파리: 반투명 갓 + 긴 촉수
    jelly(c, b, o) {
      const { x, y, r, t } = b;
      c.strokeStyle = o.col; c.lineWidth = 3; c.globalAlpha *= 0.85;
      for (let k = 0; k < 7; k++) {
        const sx = x + (k - 3) * r * 0.27;
        c.beginPath(); c.moveTo(sx, y + r * 0.35);
        for (let s = 1; s <= 9; s++) c.lineTo(sx + Math.sin(t * 3 + k + s * 0.7) * (4 + s), y + r * 0.35 + s * r * 0.17);
        c.stroke();
      }
      c.beginPath();
      c.arc(x, y, r, Math.PI, 0);
      for (let k = 0; k <= 8; k++) c.lineTo(x + r - (k / 8) * 2 * r, y + r * 0.35 + Math.sin(t * 5 + k) * 4 * (k % 2 ? 1 : -1));
      c.closePath();
      c.fillStyle = o.col; c.fill(); shade(c, 0.12); outline(c, o, 2);
      for (let k = 0; k < 5; k++) fillC(c, x + Math.cos(k * 1.3) * r * 0.55, y - r * 0.35 + Math.sin(k * 2.1) * r * 0.2, 3 + (k % 2) * 2, 'rgba(255,255,255,0.55)');
      c.globalAlpha /= 0.85;
      eye(c, x - r * 0.3, y, r * 0.16, o); eye(c, x + r * 0.3, y, r * 0.16, o);
    },

    // 4 스톰 아이: 소용돌이 팔 + 가운데 큰 눈
    storm(c, b, o) {
      const { x, y, r, t } = b;
      for (let arm = 0; arm < 3; arm++) {
        for (let s = 0; s < 14; s++) {
          const a = t * 2 + arm * TAU / 3 + s * 0.32, d = r * 0.4 + s * r * 0.08;
          fillC(c, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(2, 9 - s * 0.5), o.col);
        }
      }
      circle(c, x, y, r * 0.62); c.fillStyle = '#1e1b3a'; c.fill(); outline(c, o);
      eye(c, x, y, r * 0.42, o, '#7c3aed');
    },

    // 5 펄스 하트: 쿵쿵 뛰는 심장 + 혈관
    heart(c, b, o) {
      const { x, y, r, t } = b;
      const beat = 1 + Math.pow(Math.max(0, Math.sin(t * (o.en ? 9 : 5))), 8) * 0.18;
      const s = r * 1.25 * beat;
      c.beginPath();
      c.moveTo(x, y + s * 0.85);
      c.bezierCurveTo(x - s * 1.2, y + s * 0.1, x - s * 0.9, y - s * 0.85, x, y - s * 0.35);
      c.bezierCurveTo(x + s * 0.9, y - s * 0.85, x + s * 1.2, y + s * 0.1, x, y + s * 0.85);
      c.closePath();
      c.fillStyle = o.col; c.fill(); outline(c, o);
      c.strokeStyle = 'rgba(80,0,20,0.55)'; c.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        c.beginPath(); c.moveTo(x + (k - 1.5) * s * 0.25, y - s * 0.3);
        c.quadraticCurveTo(x + (k - 1.5) * s * 0.45, y + s * 0.1, x + (k - 1.5) * s * 0.2, y + s * 0.5); c.stroke();
      }
      fillC(c, x - s * 0.35, y - s * 0.75, s * 0.13, o.col); fillC(c, x + s * 0.1, y - s * 0.8, s * 0.11, o.col); // 대동맥
      eye(c, x, y - s * 0.05, r * 0.22, o);
    },

    // 6 파이어월: 벽돌 팔각형 + 위쪽 불꽃 + 바이저
    firewall(c, b, o) {
      const { x, y, r, t } = b;
      for (let k = 0; k < 7; k++) {
        const fx = x + (k - 3) * r * 0.26, h = r * (0.5 + 0.35 * Math.abs(Math.sin(t * 6 + k * 1.7)));
        c.beginPath(); c.moveTo(fx - r * 0.15, y - r * 0.7); c.quadraticCurveTo(fx, y - r * 0.7 - h * 1.4, fx + r * 0.15, y - r * 0.7);
        c.fillStyle = k % 2 ? '#fb923c' : '#facc15'; c.fill();
      }
      poly(c, x, y, r, 8, Math.PI / 8);
      c.fillStyle = o.col; c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
      for (let row = -3; row <= 3; row++) {
        const yy = y + row * r * 0.28;
        c.beginPath(); c.moveTo(x - r, yy); c.lineTo(x + r, yy); c.stroke();
        for (let col = -3; col <= 3; col++) {
          const xx = x + col * r * 0.4 + (row % 2 ? r * 0.2 : 0);
          c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + r * 0.28); c.stroke();
        }
      }
      c.restore();
      poly(c, x, y, r, 8, Math.PI / 8); outline(c, o);
      slitVisor(c, x, y, r * 1.2, r * 0.24, o, t);
    },

    // 7 마그마 타이탄: 울퉁불퉁한 바위 몸 + 용암 균열 + 주먹
    golem(c, b, o) {
      const { x, y, r, t } = b;
      [-1, 1].forEach(s => {
        const fy = y + r * 0.3 + Math.sin(t * 3 + s) * r * 0.2;
        poly(c, x + s * r * 1.35, fy, r * 0.42, 6, t * 0.3 * s);
        c.fillStyle = o.col; c.fill(); shade(c, -0.25); outline(c, o, 2);
      });
      c.beginPath();
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * TAU, rr = r * (0.85 + hash(k) * 0.3);
        k ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      c.closePath(); c.fillStyle = o.col; c.fill(); shade(c, -0.3); outline(c, o);
      c.strokeStyle = o.en ? '#fde047' : '#fb923c'; c.lineWidth = 3; c.shadowColor = '#f97316'; c.shadowBlur = 10;
      for (let k = 0; k < 5; k++) {
        const a = hash(k + 20) * TAU;
        c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
        c.lineTo(x + Math.cos(a + 0.3) * r * 0.55, y + Math.sin(a + 0.3) * r * 0.55);
        c.lineTo(x + Math.cos(a - 0.1) * r * 0.85, y + Math.sin(a - 0.1) * r * 0.85); c.stroke();
      }
      c.shadowBlur = 0;
      [-1, 1].forEach(s => { fillC(c, x + s * r * 0.32, y - r * 0.25, r * 0.13, '#fde047'); });
    },

    // 8 프리즘: 결정 삼각형 + 무지개 빛줄기
    prism(c, b, o) {
      const { x, y, r, t } = b;
      ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'].forEach((col, k) => {
        const a = t * 0.7 + k * TAU / 5;
        c.strokeStyle = col; c.globalAlpha *= 0.6; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 2.1, y + Math.sin(a) * r * 2.1); c.stroke();
        c.globalAlpha /= 0.6;
      });
      const rot = -Math.PI / 2 + Math.sin(t) * 0.3;
      poly(c, x, y, r * 1.15, 3, rot); c.fillStyle = o.col; c.fill(); shade(c, 0.15); outline(c, o);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) { const a = rot + k * TAU / 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15); c.stroke(); }
      eye(c, x, y + r * 0.05, r * 0.22, o);
    },

    // 9, 22 뱀: 꼬리를 흔드는 마디 몸 + 송곳니 머리 (spark: 번개 불꽃)
    serpent(c, b, o) {
      const { x, y, r, t } = b;
      for (let k = 9; k >= 1; k--) {
        const sx = x - Math.sin(t * 1.2 - k * 0.5) * r * 0.9 * (k / 4), sy = y - k * r * 0.32;
        fillC(c, sx, sy, r * (0.62 - k * 0.045), o.col);
        circle(c, sx, sy, r * (0.62 - k * 0.045)); shade(c, k % 2 ? -0.18 : 0.05);
        if (b.def.spark && hash(k + Math.floor(t * 8)) > 0.7) {
          c.strokeStyle = '#fef08a'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy);
          c.lineTo(sx + (hash(k) - 0.5) * 40, sy + (hash(k + 3) - 0.5) * 40); c.stroke();
        }
      }
      c.beginPath(); c.ellipse(x, y, r * 0.95, r * 0.75, 0, 0, TAU); c.fillStyle = o.col; c.fill(); outline(c, o);
      c.fillStyle = '#ffffff';
      [-1, 1].forEach(s => { c.beginPath(); c.moveTo(x + s * r * 0.35, y + r * 0.5); c.lineTo(x + s * r * 0.22, y + r * 0.95); c.lineTo(x + s * r * 0.1, y + r * 0.55); c.fill(); });
      angryEye(c, x - r * 0.38, y - r * 0.08, r * 0.2, o, false);
      angryEye(c, x + r * 0.38, y - r * 0.08, r * 0.2, o, true);
    },

    // 11 네온 드래곤: 펄럭이는 날개 + 뿔 달린 머리
    dragon(c, b, o) {
      const { x, y, r, t } = b;
      const flap = Math.sin(t * 4) * 0.35;
      [-1, 1].forEach(s => {
        c.beginPath(); c.moveTo(x + s * r * 0.4, y - r * 0.1);
        for (let k = 0; k <= 3; k++) {
          const a = -0.9 + flap + k * 0.45;
          c.lineTo(x + s * Math.cos(a) * r * 2.1, y + Math.sin(a) * r * 1.5 - r * 0.3);
          c.lineTo(x + s * Math.cos(a + 0.22) * r * 1.3, y + Math.sin(a + 0.22) * r * 1.0 - r * 0.1);
        }
        c.closePath(); c.fillStyle = o.col; c.globalAlpha *= 0.7; c.fill(); c.globalAlpha /= 0.7; outline(c, o, 2);
      });
      [-1, 1].forEach(s => { c.beginPath(); c.moveTo(x + s * r * 0.3, y - r * 0.55); c.quadraticCurveTo(x + s * r * 0.9, y - r * 1.2, x + s * r * 0.55, y - r * 1.4); c.lineTo(x + s * r * 0.5, y - r * 0.5); c.fillStyle = '#fdf4ff'; c.fill(); });
      c.beginPath(); c.ellipse(x, y, r * 0.75, r * 0.85, 0, 0, TAU); c.fillStyle = o.col; c.fill(); outline(c, o);
      c.beginPath(); c.ellipse(x, y + r * 0.45, r * 0.4, r * 0.25, 0, 0, TAU); shade(c, -0.35);
      angryEye(c, x - r * 0.3, y - r * 0.15, r * 0.17, o, false);
      angryEye(c, x + r * 0.3, y - r * 0.15, r * 0.17, o, true);
    },

    // 12 코드 센티넬: 로봇 머리 + 안테나 + 스캐너
    sentinel(c, b, o) {
      const { x, y, r, t } = b;
      c.strokeStyle = o.col; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, y - r); c.lineTo(x, y - r * 1.5); c.stroke();
      fillC(c, x, y - r * 1.55, 6, Math.floor(t * 3) % 2 ? '#ef4444' : '#fef08a');
      [-1, 1].forEach(s => { c.beginPath(); c.roundRect(x + s * r * 1.05 - r * 0.15, y - r * 0.4, r * 0.3, r * 0.8, 4); c.fillStyle = o.col; c.fill(); shade(c, -0.3); });
      c.beginPath(); c.roundRect(x - r, y - r, r * 2, r * 2, r * 0.3); c.fillStyle = o.col; c.fill(); outline(c, o);
      c.fillStyle = '#05070d'; c.beginPath(); c.roundRect(x - r * 0.8, y - r * 0.3, r * 1.6, r * 0.42, 6); c.fill();
      const sx = x + Math.sin(t * 3) * r * 0.65;
      c.fillStyle = o.en ? '#ff1744' : '#4ade80'; c.shadowColor = c.fillStyle; c.shadowBlur = 14;
      c.fillRect(sx - 6, y - r * 0.24, 12, r * 0.3); c.shadowBlur = 0;
      c.fillStyle = 'rgba(0,0,0,0.35)';
      for (let k = 0; k < 5; k++) c.fillRect(x - r * 0.5 + k * r * 0.25, y + r * 0.45, r * 0.12, r * 0.3);
    },

    // 13 블랙홀: 강착 원반 + 검은 중심
    blackhole(c, b, o) {
      const { x, y, r, t } = b;
      for (let k = 0; k < 4; k++) {
        c.beginPath(); c.ellipse(x, y, r * (1.9 - k * 0.25), r * (0.55 - k * 0.08), -0.35, 0, TAU);
        c.strokeStyle = ['#7c3aed', '#c084fc', '#f0abfc', '#fde68a'][k]; c.lineWidth = 5 - k; c.setLineDash([18, 10]); c.lineDashOffset = -t * (60 + k * 30); c.stroke();
      }
      c.setLineDash([]);
      circle(c, x, y, r * 0.85); c.fillStyle = '#000000'; c.fill();
      c.lineWidth = 3; c.strokeStyle = o.col === '#ffffff' ? '#ffffff' : '#e9d5ff'; c.shadowColor = '#c084fc'; c.shadowBlur = 18; c.stroke(); c.shadowBlur = 0;
      c.beginPath(); c.ellipse(x, y, r * 1.9, r * 0.55, -0.35, Math.PI * 1.05, Math.PI * 1.95); c.strokeStyle = '#fde68a'; c.lineWidth = 3; c.stroke();
      if (o.en) { fillC(c, x + Math.cos(o.aim) * r * 0.3, y + Math.sin(o.aim) * r * 0.3, r * 0.12, '#e11d48'); }
    },

    // 14 서리 거인: 육각형 + 눈송이 가시 + 고드름
    ice(c, b, o) {
      const { x, y, r, t } = b;
      c.strokeStyle = '#e0f2fe'; c.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const a = t * 0.3 + k * TAU / 6, ex = x + Math.cos(a) * r * 1.6, ey = y + Math.sin(a) * r * 1.6;
        c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
        const mx = x + Math.cos(a) * r * 1.25, my = y + Math.sin(a) * r * 1.25;
        [-0.6, 0.6].forEach(s => { c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(a + s) * r * 0.3, my + Math.sin(a + s) * r * 0.3); c.stroke(); });
      }
      poly(c, x, y, r, 6, Math.PI / 6); c.fillStyle = o.col; c.fill(); shade(c, 0.2); outline(c, o);
      c.fillStyle = '#e0f2fe';
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + k * r * 0.25 - 6, y + r * 0.8); c.lineTo(x + k * r * 0.25, y + r * (1.15 + hash(k + 9) * 0.3)); c.lineTo(x + k * r * 0.25 + 6, y + r * 0.8); c.fill(); }
      angryEye(c, x - r * 0.32, y - r * 0.05, r * 0.18, o, false);
      angryEye(c, x + r * 0.32, y - r * 0.05, r * 0.18, o, true);
    },

    // 15, 24 불사조: 불꽃 날개 + 불꽃 꼬리
    phoenix(c, b, o) {
      const { x, y, r, t } = b;
      const fire = b.def.wing || ['#f97316', '#facc15', '#fef3c7'];
      const flap = Math.sin(t * 5) * 0.3;
      for (let k = 0; k < 4; k++) {
        c.beginPath(); c.moveTo(x - r * 0.25 + (k - 1.5) * 8, y + r * 0.5);
        c.quadraticCurveTo(x + Math.sin(t * 6 + k) * 18, y + r * (1.4 + k * 0.15), x + (k - 1.5) * 10, y + r * (1.9 + (k % 2) * 0.3));
        c.strokeStyle = fire[k % 3]; c.lineWidth = 5 - k; c.stroke();
      }
      [-1, 1].forEach(s => {
        for (let f = 0; f < 3; f++) {
          c.beginPath(); c.moveTo(x + s * r * 0.3, y);
          const a = -0.5 + flap * s * 0 + flap + f * 0.35;
          c.quadraticCurveTo(x + s * r * 1.2, y - r * (1.0 - f * 0.4) - Math.sin(t * 5) * r * 0.3, x + s * Math.cos(a) * r * (2.2 - f * 0.4), y + Math.sin(a) * r * 1.2);
          c.quadraticCurveTo(x + s * r * 0.9, y + r * 0.2, x + s * r * 0.3, y + r * 0.2);
          c.fillStyle = fire[f]; c.globalAlpha *= 0.85; c.fill(); c.globalAlpha /= 0.85;
        }
      });
      c.beginPath(); c.moveTo(x, y - r * 0.95); c.quadraticCurveTo(x + r * 0.8, y, x, y + r * 0.75); c.quadraticCurveTo(x - r * 0.8, y, x, y - r * 0.95);
      c.fillStyle = o.col; c.fill(); outline(c, o, 2);
      c.beginPath(); c.moveTo(x - 5, y - r * 0.2); c.lineTo(x, y + r * 0.05); c.lineTo(x + 5, y - r * 0.2); c.fillStyle = '#fde047'; c.fill();
      angryEye(c, x - r * 0.22, y - r * 0.38, r * 0.13, o, false);
      angryEye(c, x + r * 0.22, y - r * 0.38, r * 0.13, o, true);
    },

    // 16 크로노스: 시계 + 톱니 + 진자
    clock(c, b, o) {
      const { x, y, r, t } = b;
      const pa = Math.sin(t * 2.5) * 0.5;
      c.strokeStyle = o.col; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, y + r * 0.8); c.lineTo(x + Math.sin(pa) * r * 1.4, y + r * 0.8 + Math.cos(pa) * r * 1.0); c.stroke();
      fillC(c, x + Math.sin(pa) * r * 1.4, y + r * 0.8 + Math.cos(pa) * r * 1.0, r * 0.2, o.col);
      star(c, x, y, r * 1.18, r * 0.98, 16, t * 0.5); c.fillStyle = o.col; c.fill(); shade(c, -0.25);
      circle(c, x, y, r * 0.95); c.fillStyle = '#e0f2fe'; c.fill(); outline(c, o);
      c.strokeStyle = '#0b0f1a';
      for (let k = 0; k < 12; k++) {
        const a = k * TAU / 12, l = k % 3 ? 0.1 : 0.2;
        c.lineWidth = k % 3 ? 2 : 4; c.beginPath();
        c.moveTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85); c.lineTo(x + Math.cos(a) * r * (0.85 - l), y + Math.sin(a) * r * (0.85 - l)); c.stroke();
      }
      const hand = (a, l, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); };
      hand(t * 0.6 * (o.en ? 3 : 1), r * 0.45, 5, '#0b0f1a');
      hand(t * 4 * (o.en ? 3 : 1), r * 0.72, 3, o.en ? '#e11d48' : '#0369a1');
      fillC(c, x, y, 5, '#0b0f1a');
    },

    // 17 썬더 버드: 번개 모양 날개 + 부리
    bird(c, b, o) {
      const { x, y, r, t } = b;
      const flap = Math.sin(t * 6) * r * 0.5;
      [-1, 1].forEach(s => {
        c.beginPath(); c.moveTo(x + s * r * 0.3, y - r * 0.2);
        c.lineTo(x + s * r * 1.0, y - r * 0.6 - flap); c.lineTo(x + s * r * 0.95, y - r * 0.15 - flap * 0.6);
        c.lineTo(x + s * r * 1.7, y - r * 0.5 - flap * 1.2); c.lineTo(x + s * r * 1.35, y + r * 0.1 - flap * 0.5);
        c.lineTo(x + s * r * 2.1, y + r * 0.05 - flap * 1.3); c.lineTo(x + s * r * 0.4, y + r * 0.45);
        c.closePath(); c.fillStyle = o.col; c.fill(); outline(c, o, 2);
      });
      poly(c, x, y, r * 0.8, 3, Math.PI / 2); c.fillStyle = o.col; c.fill(); shade(c, -0.15); outline(c, o);
      c.beginPath(); c.moveTo(x - r * 0.2, y + r * 0.15); c.lineTo(x, y + r * 0.6); c.lineTo(x + r * 0.2, y + r * 0.15); c.fillStyle = '#fb923c'; c.fill();
      angryEye(c, x - r * 0.25, y - r * 0.15, r * 0.14, o, false);
      angryEye(c, x + r * 0.25, y - r * 0.15, r * 0.14, o, true);
      if (Math.floor(t * 5) % 4 === 0) {
        c.strokeStyle = '#fef08a'; c.lineWidth = 3; c.beginPath();
        let lx = x + (hash(Math.floor(t * 5)) - 0.5) * r * 3, ly = y - r * 1.4; c.moveTo(lx, ly);
        for (let k = 0; k < 4; k++) { lx += (k % 2 ? -1 : 1) * 12; ly += r * 0.3; c.lineTo(lx, ly); }
        c.stroke();
      }
    },

    // 18 게이트 키퍼: 룬이 새겨진 고리 + 소용돌이 + 열리는 눈
    gate(c, b, o) {
      const { x, y, r, t } = b;
      circle(c, x, y, r * 1.1); c.fillStyle = o.col; c.fill(); outline(c, o);
      circle(c, x, y, r * 0.78); c.fillStyle = '#020617'; c.fill();
      c.fillStyle = '#e0e7ff'; c.font = `bold ${Math.round(r * 0.22)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾ';
      for (let k = 0; k < 10; k++) { const a = t * 0.5 + k * TAU / 10; c.fillText(runes[k], x + Math.cos(a) * r * 0.94, y + Math.sin(a) * r * 0.94); }
      c.strokeStyle = 'rgba(96,165,250,0.7)'; c.lineWidth = 2;
      for (let k = 0; k < 3; k++) { c.beginPath(); for (let s = 0; s < 30; s++) { const a = -t * 2 + k * TAU / 3 + s * 0.18, d = r * 0.75 * (1 - s / 30); s ? c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.stroke(); }
      const open = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.8));
      c.save(); c.beginPath(); c.ellipse(x, y, r * 0.45, r * 0.45 * open, 0, 0, TAU); c.clip();
      eye(c, x, y, r * 0.42, o, '#1d4ed8'); c.restore();
    },

    // 19 초신성: 일렁이는 코로나 + 성난 태양
    sun(c, b, o) {
      const { x, y, r, t } = b;
      for (let k = 0; k < 18; k++) {
        const a = t * 0.4 + k * TAU / 18, l = r * (1.35 + 0.3 * Math.sin(t * 4 + k * 1.7));
        c.beginPath(); c.moveTo(x + Math.cos(a - 0.12) * r * 0.9, y + Math.sin(a - 0.12) * r * 0.9);
        c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.lineTo(x + Math.cos(a + 0.12) * r * 0.9, y + Math.sin(a + 0.12) * r * 0.9);
        c.fillStyle = k % 2 ? '#fde047' : '#fb923c'; c.fill();
      }
      const g = c.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, '#fffbeb'); g.addColorStop(1, o.col);
      circle(c, x, y, r); c.fillStyle = g; c.fill(); outline(c, o);
      angryEye(c, x - r * 0.35, y - r * 0.1, r * 0.18, o, false);
      angryEye(c, x + r * 0.35, y - r * 0.1, r * 0.18, o, true);
      c.beginPath(); c.arc(x, y + r * 0.45, r * 0.25, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = '#7c2d12'; c.lineWidth = 3; c.stroke();
    },

    // 10, 20 군주: 왕관 + 어두운 구체 + 여러 개의 눈 + 주위를 도는 파편
    crown(c, b, o) {
      const { x, y, r, t } = b;
      const many = b.def.eyes || 1;
      for (let k = 0; k < 6; k++) {
        const a = t * 1.1 + k * TAU / 6;
        poly(c, x + Math.cos(a) * r * 1.55, y + Math.sin(a) * r * 1.55, r * 0.17, 3, a * 2);
        c.fillStyle = o.col; c.fill();
      }
      c.beginPath(); c.moveTo(x - r * 0.75, y - r * 0.6);
      for (let k = 0; k <= 4; k++) { c.lineTo(x - r * 0.75 + k * r * 0.375, y - r * (k % 2 ? 0.95 : 1.45)); }
      c.lineTo(x + r * 0.75, y - r * 0.6); c.closePath(); c.fillStyle = '#fbbf24'; c.fill(); outline(c, o, 2);
      circle(c, x, y, r); c.fillStyle = '#0b0610'; c.fill(); c.lineWidth = 4; c.strokeStyle = o.col; c.stroke();
      if (many === 1) eye(c, x, y + r * 0.05, r * 0.35, o, '#be123c');
      else {
        eye(c, x, y - r * 0.2, r * 0.28, o, '#be123c');
        eye(c, x - r * 0.45, y + r * 0.3, r * 0.2, o, '#be123c');
        eye(c, x + r * 0.45, y + r * 0.3, r * 0.2, o, '#be123c');
      }
    },

    // 21 크라켄: 둥근 머리 + 빨판 달린 촉수
    kraken(c, b, o) {
      const { x, y, r, t } = b;
      for (let k = 0; k < 8; k++) {
        const base = (k - 3.5) * 0.32;
        let px = x + Math.sin(base) * r * 0.7, py = y + r * 0.4;
        c.beginPath(); c.moveTo(px, py);
        const pts = [];
        for (let s = 1; s <= 10; s++) {
          const a = Math.PI / 2 + base * 1.8 + Math.sin(t * 2 + k + s * 0.5) * 0.5;
          px += Math.cos(a) * r * 0.16; py += Math.sin(a) * r * 0.16; c.lineTo(px, py); pts.push([px, py]);
        }
        c.strokeStyle = o.col; c.lineWidth = 9; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
        pts.forEach((p, i) => { if (i % 2 === 0) fillC(c, p[0], p[1], 2, '#fecdd3'); });
      }
      c.beginPath(); c.ellipse(x, y - r * 0.15, r * 0.95, r * 1.05, 0, 0, TAU); c.fillStyle = o.col; c.fill(); outline(c, o);
      for (let k = 0; k < 4; k++) fillC(c, x + (hash(k) - 0.5) * r * 1.2, y - r * 0.7 + hash(k + 5) * r * 0.4, 4 + hash(k + 2) * 4, 'rgba(0,0,0,0.2)');
      eye(c, x - r * 0.38, y + r * 0.05, r * 0.24, o, '#facc15');
      eye(c, x + r * 0.38, y + r * 0.05, r * 0.24, o, '#facc15');
    },

    // 23 홀로 오라클: 두건 + 빛나는 제3의 눈 + 깜빡이는 홀로그램
    oracle(c, b, o) {
      const { x, y, r, t } = b;
      const flick = hash(Math.floor(t * 12)) > 0.9 ? 0.4 : 1;
      c.globalAlpha *= flick;
      [0, 1].forEach(k => { c.beginPath(); c.ellipse(x, y + r * (1.0 + k * 0.25), r * (1.2 - k * 0.3), r * 0.18, 0, 0, TAU); c.strokeStyle = 'rgba(165,180,252,0.6)'; c.lineWidth = 2; c.stroke(); });
      c.beginPath(); c.moveTo(x, y - r * 1.25); c.quadraticCurveTo(x + r * 1.2, y - r * 0.2, x + r * 0.95, y + r * 0.95);
      c.lineTo(x - r * 0.95, y + r * 0.95); c.quadraticCurveTo(x - r * 1.2, y - r * 0.2, x, y - r * 1.25);
      c.fillStyle = o.col; c.fill(); outline(c, o, 2);
      c.beginPath(); c.ellipse(x, y + r * 0.1, r * 0.52, r * 0.62, 0, 0, TAU); c.fillStyle = '#020617'; c.fill();
      c.save(); c.clip(); c.fillStyle = 'rgba(129,140,248,0.18)';
      for (let k = 0; k < 12; k++) c.fillRect(x - r, y - r * 0.6 + k * r * 0.12 + ((t * 40) % (r * 0.12)), r * 2, 2);
      c.restore();
      [-1, 1].forEach(s => fillC(c, x + s * r * 0.2, y + r * 0.2, r * 0.07, o.en ? '#ff1744' : '#a5b4fc'));
      c.beginPath(); c.ellipse(x, y - r * 0.55, r * 0.22, r * 0.12, 0, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
      fillC(c, x + Math.cos(o.aim) * r * 0.06, y - r * 0.55, r * 0.08, o.en ? '#e11d48' : '#6366f1');
      c.globalAlpha /= flick;
    },

    // 25 퀀텀 코어: 원자핵 + 전자 궤도
    atom(c, b, o) {
      const { x, y, r, t } = b;
      for (let k = 0; k < 3; k++) {
        const rot = k * Math.PI / 3 + t * 0.3;
        c.beginPath(); c.ellipse(x, y, r * 1.7, r * 0.55, rot, 0, TAU); c.strokeStyle = 'rgba(167,243,208,0.65)'; c.lineWidth = 2; c.stroke();
        const a = t * (3 + k) + k * 2;
        const ex = Math.cos(a) * r * 1.7, ey = Math.sin(a) * r * 0.55;
        fillC(c, x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot), 6, '#fef08a');
      }
      for (let k = 0; k < 9; k++) {
        const a = k * 2.4 + t * 0.6, d = k === 0 ? 0 : r * (0.3 + (k % 3) * 0.13);
        fillC(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.34, k % 2 ? o.col : '#ef4444');
        circle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.34); shade(c, k % 2 ? 0.1 : -0.1);
      }
      eye(c, x, y, r * 0.22, o);
    },

    // 26 사신 성운: 두건 쓴 해골 + 큰 낫
    reaper(c, b, o) {
      const { x, y, r, t } = b;
      const sa = t * 1.4;
      c.save(); c.translate(x, y); c.rotate(sa);
      c.strokeStyle = '#78716c'; c.lineWidth = 5; c.beginPath(); c.moveTo(-r * 1.5, 0); c.lineTo(r * 1.5, 0); c.stroke();
      c.beginPath(); c.moveTo(r * 1.5, 0); c.quadraticCurveTo(r * 1.4, -r * 1.3, r * 0.2, -r * 1.2); c.quadraticCurveTo(r * 1.0, -r * 0.8, r * 1.4, 0);
      c.fillStyle = '#e2e8f0'; c.fill(); c.restore();
      c.beginPath(); c.moveTo(x, y - r * 1.2); c.quadraticCurveTo(x + r * 1.2, y - r * 0.6, x + r * 0.9, y + r * 1.0);
      for (let k = 0; k <= 6; k++) c.lineTo(x + r * 0.9 - k * r * 0.3, y + r * (1.0 + (k % 2 ? 0.25 : 0)) + Math.sin(t * 4 + k) * 4);
      c.quadraticCurveTo(x - r * 1.2, y - r * 0.6, x, y - r * 1.2);
      c.fillStyle = '#1e1b2e'; c.fill(); c.lineWidth = 3; c.strokeStyle = o.col; c.stroke();
      c.beginPath(); c.ellipse(x, y, r * 0.48, r * 0.55, 0, 0, TAU); c.fillStyle = o.col === '#ffffff' ? '#ffffff' : '#f5f5f4'; c.fill();
      [-1, 1].forEach(s => { c.beginPath(); c.ellipse(x + s * r * 0.19, y - r * 0.08, r * 0.14, r * 0.17, 0, 0, TAU); c.fillStyle = '#0b0610'; c.fill(); fillC(c, x + s * r * 0.19 + Math.cos(o.aim) * 3, y - r * 0.06 + Math.sin(o.aim) * 3, r * 0.05, o.en ? '#ef4444' : '#93c5fd'); });
      c.fillStyle = '#0b0610';
      for (let k = -2; k <= 2; k++) c.fillRect(x + k * r * 0.1 - 2, y + r * 0.28, 4, r * 0.14);
    },

    // 27 일식의 왕: 검은 원반 + 붉은 코로나
    eclipse(c, b, o) {
      const { x, y, r, t } = b;
      const g = c.createRadialGradient(x, y, r * 0.9, x, y, r * 1.9);
      g.addColorStop(0, o.en ? 'rgba(255,60,60,0.95)' : 'rgba(255,120,80,0.85)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      circle(c, x, y, r * 1.9); c.fillStyle = g; c.fill();
      for (let k = 0; k < 24; k++) {
        const a = k * TAU / 24 + t * 0.2, l = r * (1.1 + 0.4 * hash(k + Math.floor(t * 3)));
        c.strokeStyle = 'rgba(254,202,202,0.6)'; c.lineWidth = 2; c.beginPath();
        c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
      circle(c, x, y, r); c.fillStyle = '#000000'; c.fill(); c.lineWidth = 3; c.strokeStyle = o.col; c.stroke();
      c.beginPath(); c.arc(x + Math.cos(t) * 4, y, r * 0.98, -0.6, 0.6); c.strokeStyle = '#fff7ed'; c.lineWidth = 4; c.stroke();
      c.beginPath(); c.ellipse(x, y, r * 0.5, r * 0.12, 0, 0, TAU); c.fillStyle = o.en ? '#ff1744' : '#7f1d1d'; c.fill();
      fillC(c, x + Math.cos(o.aim) * r * 0.25, y, r * 0.08, '#fef2f2');
    },

    // 28 무한의 눈: 서로 반대로 도는 눈의 고리
    mandala(c, b, o) {
      const { x, y, r, t } = b;
      [[1.65, 12, 0.11, 1], [1.2, 8, 0.14, -1]].forEach(([d, n, s, dir]) => {
        circle(c, x, y, r * d); c.strokeStyle = 'rgba(125,211,252,0.4)'; c.lineWidth = 2; c.stroke();
        for (let k = 0; k < n; k++) {
          const a = t * 0.6 * dir + k * TAU / n;
          const ex = x + Math.cos(a) * r * d, ey = y + Math.sin(a) * r * d;
          const blink = Math.abs(Math.sin(t * 1.5 + k * 0.9)) > 0.15 ? 1 : 0.15;
          c.save(); c.beginPath(); c.ellipse(ex, ey, r * s * 1.3, r * s * blink, 0, 0, TAU); c.clip();
          eye(c, ex, ey, r * s * 1.2, { aim: Math.atan2(b.py - ey, b.px - ex), en: o.en }, '#0c4a6e'); c.restore();
        }
      });
      circle(c, x, y, r * 0.85); c.fillStyle = o.col; c.fill(); outline(c, o);
      eye(c, x, y, r * 0.65, o, '#0284c7');
    },

    // 29 시스템 오버로드: RGB 글리치 사각형
    glitch(c, b, o) {
      const { x, y, r, t } = b;
      const tick = Math.floor(t * 10);
      const off = 3 + hash(tick) * (o.en ? 9 : 5);
      c.save(); c.globalCompositeOperation = 'lighter';
      [['#ff0040', -off, 0], ['#00ff9c', off, 0], ['#3d7bff', 0, off * 0.6]].forEach(([col, dx, dy]) => {
        c.beginPath(); c.rect(x - r + dx, y - r + dy, r * 2, r * 2); c.fillStyle = col; c.globalAlpha = 0.55; c.fill();
      });
      c.restore();
      c.beginPath(); c.rect(x - r, y - r, r * 2, r * 2); c.fillStyle = o.col; c.globalAlpha *= 0.85; c.fill(); c.globalAlpha /= 0.85; outline(c, o);
      for (let k = 0; k < 4; k++) {
        if (hash(tick * 7 + k) < 0.5) continue;
        const sy = y - r + hash(tick + k * 3) * r * 2, sh = 4 + hash(tick + k) * 10, sx = (hash(tick + k * 5) - 0.5) * 40;
        c.fillStyle = hash(k + tick) > 0.5 ? '#000000' : '#facc15'; c.fillRect(x - r + sx, sy, r * 2, sh);
      }
      c.fillStyle = '#05070d'; c.fillRect(x - r * 0.75, y - r * 0.35, r * 1.5, r * 0.5);
      c.fillStyle = o.en ? '#ff1744' : '#facc15'; c.font = `bold ${Math.round(r * 0.36)}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(hash(tick) > 0.8 ? 'F@TAL' : 'ERR', x + (hash(tick + 1) - 0.5) * 6, y - r * 0.1);
      c.fillStyle = 'rgba(0,0,0,0.5)';
      for (let k = 0; k < 6; k++) c.fillRect(x - r * 0.75 + k * r * 0.27, y + r * 0.4, r * 0.15, r * 0.35 * hash(tick + k));
    },

    // 30 VERTEX: 핏발 선 거대한 눈알 (최종 보스)
    eyeball(c, b, o) {
      const { x, y, t } = b;
      const r = b.r * 1.1;
      const en = o.en, hit = o.col === '#ffffff';
      const jx = en ? (hash(Math.floor(t * 30)) - 0.5) * 3 : 0, jy = en ? (hash(Math.floor(t * 30) + 1) - 0.5) * 3 : 0;
      const cx = x + jx, cy = y + jy;

      // 뒤쪽 촉수 같은 핏줄
      c.lineCap = 'round';
      for (let k = 0; k < 10; k++) {
        const a0 = k * TAU / 10 + hash(k) * 0.4;
        c.beginPath(); let px = cx + Math.cos(a0) * r * 0.9, py = cy + Math.sin(a0) * r * 0.9; c.moveTo(px, py);
        for (let s = 1; s <= 8; s++) {
          const a = a0 + Math.sin(t * 2 + k + s * 0.6) * 0.35;
          px += Math.cos(a) * r * 0.13; py += Math.sin(a) * r * 0.13; c.lineTo(px, py);
        }
        c.strokeStyle = k % 2 ? '#3f0613' : '#5c0a1d'; c.lineWidth = 7 - k % 3; c.stroke();
      }
      c.lineCap = 'butt';

      // 분노: 주위에 작은 눈들이 떠서 플레이어를 노려봄
      if (en) {
        for (let k = 0; k < 6; k++) {
          const a = -t * 0.8 + k * TAU / 6, ex = cx + Math.cos(a) * r * 1.75, ey = cy + Math.sin(a) * r * 1.75;
          fillC(c, ex, ey, r * 0.2, '#3f0613');
          fillC(c, ex, ey, r * 0.16, '#f1e7d8');
          const pa = Math.atan2(b.py - ey, b.px - ex);
          fillC(c, ex + Math.cos(pa) * r * 0.06, ey + Math.sin(pa) * r * 0.06, r * 0.08, '#b91c1c');
          fillC(c, ex + Math.cos(pa) * r * 0.06, ey + Math.sin(pa) * r * 0.06, r * 0.035, '#000');
        }
      }

      // 흰자
      const g = c.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
      g.addColorStop(0, hit ? '#ffffff' : '#fbf6ee'); g.addColorStop(0.7, hit ? '#ffffff' : '#ead9c4'); g.addColorStop(1, hit ? '#ffe4e6' : '#b98b7a');
      circle(c, cx, cy, r); c.fillStyle = g; c.fill();

      // 핏발
      c.save(); circle(c, cx, cy, r); c.clip();
      for (let k = 0; k < 14; k++) {
        const a = hash(k + 40) * TAU;
        let px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        c.beginPath(); c.moveTo(px, py);
        let ang = a + Math.PI;
        for (let s = 0; s < 5; s++) {
          ang += (hash(k * 9 + s) - 0.5) * 1.1 + Math.sin(t * 1.5 + k) * 0.05;
          px += Math.cos(ang) * r * 0.12; py += Math.sin(ang) * r * 0.12; c.lineTo(px, py);
          if (s === 2) { c.moveTo(px, py); c.lineTo(px + Math.cos(ang + 0.9) * r * 0.1, py + Math.sin(ang + 0.9) * r * 0.1); c.moveTo(px, py); }
        }
        c.strokeStyle = en ? 'rgba(185,28,28,0.95)' : 'rgba(185,28,28,0.7)'; c.lineWidth = k % 3 ? 1.2 : 2.2; c.stroke();
      }
      c.restore();

      // 홍채 + 동공 (플레이어를 끝까지 따라봄)
      const ix = cx + Math.cos(o.aim) * r * 0.38, iy = cy + Math.sin(o.aim) * r * 0.38;
      const ir = r * 0.42;
      const ig = c.createRadialGradient(ix, iy, ir * 0.2, ix, iy, ir);
      ig.addColorStop(0, en ? '#fde047' : '#a3e635'); ig.addColorStop(0.55, en ? '#dc2626' : '#4d7c0f'); ig.addColorStop(1, '#1a0505');
      circle(c, ix, iy, ir); c.fillStyle = ig; c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
      for (let k = 0; k < 24; k++) { const a = k * TAU / 24; c.beginPath(); c.moveTo(ix + Math.cos(a) * ir * 0.35, iy + Math.sin(a) * ir * 0.35); c.lineTo(ix + Math.cos(a) * ir * 0.95, iy + Math.sin(a) * ir * 0.95); c.stroke(); }
      if (en) {
        // 분노: 세로로 찢어진 동공
        c.beginPath(); c.ellipse(ix, iy, ir * 0.16, ir * 0.78, 0, 0, TAU); c.fillStyle = '#000'; c.fill();
      } else {
        const pr = ir * (0.42 + Math.sin(t * 1.7) * 0.12);
        fillC(c, ix, iy, pr, '#000');
      }
      fillC(c, ix - ir * 0.35, iy - ir * 0.4, ir * 0.16, 'rgba(255,255,255,0.85)');
      fillC(c, ix + ir * 0.3, iy + ir * 0.25, ir * 0.06, 'rgba(255,255,255,0.6)');

      // 눈꺼풀 깜빡임 (분노 중엔 경련하듯 빠르게)
      const period = en ? 1.6 : 3.8, ph = t % period;
      const close = ph < 0.22 ? Math.sin((ph / 0.22) * Math.PI) : 0;
      if (close > 0) {
        c.save(); circle(c, cx, cy, r + 1); c.clip();
        c.fillStyle = '#4a0f16';
        c.fillRect(cx - r - 2, cy - r - 2, r * 2 + 4, (r + 2) * close);
        c.fillRect(cx - r - 2, cy + r + 2 - (r + 2) * close, r * 2 + 4, (r + 2) * close);
        c.restore();
      }
      circle(c, cx, cy, r); c.lineWidth = 3; c.strokeStyle = '#3f0613'; c.stroke();

      // 분노: 흘러내리는 피
      if (en) {
        for (let k = 0; k < 4; k++) {
          const dx = cx + (k - 1.5) * r * 0.35, len = r * (0.3 + ((t * 0.5 + hash(k)) % 1) * 0.9);
          c.strokeStyle = '#7f1d1d'; c.lineWidth = 4; c.lineCap = 'round';
          c.beginPath(); c.moveTo(dx, cy + Math.sqrt(Math.max(0, r * r - (dx - cx) ** 2)) - 3); c.lineTo(dx, cy + Math.sqrt(Math.max(0, r * r - (dx - cx) ** 2)) + len); c.stroke();
          c.lineCap = 'butt';
        }
      }
    },
  };

  window.BossArt = {
    has: look => !!LOOKS[look],
    draw(c, b, o) { LOOKS[b.def.look](c, b, o); },
  };
})();
