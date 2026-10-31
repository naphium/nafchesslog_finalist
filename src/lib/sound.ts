export type SoundKind = "move" | "capture" | "check" | "castle" | "promote" | "end";

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.15) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

function knock(start: number, gain: number, freq = 180) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * 0.09);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.min(1, i / (ctx.sampleRate * 0.002)) * Math.pow(1 - i / len, 5);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq * 6;
  f.Q.value = 0.65;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + start);
  src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  tone(freq, start, 0.08, "sine", gain * 0.1);
}

export function playSound(kind: SoundKind) {
  if (typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    switch (kind) {
      case "move":
        knock(0, 0.55, 210);
        break;
      case "capture":
        knock(0, 0.75, 150);
        knock(0.035, 0.3, 310);
        break;
      case "castle":
        knock(0, 0.5, 210);
        knock(0.11, 0.45, 170);
        break;
      case "check":
        knock(0, 0.5);
        tone(740, 0.04, 0.16, "sine", 0.06);
        tone(880, 0.12, 0.16, "sine", 0.04);
        break;
      case "promote":
        knock(0, 0.5);
        tone(660, 0, 0.12, "sine", 0.1);
        tone(990, 0.1, 0.18, "sine", 0.1);
        break;
      case "end":
        tone(523, 0, 0.2, "sine", 0.12);
        tone(392, 0.18, 0.35, "sine", 0.12);
        break;
    }
  } catch {
    /* audio unavailable */
  }
}
