import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Note Frequencies ────────────────────────────────────────────────────────
const NOTE_FREQ = {
  'C2': 65.41, 
  'G2': 98.00, 
  'A2': 110.00, 
  'Bb2': 116.54, 
  'B2': 123.47,
  'C3': 130.81, 
  'C#3': 138.59, 
  'Db3': 138.59,
  'D3': 146.83, 
  'Eb3': 155.56, 
  'E3': 164.81,
  'F3': 174.61, 
  'F#3': 185.00, 
  'G3': 196.00,
  'Ab3': 207.65, 
  'A3': 220.00, 
  'Bb3': 233.08, 
  'B3': 246.94,
  'C4': 261.63, 
  'C#4': 277.18, 
  'Db4': 277.18,
  'D4': 293.66, 
  'Eb4': 311.13, 
  'E4': 329.63,
  'F4': 349.23, 
  'F#4': 369.99, 
  'G4': 392.00,
  'Ab4': 415.30, 
  'A4': 440.00, 
  'Bb4': 466.16, 
  'B4': 493.88, 
  'G#4': 415.30,
  'C5': 523.25, 
  'D5': 587.33, 
  'E5': 659.25, 
  'G5': 783.99,
};

// ─── Chord → Note Mappings ───────────────────────────────────────────────────
const CHORD_NOTES = {
  // ── Major chords ──────────────────────────────────────────────────────────
  'C':   ['C3','G3','E4','G4','C5'],
  'C#':  ['C#3','Ab3','F4','Ab4'],   
  'Db':  ['C#3','Ab3','F4','Ab4'],
  'D':   ['D3','A3','F#4','A4','D5'],
  'D#':  ['Eb3','Bb3','G4','Bb4'],   
  'Eb':  ['Eb3','Bb3','G4','Bb4'],
  'E':   ['E3','B3','Ab4','B4'],
  'F':   ['F3','C4','A4','C5'],
  'F#':  ['F#3','C#4','Bb4'],        
  'Gb':  ['F#3','C#4','Bb4'],
  'G':   ['G3','D4','B4','G5'],
  'G#':  ['Ab3','Eb4','C5'],         
  'Ab':  ['Ab3','Eb4','C5'],
  'A':   ['A3','C#4','E4','A4'],
  'A#':  ['Bb3','F4','D4','Bb4'],    
  'Bb':  ['Bb3','F4','D4','Bb4'],
  'B':   ['B3','Eb4','F#4','B4'],
  // ── Minor chords ──────────────────────────────────────────────────────────
  'Cm':  ['C3','Eb3','G3','C4','Eb4'],
  'C#m': ['C#3','E3','Ab3','C#4'],   
  'Dbm': ['C#3','E3','Ab3','C#4'],
  'Dm':  ['D3','F3','A3','D4'],
  'D#m': ['Eb3','F#3','Bb3','Eb4'],  
  'Ebm': ['Eb3','F#3','Bb3','Eb4'],
  'Em':  ['E3','G3','B3','E4','G4'],
  'Fm':  ['F3','Ab3','C4','F4'],
  'F#m': ['F#3','A3','C#4','F#4'],   
  'Gbm': ['F#3','A3','C#4','F#4'],
  'Gm':  ['G3','Bb3','D4','G4'],
  'G#m': ['Ab3','B3','Eb4','Ab4'],   
  'Abm': ['Ab3','B3','Eb4','Ab4'],
  'Am':  ['A3','C4','E4','A4'],
  'A#m': ['Bb3','Db4','F4','Bb4'],   
  'Bbm': ['Bb3','Db4','F4','Bb4'],
  'Bm':  ['B3','D4','F#4','B4'],
  // ── 7th chord aliases (AI sometimes adds "7" suffix) ─────────────────────
  'C7':  ['C3','G3','E4','Bb4'],     
  'G7':  ['G3','D4','F4','B4'],
  'D7':  ['D3','A3','C4','F#4'],     
  'A7':  ['A3','C#4','G4','E4'],
  'E7':  ['E3','B3','D4','Ab4'],     
  'F7':  ['F3','C4','Eb4','A4'],
  'Cmaj7': ['C3','G3','B3','E4'],    
  'Gmaj7': ['G3','D4','F#4','B4'],
  'Fmaj7': ['F3','C4','E4','A4'],    
  'Amaj7': ['A3','C#4','G#4','E4'],
  'Dm7': ['D3','F3','C4','A4'],      
  'Em7': ['E3','G3','D4','B4'],
  'Am7': ['A3','C4','G4','E4'],      
  'Bm7': ['B3','D4','A4','F#4'],
};

// ─── Default BPM per genre ───────────────────────────────────────────────────
export const GENRE_BPM = {
  'Afrobeats':        100,
  'Amapiano':         116,
  'Highlife':          90,
  'Contemporary':      72,
  'Traditional Choral':60,
  'Call & Response':   76,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERCUSSION PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function kick(ctx, t, vol = 0.85, destNode = null) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.45);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  osc.connect(g); 
  g.connect(destNode || ctx.destination);
  osc.start(t); 
  osc.stop(t + 0.5);
}

