# music_theory.py
# Self-contained gospel music theory module for SelahAI backend.
# Handles: chord voicing, SATB note assignment, bass line patterns, MIDI note numbers.
# Runs entirely on CPU. No GPU or external API dependency.

from typing import List, Dict, Tuple

# ─── Chromatic note → semitone offset (relative to C = 0) ─────────────────────
NOTE_SEMITONES: Dict[str, int] = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4,
    "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8,
    "A": 9, "A#": 10, "Bb": 10, "B": 11
}

# MIDI note number = (octave + 1) * 12 + semitone
def note_to_midi(note_name: str, octave: int) -> int:
    semitone = NOTE_SEMITONES.get(note_name, 0)
    return (octave + 1) * 12 + semitone

# ─── Chord voicings: 5-note close-position voicings for gospel piano ──────────
# Format: list of (note_name, octave) tuples
CHORD_VOICINGS: Dict[str, List[Tuple[str, int]]] = {
    "C":   [("C", 3), ("E", 3), ("G", 3), ("C", 4), ("E", 4)],
    "C#":  [("C#", 3), ("F", 3), ("G#", 3), ("C#", 4)],
    "Db":  [("Db", 3), ("F", 3), ("Ab", 3), ("Db", 4)],
    "D":   [("D", 3), ("F#", 3), ("A", 3), ("D", 4), ("F#", 4)],
    "Eb":  [("Eb", 3), ("G", 3), ("Bb", 3), ("Eb", 4)],
    "E":   [("E", 3), ("G#", 3), ("B", 3), ("E", 4)],
    "F":   [("F", 3), ("A", 3), ("C", 4), ("F", 4)],
    "F#":  [("F#", 3), ("A#", 3), ("C#", 4), ("F#", 4)],
    "Gb":  [("Gb", 3), ("Bb", 3), ("Db", 4)],
    "G":   [("G", 3), ("B", 3), ("D", 4), ("G", 4), ("B", 4)],
    "Ab":  [("Ab", 3), ("C", 4), ("Eb", 4)],
    "A":   [("A", 3), ("C#", 4), ("E", 4), ("A", 4)],
    "Bb":  [("Bb", 3), ("D", 4), ("F", 4), ("Bb", 4)],
    "B":   [("B", 3), ("D#", 4), ("F#", 4), ("B", 4)],
    # Minor chords
    "Cm":  [("C", 3), ("Eb", 3), ("G", 3), ("C", 4)],
    "Dm":  [("D", 3), ("F", 3), ("A", 3), ("D", 4)],
    "Em":  [("E", 3), ("G", 3), ("B", 3), ("E", 4)],
    "Fm":  [("F", 3), ("Ab", 3), ("C", 4), ("F", 4)],
    "Gm":  [("G", 3), ("Bb", 3), ("D", 4), ("G", 4)],
    "Am":  [("A", 3), ("C", 4), ("E", 4), ("A", 4)],
    "Bm":  [("B", 3), ("D", 4), ("F#", 4), ("B", 4)],
    # 7th chords (common in gospel)
    "G7":  [("G", 3), ("B", 3), ("D", 4), ("F", 4)],
    "C7":  [("C", 3), ("E", 3), ("G", 3), ("Bb", 3)],
    "F7":  [("F", 3), ("A", 3), ("C", 4), ("Eb", 4)],
    "Cmaj7": [("C", 3), ("E", 3), ("G", 3), ("B", 3)],
    "Gmaj7": [("G", 3), ("B", 3), ("D", 4), ("F#", 4)],
    "Fmaj7": [("F", 3), ("A", 3), ("C", 4), ("E", 4)],
    "Am7":   [("A", 3), ("C", 4), ("E", 4), ("G", 4)],
    "Em7":   [("E", 3), ("G", 3), ("B", 3), ("D", 4)],
    "Dm7":   [("D", 3), ("F", 3), ("A", 3), ("C", 4)],
}

def get_voicing(chord_name: str) -> List[Tuple[str, int]]:
    """Returns the note list for a chord name, falling back gracefully."""
    # Try exact match first
    if chord_name in CHORD_VOICINGS:
        return CHORD_VOICINGS[chord_name]
    # Try stripping trailing digits (e.g. "G7" → try "G" if not found above)
    base = chord_name.rstrip("0123456789")
    if base in CHORD_VOICINGS:
        return CHORD_VOICINGS[base]
    # Default to C major
    return CHORD_VOICINGS["C"]

