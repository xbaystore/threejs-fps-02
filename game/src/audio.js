// Procedural sound: every effect is synthesised with WebAudio, so the game ships no audio
// files and makes no network request. The context is created lazily on the first user gesture
// (pointer lock), because browsers refuse audio before one.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const length = Math.floor(ctx.sampleRate * 1);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function noise(duration, filterFreq, gainValue, type = 'lowpass') {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(t);
    source.stop(t + duration + 0.05);
  }

  function tone(freq, duration, gainValue, type = 'sine', slideTo = null) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function click(delay, freq = 1800, gainValue = 0.12) {
    if (!ensure()) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  return {
    unlock() {
      ensure();
    },
    shot(kind) {
      // A crack (band-passed noise) over a low thump; rifles boom, pistols snap.
      if (kind === 'rifle') {
        noise(0.14, 2400, 0.55, 'bandpass');
        tone(120, 0.12, 0.35, 'sine', 45);
      } else if (kind === 'smg') {
        noise(0.09, 3200, 0.42, 'bandpass');
        tone(150, 0.08, 0.25, 'sine', 60);
      } else if (kind === 'dmr') {
        noise(0.22, 1800, 0.6, 'bandpass');
        tone(95, 0.2, 0.42, 'sine', 38);
      } else {
        noise(0.07, 4200, 0.38, 'bandpass');
        tone(190, 0.06, 0.2, 'sine', 80);
      }
    },
    distantShot() {
      noise(0.18, 900, 0.14, 'lowpass');
    },
    dryFire() {
      click(0, 2400, 0.1);
    },
    reload() {
      click(0, 1400, 0.12);
      click(0.28, 1100, 0.12);
      click(0.62, 1700, 0.14);
    },
    hit(killed) {
      tone(killed ? 1320 : 990, 0.07, 0.16, 'square');
      if (killed) tone(1760, 0.1, 0.12, 'square');
    },
    hurt() {
      tone(180, 0.16, 0.3, 'sawtooth', 90);
    },
    step() {
      noise(0.05, 500, 0.05, 'lowpass');
    },
    plantTick(final) {
      tone(final ? 1760 : 880, final ? 0.22 : 0.08, 0.18, 'square');
    },
    defuseTick() {
      tone(660, 0.08, 0.14, 'square');
    },
    explosion() {
      noise(1.1, 420, 0.9, 'lowpass');
      tone(70, 0.9, 0.6, 'sine', 28);
    },
    grenadePin() {
      click(0, 2000, 0.12);
    },
    roundWin() {
      tone(523, 0.16, 0.16, 'triangle');
      tone(659, 0.16, 0.16, 'triangle');
      tone(784, 0.3, 0.18, 'triangle');
    },
    roundLose() {
      tone(392, 0.2, 0.16, 'triangle');
      tone(311, 0.2, 0.16, 'triangle');
      tone(233, 0.4, 0.18, 'triangle');
    },
    buy() {
      tone(1046, 0.06, 0.14, 'square');
      tone(1318, 0.1, 0.12, 'square');
    },
  };
}
