// Synthesizes the promo soundtrack (music + UI sound effects) from the video cue sheet.
// Everything is generated here, so there are no third-party audio assets or licenses.
// Usage: node demo/promo/soundtrack.cjs <timeline.json> <out.wav>
const fs = require('fs');

const SR = 48000;
const TAU = Math.PI * 2;

function build(tl) {
  const N = Math.ceil((tl.duration + 0.5) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);        // music bus
  const fxL = new Float32Array(N), fxR = new Float32Array(N);    // UI / impact bus
  const verbL = new Float32Array(N), verbR = new Float32Array(N); // reverb send
  const duck = new Float32Array(N).fill(1);                      // sidechain gain

  // Tempo is chosen so the drop lands exactly on the first footage frame (16 beats in).
  const B = tl.s3In / 16;
  const beat = (i) => i * B;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const inRange = (t, a, b) => t >= a && t < b;
  const add = (bufL, bufR, t, fn, len, gain = 1, pan = 0, send = 0) => {
    const s0 = Math.floor(t * SR), n = Math.floor(len * SR);
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < n; i++) {
      const k = s0 + i; if (k < 0 || k >= N) continue;
      const v = fn(i / SR, i);
      bufL[k] += v * gl; bufR[k] += v * gr;
      if (send) { verbL[k] += v * gl * send; verbR[k] += v * gr * send; }
    }
  };
  const lp = (a) => { let y = 0; return (x) => (y += a * (x - y)); };
  const hp = (a) => { let y = 0, px = 0; return (x) => { y = a * (y + x - px); px = x; return y; }; };
  const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- song map ----------
  const T = tl;
  const endHit = T.t7;
  const dropAt = T.s3In;
  const breakdown = [T.t6, T.t7];
  const grooveOn = (t) => t >= dropAt && !inRange(t, breakdown[0], breakdown[1]) && t < endHit;
  // Am – F – C – G, one chord per bar.
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]];
  const ROOTS = [33, 29, 36, 31];
  const barOf = (t) => Math.floor(t / (4 * B));
  const chordAt = (t) => CHORDS[((barOf(t) % 4) + 4) % 4];
  const rootAt = (t) => ROOTS[((barOf(t) % 4) + 4) % 4];

  // ---------- drums ----------
  const kick = (t, g = 1) => {
    add(L, R, t, (x) => {
      // Pitch sweeps 155 Hz -> 45 Hz; phase is the integral of that sweep.
      const ph = 45 * x + (110 / 28) * (1 - Math.exp(-x * 28));
      return Math.sin(TAU * ph) * Math.exp(-x * 7) + (x < 0.004 ? rnd() * 0.4 * (1 - x / 0.004) : 0);
    }, 0.45, 0.9 * g);
    const s0 = Math.floor(t * SR);
    for (let i = 0; i < 0.3 * SR; i++) {
      const k = s0 + i; if (k >= N) break;
      const x = i / SR;
      duck[k] = Math.min(duck[k], 1 - 0.65 * Math.exp(-x * 12) * (x < 0.005 ? x / 0.005 : 1));
    }
  };
  const clap = (t, g = 1) => {
    const f = hp(0.92), f2 = lp(0.35);
    add(L, R, t, (x) => {
      const burst = x < 0.03 ? (Math.floor(x / 0.009) % 2 === 0 ? 1 : 0.3) : 1;
      return f2(f(rnd())) * Math.exp(-x * 22) * burst;
    }, 0.25, 0.42 * g, 0, 0.35);
  };
  const hat = (t, open = false, g = 1, pan = 0.15) => {
    const f = hp(0.6);
    add(L, R, t, (x) => f(rnd()) * Math.exp(-x * (open ? 14 : 70)), open ? 0.3 : 0.06, (open ? 0.12 : 0.16) * g, pan);
  };

  // ---------- tonal ----------
  const bassNote = (t, m, len) => {
    const f = midi(m), l1 = lp(0.06), l2 = lp(0.06);
    add(L, R, t, (x) => {
      const env = Math.min(1, x / 0.004) * Math.exp(-x * 3.5);
      const v = saw(f * x) * 0.6 + Math.sin(TAU * f * x) * 0.8;
      return l2(l1(v)) * 2.2 * env;
    }, len, 0.34);
  };
  const padChord = (t, notes, len, g = 1, bright = 0.03) => {
    notes.forEach((m, n) => {
      [-0.09, 0.09].forEach((det, j) => {
        const f = midi(m + 12) * Math.pow(2, det / 12), l = lp(bright);
        const pan = j === 0 ? -0.6 : 0.6;
        add(L, R, t, (x) => {
          const env = Math.min(1, x / 0.6) * Math.min(1, (len - x) / 0.5);
          return l(saw(f * x + n * 0.13)) * env;
        }, len, 0.07 * g, pan, 0.5);
      });
    });
  };
  const pluck = (t, m, g = 1, pan = 0, bright = 0.25) => {
    const f = midi(m);
    let y = 0;
    add(L, R, t, (x) => {
      const a = bright * Math.exp(-x * 18) + 0.02;
      y += a * (saw(f * x) + 0.5 * saw(f * 2.005 * x) - y);
      return y * Math.exp(-x * 7);
    }, 0.4, 0.2 * g, pan, 0.25);
  };
  const bell = (t, m, g = 1, pan = 0) => {
    const f = midi(m);
    add(fxL, fxR, t, (x) => (Math.sin(TAU * f * x) + 0.35 * Math.sin(TAU * f * 2.76 * x) * Math.exp(-x * 6)) * Math.exp(-x * 4.5) * Math.min(1, x / 0.002),
      1.2, 0.16 * g, pan, 0.45);
  };

  // ---------- fx ----------
  const riser = (t0, t1, g = 1) => {
    let ph = 0, y = 0;
    add(L, R, t0, (x) => {
      const p = x / (t1 - t0);
      ph += (200 + 1800 * p * p) / SR;
      y += (0.01 + 0.4 * p * p) * (rnd() - y);
      return (y * 0.9 + saw(ph) * 0.12 * p) * p * p;
    }, t1 - t0, 0.5 * g, 0, 0.3);
  };
  const impact = (t, g = 1) => {
    add(fxL, fxR, t, (x) => Math.sin(TAU * (38 + 50 * Math.exp(-x * 9)) * x) * Math.exp(-x * 2.2), 2.2, 0.75 * g);
    const f = lp(0.08);
    add(fxL, fxR, t, (x) => f(rnd()) * Math.exp(-x * 5), 1, 0.5 * g, 0, 1.2);
  };
  const whoosh = (t, len = 0.5, g = 1) => {
    let y = 0;
    add(fxL, fxR, t - len * 0.6, (x) => {
      const p = x / len, a = 0.02 + 0.25 * Math.sin(Math.PI * p);
      y += a * (rnd() - y);
      return y * Math.sin(Math.PI * p);
    }, len, 0.35 * g, 0, 0.4);
  };
  const keyTick = (t) => {
    const f = hp(0.3);
    const pitch = 2400 + 450 * (rnd() + 1);
    add(fxL, fxR, t, (x) => (f(rnd()) * 0.6 + Math.sin(TAU * pitch * x) * 0.3) * Math.exp(-x * 320), 0.03, 0.25, rnd() * 0.15);
  };
  const mouseClick = (t) => {
    const f = hp(0.4);
    add(fxL, fxR, t, (x) => (f(rnd()) * 0.7 + Math.sin(TAU * 1500 * x) * 0.5) * Math.exp(-x * 260), 0.04, 0.35);
    add(fxL, fxR, t + 0.07, (x) => f(rnd()) * 0.5 * Math.exp(-x * 400), 0.03, 0.2);
  };

  // ---------- arrangement ----------
  const totalBeats = Math.ceil(tl.duration / B) + 8;

  // Intro pad swell and sparkle arp (beats 0-15), manifesto hits on beat.
  padChord(0, CHORDS[0], 4 * B, 1.5, 0.014);
  padChord(4 * B, CHORDS[1], 4 * B, 1.6, 0.02);
  padChord(8 * B, CHORDS[2], 4 * B, 1.6, 0.026);
  padChord(12 * B, CHORDS[3], 4 * B - 0.12, 1.7, 0.035);
  // Low drone under the intro so it isn't just air.
  bassNote(0, 33, 4 * B); bassNote(4 * B, 29, 4 * B);
  const sparkle = [81, 84, 88, 91, 88, 84];
  for (let i = 0; i < 32; i++) {
    const t = i * B / 2;
    if (t > dropAt - 0.2) break;
    pluck(t, sparkle[i % 6], 0.35 + 0.35 * (i / 32), i % 2 ? 0.5 : -0.5, 0.12);
  }
  impact(1.2, 0.45);
  whoosh(4.2, 0.7, 0.8);
  // Manifesto: kick + clap stab on each "No" line, soft hat pulse under it.
  tl.lines.forEach((t) => { kick(t, 0.9); clap(t, 0.6); bassNote(t, rootAt(t) + 12, 0.35); });
  for (let i = 8; i < 16; i++) hat(beat(i) + B / 2, false, 0.7);
  riser(dropAt - 4 * B, dropAt - 0.05, 1);

  // Groove from the drop.
  for (let i = 16; i < totalBeats; i++) {
    const t = beat(i);
    if (t >= tl.duration) break;
    const on = grooveOn(t);
    const bd = inRange(t, breakdown[0], breakdown[1]);
    if (on) {
      kick(t);
      if (i % 2 === 1) clap(t);
      hat(t + B / 2, true, 0.8);
      hat(t + B / 4, false, 0.55, -0.2);
      hat(t + (3 * B) / 4, false, 0.55, 0.25);
      // Offbeat bass, root / octave
      bassNote(t + B / 2, rootAt(t) + (i % 4 === 3 ? 12 : 0), B / 2);
      if (i % 4 === 2) bassNote(t + B * 0.75, rootAt(t) + 7, B / 4);
    }
    if (on || bd) {
      // 16th-note arp through the chord, brighter in the groove.
      const ch = chordAt(t);
      const seq = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24];
      for (let s = 0; s < 4; s++) {
        pluck(t + (s * B) / 4, seq[s], bd ? 0.55 : 0.6, s % 2 ? 0.45 : -0.45, bd ? 0.06 : 0.2);
      }
    }
    if (i % 4 === 0 && t < endHit) padChord(t, chordAt(t), Math.min(4 * B, endHit - t), bd ? 2.2 : 0.75, bd ? 0.024 : 0.03);
    if (bd && i % 4 === 0) bassNote(t, rootAt(t), 4 * B);
  }
  // Scene transitions.
  whoosh(tl.t5, 0.6); whoosh(tl.t6, 0.7);
  riser(tl.t7 - 2 * B, tl.t7 - 0.03, 0.7);
  // End card: impact and a held Am chord with a bell on top.
  impact(endHit, 0.9);
  kick(endHit, 1);
  padChord(endHit, [57, 60, 64, 69], tl.duration - endHit + 0.4, 1.4, 0.02);
  bassNote(endHit, 33, 2.5);
  bell(endHit + 0.7, 81, 0.8);

  // ---------- UI sound effects ----------
  tl.keys.forEach(keyTick);
  tl.clicks.forEach(mouseClick);
  tl.success.forEach((t) => { bell(t, 88, 0.9, -0.2); bell(t + 0.09, 95, 0.75, 0.2); });
  tl.failure.forEach((t) => { bell(t, 76, 0.7); bell(t + 0.12, 72, 0.7); });
  tl.swaps.forEach((t) => whoosh(t + 0.15, 0.35, 0.6));
  tl.cards.forEach((t, i) => pluck(t, [88, 91, 93, 95, 98, 100][i], 0.45, (i % 3 - 1) * 0.5, 0.3));

  // ---------- mix ----------
  // Sidechain the music bus to the kick, keep a quieter bed under the footage so UI ticks read.
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    const bed = t >= dropAt && t < tl.s3Out ? 0.78 : 1;
    L[k] *= duck[k] * bed; R[k] *= duck[k] * bed;
    verbL[k] *= duck[k]; verbR[k] *= duck[k];
  }
  const [rvL, rvR] = reverb(verbL, verbR);
  const outL = new Float32Array(N), outR = new Float32Array(N);
  const fadeStart = tl.duration - 1.2;
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    const fade = t > fadeStart ? Math.max(0, 1 - (t - fadeStart) / 1.2) : 1;
    const fadeIn = Math.min(1, t / 0.05);
    outL[k] = (L[k] + fxL[k] + rvL[k] * 0.3) * fade * fadeIn;
    outR[k] = (R[k] + fxR[k] + rvR[k] * 0.3) * fade * fadeIn;
  }
  // Soft clip; final loudness is set by ffmpeg loudnorm.
  let peak = 0;
  for (let k = 0; k < N; k++) peak = Math.max(peak, Math.abs(outL[k]), Math.abs(outR[k]));
  const pre = 0.9 / (peak || 1) * 1.4;
  for (let k = 0; k < N; k++) { outL[k] = Math.tanh(outL[k] * pre) * 0.89; outR[k] = Math.tanh(outR[k] * pre) * 0.89; }
  return [outL.subarray(0, Math.floor(tl.duration * SR)), outR.subarray(0, Math.floor(tl.duration * SR))];
}

