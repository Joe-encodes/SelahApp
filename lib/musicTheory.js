export const NOTE_SEMITONES = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4,
  "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8,
  "A": 9, "A#": 10, "Bb": 10, "B": 11
};

export function noteToMidi(noteName, octave) {
  const semitone = NOTE_SEMITONES[noteName] ?? 0;
  return (octave + 1) * 12 + semitone;
}

export const CHORD_VOICINGS = {
  "C":   [["C", 3], ["E", 3], ["G", 3], ["C", 4], ["E", 4]],
  "C#":  [["C#", 3], ["F", 3], ["G#", 3], ["C#", 4]],
  "Db":  [["Db", 3], ["F", 3], ["Ab", 3], ["Db", 4]],
  "D":   [["D", 3], ["F#", 3], ["A", 3], ["D", 4], ["F#", 4]],
  "Eb":  [["Eb", 3], ["G", 3], ["Bb", 3], ["Eb", 4]],
  "E":   [["E", 3], ["G#", 3], ["B", 3], ["E", 4]],
  "F":   [["F", 3], ["A", 3], ["C", 4], ["F", 4]],
  "F#":  [["F#", 3], ["A#", 3], ["C#", 4], ["F#", 4]],
  "Gb":  [["Gb", 3], ["Bb", 3], ["Db", 4]],
  "G":   [["G", 3], ["B", 3], ["D", 4], ["G", 4], ["B", 4]],
  "Ab":  [["Ab", 3], ["C", 4], ["Eb", 4]],
  "A":   [["A", 3], ["C#", 4], ["E", 4], ["A", 4]],
  "Bb":  [["Bb", 3], ["D", 4], ["F", 4], ["Bb", 4]],
  "B":   [["B", 3], ["D#", 4], ["F#", 4], ["B", 4]],
  // Minor chords
  "Cm":  [["C", 3], ["Eb", 3], ["G", 3], ["C", 4]],
  "Dm":  [["D", 3], ["F", 3], ["A", 3], ["D", 4]],
  "Em":  [["E", 3], ["G", 3], ["B", 3], ["E", 4]],
  "Fm":  [["F", 3], ["Ab", 3], ["C", 4], ["F", 4]],
  "Gm":  [["G", 3], ["Bb", 3], ["D", 4], ["G", 4]],
  "Am":  [["A", 3], ["C", 4], ["E", 4], ["A", 4]],
  "Bm":  [["B", 3], ["D", 4], ["F#", 4], ["B", 4]],
  // 7th chords
  "G7":  [["G", 3], ["B", 3], ["D", 4], ["F", 4]],
  "C7":  [["C", 3], ["E", 3], ["G", 3], ["Bb", 3]],
  "F7":  [["F", 3], ["A", 3], ["C", 4], ["Eb", 4]],
  "Cmaj7": [["C", 3], ["E", 3], ["G", 3], ["B", 3]],
  "Gmaj7": [["G", 3], ["B", 3], ["D", 4], ["F#", 4]],
  "Fmaj7": [["F", 3], ["A", 3], ["C", 4], ["E", 4]],
  "Am7":   [["A", 3], ["C", 4], ["E", 4], ["G", 4]],
  "Em7":   [["E", 3], ["G", 3], ["B", 3], ["D", 4]],
  "Dm7":   [["D", 3], ["F", 3], ["A", 3], ["C", 4]],
};

export function getVoicing(chordName) {
  if (CHORD_VOICINGS[chordName]) {
    return CHORD_VOICINGS[chordName];
  }
  const base = chordName.replace(/[0-9]+$/, "");
  if (CHORD_VOICINGS[base]) {
    return CHORD_VOICINGS[base];
  }
  return CHORD_VOICINGS["C"];
}

export function voicingToMidiNotes(chordName) {
  return getVoicing(chordName).map(([name, oct]) => noteToMidi(name, oct));
}

export function getSatbForChord(chordName) {
  const voicing = getVoicing(chordName);
  const midiNotes = voicing.map(([n, o]) => noteToMidi(n, o)).sort((a, b) => a - b);

  const closestInRange = (notes, low, high) => {
    const inRange = notes.filter((n) => low <= n && n <= high);
    if (inRange.length > 0) {
      return inRange[Math.floor(inRange.length / 2)];
    }
    const target = Math.floor((low + high) / 2);
    let best = notes.reduce((prev, curr) => {
      const prevDiff = Math.abs((prev % 12) - (target % 12));
      const currDiff = Math.abs((curr % 12) - (target % 12));
      return currDiff < prevDiff ? curr : prev;
    }, notes[0]);

    while (best < low) best += 12;
    while (best > high) best -= 12;
    return best;
  };

  return {
    lead:    closestInRange(midiNotes, 60, 76),
    soprano: closestInRange(midiNotes, 65, 81),
    alto:    closestInRange(midiNotes, 57, 72),
    tenor:   closestInRange(midiNotes, 48, 67),
  };
}

export const NOTES_ORDER = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export function buildGospelProgression(root) {
  const idx = NOTES_ORDER.indexOf(root) !== -1 ? NOTES_ORDER.indexOf(root) : 0;
  const I   = NOTES_ORDER[idx];
  const IV  = NOTES_ORDER[(idx + 5) % 12];
  const V   = NOTES_ORDER[(idx + 7) % 12];
  const vi  = NOTES_ORDER[(idx + 9) % 12] + "m";
  return [I, IV, V, vi];
}

export function getBassNotesForChord(chordName) {
  const cleanName = chordName.replace(/m|0|1|2|3|4|5|6|7|8|9|maj/g, "");
  const baseNote = NOTE_SEMITONES[cleanName] ?? 0;
  const bassRoot = 36 + baseNote; // Bass C3 range

  const isMinor = chordName.includes("m") && !chordName.includes("maj");
  const third = bassRoot + (isMinor ? 3 : 4);
  const fifth = bassRoot + 7;

  return [
    [0.0,   bassRoot, 1.0],
    [1.0,   fifth,     0.75],
    [1.75,  bassRoot, 0.5],
    [2.5,   third,     0.75],
    [3.25,  bassRoot, 0.75],
  ];
}
