# synth_engine.py
# Pure-Python additive synthesizer for SelahAI backend.
# Generates gospel vocal-like WAV audio for choir parts using only:
#   - numpy (additive synthesis with ADSR, harmonics, formants, vibrato)
#   - scipy (WAV file write)
# No GPU, no external API, no C libraries. Runs on any CPU.
#
# This is deliberately focused on choir-style sounds (not general music).
# The formant shaping gives each voice part a human-like tonal character.

import math
import struct
import wave
import io
import os
from typing import List, Tuple, Dict

SAMPLE_RATE = 44100

# ─── ADSR Envelope ────────────────────────────────────────────────────────────

def make_adsr(
    num_samples: int,
    attack_s:  float = 0.10,
    decay_s:   float = 0.06,
    sustain:   float = 0.80,
    release_s: float = 0.15,
) -> List[float]:
    """Generates an ADSR amplitude envelope curve as a list of floats [0.0–1.0]."""
    attack_n  = int(attack_s  * SAMPLE_RATE)
    decay_n   = int(decay_s   * SAMPLE_RATE)
    release_n = int(release_s * SAMPLE_RATE)
    sustain_n = max(0, num_samples - attack_n - decay_n - release_n)

    env = []
    # Attack: linear ramp up
    for i in range(min(attack_n, num_samples)):
        env.append(i / attack_n)
    # Decay: from 1.0 → sustain level
    for i in range(min(decay_n, num_samples - len(env))):
        env.append(1.0 - (1.0 - sustain) * (i / decay_n))
    # Sustain: hold
    for _ in range(min(sustain_n, num_samples - len(env))):
        env.append(sustain)
    # Release: ramp down to 0
    remaining = num_samples - len(env)
    for i in range(remaining):
        env.append(sustain * (1.0 - (i / max(release_n, 1))))
    return env[:num_samples]

# ─── Vibrato LFO ──────────────────────────────────────────────────────────────

def apply_vibrato(base_freq: float, t: float, depth: float = 0.007, rate: float = 5.5) -> float:
    """Returns the instantaneous frequency with sinusoidal vibrato applied."""
    return base_freq * (1.0 + depth * math.sin(2.0 * math.pi * rate * t))

# ─── Formant Filter (resonant bandpass via IIR biquad) ───────────────────────

class BiquadBandpass:
    """Minimal stateful biquad bandpass IIR filter for one channel of audio."""
    def __init__(self, fc: float, q: float, sample_rate: int = SAMPLE_RATE):
        self.sample_rate = sample_rate
        self.q = q
        self.update_fc(fc, q)
        self.x1 = self.x2 = self.y1 = self.y2 = 0.0

    def update_fc(self, fc: float, q: float = None):
        if q is not None:
            self.q = q
        w0 = 2.0 * math.pi * fc / self.sample_rate
        alpha = math.sin(w0) / (2.0 * self.q)
        self.b0 =  math.sin(w0) / 2.0
        self.b1 =  0.0
        self.b2 = -math.sin(w0) / 2.0
        self.a0 =  1.0 + alpha
        self.a1 = -2.0 * math.cos(w0)
        self.a2 =  1.0 - alpha

    def process(self, x: float) -> float:
        y = (self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2
             - self.a1 * self.y1 - self.a2 * self.y2) / self.a0
        self.x2, self.x1 = self.x1, x
        self.y2, self.y1 = self.y1, y
        return y

# ─── Vowel Formants Map & Phonetic Morphing Engine ───────────────────────────
VOWEL_FORMANTS: Dict[str, Tuple[float, float]] = {
    "a": (800.0, 1200.0),
    "e": (550.0, 1800.0),
    "i": (300.0, 2200.0),
    "o": (500.0, 1000.0),
    "u": (350.0, 800.0),
}

def parse_vowels_from_text(text: str) -> List[Tuple[float, float]]:
    """Extracts a sequence of (F1, F2) formant pairs representing the vowels in the text."""
    if not text:
        return [(700.0, 1100.0)]  # Default vowel "Ah/Oh blend"
    
    text = text.lower()
    sequence = []
    for char in text:
        if char in VOWEL_FORMANTS:
            sequence.append(VOWEL_FORMANTS[char])
            
    if not sequence:
        return [(700.0, 1100.0)]
    return sequence

