// 스테이지 정의: 배경, 색상, 탄 종류/비율, 이벤트, 보스, 음악
//
// 탄 궤적(kinds)
//   straight 직선 · curve 휘는 탄 · wave 물결 · accel 가속 · homing 유도 · bounce 벽 반사
//   split 분열 · zigzag 지그재그 · lock 조준 후 돌진 · boomerang 부메랑 · gravity 포물선 낙하
//   helix 이중 나선(2발 한 쌍)
// 웨이브 이벤트(events)
//   fan 부채꼴 · wall 빈틈 있는 탄막 벽 · turretRing 경고 후 원형 폭발 · turretSpiral 경고 후 회오리
// 보스 패턴(patterns)
//   aimed ring spiral curveRing waveFan rain rainUp accelBurst homingVolley bounceSpray cross
//   splitBomb zigzagFan helixStream orbitBurst lockOn boomerangFan gravityFountain flower sweep
//   mineField summon
//   rage: 보스 체력이 절반 이하일 때 동시에 추가로 쓰는 패턴
//
// 난이도 수치(waveTime, spawn, speed, hp, eventEvery)는 아래 STAGE_CURVE 에서 계산합니다.
// special: 스페셜 스테이지(27~30) · openYear: 열리는 해(1월 1일) · boss.rageAt: 분노 모드 시작 체력 비율(기본 0.5)
const STAGES = [
  // ---------------- 1 ~ 10 ----------------
  {
    name: '네온 필드', bg: 'grid',
    colors: { bg: '#0f172a', bg2: '#111827', line: 'rgba(94,234,212,0.09)', accent: '#5eead4' },
    bullet: ['#f87171', '#fbbf24'],
    kinds: { straight: 1 },
    events: [],
    boss: { name: '큐브 가디언', sides: 4, color: '#38bdf8', r: 34, move: 'sway', patterns: ['aimed', 'ring'] },
    music: { bpm: 118, root: 57, mode: 'minor', prog: [0, 5, 2, 6], arp: 'up', lead: 'square', bass: 'triangle', drums: 'four' },
  },
  {
    name: '별빛 표류', bg: 'stars',
    colors: { bg: '#070b1f', bg2: '#141a3a', line: 'rgba(253,230,138,0.6)', accent: '#fde68a' },
    bullet: ['#fb923c', '#f472b6'],
    kinds: { straight: 0.6, curve: 0.4 },
    events: ['fan'],
    boss: { name: '별의 직조자', sides: 5, color: '#facc15', r: 36, move: 'float', patterns: ['curveRing', 'aimed', 'spiral'] },
    music: { bpm: 124, root: 60, mode: 'major', prog: [0, 4, 5, 3], arp: 'broken', lead: 'triangle', bass: 'triangle', drums: 'half' },
  },
  {
    name: '심해', bg: 'waves',
    colors: { bg: '#021526', bg2: '#03346e', line: 'rgba(56,189,248,0.18)', accent: '#38bdf8' },
    bullet: ['#a5f3fc', '#f0abfc'],
    kinds: { straight: 0.35, curve: 0.25, wave: 0.4 },
    events: ['fan', 'wall'],
    boss: { name: '심연의 해파리', sides: 0, color: '#c084fc', r: 38, move: 'float', patterns: ['waveFan', 'ring', 'rainUp'] },
    music: { bpm: 108, root: 50, mode: 'dorian', prog: [0, 3, 4, 0], arp: 'broken', lead: 'sine', bass: 'sine', drums: 'half' },
  },
  {
    name: '폭풍의 눈', bg: 'rain',
    colors: { bg: '#0c0a1d', bg2: '#1e1b3a', line: 'rgba(196,181,253,0.35)', accent: '#c4b5fd' },
    bullet: ['#fde047', '#e879f9'],
    kinds: { straight: 0.25, curve: 0.2, wave: 0.2, accel: 0.35 },
    events: ['fan', 'wall', 'turretRing'],
    boss: { name: '스톰 아이', sides: 6, color: '#a78bfa', r: 38, move: 'dash', patterns: ['accelBurst', 'rain', 'aimed'] },
    music: { bpm: 136, root: 52, mode: 'phrygian', prog: [0, 1, 0, 6], arp: 'fast', lead: 'sawtooth', bass: 'square', drums: 'break' },
  },
  {
    name: '펄스 코어', bg: 'rings',
    colors: { bg: '#1a0526', bg2: '#4a044e', line: 'rgba(244,114,182,0.25)', accent: '#f472b6' },
    bullet: ['#fef08a', '#67e8f9'],
    kinds: { straight: 0.25, curve: 0.2, wave: 0.15, accel: 0.15, homing: 0.25 },
    events: ['fan', 'turretRing', 'turretSpiral'],
    boss: { name: '펄스 하트', sides: 0, color: '#f43f5e', r: 40, move: 'center', patterns: ['ring', 'homingVolley', 'spiral'], rage: 'aimed' },
    music: { bpm: 128, root: 53, mode: 'minor', prog: [0, 6, 5, 4], arp: 'pulse', lead: 'square', bass: 'sawtooth', drums: 'four' },
  },
  {
    name: '사이버 그리드', bg: 'circuit',
    colors: { bg: '#020f0a', bg2: '#052e16', line: 'rgba(74,222,128,0.16)', accent: '#4ade80' },
    bullet: ['#f87171', '#fde047'],
    kinds: { straight: 0.2, curve: 0.15, wave: 0.1, accel: 0.15, homing: 0.15, bounce: 0.25 },
    events: ['wall', 'turretRing', 'turretSpiral'],
    boss: { name: '파이어월', sides: 8, color: '#22c55e', r: 40, move: 'sway', patterns: ['bounceSpray', 'cross', 'aimed'], rage: 'ring' },
    music: { bpm: 140, root: 55, mode: 'harmonic', prog: [0, 5, 3, 4], arp: 'fast', lead: 'square', bass: 'square', drums: 'trap' },
  },
  {
    name: '화산 지대', bg: 'embers',
    colors: { bg: '#1c0702', bg2: '#7c2d12', line: 'rgba(251,146,60,0.7)', accent: '#fb923c' },
    bullet: ['#fde047', '#fca5a5'],
    kinds: { straight: 0.2, curve: 0.15, accel: 0.15, homing: 0.1, bounce: 0.15, split: 0.25 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '마그마 타이탄', sides: 7, color: '#ef4444', r: 44, move: 'dash', patterns: ['splitBomb', 'gravityFountain', 'ring'], rage: 'rain' },
    music: { bpm: 132, root: 45, mode: 'phrygian', prog: [0, 1, 6, 0], arp: 'up', lead: 'sawtooth', bass: 'sawtooth', drums: 'break' },
  },
  {
    name: '수정 동굴', bg: 'hex',
    colors: { bg: '#04131f', bg2: '#0c4a6e', line: 'rgba(165,243,252,0.14)', accent: '#a5f3fc' },
    bullet: ['#f0abfc', '#fde68a'],
    kinds: { straight: 0.1, curve: 0.15, wave: 0.15, accel: 0.1, homing: 0.1, bounce: 0.1, split: 0.1, zigzag: 0.2 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '프리즘', sides: 3, color: '#67e8f9', r: 42, move: 'orbit', patterns: ['spiral', 'curveRing', 'zigzagFan'], rage: 'flower' },
    music: { bpm: 120, root: 62, mode: 'lydian', prog: [0, 1, 4, 5], arp: 'broken', lead: 'triangle', bass: 'triangle', drums: 'half' },
  },
  {
    name: '오로라', bg: 'aurora',
    colors: { bg: '#020617', bg2: '#0f172a', line: 'rgba(134,239,172,0.3)', accent: '#86efac' },
    bullet: ['#fda4af', '#fcd34d'],
    kinds: { straight: 0.1, curve: 0.15, wave: 0.15, accel: 0.1, homing: 0.1, bounce: 0.1, zigzag: 0.15, helix: 0.15 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '하늘 뱀', sides: 0, color: '#a3e635', r: 40, move: 'figure8', patterns: ['waveFan', 'helixStream', 'cross', 'spiral'], rage: 'homingVolley' },
    music: { bpm: 124, root: 57, mode: 'dorian', prog: [0, 4, 3, 6], arp: 'fast', lead: 'triangle', bass: 'sine', drums: 'four' },
  },
  {
    name: '공허', bg: 'void',
    colors: { bg: '#050005', bg2: '#2a0410', line: 'rgba(248,113,113,0.5)', accent: '#f87171' },
    bullet: ['#f8fafc', '#fb7185', '#fbbf24'],
    kinds: { straight: 0.1, curve: 0.15, wave: 0.1, accel: 0.15, homing: 0.1, bounce: 0.1, split: 0.1, zigzag: 0.1, helix: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: {
      name: '공허의 군주', sides: 12, color: '#e11d48', r: 46, move: 'teleport', random: true, rage: 'ring',
      patterns: ['aimed', 'ring', 'spiral', 'curveRing', 'waveFan', 'accelBurst', 'homingVolley', 'cross', 'splitBomb', 'zigzagFan', 'helixStream'],
    },
    music: { bpm: 150, root: 50, mode: 'harmonic', prog: [0, 5, 1, 4], arp: 'fast', lead: 'sawtooth', bass: 'sawtooth', drums: 'trap' },
  },

  // ---------------- 11 ~ 20 (새 궤적: 조준 돌진 · 부메랑 · 포물선 · 이중 나선) ----------------
  {
    name: '네온 시티', bg: 'scan',
    colors: { bg: '#12002b', bg2: '#3b0764', line: 'rgba(232,121,249,0.35)', accent: '#e879f9' },
    bullet: ['#22d3ee', '#fde047'],
    kinds: { straight: 0.15, curve: 0.15, wave: 0.15, accel: 0.1, helix: 0.2, lock: 0.25 },
    events: ['fan', 'wall', 'turretRing'],
    boss: { name: '네온 드래곤', sides: 0, color: '#d946ef', r: 42, move: 'figure8', patterns: ['orbitBurst', 'aimed', 'sweep'], rage: 'ring' },
    music: { bpm: 112, root: 57, mode: 'minor', prog: [0, 5, 3, 4], arp: 'up', lead: 'sawtooth', bass: 'sawtooth', drums: 'four' },
  },
  {
    name: '디지털 비', bg: 'matrix',
    colors: { bg: '#000a03', bg2: '#022c13', line: 'rgba(34,197,94,0.85)', accent: '#22c55e' },
    bullet: ['#f0fdf4', '#fde047'],
    kinds: { straight: 0.15, accel: 0.15, zigzag: 0.15, homing: 0.1, lock: 0.25, bounce: 0.2 },
    events: ['wall', 'turretRing', 'turretSpiral'],
    boss: { name: '코드 센티넬', sides: 4, color: '#16a34a', r: 42, move: 'dash', patterns: ['lockOn', 'cross', 'rain'], rage: 'aimed' },
    music: { bpm: 142, root: 52, mode: 'phrygian', prog: [0, 1, 3, 1], arp: 'fast', lead: 'square', bass: 'square', drums: 'trap' },
  },
  {
    name: '깊은 우주', bg: 'nebula',
    colors: { bg: '#05010f', bg2: '#1e0b3a', line: 'rgba(167,139,250,0.5)', accent: '#a78bfa' },
    bullet: ['#fbcfe8', '#93c5fd'],
    kinds: { straight: 0.1, curve: 0.2, wave: 0.1, homing: 0.1, boomerang: 0.3, helix: 0.2 },
    events: ['fan', 'turretRing', 'turretSpiral'],
    boss: { name: '블랙홀', sides: 0, color: '#7c3aed', r: 44, move: 'center', patterns: ['boomerangFan', 'orbitBurst', 'spiral'], rage: 'homingVolley' },
    music: { bpm: 104, root: 49, mode: 'dorian', prog: [0, 6, 4, 5], arp: 'broken', lead: 'sine', bass: 'sine', drums: 'half' },
  },
  {
    name: '얼음 성채', bg: 'hex',
    colors: { bg: '#020c1b', bg2: '#1e3a5f', line: 'rgba(191,219,254,0.18)', accent: '#bfdbfe' },
    bullet: ['#e0f2fe', '#a78bfa'],
    kinds: { straight: 0.1, wave: 0.15, zigzag: 0.15, gravity: 0.3, lock: 0.15, boomerang: 0.15 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '서리 거인', sides: 6, color: '#60a5fa', r: 46, move: 'sway', patterns: ['gravityFountain', 'curveRing', 'lockOn'], rage: 'zigzagFan' },
    music: { bpm: 116, root: 59, mode: 'lydian', prog: [0, 2, 4, 1], arp: 'broken', lead: 'triangle', bass: 'triangle', drums: 'half' },
  },
  {
    name: '용암 심장', bg: 'embers',
    colors: { bg: '#140200', bg2: '#991b1b', line: 'rgba(253,186,116,0.8)', accent: '#fdba74' },
    bullet: ['#fef9c3', '#fca5a5'],
    kinds: { accel: 0.15, split: 0.15, gravity: 0.25, helix: 0.2, homing: 0.1, boomerang: 0.15 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '불사조', sides: 5, color: '#f97316', r: 44, move: 'figure8', patterns: ['helixStream', 'gravityFountain', 'splitBomb'], rage: 'ring' },
    music: { bpm: 138, root: 48, mode: 'harmonic', prog: [0, 5, 6, 4], arp: 'up', lead: 'sawtooth', bass: 'sawtooth', drums: 'break' },
  },
  {
    name: '시간의 터널', bg: 'tunnel',
    colors: { bg: '#030712', bg2: '#0c1a33', line: 'rgba(56,189,248,0.4)', accent: '#38bdf8' },
    bullet: ['#fde68a', '#f9a8d4'],
    kinds: { curve: 0.15, zigzag: 0.15, lock: 0.2, boomerang: 0.15, helix: 0.15, gravity: 0.1, bounce: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '크로노스', sides: 8, color: '#0ea5e9', r: 44, move: 'orbit', patterns: ['flower', 'lockOn', 'boomerangFan'], rage: 'sweep' },
    music: { bpm: 126, root: 54, mode: 'minor', prog: [0, 3, 5, 4], arp: 'pulse', lead: 'square', bass: 'square', drums: 'four' },
  },
  {
    name: '폭풍 전선', bg: 'rain',
    colors: { bg: '#120404', bg2: '#3f0d0d', line: 'rgba(252,165,165,0.35)', accent: '#fca5a5' },
    bullet: ['#fef08a', '#c4b5fd'],
    kinds: { accel: 0.2, zigzag: 0.15, lock: 0.2, homing: 0.15, helix: 0.15, split: 0.15 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '썬더 버드', sides: 3, color: '#facc15', r: 42, move: 'dash', patterns: ['sweep', 'accelBurst', 'helixStream'], rage: 'lockOn' },
    music: { bpm: 152, root: 50, mode: 'phrygian', prog: [0, 1, 6, 1], arp: 'fast', lead: 'sawtooth', bass: 'square', drums: 'trap' },
  },
  {
    name: '심연의 문', bg: 'void',
    colors: { bg: '#00030a', bg2: '#0a1a4a', line: 'rgba(96,165,250,0.55)', accent: '#60a5fa' },
    bullet: ['#f8fafc', '#a5b4fc', '#f0abfc'],
    kinds: { curve: 0.15, homing: 0.15, split: 0.15, boomerang: 0.15, gravity: 0.1, lock: 0.15, helix: 0.15 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '게이트 키퍼', sides: 10, color: '#3b82f6', r: 46, move: 'teleport', patterns: ['mineField', 'orbitBurst', 'cross'], rage: 'flower' },
    music: { bpm: 132, root: 47, mode: 'harmonic', prog: [0, 3, 1, 4], arp: 'broken', lead: 'square', bass: 'sawtooth', drums: 'break' },
  },
  {
    name: '은하 폭발', bg: 'nebula',
    colors: { bg: '#0a0210', bg2: '#4a0d3a', line: 'rgba(251,191,36,0.55)', accent: '#fbbf24' },
    bullet: ['#fef3c7', '#f472b6', '#67e8f9'],
    kinds: { curve: 0.1, wave: 0.1, accel: 0.1, homing: 0.1, split: 0.1, lock: 0.15, boomerang: 0.1, gravity: 0.1, helix: 0.15 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '초신성', sides: 0, color: '#f59e0b', r: 48, move: 'center', patterns: ['flower', 'gravityFountain', 'summon', 'helixStream'], rage: 'orbitBurst' },
    music: { bpm: 140, root: 56, mode: 'major', prog: [0, 5, 3, 4], arp: 'fast', lead: 'triangle', bass: 'sawtooth', drums: 'four' },
  },
  {
    name: '최후의 차원', bg: 'tunnel',
    colors: { bg: '#0a0000', bg2: '#3b0010', line: 'rgba(244,63,94,0.5)', accent: '#f43f5e' },
    bullet: ['#ffffff', '#fb7185', '#fbbf24', '#a78bfa'],
    kinds: { straight: 0.05, curve: 0.1, wave: 0.05, accel: 0.1, homing: 0.1, bounce: 0.05, split: 0.1, zigzag: 0.1, lock: 0.1, boomerang: 0.1, gravity: 0.05, helix: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: {
      name: '차원의 지배자', sides: 12, color: '#be123c', r: 50, move: 'teleport', random: true, rage: 'lockOn',
      patterns: ['aimed', 'ring', 'spiral', 'curveRing', 'accelBurst', 'homingVolley', 'cross', 'splitBomb', 'helixStream',
        'orbitBurst', 'lockOn', 'boomerangFan', 'gravityFountain', 'flower', 'sweep', 'mineField', 'summon'],
    },
    music: { bpm: 160, root: 50, mode: 'harmonic', prog: [0, 1, 5, 4], arp: 'fast', lead: 'sawtooth', bass: 'sawtooth', drums: 'trap' },
  },

  // ---------------- 21 ~ 26 ----------------
  {
    name: '산호 미궁', bg: 'waves',
    colors: { bg: '#011a1f', bg2: '#04434f', line: 'rgba(45,212,191,0.2)', accent: '#2dd4bf' },
    bullet: ['#fda4af', '#fef08a'],
    kinds: { wave: 0.2, curve: 0.15, boomerang: 0.2, helix: 0.15, homing: 0.1, gravity: 0.1, lock: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '크라켄', sides: 0, color: '#14b8a6', r: 46, move: 'float', patterns: ['waveFan', 'boomerangFan', 'mineField', 'orbitBurst'], rage: 'helixStream' },
    music: { bpm: 118, root: 51, mode: 'dorian', prog: [0, 4, 6, 3], arp: 'broken', lead: 'sine', bass: 'triangle', drums: 'half' },
  },
  {
    name: '천둥 협곡', bg: 'rain',
    colors: { bg: '#0a0a14', bg2: '#27213f', line: 'rgba(253,224,71,0.35)', accent: '#fde047' },
    bullet: ['#e0e7ff', '#fb7185'],
    kinds: { accel: 0.2, zigzag: 0.15, lock: 0.2, bounce: 0.15, split: 0.15, helix: 0.15 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '라이트닝 웜', sides: 3, color: '#eab308', r: 44, move: 'dash', patterns: ['sweep', 'lockOn', 'accelBurst', 'zigzagFan'], rage: 'cross' },
    music: { bpm: 156, root: 49, mode: 'phrygian', prog: [0, 1, 4, 1], arp: 'fast', lead: 'sawtooth', bass: 'square', drums: 'trap' },
  },
  {
    name: '홀로그램 신전', bg: 'scan',
    colors: { bg: '#030316', bg2: '#1e1b4b', line: 'rgba(129,140,248,0.4)', accent: '#818cf8' },
    bullet: ['#f0abfc', '#67e8f9'],
    kinds: { curve: 0.15, homing: 0.15, lock: 0.15, boomerang: 0.15, helix: 0.2, split: 0.2 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '홀로 오라클', sides: 6, color: '#6366f1', r: 44, move: 'teleport', patterns: ['flower', 'orbitBurst', 'zigzagFan', 'homingVolley'], rage: 'lockOn' },
    music: { bpm: 122, root: 58, mode: 'lydian', prog: [0, 1, 5, 4], arp: 'pulse', lead: 'triangle', bass: 'sine', drums: 'four' },
  },
  {
    name: '극광 회랑', bg: 'aurora',
    colors: { bg: '#010814', bg2: '#0b2239', line: 'rgba(244,114,182,0.32)', accent: '#f472b6' },
    bullet: ['#bbf7d0', '#fde68a', '#c4b5fd'],
    kinds: { wave: 0.15, curve: 0.15, gravity: 0.2, helix: 0.2, boomerang: 0.15, lock: 0.15 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '오로라 피닉스', sides: 5, color: '#ec4899', r: 46, move: 'figure8', patterns: ['helixStream', 'curveRing', 'gravityFountain', 'sweep'], rage: 'spiral' },
    music: { bpm: 130, root: 55, mode: 'major', prog: [0, 3, 4, 5], arp: 'up', lead: 'triangle', bass: 'triangle', drums: 'four' },
  },
  {
    name: '양자 회로', bg: 'circuit',
    colors: { bg: '#00100c', bg2: '#03362a', line: 'rgba(52,211,153,0.22)', accent: '#34d399' },
    bullet: ['#fca5a5', '#fde047', '#f0f9ff'],
    kinds: { bounce: 0.2, zigzag: 0.15, lock: 0.15, split: 0.15, accel: 0.15, homing: 0.2 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: { name: '퀀텀 코어', sides: 8, color: '#10b981', r: 46, move: 'center', patterns: ['summon', 'bounceSpray', 'cross', 'lockOn'], rage: 'orbitBurst' },
    music: { bpm: 146, root: 53, mode: 'harmonic', prog: [0, 5, 3, 4], arp: 'fast', lead: 'square', bass: 'square', drums: 'trap' },
  },
  {
    name: '별의 무덤', bg: 'stars',
    colors: { bg: '#04030a', bg2: '#1c1430', line: 'rgba(226,232,240,0.7)', accent: '#e2e8f0' },
    bullet: ['#fbbf24', '#f472b6', '#93c5fd'],
    kinds: { straight: 0.05, curve: 0.1, wave: 0.05, accel: 0.1, homing: 0.1, split: 0.1, zigzag: 0.1, lock: 0.1, boomerang: 0.1, gravity: 0.1, helix: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: {
      name: '사신 성운', sides: 9, color: '#94a3b8', r: 48, move: 'orbit', random: true, rage: 'flower',
      patterns: ['spiral', 'curveRing', 'homingVolley', 'splitBomb', 'helixStream', 'orbitBurst', 'boomerangFan', 'gravityFountain', 'sweep', 'mineField'],
    },
    music: { bpm: 136, root: 48, mode: 'minor', prog: [0, 6, 3, 4], arp: 'broken', lead: 'sawtooth', bass: 'sawtooth', drums: 'break' },
  },

  // ---------------- 27 ~ 30: 스페셜 스테이지 (매년 1월 1일에 하나씩 열림, 매우 어려움) ----------------
  {
    name: '붉은 일식', bg: 'void', special: true,
    colors: { bg: '#0a0000', bg2: '#450a0a', line: 'rgba(252,165,165,0.6)', accent: '#ff4d4d' },
    bullet: ['#ffffff', '#fecaca', '#fbbf24'],
    kinds: { accel: 0.15, homing: 0.15, split: 0.15, lock: 0.2, boomerang: 0.1, helix: 0.15, bounce: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: {
      name: '일식의 왕', sides: 0, color: '#dc2626', r: 50, move: 'teleport', random: true, rage: 'sweep', rageAt: 0.7,
      patterns: ['aimed', 'ring', 'spiral', 'accelBurst', 'homingVolley', 'splitBomb', 'lockOn', 'flower', 'orbitBurst'],
    },
    music: { bpm: 158, root: 47, mode: 'harmonic', prog: [0, 1, 5, 4], arp: 'fast', lead: 'sawtooth', bass: 'sawtooth', drums: 'trap' },
  },
  {
    name: '무한 회랑', bg: 'tunnel', special: true,
    colors: { bg: '#00040a', bg2: '#082f49', line: 'rgba(125,211,252,0.6)', accent: '#7dd3fc' },
    bullet: ['#fef9c3', '#f9a8d4', '#ffffff'],
    kinds: { curve: 0.1, wave: 0.1, zigzag: 0.15, lock: 0.15, boomerang: 0.15, gravity: 0.1, helix: 0.15, bounce: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: {
      name: '무한의 눈', sides: 0, color: '#0284c7', r: 50, move: 'orbit', random: true, rage: 'orbitBurst', rageAt: 0.75,
      patterns: ['curveRing', 'waveFan', 'zigzagFan', 'helixStream', 'boomerangFan', 'gravityFountain', 'flower', 'sweep', 'mineField', 'lockOn'],
    },
    music: { bpm: 164, root: 52, mode: 'minor', prog: [0, 3, 6, 4], arp: 'fast', lead: 'square', bass: 'sawtooth', drums: 'trap' },
  },
  {
    name: '코드 붕괴', bg: 'matrix', special: true,
    colors: { bg: '#000500', bg2: '#052e16', line: 'rgba(250,204,21,0.85)', accent: '#facc15' },
    bullet: ['#ffffff', '#ef4444', '#facc15'],
    kinds: { straight: 0.05, accel: 0.15, homing: 0.15, bounce: 0.1, split: 0.15, zigzag: 0.1, lock: 0.2, helix: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: {
      name: '시스템 오버로드', sides: 4, color: '#ca8a04', r: 50, move: 'dash', random: true, rage: 'summon', rageAt: 0.8,
      patterns: ['aimed', 'cross', 'rain', 'rainUp', 'bounceSpray', 'splitBomb', 'zigzagFan', 'lockOn', 'sweep', 'mineField', 'summon'],
    },
    music: { bpm: 170, root: 50, mode: 'phrygian', prog: [0, 1, 0, 6], arp: 'fast', lead: 'square', bass: 'square', drums: 'trap' },
  },
  {
    name: '차원 너머', bg: 'nebula', special: true, final: true,
    colors: { bg: '#030008', bg2: '#2e0249', line: 'rgba(255,255,255,0.6)', accent: '#ffffff' },
    bullet: ['#ffffff', '#f472b6', '#22d3ee', '#fbbf24', '#a78bfa'],
    kinds: { straight: 0.04, curve: 0.08, wave: 0.06, accel: 0.1, homing: 0.1, bounce: 0.06, split: 0.1, zigzag: 0.08, lock: 0.12, boomerang: 0.1, gravity: 0.06, helix: 0.1 },
    events: ['fan', 'wall', 'turretRing', 'turretSpiral'],
    boss: {
      // 최종 보스: 처음부터 분노 패턴을 함께 씀
      name: 'VERTEX', sides: 12, color: '#f5f3ff', r: 54, move: 'teleport', random: true, rage: 'lockOn', rageAt: 1,
      patterns: ['aimed', 'ring', 'spiral', 'curveRing', 'waveFan', 'accelBurst', 'homingVolley', 'bounceSpray', 'cross', 'splitBomb',
        'zigzagFan', 'helixStream', 'orbitBurst', 'boomerangFan', 'gravityFountain', 'flower', 'sweep', 'mineField', 'summon'],
    },
    music: { bpm: 176, root: 50, mode: 'harmonic', prog: [0, 5, 1, 4], arp: 'fast', lead: 'sawtooth', bass: 'sawtooth', drums: 'trap' },
  },
];

// ---- 기본으로 열려 있는 스테이지 수. 27단계부터는 2027년, 2028년 ... 2030년 1월 1일에 하나씩 열림 ----
const BASE_OPEN_STAGES = 26;
STAGES.forEach((s, i) => { s.openYear = i + 1 > BASE_OPEN_STAGES ? 2000 + i + 1 : 0; });

// ---- 난이도 곡선 ----
// d: 1단계 0 → 20단계 1 (지금까지의 밸런스 그대로) → 26단계 1.21 → 스페셜 27~29단계 1.4~1.6 → 30단계 1.8(극악)
(function STAGE_CURVE() {
  const SPECIAL_D = { 27: 1.4, 28: 1.5, 29: 1.6, 30: 1.8 };
  STAGES.forEach((s, i) => {
    const n = i + 1;
    const d = SPECIAL_D[n] ?? (n <= 20 ? i / 19 : 1 + (n - 20) * 0.035);
    s.d = d;
    const over = Math.max(0, d - 1); // 20단계를 넘어선 정도
    s.waveTime = Math.round(18 + Math.min(d, 1) * 10) + (s.special ? 4 : 0);        // 버티기 시간 18초 → 28초, 스페셜 32초
    s.spawn = +((d <= 1 ? 0.56 - d * 0.32 : 0.24 - over * 0.12) * (s.special ? 0.85 : 1)).toFixed(3); // 탄 생성 간격 0.56 → 0.24 → 스페셜 0.17~0.12초
    s.speed = Math.round(d <= 1 ? 130 + d * 110 : 240 + over * 80);                  // 탄 속도 130 → 240 → 304
    s.eventEvery = s.events.length ? +Math.max(2, 6.5 - d * 3.6).toFixed(2) : 99;    // 이벤트 간격 6.5 → 2초
    s.boss.hp = Math.round(d <= 1 ? 4 + d * 26 : 30 + over * 20);                    // 보스 체력 4 → 30 → 46
  });
})();