function snare(ctx, t, vol = 0.45, destNode = null) {
  const targetDest = destNode || ctx.destination;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); 
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(g); 
  g.connect(targetDest); 
  src.start(t);
  
  const osc = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc.frequency.setValueAtTime(220, t);
  g2.gain.setValueAtTime(vol * 0.4, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(g2); 
  g2.connect(targetDest);
  osc.start(t); 
  osc.stop(t + 0.07);
}

function hihat(ctx, t, vol = 0.18, open = false, destNode = null) {
  const len = open ? 0.25 : 0.04;
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); 
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass'; 
  filt.frequency.value = 9000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(filt); 
  filt.connect(g); 
  g.connect(destNode || ctx.destination);
  src.start(t);
}

function logDrum(ctx, t, vol = 0.9, destNode = null) {
  const targetDest = destNode || ctx.destination;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(75, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.35);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g); 
  g.connect(targetDest);
  osc.start(t); 
  osc.stop(t + 0.45);
  
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); 
  src.buffer = buf;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(vol * 0.3, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(g2); 
  g2.connect(targetDest); 
  src.start(t);
}

function logTomRoll(ctx, t, spb, destNode = null, vol = 0.5) {
  const targetDest = destNode || ctx.destination;
  const steps = 4;
  const stepDur = spb * 0.5;
  for (let i = 0; i < steps; i++) {
    const hitTime = t + i * stepDur;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const startFreq = 150 - (i * 20);
    const endFreq = startFreq * 0.5;
    osc.frequency.setValueAtTime(startFreq, hitTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, hitTime + 0.15);
    g.gain.setValueAtTime(vol, hitTime);
    g.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.15);
    osc.connect(g);
    g.connect(targetDest);
    osc.start(hitTime);
    osc.stop(hitTime + 0.16);
  }
}

function clave(ctx, t, vol = 0.35, destNode = null) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2400, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.connect(g); 
  g.connect(destNode || ctx.destination);
  osc.start(t); 
  osc.stop(t + 0.05);
}

function bassNote(ctx, note, t, dur, vol = 0.25, destNode = null) {
  const freq = NOTE_FREQ[note];
  if (!freq) return;
  const targetDest = destNode || ctx.destination;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.05);
  g.gain.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(targetDest);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq * 0.5, t); // Drop one octave for deep sub-bass
  osc1.connect(g);

  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 0.5, t);
  const g2 = ctx.createGain();
  g2.gain.value = 0.15; // Triangle overtone for warm presence
  osc2.connect(g2);
  g2.connect(g);

  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + dur);
  osc2.stop(t + dur);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTRUMENT CHORD VOICES
// ═══════════════════════════════════════════════════════════════════════════════

function pianoChord(ctx, notes, t, dur, vol = 0.18, destNode = null) {
  notes.forEach((note, i) => {
    const freq = NOTE_FREQ[note]; 
    if (!freq) return;
    const targetDest = destNode || ctx.destination;
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t + i * 0.025);
    gainNode.gain.linearRampToValueAtTime(vol, t + i * 0.025 + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(vol * 0.4, t + i * 0.025 + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.025 + dur * 0.85);
    gainNode.connect(targetDest);
    
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    
    carrier.type = 'sine';
    modulator.type = 'sine';
    
    carrier.frequency.setValueAtTime(freq, t + i * 0.025);
    modulator.frequency.setValueAtTime(freq * 2.0, t + i * 0.025);
    
    modGain.gain.setValueAtTime(freq * 0.8, t + i * 0.025);
    modGain.gain.exponentialRampToValueAtTime(0.05, t + i * 0.025 + 0.15);
    
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(gainNode);
    
    modulator.start(t + i * 0.025);
    carrier.start(t + i * 0.025);
    modulator.stop(t + dur);
    carrier.stop(t + dur);
  });
}

function pianoStab(ctx, notes, t, vol = 0.2, destNode = null) {
  notes.forEach((note, i) => {
    const freq = NOTE_FREQ[note]; 
    if (!freq) return;
    const targetDest = destNode || ctx.destination;
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t + i * 0.02);
    gainNode.gain.linearRampToValueAtTime(vol, t + i * 0.02 + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.02 + 0.2);
    gainNode.connect(targetDest);
    
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    
    carrier.type = 'sine';
    modulator.type = 'sine';
    
    carrier.frequency.setValueAtTime(freq, t + i * 0.02);
    modulator.frequency.setValueAtTime(freq * 2.0, t + i * 0.02);
    modGain.gain.setValueAtTime(freq * 1.0, t + i * 0.02);
    modGain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.02 + 0.08);
    
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(gainNode);
    
    modulator.start(t + i * 0.02);
    carrier.start(t + i * 0.02);
    modulator.stop(t + 0.25);
    carrier.stop(t + 0.25);
  });
}

