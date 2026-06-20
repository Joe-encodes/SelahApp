# midi_generator.py
# Generates MIDI files for the SelahAI gospel backing track.
# Uses MIDIUtil for symbolic MIDI writing — 100% CPU, no GPU required.
# Output: Standard MIDI file (.mid) with piano, bass, and percussion tracks.
# The FE can download this directly, or pass to FluidSynth to render to WAV.

import os
from midiutil import MIDIFile
from typing import List, Dict, Tuple
from music_theory import (
    voicing_to_midi_notes,
    get_bass_notes_for_chord,
    get_bpm_for_genre,
)

# ─── MIDI Channel / Instrument Assignments (General MIDI) ─────────────────────
CHANNEL_PIANO       = 0   # Piano
CHANNEL_BASS        = 1   # Electric Bass (Finger) = program 33
CHANNEL_CHOIR       = 2   # Choir Aahs = program 53
CHANNEL_PERCUSSION  = 9   # Drums (channel 9 is always percussion in MIDI)

GM_PIANO       = 0   # Grand Piano
GM_ORGAN       = 19  # Church Organ
GM_BASS        = 32  # Acoustic Bass
GM_CHOIR       = 52  # Choir Aahs
GM_PAD         = 88  # Pad 1 (new age)

# ─── Gospel MIDI Generator ────────────────────────────────────────────────────

def generate_gospel_midi(
    chords: List[str],
    genre: str,
    bpm: int,
    bars_per_chord: int = 1,
    output_path: str = "backing.mid",
    lyrics: List[dict] = None,
) -> str:
    """
    Generates a multi-track gospel MIDI file.
    Tracks:
      0 — Piano chord voicings
      1 — Walking bass line
      2 — Gospel choir pad (Choir Aahs)
      3 — Percussion (kick + snare pattern)

    Each chord gets `bars_per_chord` bars (4/4 time).
    Returns the path to the saved .mid file.
    """
    num_tracks = 4
    midi = MIDIFile(num_tracks, ticks_per_quarternote=480)
    midi.addTempo(track=0, time=0, tempo=bpm)

    # Set General MIDI instruments per track
    midi.addProgramChange(0, CHANNEL_PIANO, 0, GM_ORGAN)
    midi.addProgramChange(1, CHANNEL_BASS,  0, GM_BASS)
    midi.addProgramChange(2, CHANNEL_CHOIR, 0, GM_CHOIR)

    current_beat = 0.0
    bar_duration = 4.0 * bars_per_chord  # beats

    for chord_idx, chord_name in enumerate(chords):
        # Retrieve arrangement metadata for this chord/bar if available
        arrangement = None
        if lyrics and chord_idx < len(lyrics):
            arrangement = lyrics[chord_idx].get("arrangement")
        
        # Default arrangement if none
        if not arrangement:
            arrangement = {"dynamics": "mezzo", "percussion": "full"}
            
        dynamics = arrangement.get("dynamics", "mezzo")
        perc_style = arrangement.get("percussion", "full")
        
        # Determine track volumes based on dynamics
        vol_scale = 0.55 if dynamics == "piano" else 0.82 if dynamics == "mezzo" else 1.1
        
        piano_vol = int(70 * vol_scale)
        bass_vol = int(80 * vol_scale)
        choir_vol = int(65 * vol_scale)
        
        # Mute piano/bass if percussion solo
        if perc_style == "solo":
            piano_vol = 0
            bass_vol = 0
            choir_vol = 0

        # ── Track 0: Piano / Organ chord voicing ──────────────────────────────
        if piano_vol > 0:
            piano_notes = voicing_to_midi_notes(chord_name)
            for note in piano_notes:
                for bar in range(bars_per_chord):
                    # Full chord on beat 1 of each bar
                    beat = current_beat + bar * 4.0
                    midi.addNote(
                        track=0, channel=CHANNEL_PIANO,
                        pitch=note, time=beat, duration=3.8,
                        volume=piano_vol
                    )
                    # Stab on beat 3 (gospel typical)
                    midi.addNote(
                        track=0, channel=CHANNEL_PIANO,
                        pitch=note, time=beat + 2.0, duration=0.9,
                        volume=int(piano_vol * 0.85)
                    )

        # ── Track 1: Walking bass line ─────────────────────────────────────────
        if bass_vol > 0:
            bass_pattern = get_bass_notes_for_chord(chord_name, bpm)
            for bar in range(bars_per_chord):
                for (offset, bass_note, dur) in bass_pattern:
                    beat = current_beat + bar * 4.0 + offset
                    midi.addNote(
                        track=1, channel=CHANNEL_BASS,
                        pitch=bass_note, time=beat, duration=dur,
                        volume=bass_vol
                    )

        # ── Track 2: Choir Pad ─────────────────────────────────────────────────
        if choir_vol > 0:
            # Recreate piano_notes logic locally to avoid naming errors
            temp_piano_notes = voicing_to_midi_notes(chord_name)
            choir_notes = temp_piano_notes[-2:]  # Top two notes of the voicing = soprano + alto
            for note in choir_notes:
                for bar in range(bars_per_chord):
                    beat = current_beat + bar * 4.0
                    midi.addNote(
                        track=2, channel=CHANNEL_CHOIR,
                        pitch=note, time=beat, duration=bar_duration - 0.1,
                        volume=choir_vol
                    )

        # ── Track 3: Percussion ────────────────────────────────────────────────
        _add_percussion_pattern(midi, current_beat, bars_per_chord, genre, perc_style, chord_idx, vol_scale)

        current_beat += bar_duration

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "wb") as f:
        midi.writeFile(f)

    return output_path


