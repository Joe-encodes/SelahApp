import { voicingToMidiNotes, getBassNotesForChord } from "./musicTheory";

function writeVarLen(value) {
  let buffer = [];
  let bufferVal = value & 0x7f;
  let val = value >> 7;
  while (val > 0) {
    buffer.push(bufferVal | 0x80);
    bufferVal = val & 0x7f;
    val = val >> 7;
  }
  buffer.push(bufferVal);
  return buffer.reverse();
}

function buildTrackBuffer(events) {
  events.sort((a, b) => a.tick - b.tick);

  let trackData = [];
  let lastTick = 0;

  for (let ev of events) {
    let delta = ev.tick - lastTick;
    if (delta < 0) delta = 0;
    
    trackData.push(...writeVarLen(delta));
    trackData.push(ev.status);
    trackData.push(...ev.data);
    
    lastTick = ev.tick;
  }

  // End of track meta event
  trackData.push(0x00, 0xFF, 0x2F, 0x00);

  const chunkHeader = [0x4D, 0x54, 0x72, 0x6B]; // "MTrk"
  const len = trackData.length;
  const lengthBytes = [
    (len >> 24) & 0xff,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff
  ];

  return Buffer.concat([
    Buffer.from(chunkHeader),
    Buffer.from(lengthBytes),
    Buffer.from(trackData)
  ]);
}

