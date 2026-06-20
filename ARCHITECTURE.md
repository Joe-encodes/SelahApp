# SelahAI: Technical Architecture & System Walkthrough

This document outlines the architecture, data flows, system constraints, and file-by-file blueprints of the SelahAI Gospel Music Co-Writer application.

---

## 1. Executive Summary & Constraints

### What Has Been Achieved
- **Full UI Makeover:** Formatted dark aesthetic styled after the Suno reference app, featuring responsive mobile navigation drawer, clean dashboard columns, Genre vibe presets, and a collapsible advanced settings drawer.
- **Real-Time Choir Practice Prompter:** Dynamic visual chords arranger, phonetic vowel-morphing singing engine, and synchronization of the lyrics prompter timeline directly to active chord beats.
- **Instrument Mixer Workstation:** Dynamic mixer sliders for Piano, Percussion, Bass, and Guitar, controlling gain nodes with a 48-hour session expiration lock.
- **Production Stems & MIDI Exports:** MIDI generation engine for custom section arrangements, and local browser-based `OfflineAudioContext` WAV backing track synthesis.
- **FastAPI Backend (Python):** Complete, lightweight FastAPI server running locally alongside the Next.js frontend to offload symbolic MIDI creation and CPU additive vowel-synthesis.
- **Offline Shell & Database Caching:** Custom Service Worker shell caching with IndexedDB caching of all generated song metadata.

### Constraints & Challenges Faced
1. **CPU/Browser-First Audio Synthesis:** Heavy ML models like ACE-Step require high GPU power and 10GB+ weights files. To avoid live pitch delays or thermal throttling on client CPUs, we developed a pure-Python additive synthesizer for the server and a matching Web Audio synthesizer for the browser.
2. **Vocal Articulation (Vowel Morphing):** To avoid flat "humming" tones, a phonetic vowel parser extracts vowel patterns from lyric lines, automating resonant bandpass filter frequencies (F1, F2) over the note's duration.
3. **Legato/Silence Legibility:** Bridging notes smoothly without popping required exact ADSR envelopes combined with a `0.90` duration multiplier for active notes to leave a brief legato release gap.

### The "12-13 Second Output" Explanation
The generated audio files (e.g., backing tracks or synthesized vocal stems) are typically 12 to 13 seconds long because of the following math:
- **Default Tempo:** 72 BPM (Beats Per Minute)
- **Seconds Per Beat (SPB):** $\frac{60 \text{ seconds}}{72 \text{ BPM}} \approx 0.833 \text{ seconds per beat}$
- **Bar Duration (4 beats):** $4 \times 0.833 \text{s} \approx 3.333 \text{ seconds per bar}$
- **Standard Loop Progression:** 4 chords (e.g., `G - C - D - Em`)
- **Total Song Duration:** $4 \text{ bars} \times 3.333 \text{s} \approx 13.33 \text{ seconds}$
- **Synthesis Active Note Time:** $\text{bar duration} \times 0.90 \text{ (legato multiplier)} \approx 3.0 \text{ seconds of active sound per note}$ followed by $0.33 \text{ seconds of release silence}$.
- **Result:** The final rendered WAV buffer has a duration of exactly **13.33 seconds** (which compresses/rounds to 12-13s in players).

---

## 2. High-Level Data Flows (Medium Version)

### A. Song Generation & Retrieval Flow
```
[User Form Submit]
       │ (Prompt parameters: Genre, Key, Vibe, Topic)
       ▼
[Next.js API: pages/api/generate.js]
       │ (Sends engineered prompts to Groq API)
       ▼
[Groq LLM: Llama-3.3-70b] ──► (Returns structured JSON song model)
       │
       ▼
[Next.js API response] ──► [IndexedDB Cache] ──► [UI State Render]
```

### B. Rehearsal Playback & Audio Synthesis Flow
```
[User Clicks Play in Dashboard]
       │
       ├─► [Web Audio API: useGospelAudio.js] ──► Synthesizes Piano, Bass, Guitar oscillators
       │                                         and schedules Drum beats in real-time.
       │
       └─► [Player Prompt Timeline] ──► Highlight active chord box and update prompter
                                         lyrics index dynamically synced to beat timer.
```

---

## 3. File-by-File Blueprint & Specifications (Long Version)

### A. Python Backend Component (`/backend`)