def _add_percussion_pattern(
    midi: MIDIFile,
    start_beat: float,
    bars: int,
    genre: str,
    perc_style: str,
    chord_idx: int,
    vol_scale: float,
):
    """
    Writes drum notes to track 3, channel 9 (MIDI percussion).
    GM percussion note numbers:
      36 = Bass Drum 1 (kick)
      38 = Acoustic Snare
      42 = Closed Hi-Hat
      46 = Open Hi-Hat
      39 = Hand Clap (common in gospel)
      43 = Low Tom (for drum fills)
      45 = Mid Tom (for drum fills)
    """
    if perc_style == "mute":
        return

    is_afro     = genre in ("Afrobeats", "Amapiano", "Highlife")
    is_choral   = genre in ("Traditional Choral",)
    
    # Volume levels scaled by section dynamics
    kick_vol = int(90 * vol_scale)
    snare_vol = int(80 * vol_scale)
    hihat_vol = int(55 * vol_scale)

    for bar in range(bars):
        b = start_beat + bar * 4.0
        
        # Check if this is a section boundary bar (last bar of a 4-bar cycle) to inject a drum fill
        is_fill_bar = (chord_idx % 4 == 3)
        
        # Kick drum
        if perc_style == "light":
            midi.addNote(track=3, channel=CHANNEL_PERCUSSION, pitch=36, time=b, duration=0.4, volume=kick_vol)
        else:
            kick_pattern = [0.0, 1.5, 2.0] if is_afro else [0.0, 2.0]
            for beat_offset in kick_pattern:
                midi.addNote(track=3, channel=CHANNEL_PERCUSSION, pitch=36,
                             time=b + beat_offset, duration=0.4, volume=kick_vol)

        # Snare / Hand Clap / Toms (drum fill override)
        if is_fill_bar and perc_style != "light":
            # Snare beat 2
            pitch = 39 if genre in ("Contemporary", "Traditional Choral") else 38
            midi.addNote(track=3, channel=CHANNEL_PERCUSSION, pitch=pitch, time=b + 1.0, duration=0.25, volume=snare_vol)
            
            # Fill on beats 3 and 4: low and mid tom rolls
            fill_notes = [
                (2.0, 43), (2.25, 43),
                (2.5, 45), (2.75, 45),
                (3.0, 38), (3.25, 38),
                (3.5, 36), (3.75, 46)  # Kick + Open Hat accent at end of fill
            ]
            for beat_offset, pitch_num in fill_notes:
                midi.addNote(track=3, channel=CHANNEL_PERCUSSION, pitch=pitch_num,
                             time=b + beat_offset, duration=0.2, volume=snare_vol)
        else:
            if perc_style != "light":
                snare_pattern = [1.0, 3.0]
                for beat_offset in snare_pattern:
                    pitch = 39 if genre in ("Contemporary", "Traditional Choral") else 38
                    midi.addNote(track=3, channel=CHANNEL_PERCUSSION, pitch=pitch,
                                 time=b + beat_offset, duration=0.25, volume=snare_vol)

        # Hi-Hat 8ths (skip for choral or during tom solos)
        if not is_choral and perc_style != "solo":
            hihat_limit = 4 if perc_style == "light" else 8
            for eighth in range(hihat_limit):
                beat_offset = eighth * (1.0 if perc_style == "light" else 0.5)
                # Don't play hi-hats during the fill on beats 3 & 4
                if is_fill_bar and beat_offset >= 2.0:
                    continue
                midi.addNote(track=3, channel=CHANNEL_PERCUSSION, pitch=42,
                             time=b + beat_offset, duration=0.2,
                             volume=hihat_vol + (10 if eighth % 2 == 0 else 0))

        # Gospel Amapiano log drum feel
        if genre == "Amapiano" and perc_style != "light":
            for beat_offset in [0.0, 2.0, 3.5]:
                midi.addNote(track=3, channel=CHANNEL_PERCUSSION, pitch=41,
                             time=b + beat_offset, duration=0.5, volume=int(75 * vol_scale))


# ─── Convenience CLI test ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    from music_theory import build_gospel_progression

    root_key = sys.argv[1] if len(sys.argv) > 1 else "G"
    genre    = sys.argv[2] if len(sys.argv) > 2 else "Contemporary"

    chords = build_gospel_progression(root_key)
    print(f"Generating MIDI for {genre} in key of {root_key}: {chords}")

    path = generate_gospel_midi(
        chords=chords * 2,  # Two rounds of the progression
        genre=genre,
        bpm=get_bpm_for_genre(genre),
        bars_per_chord=2,
        output_path=f"test_output/backing_{root_key}_{genre.replace(' ', '_')}.mid",
    )
    print(f"MIDI saved to: {path}")