// Freeverb-style: parallel damped combs into series allpasses, decorrelated per channel.
function reverb(inL, inR) {
  const run = (input, spread) => {
    const out = new Float32Array(input.length);
    const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * 48 / 44.1)), i: 0, store: 0 }));
    const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * 48 / 44.1)), i: 0 }));
    const fb = 0.86, damp = 0.3;
    for (let n = 0; n < input.length; n++) {
      const x = input[n] * 0.015;
      let s = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * fb;
        c.i = (c.i + 1) % c.buf.length;
        s += y;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        a.buf[a.i] = s + b * 0.5;
        s = b - s;
        a.i = (a.i + 1) % a.buf.length;
      }
      out[n] = s;
    }
    return out;
  };
  return [run(inL, 0), run(inR, 23)];
}

function writeWav(path, chans) {
  const n = chans[0].length, bytes = n * 2 * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + bytes, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(bytes, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, chans[0][i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, chans[1][i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(path, buf);
}

function renderSoundtrack(timeline, out) {
  writeWav(out, build(timeline));
  return out;
}

module.exports = { renderSoundtrack };

if (require.main === module) {
  const [tlPath, out] = process.argv.slice(2);
  renderSoundtrack(JSON.parse(fs.readFileSync(tlPath, 'utf8')), out);
  console.log('wrote', out);
}