function guitarStrum(ctx, notes, t, dur, vol = 0.18, destNode = null) {
  notes.forEach((note, i) => {
    const freq = NOTE_FREQ[note]; 
    if (!freq) return;
    const targetDest = destNode || ctx.destination;
    
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + i * 0.028);
    g.gain.linearRampToValueAtTime(vol, t + i * 0.028 + 0.005);
    g.gain.exponentialRampToValueAtTime(vol * 0.4, t + i * 0.028 + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.028 + dur * 0.7);
    
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; 
    filt.frequency.value = 1800;
    
    filt.connect(g); 
    g.connect(targetDest);
    
    const osc = ctx.createOscillator(); 
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t + i * 0.028);
    
    osc.connect(filt); 
    osc.start(t + i * 0.028); 
    osc.stop(t + dur);
  });
}

function organChord(ctx, notes, t, dur, vol = 0.12, destNode = null) {
  const targetDest = destNode || ctx.destination;
  notes.forEach((note) => {
    const freq = NOTE_FREQ[note]; 
    if (!freq) return;
    [1, 2, 3, 4, 6].forEach((harmonic, hi) => {
      const hVol = vol / (hi + 1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(hVol, t + 0.08); 
      g.gain.setValueAtTime(hVol, t + dur - 0.1);
      g.gain.linearRampToValueAtTime(0, t + dur);
      g.connect(targetDest);
      
      const osc = ctx.createOscillator(); 
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * harmonic, t);
      
      osc.connect(g); 
      osc.start(t); 
      osc.stop(t + dur + 0.05);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENRE BAR SCHEDULERS
// ═══════════════════════════════════════════════════════════════════════════════

function scheduleAfrobeats(ctx, notes, t, spb, destinations, percStyle, isFillBar, volScale) {
  const { piano, percussion, bass } = destinations;

  if (percStyle !== "solo" && bass) {
    const rootNote = notes[0] || "C3";
    bassNote(ctx, rootNote, t, spb * 1.2, 0.24 * volScale, bass);
    bassNote(ctx, rootNote, t + spb * 1.5, spb * 0.8, 0.20 * volScale, bass);
    const fifthNote = notes[1] || rootNote;
    bassNote(ctx, fifthNote, t + spb * 2.5, spb * 1.2, 0.18 * volScale, bass);
  }

  if (percStyle === "mute") return;

  const kVol = 0.85 * volScale;
  const sVol = 0.45 * volScale;
  const hVol = 0.12 * volScale;

  if (percStyle === "light") {
    kick(ctx, t, kVol, percussion);
    for (let i = 0; i < 4; i++) {
      hihat(ctx, t + i * spb, hVol, false, percussion);
    }
  } else {
    kick(ctx, t, kVol, percussion);
    kick(ctx, t + spb * 1.5, kVol, percussion);
    kick(ctx, t + spb * 2, kVol, percussion);
    
    if (isFillBar) {
      snare(ctx, t + spb, sVol, percussion);
      logTomRoll(ctx, t + spb * 2, spb, percussion, sVol);
    } else {
      snare(ctx, t + spb, sVol, percussion);
      snare(ctx, t + spb * 3, sVol, percussion);
      for (let i = 0; i < 8; i++) {
        hihat(ctx, t + i * spb * 0.5, hVol + (i % 2 === 0 ? 0.04 : 0), false, percussion);
      }
      clave(ctx, t, 0.35 * volScale, percussion);
      clave(ctx, t + spb * 1.5, 0.35 * volScale, percussion);
      clave(ctx, t + spb * 2.5, 0.35 * volScale, percussion);
    }
  }
  
  if (percStyle !== "solo" && piano) {
    pianoStab(ctx, notes, t, 0.22 * volScale, piano);
    pianoStab(ctx, notes, t + spb * 2, 0.22 * volScale, piano);
  }
}

function scheduleAmapiano(ctx, notes, t, spb, destinations, percStyle, isFillBar, volScale) {
  const { piano, percussion, bass } = destinations;
  if (percStyle === "mute") return;

  const lVol = 0.9 * volScale;
  const sVol = 0.35 * volScale;
  const hVol = 0.1 * volScale;

  if (percStyle === "light") {
    logDrum(ctx, t, lVol, bass);
    for (let i = 0; i < 4; i++) {
      hihat(ctx, t + i * spb, hVol, false, percussion);
    }
  } else {
    logDrum(ctx, t, lVol, bass);
    logDrum(ctx, t + spb * 2, lVol, bass);
    
    if (isFillBar) {
      logTomRoll(ctx, t + spb * 2, spb, percussion, sVol);
    } else {
      for (let i = 0; i < 16; i++) {
        hihat(ctx, t + i * spb * 0.25, hVol + (i % 4 === 0 ? 0.08 : 0), false, percussion);
      }
      snare(ctx, t + spb * 2, sVol, percussion);
    }
  }

  if (percStyle !== "solo" && piano) {
    pianoChord(ctx, notes, t + spb, spb * 1.8, 0.16 * volScale, piano);
    pianoChord(ctx, notes, t + spb * 3, spb * 0.8, 0.16 * volScale, piano);
  }
}

function scheduleHighlife(ctx, notes, t, spb, destinations, percStyle, isFillBar, volScale) {
  const { piano, percussion, guitar, bass } = destinations;
  
  if (percStyle !== "solo" && bass) {
    const rootNote = notes[0] || "C3";
    bassNote(ctx, rootNote, t, spb * 0.8, 0.22 * volScale, bass);
    bassNote(ctx, rootNote, t + spb, spb * 0.8, 0.18 * volScale, bass);
    const fifthNote = notes[1] || rootNote;
    bassNote(ctx, fifthNote, t + spb * 2, spb * 0.8, 0.20 * volScale, bass);
    bassNote(ctx, fifthNote, t + spb * 3, spb * 0.8, 0.16 * volScale, bass);
  }

  if (percStyle !== "solo" && guitar) {
    guitarStrum(ctx, notes, t, spb, 0.18 * volScale, guitar);
    guitarStrum(ctx, notes, t + spb * 0.75, spb * 0.5, 0.10 * volScale, guitar);
    guitarStrum(ctx, notes, t + spb * 1.5, spb, 0.18 * volScale, guitar);
    guitarStrum(ctx, notes, t + spb * 2, spb, 0.14 * volScale, guitar);
    guitarStrum(ctx, notes, t + spb * 3, spb, 0.18 * volScale, guitar);
  }

  if (percStyle === "mute") return;

  const hVol = 0.1 * volScale;

  if (percStyle === "light") {
    clave(ctx, t, 0.25 * volScale, percussion);
    for (let i = 0; i < 4; i++) {
      hihat(ctx, t + i * spb, hVol, false, percussion);
    }
  } else {
    if (isFillBar) {
      logTomRoll(ctx, t + spb * 2, spb, percussion, 0.45 * volScale);
    } else {
      clave(ctx, t, 0.25 * volScale, percussion);
      clave(ctx, t + spb * 0.5, 0.18 * volScale, percussion);
      clave(ctx, t + spb * 1.5, 0.25 * volScale, percussion);
      clave(ctx, t + spb * 2.5, 0.18 * volScale, percussion);
      clave(ctx, t + spb * 3, 0.25 * volScale, percussion);
      for (let i = 0; i < 8; i++) {
        hihat(ctx, t + i * spb * 0.5, hVol, false, percussion);
      }
    }
  }
}

function scheduleContemporary(ctx, notes, t, spb, barDur, destinations, percStyle, isFillBar, volScale) {
  const { piano, percussion, bass, guitar } = destinations;
  
  if (percStyle !== "solo" && piano) {
    pianoChord(ctx, notes, t, barDur, 0.18 * volScale, piano);
  }

  if (percStyle !== "solo" && bass) {
    const rootNote = notes[0] || "C3";
    bassNote(ctx, rootNote, t, spb * 1.5, 0.22 * volScale, bass);
    const fifthNote = notes[1] || rootNote;
    bassNote(ctx, fifthNote, t + spb * 2, spb * 1.5, 0.18 * volScale, bass);
  }

  if (percStyle !== "solo" && guitar) {
    guitarStrum(ctx, notes, t + spb * 0.5, spb * 1.2, 0.12 * volScale, guitar);
    guitarStrum(ctx, notes, t + spb * 2.5, spb * 1.2, 0.10 * volScale, guitar);
  }
  
  if (percStyle === "mute") return;

  const kVol = 0.75 * volScale;
  const sVol = 0.35 * volScale;
  const hVol = 0.12 * volScale;
  
  if (isFillBar && percStyle !== "light") {
    kick(ctx, t, kVol, percussion);
    snare(ctx, t + spb, sVol, percussion);
    logTomRoll(ctx, t + spb * 2, spb, percussion, 0.4 * volScale);
  } else {
    kick(ctx, t, kVol, percussion);
    kick(ctx, t + spb * 2, kVol, percussion);
    snare(ctx, t + spb, sVol, percussion);
    snare(ctx, t + spb * 3, sVol, percussion);
    for (let b = 0; b < 4; b++) {
      hihat(ctx, t + b * spb, hVol, false, percussion);
    }
  }
}

function scheduleChoralOrgan(ctx, notes, t, spb, barDur, destinations, percStyle, volScale) {
  const { piano } = destinations;
  if (percStyle !== "solo" && piano) {
    organChord(ctx, notes, t, barDur, 0.13 * volScale, piano);
  }
}

function scheduleCallResponse(ctx, notes, t, spb, barDur, destinations, percStyle, isFillBar, volScale) {
  const { piano, percussion, bass } = destinations;
  
  if (percStyle !== "solo" && piano) {
    pianoChord(ctx, notes, t, spb * 1.5, 0.16 * volScale, piano);
    pianoChord(ctx, notes, t + spb * 2, spb * 1.5, 0.16 * volScale, piano);
  }

  if (percStyle !== "solo" && bass) {
    const rootNote = notes[0] || "C3";
    bassNote(ctx, rootNote, t, spb * 1.5, 0.22 * volScale, bass);
    bassNote(ctx, rootNote, t + spb * 2, spb * 1.5, 0.20 * volScale, bass);
  }
  
  if (percStyle === "mute") return;

  const kVol = 0.7 * volScale;
  const sVol = 0.3 * volScale;

  if (isFillBar && percStyle !== "light") {
    kick(ctx, t, kVol, percussion);
    snare(ctx, t + spb, sVol, percussion);
    logTomRoll(ctx, t + spb * 2, spb, percussion, 0.45 * volScale);
  } else {
    for (let b = 0; b < 4; b++) {
      clave(ctx, t + b * spb, 0.2 * volScale, percussion);
    }
    snare(ctx, t + spb * 2, 0.25 * volScale, percussion);
  }
}

function scheduleBar(ctx, chordName, t, bpm, genre, destinations, arrangement = null, chordIdx = 0) {
  const spb    = 60.0 / bpm;
  const barDur = spb * 4;
  const notes  = CHORD_NOTES[chordName] || CHORD_NOTES['C'];

  const arr = arrangement || { dynamics: "mezzo", percussion: "full" };
  const dynamics = arr.dynamics || "mezzo";
  const percStyle = arr.percussion || "full";
  
  const volScale = dynamics === "piano" ? 0.5 : dynamics === "mezzo" ? 0.85 : 1.15;
  const isFillBar = (chordIdx % 4 === 3);

  // Filter destinations if percussion solo is active
  const activeDests = { ...destinations };
  if (percStyle === "solo") {
    activeDests.piano = null;
    activeDests.bass = null;
    activeDests.guitar = null;
  }

  switch (genre) {
    case 'Afrobeats':          scheduleAfrobeats(ctx, notes, t, spb, activeDests, percStyle, isFillBar, volScale);               break;
    case 'Amapiano':           scheduleAmapiano(ctx, notes, t, spb, activeDests, percStyle, isFillBar, volScale);                break;
    case 'Highlife':           scheduleHighlife(ctx, notes, t, spb, activeDests, percStyle, isFillBar, volScale);                break;
    case 'Traditional Choral': scheduleChoralOrgan(ctx, notes, t, spb, barDur, activeDests, percStyle, volScale);                 break;
    case 'Call & Response':    scheduleCallResponse(ctx, notes, t, spb, barDur, activeDests, percStyle, isFillBar, volScale);    break;
    case 'Contemporary':
    default:                   scheduleContemporary(ctx, notes, t, spb, barDur, activeDests, percStyle, isFillBar, volScale);    break;
  }
  return barDur;
}

// ─── Reverb Impulse Response Generator ────────────────────────────────────────
function createReverbBuffer(ctx, duration = 1.5, decay = 2.0) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const percent = i / length;
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - percent, decay);
    }
  }
  return impulse;
}

// ─── Binary MIDI Encoding Helper ──────────────────────────────────────────────
function noteToMidiNumber(note) {
  const match = note.match(/^([A-G]#?|Bb|Db|Eb|Gb|Ab)([0-9])$/);
  if (!match) return 60;
  const noteName = match[1];
  const octave = parseInt(match[2]);
  const noteMap = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  return 12 * (octave + 1) + noteMap[noteName];
}

function getVLQ(value) {
  let val = value;
  const buffer = [];
  buffer.push(val & 0x7f);
  while (val > 0x7f) {
    val = val >> 7;
    buffer.unshift((val & 0x7f) | 0x80);
  }
  return buffer;
}

export function chordsToMidi(chords, bpm = 72) {
  const header = [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0];
  const trackEvents = [];
  const microSecs = Math.round(60000000 / bpm);
  trackEvents.push(0x00, 0xff, 0x51, 0x03, (microSecs >> 16) & 0xff, (microSecs >> 8) & 0xff, microSecs & 0xff);
  const ticksPerBar = 1920;
  chords.forEach((chordName) => {
    const noteNames = CHORD_NOTES[chordName] || CHORD_NOTES['C'];
    const midiNotes = noteNames.map(noteToMidiNumber);
    midiNotes.forEach((midiNum) => trackEvents.push(0x00, 0x90, midiNum, 0x60));
    midiNotes.forEach((midiNum, noteIdx) => {
      const deltaBytes = noteIdx === 0 ? getVLQ(ticksPerBar) : [0];
      trackEvents.push(...deltaBytes, 0x80, midiNum, 0x40);
    });
  });
  trackEvents.push(0x00, 0xff, 0x2f, 0x00);
  const trackHeader = [0x4d, 0x54, 0x72, 0x6b, (trackEvents.length >> 24) & 0xff, (trackEvents.length >> 16) & 0xff, (trackEvents.length >> 8) & 0xff, trackEvents.length & 0xff];
  return new Blob([new Uint8Array([...header, ...trackHeader, ...trackEvents])], { type: 'audio/midi' });
}

// ─── Offline Rendering ────────────────────────────────────────────────────────
export function renderWavBuffer(chords, genre, bpm) {
  const spb = 60.0 / bpm;
  const barDur = spb * 4;
  const totalDuration = barDur * (chords.length || 4);
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100 * totalDuration, 44100);
  const pianoGain = offlineCtx.createGain(), percussionGain = offlineCtx.createGain();
  const bassGain = offlineCtx.createGain(), guitarGain = offlineCtx.createGain();
  const reverb = offlineCtx.createConvolver();
  reverb.buffer = createReverbBuffer(offlineCtx);
  const dry = offlineCtx.createGain(), wet = offlineCtx.createGain();
  dry.gain.value = 0.85; wet.gain.value = 0.35;
  [pianoGain, guitarGain, bassGain].forEach(g => { g.connect(dry); g.connect(reverb); });
  percussionGain.connect(dry); reverb.connect(wet); dry.connect(offlineCtx.destination); wet.connect(offlineCtx.destination);
  let time = 0;
  chords.forEach(c => { scheduleBar(offlineCtx, c, time, bpm, genre, { piano: pianoGain, percussion: percussionGain, bass: bassGain, guitar: guitarGain }); time += barDur; });
  return offlineCtx.startRendering();
}

// Timbre profiles per voice type: [harmonics], [harmonic volumes]
const VOICE_TIMBRES = {
  soprano: { harmonics: [1, 2, 4],      vols: [1.0, 0.3, 0.08], vol: 0.22 },
  alto:    { harmonics: [1, 2, 3],      vols: [1.0, 0.4, 0.15], vol: 0.20 },
  tenor:   { harmonics: [1, 2, 3, 4],   vols: [1.0, 0.5, 0.2, 0.1], vol: 0.18 },
  lead:    { harmonics: [1, 2, 3, 5],   vols: [1.0, 0.6, 0.25, 0.05], vol: 0.24 },
};

/**
 * Splits a chord progression into Soprano, Alto, Tenor, and Lead voice parts.
 */
export function getSATBNotesForChords(chords) {
  const sopranoNotes = [];
  const altoNotes = [];
  const tenorNotes = [];
  const leadNotes = [];
  
  chords.forEach(chordName => {
    const notes = CHORD_NOTES[chordName] || CHORD_NOTES['C'];
    const sorted = [...notes].sort((a, b) => NOTE_FREQ[a] - NOTE_FREQ[b]);
    const len = sorted.length;
    
    if (len >= 4) {
      tenorNotes.push(sorted[1]);
      altoNotes.push(sorted[2]);
      sopranoNotes.push(sorted[3]);
      leadNotes.push(sorted[len - 1]);
    } else {
      tenorNotes.push(sorted[0] || "C3");
      altoNotes.push(sorted[Math.floor(len / 2)] || "E4");
      sopranoNotes.push(sorted[len - 1] || "G4");
      leadNotes.push(sorted[len - 1] || "C5");
    }
  });
  
  return { soprano: sopranoNotes, alto: altoNotes, tenor: tenorNotes, lead: leadNotes };
}

/**
 * Renders a single choir voice part from Groq-generated note arrays.
 * @param {string[][]} notesByChord  Array of note arrays, one per chord (e.g. [["G4","B4"],["E4","G4"]])
 * @param {string}     voiceType     "soprano" | "alto" | "tenor" | "lead"
 * @param {number}     bpm           Tempo in BPM
 * @returns {Promise<AudioBuffer>}
 */
// Formant maps for vowel morphing
const VOWEL_FORMANTS = {
  'a': { f1: 800, f2: 1200 },
  'e': { f1: 550, f2: 1800 },
  'i': { f1: 300, f2: 2200 },
  'o': { f1: 500, f2: 1000 },
  'u': { f1: 350, f2: 800 },
};

function parseVowelsFromText(text) {
  if (!text) return [{ f1: 700, f2: 1100 }];
  const clean = text.toLowerCase();
  const sequence = [];
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (VOWEL_FORMANTS[char]) {
      sequence.push(VOWEL_FORMANTS[char]);
    }
  }
  if (sequence.length === 0) return [{ f1: 700, f2: 1100 }];
  return sequence;
}

/**
 * Renders a single choir voice part from Groq-generated note arrays.
 * @param {string[][]} notesByChord  Array of note arrays, one per chord (e.g. [["G4","B4"],["E4","G4"]])
 * @param {string}     voiceType     "soprano" | "alto" | "tenor" | "lead"
 * @param {number}     bpm           Tempo in BPM
 * @param {string[]}   [lyricsPerChord] Lyrics line associated with each chord bar
 * @returns {Promise<AudioBuffer>}
 */
export function renderVoiceStemWav(notesByChord, voiceType, bpm, lyricsPerChord = null) {
  const spb        = 60.0 / bpm;
  const barDur     = spb * 4;
  const noteDur    = barDur * 0.92; // slight legato gap
  const totalDur   = barDur * (notesByChord.length || 1);
  const sampleRate = 44100;

  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    2, Math.ceil(sampleRate * totalDur), sampleRate
  );

  const reverb = offlineCtx.createConvolver();
  reverb.buffer = createReverbBuffer(offlineCtx, 2.2, 2.5);
  const dry = offlineCtx.createGain();
  const wet = offlineCtx.createGain();
  dry.gain.value = 0.75;
  wet.gain.value = 0.45;
  dry.connect(offlineCtx.destination);
  reverb.connect(wet);
  wet.connect(offlineCtx.destination);

  const timbre = VOICE_TIMBRES[voiceType] || VOICE_TIMBRES.lead;

  notesByChord.forEach((notes, chordIdx) => {
    const startTime = chordIdx * barDur;
    const lyricsLine = (lyricsPerChord && chordIdx < lyricsPerChord.length) ? lyricsPerChord[chordIdx] : null;
    const vowels = parseVowelsFromText(lyricsLine);

    (notes || []).forEach((noteName) => {
      const freq = NOTE_FREQ[noteName];
      if (!freq) return;

      const noteGain = offlineCtx.createGain();
      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(timbre.vol, startTime + 0.15);
      noteGain.gain.setValueAtTime(timbre.vol * 0.85, startTime + noteDur * 0.6);
      noteGain.gain.linearRampToValueAtTime(0, startTime + noteDur);

      const filter1 = offlineCtx.createBiquadFilter();
      filter1.type = 'bandpass';
      filter1.Q.setValueAtTime(3.5, startTime);

      const filter2 = offlineCtx.createBiquadFilter();
      filter2.type = 'bandpass';
      filter2.Q.setValueAtTime(3.5, startTime);

      // Automate formant morphing over time according to lyric vowel structure
      const vowelDur = noteDur / vowels.length;
      vowels.forEach((vow, vi) => {
        const vowTime = startTime + vi * vowelDur;
        if (vi === 0) {
          filter1.frequency.setValueAtTime(vow.f1, vowTime);
          filter2.frequency.setValueAtTime(vow.f2, vowTime);
        } else {
          filter1.frequency.linearRampToValueAtTime(vow.f1, vowTime);
          filter2.frequency.linearRampToValueAtTime(vow.f2, vowTime);
        }
      });
      // Add final ramp to end of note
      filter1.frequency.linearRampToValueAtTime(vowels[vowels.length - 1].f1, startTime + noteDur);
      filter2.frequency.linearRampToValueAtTime(vowels[vowels.length - 1].f2, startTime + noteDur);

      filter1.connect(dry);
      filter1.connect(reverb);
      filter2.connect(dry);
      filter2.connect(reverb);

      const vibratoLfo = offlineCtx.createOscillator();
      vibratoLfo.frequency.setValueAtTime(5.5, startTime);
      vibratoLfo.type = 'sine';

      const detunes = [-12, 0, 12];
      detunes.forEach((detuneVal) => {
        timbre.harmonics.forEach((harmonic, hi) => {
          const osc = offlineCtx.createOscillator();
          const hGain = offlineCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * harmonic, startTime);
          osc.detune.setValueAtTime(detuneVal, startTime);

          const vibratoGain = offlineCtx.createGain();
          vibratoGain.gain.setValueAtTime(freq * harmonic * 0.007, startTime);
          
          vibratoLfo.connect(vibratoGain);
          vibratoGain.connect(osc.frequency);

          hGain.gain.value = (timbre.vols[hi] ?? 0.05) / 3.0;
          osc.connect(hGain);
          
          hGain.connect(filter1);
          hGain.connect(filter2);

          osc.start(startTime);
          osc.stop(startTime + noteDur + 0.05);
        });
      });

      vibratoLfo.start(startTime);
      vibratoLfo.stop(startTime + noteDur + 0.05);
    });
  });

  return offlineCtx.startRendering();
}