#### 1. [backend/main.py](file:///c:/Users/ESTHER/Desktop/SelahApp/backend/main.py)
- **Role:** REST API Entrypoint (FastAPI).
- **Functions:**
  - `generate_melody(MelodyRequest)`: Endpoint `/api/v1/melody` generates backing track MIDI files using a background thread pool executor.
  - `generate_stems(StemsRequest)`: Endpoint `/api/v1/stems` initiates vocal stem synthesis.
  - `get_stem_status(task_id)`: Checks progress of ongoing background voice generation tasks.
  - `download_file(file_name)`: Serves synthesized WAV or MIDI tracks directly to the client browser.

#### 2. [backend/synth_engine.py](file:///c:/Users/ESTHER/Desktop/SelahApp/backend/synth_engine.py)
- **Role:** Pure-Python additive synthesizer.
- **Key Modules:**
  - `make_adsr()`: Builds linear attack/decay/sustain/release curves to scale wave amplitudes.
  - `BiquadBandpass`: Implements digital IIR biquad bandpass filter coefficients dynamically adjusted mid-loop to sculpt voice frequencies.
  - `synthesize_note()`: Combines three detuned oscillators per note (ensemble chorus effect), sinusoidal vibrato LFO, and parallel formant filters morphing vowels.
  - `render_voice_stem_wav()`: Integrates chords, lyrics, and tempo to output high-fidelity vocal stems.

#### 3. [backend/midi_generator.py](file:///c:/Users/ESTHER/Desktop/SelahApp/backend/midi_generator.py)
- **Role:** Symbolic MIDI generator.
- **Key Logic:**
  - Instantiates `MIDIFile` tracks for different channels: Piano, Bass, Guitar, and Percussion.
  - Automates drum fills (kick, snare, hihat velocity rolls) on beat 4 of transition bars based on section structure flags.

#### 4. [backend/music_theory.py](file:///c:/Users/ESTHER/Desktop/SelahApp/backend/music_theory.py)
- **Role:** Mathematical Music Theory Resolver.
- **Formulas:**
  - Resolves note numbers and transposition steps from string pitch aliases (e.g. `C#4` -> `61`).
  - Contains pitch frequency tables mapping roots to chord harmonics.

---

### B. Frontend Next.js Client Component

#### 1. [lib/useGospelAudio.js](file:///c:/Users/ESTHER/Desktop/SelahApp/lib/useGospelAudio.js)
- **Role:** Web Audio API synthesis engine hook.
- **Key Features:**
  - Schedules hihats, kicks, snares, and log drums via precise `AudioContext` lookahead timers.
  - Ported phonetic parser automating Web Audio `BiquadFilterNode` parameters for live local choir singing.
  - Exposes playback hooks: `play`, `pause`, `stop`, `volumes`, and client-side WAV/MIDI file renders.

#### 2. [components/Player.jsx](file:///c:/Users/ESTHER/Desktop/SelahApp/components/Player.jsx)
- **Role:** Choir Desk dashboard and rehearsal UI.
- **Core Elements:**
  - Synchronizes active lyrics and part indexes via `activeLyricIdx` computed from the current chord playback step.
  - Renders the **Arrangement Monitor** displaying dynamics (Forte, Piano, Mezzo) and active instrument channel indicators.
  - Manages SAT Stem mixing sliders and handles local vs cloud synthesis fallbacks.

#### 3. [pages/api/generate.js](file:///c:/Users/ESTHER/Desktop/SelahApp/pages/api/generate.js)
- **Role:** LLM lyric/chords generator.
- **Design:**
  - Constructs system and user messages containing structural and harmonic guidelines.
  - Calls Groq API using `llama-3.3-70b-versatile` and parses structured JSON sections list.

#### 4. [lib/indexedDb.js](file:///c:/Users/ESTHER/Desktop/SelahApp/lib/indexedDb.js)
- **Role:** Offline indexed storage.
- **Logic:**
  - Initializes database (`SelahDB`) storing generated songs locally to ensure persistence during offline use.

#### 5. [public/sw.js](file:///c:/Users/ESTHER/Desktop/SelahApp/public/sw.js)
- **Role:** Service worker for PWA support.
- **Strategy:**
  - Listens to `install` and `fetch` events to serve the HTML shell and static files directly from local cache when offline.