def get_vowel_formants_at_time(vowels: List[Tuple[float, float]], t: float, duration_s: float) -> Tuple[float, float]:
    """Smoothly interpolates formant frequencies (F1, F2) over duration_s based on active time t."""
    if len(vowels) == 1:
        return vowels[0]
    
    percent = t / max(duration_s, 0.01)
    percent = max(0.0, min(1.0, percent))
    
    idx_float = percent * (len(vowels) - 1)
    idx_low = int(math.floor(idx_float))
    idx_high = min(idx_low + 1, len(vowels) - 1)
    weight = idx_float - idx_low
    
    f1_low, f2_low = vowels[idx_low]
    f1_high, f2_high = vowels[idx_high]
    
    f1 = f1_low + (f1_high - f1_low) * weight
    f2 = f2_low + (f2_high - f2_low) * weight
    return f1, f2

# ─── Voice Timbre Profiles ────────────────────────────────────────────────────
# Each voice has: harmonics (list of relative frequencies), amplitudes per harmonic,
# main gain, formant bands [F1, F2] to sculpt the vowel resonance, ADSR params.

VOICE_PROFILES: Dict[str, dict] = {
    "soprano": {
        "harmonics":    [1, 2, 4, 6],
        "harm_amps":    [1.0, 0.4, 0.12, 0.04],
        "gain":         0.20,
        "formants":     [(850, 7), (1250, 6)],
        "adsr":         dict(attack_s=0.12, decay_s=0.06, sustain=0.82, release_s=0.18),
    },
    "alto": {
        "harmonics":    [1, 2, 3, 5],
        "harm_amps":    [1.0, 0.5, 0.18, 0.06],
        "gain":         0.18,
        "formants":     [(750, 6), (1150, 5)],
        "adsr":         dict(attack_s=0.14, decay_s=0.07, sustain=0.80, release_s=0.20),
    },
    "tenor": {
        "harmonics":    [1, 2, 3, 4],
        "harm_amps":    [1.0, 0.55, 0.22, 0.10],
        "gain":         0.16,
        "formants":     [(650, 6), (1000, 5)],
        "adsr":         dict(attack_s=0.16, decay_s=0.08, sustain=0.78, release_s=0.22),
    },
    "lead": {
        "harmonics":    [1, 2, 3, 5, 7],
        "harm_amps":    [1.0, 0.60, 0.28, 0.08, 0.03],
        "gain":         0.22,
        "formants":     [(700, 7), (1100, 6)],
        "adsr":         dict(attack_s=0.10, decay_s=0.06, sustain=0.85, release_s=0.16),
    },
}

# ─── Core Note Synthesizer ────────────────────────────────────────────────────

def synthesize_note(
    midi_note: int,
    duration_s: float,
    voice_type: str,
    ensemble_detune_cents: List[float] = None,
    lyrics_line: str = None,
) -> List[float]:
    """
    Synthesizes a single choir note using additive synthesis with:
    - Multiple detuned unison voices (ensemble chorus effect)
    - Vibrato LFO
    - Harmonic overtones shaped by ADSR
    - Dynamic Formant bandpass filtering morphing over lyric vowel text
    Returns a list of float samples normalised to [-1.0, 1.0].
    """
    profile = VOICE_PROFILES.get(voice_type, VOICE_PROFILES["lead"])
    num_samples = int(duration_s * SAMPLE_RATE)
    freq = 440.0 * (2.0 ** ((midi_note - 69) / 12.0))

    vowels = parse_vowels_from_text(lyrics_line)

    # Ensemble detune (cents offsets for chorus effect)
    if ensemble_detune_cents is None:
        ensemble_detune_cents = [-10.0, 0.0, 10.0]

    envelope = make_adsr(num_samples, **profile["adsr"])

    output = [0.0] * num_samples

    for detune_cents in ensemble_detune_cents:
        detune_factor = 2.0 ** (detune_cents / 1200.0)
        detuned_freq = freq * detune_factor
        gain_per_voice = profile["gain"] / len(ensemble_detune_cents)

        # Per-voice formant filters (independent state)
        voice_filters = [BiquadBandpass(fc, q) for fc, q in profile["formants"]]

        phase_accumulators = [0.0] * len(profile["harmonics"])

        for i in range(num_samples):
            t = i / SAMPLE_RATE
            inst_freq = apply_vibrato(detuned_freq, t)

            # Update formant filters dynamically based on vowel morph sequence
            if i % 128 == 0:
                f1_target, f2_target = get_vowel_formants_at_time(vowels, t, duration_s)
                voice_filters[0].update_fc(f1_target)
                if len(voice_filters) > 1:
                    voice_filters[1].update_fc(f2_target)

            # Sum harmonics
            raw = 0.0
            for hi, harmonic in enumerate(profile["harmonics"]):
                h_freq = inst_freq * harmonic
                delta_phase = 2.0 * math.pi * h_freq / SAMPLE_RATE
                phase_accumulators[hi] += delta_phase
                if phase_accumulators[hi] > 2.0 * math.pi:
                    phase_accumulators[hi] -= 2.0 * math.pi
                raw += math.sin(phase_accumulators[hi]) * profile["harm_amps"][hi]

            # Apply formant filters in parallel (mix 50/50)
            filtered = 0.0
            for vf in voice_filters:
                filtered += vf.process(raw)
            # Blend unfiltered + filtered (50/50 keeps brightness)
            sample = (raw * 0.5 + filtered * 0.5)

            output[i] += sample * envelope[i] * gain_per_voice

    # Soft clip to prevent harsh distortion
    output = [max(-0.92, min(0.92, s)) for s in output]
    return output