def voicing_to_midi_notes(chord_name: str) -> List[int]:
    """Returns list of MIDI note numbers for a chord."""
    return [note_to_midi(name, oct) for name, oct in get_voicing(chord_name)]

# ─── SATB Voice Assignment ─────────────────────────────────────────────────────
# Given a chord, assign the most appropriate note to each choir voice.
# Ranges (MIDI): Bass 36-60, Tenor 48-72, Alto 55-79, Soprano 60-84

def get_satb_for_chord(chord_name: str) -> Dict[str, int]:
    """
    Assigns MIDI notes to each choir voice (Soprano, Alto, Tenor, Lead/Bass)
    from the chord's full voicing, selecting the best note per voice range.
    """
    voicing = get_voicing(chord_name)
    midi_notes = sorted([note_to_midi(n, o) for n, o in voicing])

    def closest_in_range(notes: List[int], low: int, high: int) -> int:
        """Pick the note in [low, high]; if none, return the closest."""
        in_range = [n for n in notes if low <= n <= high]
        if in_range:
            return in_range[len(in_range) // 2]  # middle of range notes
        # Fallback: pick nearest note, transposing by octave if needed
        target = (low + high) // 2
        best = min(notes, key=lambda n: abs((n % 12) - (target % 12)))
        # Shift to target octave
        while best < low:
            best += 12
        while best > high:
            best -= 12
        return best

    return {
        "lead":    closest_in_range(midi_notes, 60, 76),   # Tenor melody range
        "soprano": closest_in_range(midi_notes, 65, 81),   # High female
        "alto":    closest_in_range(midi_notes, 57, 72),   # Mid female
        "tenor":   closest_in_range(midi_notes, 48, 67),   # High male
    }

# ─── Gospel Chord Progressions ────────────────────────────────────────────────
NOTES_ORDER = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

def build_gospel_progression(root: str) -> List[str]:
    """Builds the classic gospel I-IV-V-vi (or I-IV-I-V) progression in the given key."""
    idx = NOTES_ORDER.index(root) if root in NOTES_ORDER else 0
    I   = NOTES_ORDER[idx]
    IV  = NOTES_ORDER[(idx + 5) % 12]
    V   = NOTES_ORDER[(idx + 7) % 12]
    vi  = NOTES_ORDER[(idx + 9) % 12] + "m"
    return [I, IV, V, vi]

# ─── Bass Line Generator ───────────────────────────────────────────────────────
def get_bass_notes_for_chord(chord_name: str, bpm: int) -> List[Tuple[float, int, float]]:
    """
    Returns a list of (time_offset_beats, midi_note, duration_beats) for a walking gospel bass line.
    One bar of bass motion per chord.
    """
    base_note = NOTE_SEMITONES.get(chord_name.rstrip("m0123456789maj"), 0)
    bass_root = 36 + base_note  # Bass C3 range

    # For minor chords, flatten the 3rd for walking bass
    is_minor = "m" in chord_name and "maj" not in chord_name
    third = bass_root + (3 if is_minor else 4)
    fifth = bass_root + 7

    # Gospel walking bass pattern: root → 5th → root → 3rd (syncopated)
    return [
        (0.0,   bass_root, 1.0),
        (1.0,   fifth,     0.75),
        (1.75,  bass_root, 0.5),
        (2.5,   third,     0.75),
        (3.25,  bass_root, 0.75),
    ]

# ─── Genre Rhythm Configurations ──────────────────────────────────────────────
GENRE_BPM_DEFAULTS = {
    "Afrobeats":        100,
    "Amapiano":         116,
    "Highlife":          90,
    "Contemporary":      72,
    "Traditional Choral": 60,
    "Call & Response":   76,
}

def get_bpm_for_genre(genre: str) -> int:
    return GENRE_BPM_DEFAULTS.get(genre, 72)


if __name__ == "__main__":
    # Quick sanity check
    chords = build_gospel_progression("G")
    print("Gospel progression in G:", chords)
    for chord in chords:
        midi = voicing_to_midi_notes(chord)
        satb = get_satb_for_chord(chord)
        print(f"  {chord}: MIDI={midi}, SATB={satb}")