export function generateGospelMidi({ chords, genre, bpm, barsPerChord = 1, lyrics = null }) {
  const TICKS_PER_BEAT = 480;
  const barDuration = 4.0 * barsPerChord; // beats

  // 1. Track 0: Meta Events + Organ
  const track0Events = [];
  
  // Set Tempo Meta Event (microseconds per beat)
  const tempoMicro = Math.round(60000000 / bpm);
  track0Events.push({
    tick: 0,
    status: 0xFF,
    data: [0x51, 0x03, (tempoMicro >> 16) & 0xff, (tempoMicro >> 8) & 0xff, tempoMicro & 0xff]
  });

  // Time Signature: 4/4
  track0Events.push({
    tick: 0,
    status: 0xFF,
    data: [0x58, 0x04, 0x04, 0x02, 0x18, 0x08]
  });

  // Program Change Organ (channel 0): C0 19 (GM Church Organ is 19)
  track0Events.push({
    tick: 0,
    status: 0xC0,
    data: [19]
  });

  // 2. Track 1: Bass
  const track1Events = [];
  // Program Change Bass (channel 1): C1 32 (GM Acoustic Bass is 32)
  track1Events.push({
    tick: 0,
    status: 0xC1,
    data: [32]
  });

  // 3. Track 2: Choir Pad
  const track2Events = [];
  // Program Change Choir Aahs (channel 2): C2 52 (GM Choir Aahs is 52)
  track2Events.push({
    tick: 0,
    status: 0xC2,
    data: [52]
  });

  // 4. Track 3: Percussion
  const track3Events = [];

  let currentBeat = 0.0;

  chords.forEach((chordName, chordIdx) => {
    let arrangement = null;
    if (lyrics && chordIdx < lyrics.length) {
      arrangement = lyrics[chordIdx].arrangement;
    }
    if (!arrangement) {
      arrangement = { dynamics: "mezzo", percussion: "full" };
    }

    const dynamics = arrangement.dynamics || "mezzo";
    const percStyle = arrangement.percussion || "full";
    const volScale = dynamics === "piano" ? 0.55 : dynamics === "mezzo" ? 0.82 : 1.1;

    let pianoVol = Math.round(70 * volScale);
    let bassVol = Math.round(80 * volScale);
    let choirVol = Math.round(65 * volScale);

    if (percStyle === "solo") {
      pianoVol = 0;
      bassVol = 0;
      choirVol = 0;
    }

    // --- Track 0: Organ/Piano chord voicing ---
    if (pianoVol > 0) {
      const pianoNotes = voicingToMidiNotes(chordName);
      pianoNotes.forEach((note) => {
        for (let bar = 0; bar < barsPerChord; bar++) {
          const beat = currentBeat + bar * 4.0;
          
          // Full chord on beat 1
          track0Events.push({
            tick: Math.round(beat * TICKS_PER_BEAT),
            status: 0x90, // Note On, channel 0
            data: [note, pianoVol]
          });
          track0Events.push({
            tick: Math.round((beat + 3.8) * TICKS_PER_BEAT),
            status: 0x80, // Note Off, channel 0
            data: [note, 0]
          });

          // Stab on beat 3
          track0Events.push({
            tick: Math.round((beat + 2.0) * TICKS_PER_BEAT),
            status: 0x90,
            data: [note, Math.round(pianoVol * 0.85)]
          });
          track0Events.push({
            tick: Math.round((beat + 2.9) * TICKS_PER_BEAT),
            status: 0x80,
            data: [note, 0]
          });
        }
      });
    }

    // --- Track 1: Walking Bass ---
    if (bassVol > 0) {
      const bassPattern = getBassNotesForChord(chordName);
      for (let bar = 0; bar < barsPerChord; bar++) {
        bassPattern.forEach(([offset, bassNote, dur]) => {
          const beat = currentBeat + bar * 4.0 + offset;
          track1Events.push({
            tick: Math.round(beat * TICKS_PER_BEAT),
            status: 0x91, // Note On, channel 1
            data: [bassNote, bassVol]
          });
          track1Events.push({
            tick: Math.round((beat + dur) * TICKS_PER_BEAT),
            status: 0x81, // Note Off, channel 1
            data: [bassNote, 0]
          });
        });
      }
    }

    // --- Track 2: Choir Pad ---
    if (choirVol > 0) {
      const tempPianoNotes = voicingToMidiNotes(chordName);
      const choirNotes = tempPianoNotes.slice(-2); // top 2 notes
      choirNotes.forEach((note) => {
        for (let bar = 0; bar < barsPerChord; bar++) {
          const beat = currentBeat + bar * 4.0;
          track2Events.push({
            tick: Math.round(beat * TICKS_PER_BEAT),
            status: 0x92, // Note On, channel 2
            data: [note, choirVol]
          });
          track2Events.push({
            tick: Math.round((beat + barDuration - 0.1) * TICKS_PER_BEAT),
            status: 0x82, // Note Off, channel 2
            data: [note, 0]
          });
        }
      });
    }

    // --- Track 3: Percussion ---
    if (percStyle !== "mute") {
      const isAfro = ["Afrobeats", "Amapiano", "Highlife"].includes(genre);
      const isChoral = genre === "Traditional Choral";

      const kickVol = Math.round(90 * volScale);
      const snareVol = Math.round(80 * volScale);
      const hihatVol = Math.round(55 * volScale);

      for (let bar = 0; bar < barsPerChord; bar++) {
        const b = currentBeat + bar * 4.0;
        const isFillBar = (chordIdx % 4 === 3);

        // Kick drum (note 36)
        if (percStyle === "light") {
          track3Events.push({ tick: Math.round(b * TICKS_PER_BEAT), status: 0x99, data: [36, kickVol] });
          track3Events.push({ tick: Math.round((b + 0.4) * TICKS_PER_BEAT), status: 0x89, data: [36, 0] });
        } else {
          const kickPattern = isAfro ? [0.0, 1.5, 2.0] : [0.0, 2.0];
          kickPattern.forEach((offset) => {
            track3Events.push({ tick: Math.round((b + offset) * TICKS_PER_BEAT), status: 0x99, data: [36, kickVol] });
            track3Events.push({ tick: Math.round((b + offset + 0.4) * TICKS_PER_BEAT), status: 0x89, data: [36, 0] });
          });
        }

        // Snare / Toms
        if (isFillBar && percStyle !== "light") {
          const pitch = ["Contemporary", "Traditional Choral"].includes(genre) ? 39 : 38;
          track3Events.push({ tick: Math.round((b + 1.0) * TICKS_PER_BEAT), status: 0x99, data: [pitch, snareVol] });
          track3Events.push({ tick: Math.round((b + 1.25) * TICKS_PER_BEAT), status: 0x89, data: [pitch, 0] });

          const fillNotes = [
            [2.0, 43], [2.25, 43],
            [2.5, 45], [2.75, 45],
            [3.0, 38], [3.25, 38],
            [3.5, 36], [3.75, 46]
          ];
          fillNotes.forEach(([offset, pNum]) => {
            track3Events.push({ tick: Math.round((b + offset) * TICKS_PER_BEAT), status: 0x99, data: [pNum, snareVol] });
            track3Events.push({ tick: Math.round((b + offset + 0.2) * TICKS_PER_BEAT), status: 0x89, data: [pNum, 0] });
          });
        } else {
          if (percStyle !== "light") {
            const snarePattern = [1.0, 3.0];
            snarePattern.forEach((offset) => {
              const pitch = ["Contemporary", "Traditional Choral"].includes(genre) ? 39 : 38;
              track3Events.push({ tick: Math.round((b + offset) * TICKS_PER_BEAT), status: 0x99, data: [pitch, snareVol] });
              track3Events.push({ tick: Math.round((b + offset + 0.25) * TICKS_PER_BEAT), status: 0x89, data: [pitch, 0] });
            });
          }
        }

        // Hi-Hat
        if (!isChoral && percStyle !== "solo") {
          const hihatLimit = percStyle === "light" ? 4 : 8;
          for (let eighth = 0; eighth < hihatLimit; eighth++) {
            const offset = eighth * (percStyle === "light" ? 1.0 : 0.5);
            if (isFillBar && offset >= 2.0) continue;

            const vol = hihatVol + (eighth % 2 === 0 ? 10 : 0);
            track3Events.push({ tick: Math.round((b + offset) * TICKS_PER_BEAT), status: 0x99, data: [42, vol] });
            track3Events.push({ tick: Math.round((b + offset + 0.2) * TICKS_PER_BEAT), status: 0x89, data: [42, 0] });
          }
        }

        // Log Drum (note 41)
        if (genre === "Amapiano" && percStyle !== "light") {
          [0.0, 2.0, 3.5].forEach((offset) => {
            track3Events.push({ tick: Math.round((b + offset) * TICKS_PER_BEAT), status: 0x99, data: [41, Math.round(75 * volScale)] });
            track3Events.push({ tick: Math.round((b + offset + 0.5) * TICKS_PER_BEAT), status: 0x89, data: [41, 0] });
          });
        }
      }
    }

    currentBeat += barDuration;
  });

  const mthdHeader = [
    0x4D, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x01,
    0x00, 0x04,
    0x01, 0xE0
  ];

  const t0 = buildTrackBuffer(track0Events);
  const t1 = buildTrackBuffer(track1Events);
  const t2 = buildTrackBuffer(track2Events);
  const t3 = buildTrackBuffer(track3Events);

  return Buffer.concat([
    Buffer.from(mthdHeader),
    t0,
    t1,
    t2,
    t3
  ]);
}
