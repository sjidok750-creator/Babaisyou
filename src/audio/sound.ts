/**
 * 절차적 사운드 — Web Audio API로만 생성 (외부 오디오 파일 없음).
 * 모든 함수는 음소거 상태를 존중하며, AudioContext는 첫 사용자 제스처에서 생성.
 */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
}

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  {
    freq,
    type = 'sine',
    start = 0,
    duration = 0.15,
    gain = 0.2,
    endFreq,
  }: {
    freq: number;
    type?: OscillatorType;
    start?: number;
    duration?: number;
    gain?: number;
    endFreq?: number;
  },
): void {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration);
  }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** 금속성 노이즈 버스트 (망치/클릭 질감) */
function metallic(ac: AudioContext, start: number, duration: number, gain: number, freq: number): void {
  const t0 = ac.currentTime + start;
  const bufferSize = Math.ceil(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 8;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t0);
}

/** 카드 장착 — 금속 클릭 */
export function playCardSnap(): void {
  const ac = getCtx();
  if (!ac) return;
  metallic(ac, 0, 0.08, 0.35, 2400);
  tone(ac, { freq: 1200, type: 'square', duration: 0.05, gain: 0.06 });
}

/** 틱 — 낮은 목탁음 */
export function playTick(): void {
  const ac = getCtx();
  if (!ac) return;
  tone(ac, { freq: 220, endFreq: 140, type: 'sine', duration: 0.12, gain: 0.18 });
}

/** 이동 — 종이 스치는 짧은 소리 */
export function playMove(): void {
  const ac = getCtx();
  if (!ac) return;
  tone(ac, { freq: 500, endFreq: 700, type: 'triangle', duration: 0.06, gain: 0.05 });
}

/** 합체 — 상승 화음 */
export function playMerge(): void {
  const ac = getCtx();
  if (!ac) return;
  tone(ac, { freq: 392, duration: 0.22, gain: 0.14 });
  tone(ac, { freq: 494, start: 0.06, duration: 0.22, gain: 0.14 });
  tone(ac, { freq: 587, start: 0.12, duration: 0.3, gain: 0.16 });
}

/** 소멸 — 잉크가 스미듯 하강 */
export function playDestroy(): void {
  const ac = getCtx();
  if (!ac) return;
  tone(ac, { freq: 300, endFreq: 60, type: 'sawtooth', duration: 0.3, gain: 0.08 });
}

/** 얼음 토글 — 유리질 */
export function playFreeze(): void {
  const ac = getCtx();
  if (!ac) return;
  tone(ac, { freq: 1568, duration: 0.12, gain: 0.08 });
  tone(ac, { freq: 2093, start: 0.05, duration: 0.15, gain: 0.06 });
}

/** 클리어 — 대장간 망치 3연타 모티프 */
export function playClear(): void {
  const ac = getCtx();
  if (!ac) return;
  [0, 0.22, 0.44].forEach((t, i) => {
    metallic(ac, t, 0.25, 0.4, 1800 + i * 400);
    tone(ac, { freq: 262 * Math.pow(2, i / 3), start: t, duration: 0.3, gain: 0.12 });
  });
  tone(ac, { freq: 1047, start: 0.66, duration: 0.6, gain: 0.1 });
}

/** 실패 — 둔탁한 하강 */
export function playFail(): void {
  const ac = getCtx();
  if (!ac) return;
  tone(ac, { freq: 196, endFreq: 98, type: 'sine', duration: 0.5, gain: 0.15 });
  tone(ac, { freq: 147, endFreq: 73, type: 'sine', start: 0.15, duration: 0.5, gain: 0.12 });
}