export function bufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels, sampleRate = buffer.sampleRate, bitDepth = 16;
  const result = numOfChan === 2 ? interleave(buffer.getChannelData(0), buffer.getChannelData(1)) : buffer.getChannelData(0);
  const bufferLength = result.length * 2, arrayBuffer = new ArrayBuffer(44 + bufferLength), view = new DataView(arrayBuffer);
  writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + bufferLength, true); writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numOfChan, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * 2, true); view.setUint16(32, numOfChan * 2, true); view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data'); view.setUint32(40, bufferLength, true); floatTo16BitPCM(view, 44, result);
  return new Blob([view], { type: 'audio/wav' });
}

function interleave(L, R) { const res = new Float32Array(L.length + R.length); for(let i=0; i<L.length; i++) { res[i*2] = L[i]; res[i*2+1] = R[i]; } return res; }
function floatTo16BitPCM(out, off, inp) { for (let i = 0; i < inp.length; i++, off += 2) { let s = Math.max(-1, Math.min(1, inp[i])); out.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); } }
function writeString(v, o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }

// ─── Main React Hook ─────────────────────────────────────────────────────────
// ─── Main React Hook ─────────────────────────────────────────────────────────
export function useGospelAudio(chords = [], genre = 'Contemporary', lyrics = []) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChordIdx, setCurrentChordIdx] = useState(0);
  const [bpm, setBpmState] = useState(GENRE_BPM[genre] || 72);
  const [volumes, setVolumesState] = useState({ piano: 0.8, percussion: 0.8, bass: 0.8, guitar: 0.8 });
  
  const ctxRef = useRef(null), schedulerRef = useRef(null), nextTimeRef = useRef(0), chordIdxRef = useRef(0);
  const isPlayingRef = useRef(false), bpmRef = useRef(GENRE_BPM[genre] || 72), chordsRef = useRef(chords), genreRef = useRef(genre);
  const pianoGainRef = useRef(null), percussionGainRef = useRef(null), bassGainRef = useRef(null), guitarGainRef = useRef(null);

  // Precompute flat arrangements list and store in ref
  const arrangementsRef = useRef([]);
  useEffect(() => {
    const arrs = [];
    (lyrics || []).forEach(l => {
      const chordsList = l.chords || [];
      chordsList.forEach(() => {
        arrs.push(l.arrangement || { dynamics: "mezzo", percussion: "full" });
      });
    });
    arrangementsRef.current = arrs;
  }, [lyrics]);

  useEffect(() => { chordsRef.current = chords; }, [chords]);
  useEffect(() => { genreRef.current = genre; bpmRef.current = GENRE_BPM[genre] || 72; setBpmState(bpmRef.current); }, [genre]);

  const setBpm = (val) => { bpmRef.current = val; setBpmState(val); };
  const setVolume = (inst, val) => {
    setVolumesState(p => ({ ...p, [inst]: val }));
    const ref = { piano: pianoGainRef, percussion: percussionGainRef, bass: bassGainRef, guitar: guitarGainRef }[inst];
    if (ref?.current) ref.current.gain.value = val;
  };

  const getCtx = () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    if (!pianoGainRef.current) {
      const c = ctxRef.current;
      pianoGainRef.current = c.createGain(); percussionGainRef.current = c.createGain(); bassGainRef.current = c.createGain(); guitarGainRef.current = c.createGain();
      const r = c.createConvolver(); r.buffer = createReverbBuffer(c);
      const d = c.createGain(), w = c.createGain(); d.gain.value = 0.85; w.gain.value = 0.35;
      [pianoGainRef, guitarGainRef, bassGainRef].forEach(g => { g.current.connect(d); g.current.connect(r); });
      percussionGainRef.current.connect(d); r.connect(w); d.connect(c.destination); w.connect(c.destination);
    }
    return ctxRef.current;
  };

  const runScheduler = useCallback(() => {
    if (!isPlayingRef.current) return;
    const ctx = ctxRef.current;
    const destinations = {
      piano: pianoGainRef.current,
      percussion: percussionGainRef.current,
      bass: bassGainRef.current,
      guitar: guitarGainRef.current
    };
    while (nextTimeRef.current < ctx.currentTime + 0.35) {
      const idx  = chordIdxRef.current;
      const time = nextTimeRef.current;
      
      const arrangement = arrangementsRef.current[idx % (arrangementsRef.current.length || 1)] || { dynamics: "mezzo", percussion: "full" };

      const dur  = scheduleBar(
        ctx, 
        chordsRef.current[idx % (chordsRef.current.length || 1)], 
        time, 
        bpmRef.current, 
        genreRef.current,
        destinations,
        arrangement,
        idx
      );
      const delay = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (isPlayingRef.current) setCurrentChordIdx(idx % (chordsRef.current.length || 1));
      }, delay);
      chordIdxRef.current = (idx + 1) % (chordsRef.current.length || 1);
      nextTimeRef.current += dur;
    }
    schedulerRef.current = setTimeout(runScheduler, 60);
  }, []);

  const play = useCallback(() => {
    const ctx = getCtx();
    isPlayingRef.current = true;
    nextTimeRef.current  = ctx.currentTime + 0.05;
    setIsPlaying(true);
    runScheduler();
  }, [runScheduler]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    clearTimeout(schedulerRef.current);
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    clearTimeout(schedulerRef.current);
    chordIdxRef.current  = 0;
    nextTimeRef.current  = 0;
    setIsPlaying(false);
    setCurrentChordIdx(0);
  }, []);

  useEffect(() => () => {
    clearTimeout(schedulerRef.current);
    isPlayingRef.current = false;
  }, []);

  const exportWav = async () => {
    if (chordsRef.current.length === 0) return;
    try {
      const buffer = await renderWavBuffer(chordsRef.current, genreRef.current, bpmRef.current, arrangementsRef.current);
      const blob = bufferToWav(buffer);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Selah_${genreRef.current}_Backing.wav`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("WAV Export Error:", e);
    }
  };

  const exportMidi = () => {
    if (chordsRef.current.length === 0) return;
    try {
      const blob = chordsToMidi(chordsRef.current, bpmRef.current);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Selah_${genreRef.current}_Chords.mid`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("MIDI Export Error:", e);
    }
  };

  return { 
    isPlaying, 
    currentChordIdx, 
    bpm, 
    setBpm, 
    play, 
    pause, 
    stop,
    volumes,
    setVolume,
    exportWav,
    exportMidi
  };
}
