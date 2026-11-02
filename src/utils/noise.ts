/* Odak sesleri: tarayıcıda üretilen gürültü (dosya indirmez). Sayaç küçültülse de çalmaya devam eder. */

export type Noise = 'brown' | 'white' | 'cafe';

let ctx: AudioContext | null = null;
let nodes: AudioNode[] = [];
let current: Noise | null = null;
const listeners = new Set<() => void>();

function buffer(ac: AudioContext, kind: 'brown' | 'white' | 'pink') {
  const len = ac.sampleRate * 4;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w * 0.35;
    else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    else { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
  }
  return buf;
}

export function playNoise(kind: Noise | null) {
  stopNodes();
  current = kind;
  if (kind) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer(ctx, kind === 'cafe' ? 'pink' : kind);
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(kind === 'white' ? 0.5 : 0.8, ctx.currentTime + 1.2);
    let chain: AudioNode = src;
    nodes = [src, gain];
    if (kind === 'cafe') {
      // Kalabalık uğultusu: orta frekanslar + yavaş dalgalanma
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass'; band.frequency.value = 700; band.Q.value = 0.6;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.13; depth.gain.value = 0.25;
      lfo.connect(depth).connect(gain.gain);
      lfo.start();
      chain = chain.connect(band);
      nodes.push(band, lfo, depth);
    }
    chain.connect(gain).connect(ctx.destination);
    src.start();
  }
  listeners.forEach((l) => l());
}

function stopNodes() {
  for (const n of nodes) {
    try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* */ }
    try { n.disconnect(); } catch { /* */ }
  }
  nodes = [];
}

export const currentNoise = () => current;
export function onNoiseChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