# ─── Chord + Silence Generation ───────────────────────────────────────────────

def mix_samples(a: List[float], b: List[float]) -> List[float]:
    """Mixes two sample buffers of possibly different lengths."""
    length = max(len(a), len(b))
    result = [0.0] * length
    for i in range(len(a)):
        result[i] += a[i]
    for i in range(len(b)):
        result[i] += b[i]
    return result

def samples_to_wav_bytes(samples: List[float], sample_rate: int = SAMPLE_RATE) -> bytes:
    """Converts float samples [-1, 1] to a 16-bit mono WAV byte string."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        packed = struct.pack(f"<{len(samples)}h", *[
            int(max(-32767, min(32767, s * 32767))) for s in samples
        ])
        wf.writeframes(packed)
    return buf.getvalue()

def render_voice_stem_wav(
    midi_notes_per_chord: List[int],
    voice_type: str,
    bpm: int,
    output_path: str,
    lyrics_per_chord: List[str] = None,
) -> str:
    """
    Renders a full choir voice stem for one voice type.
    Each chord gets one bar at the given BPM, with one sustained note per chord.
    Saves a WAV file to output_path and returns the path.
    """
    spb = 60.0 / bpm
    bar_duration = spb * 4.0  # 4 beats per bar
    note_duration = bar_duration * 0.90  # slight gap between chords

    all_samples: List[float] = []

    for chord_idx, midi_note in enumerate(midi_notes_per_chord):
        lyrics_line = lyrics_per_chord[chord_idx] if (lyrics_per_chord and chord_idx < len(lyrics_per_chord)) else None
        note_samples = synthesize_note(
            midi_note=midi_note,
            duration_s=note_duration,
            voice_type=voice_type,
            lyrics_line=lyrics_line,
        )
        # Pad with silence to fill the bar
        gap_samples = [0.0] * int((bar_duration - note_duration) * SAMPLE_RATE)
        all_samples.extend(note_samples)
        all_samples.extend(gap_samples)

    wav_bytes = samples_to_wav_bytes(all_samples)
    with open(output_path, "wb") as f:
        f.write(wav_bytes)

    return output_path


# ─── Quick Sanity Test ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import time

    print("SelahAI Pure-Python Choir Synth Engine — Sanity Test")
    print("Synthesizing 4-chord progression across 4 voice parts...")

    # G major: I-IV-V-vi  → MIDI roots for each voice at 72 BPM
    test_notes = {
        "soprano": [67, 65, 67, 69],   # G4, F4, G4, A4
        "alto":    [64, 62, 64, 65],   # E4, D4, E4, F4
        "tenor":   [59, 57, 59, 60],   # B3, A3, B3, C4
        "lead":    [67, 65, 67, 69],   # G4, F4, G4, A4 (octave up from tenor)
    }

    test_lyrics = [
        "A-ma-zing grace",
        "How sweet the sound",
        "That saved a wretch",
        "Like me"
    ]

    os.makedirs("test_output", exist_ok=True)
    for voice, notes in test_notes.items():
        start = time.time()
        path = render_voice_stem_wav(notes, voice, bpm=72, output_path=f"test_output/{voice}.wav", lyrics_per_chord=test_lyrics)
        elapsed = time.time() - start
        size_kb = os.path.getsize(path) // 1024
        print(f"  {voice:8s} -> {path}  ({size_kb}KB, {elapsed:.1f}s)")

    print("Done. WAV files in ./test_output/")
