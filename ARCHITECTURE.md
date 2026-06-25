# SelahAI: Full Technical Architecture & Codebase Walkthrough

This document serves as a complete engineering reference for the SelahAI Gospel Music Co-Writer platform. It details the high-level system flows, database structures, component states, and exact functionality of every codebase file to guide implementation and security audits.

---

## 1. System Blueprint & Core Constraints

### Application Concept
SelahAI is a Next.js full-stack web application designed for choir rehearsal and gospel song creation. It leverages AI (via Groq Llama-3.3-70b-versatile and Suno V4.5+ via APIFrame) to write lyrics, arrange chord progressions, and synthesize backing tracks, alongside a real-time client-side Web Audio synthesis engine for SATB choir practice.

### Ground-Level Constraints
1. **Serverless Transition Readiness**: State management must eventually be decoupled from temporary local storage. Background tasks, API credit counters, and queues must persist in a database (Supabase) rather than in-memory states to support serverless deployment.
2. **Security & Ownership**: Row Level Security (RLS) is enabled in Supabase. The application must enforce that only the original creator of a song can modify its layout, lyrics, chord mappings, or public status.
3. **Audio Blend Isolation**: Avoid layering synthesis voices on top of generated backing tracks. When a Suno backing track is active, local oscillators are muted, and the Web Audio context only drives the visual prompter timing.

---

## 2. High-Level Data & Playback Flows

### A. Creation Workflow (Create Studio)
```
[User Form Selection]
       │ (Theme, Key, Scripture, Genre, Emotional Mode, Instrumentation, Vocal Lead)
       ▼
[pages/api/generate.js]
       │ 1. Word-boundary truncation of bounds (theme <= 100, scripture <= 500, lyrics <= 4000)
       │ 2. Apply Scripture-to-First-Person Testimony Translation Rule
       │ 3. Rotate Groq API Keys (1 to 4)
       ▼
[Groq Llama-3.3-70b-versatile]
       │ (Generates structured JSON lyrics, chords, arrangement, and production notes)
       ▼
[Next.js Client saveSong()] ──► [IndexedDB local cache] & [Supabase songs table (via RLS)]
```

### B. Playback and Synthesis Workflow (Choir Desk)
```
[User Clicks Play in Player.jsx]
       │
       ├─► [Web Audio Engine: useGospelAudio.js]
       │         │
       │         ├─► If AI audio_url is present:
       │         │   Loads backing track MP3 buffer. Plays track. Mutes local synth oscillators.
       │         │
       │         └─► If no AI backing track is loaded:
       │             Plays real-time Web Audio Synthesizer (Soprano, Alto, Tenor, Lead, Bass, Percussion).
       │
       └─► [Player Prompt Timeline]
                 │ (Calculates beats and matches active chords/lyrics index)
                 ▼
             [Karaoke Lyrics Highlight (Karaoke Vibe)]
```

---

## 3. Database Schema & RLS Policies

All cloud storage is managed by Supabase. Local storage acts as an offline-first caching layer utilizing IndexedDB.

### SQL Definition (`lib/schema.sql`)
1. **`songs` table**: Stores metadata, lyrics (JSONB), chords (array), track configurations, and public status.
   - **RLS Policy 1**: "Users can manage their own songs" (`using (auth.uid() = user_id)` for `ALL`).
   - **RLS Policy 2**: "Public songs are readable by anyone" (`using (is_public = true)` for `SELECT`).
2. **`song_likes` table**: Tracks user likes for community songs.
   - **RLS Policy**: "Users manage their own likes" (`using (auth.uid() = user_id)`).
3. **`profiles` table**: Synchronizes user details (display name and avatar).
   - **Database Trigger (`handle_new_user`)**: Auto-creates a profile row on auth sign-up, default-naming users based on their email prefix or OAuth full name.
   - **RLS Policy**: "Users can update their own profile" (`using (auth.uid() = id)`).
4. **`song_comments` table**: Stores user discussions under individual songs.
   - **RLS Policies**: "Anyone can read comments" (SELECT), "Authenticated users can comment" (INSERT), "Users can delete own comments" (DELETE).
5. **`comment_reactions` table**: Tracks user likes/hearts on comments.
   - **RLS Policies**: "Anyone can read comment reactions" (SELECT), "Authenticated users can toggle reaction" (ALL).

---

## 4. Comprehensive File-by-File Analysis

### A. Frontend Core Pages (`/pages`)

#### 1. [pages/index.jsx](pages/index.jsx)
- **Role**: Application Dashboard and navigation core.
- **Key Functions & Logic**:
  - Initializes user session state (`user`, `profile`) and computes display initials dynamically.
  - Queries active songs list (`getAllSongs`) and merges it with mock fallbacks.
  - Employs `useGospelAudio` hook, syncing the persistent bottom media player bar.
  - Sidebar profile block is fully clickable, launching the `ProfileModal` to update credentials.
  - Embeds sub-tabs: `HomeTab` (Discover), `CreateTab` (Create Studio, strictly for AI Song Builder), `RehearseTab` (Rehearsal Room for presets catalog and practicing/editing saved songs), `LibraryTab` (Library, styled in a clean grid card format), and `CommunityTab` (Explore Feed).

#### 2. [pages/song/\[id\].jsx](pages/song/[id].jsx)
- **Role**: Dedicated spotify-like page route for Choir Desk rehearsal.
- **Key Functions & Logic**:
  - Extracts the dynamic URL `id` parameter.
  - Loads matching song object via `getSong` service, falling back to IndexedDB if offline.
  - Keeps sidebar design synchronized with the dashboard, rendering a clickable profile block.
  - Instantiates the `Player` component with full audio playback state.
  - Embeds a Comments section beneath the player, supporting real-time fetching (`GET`), posting (`POST`), deleting (`DELETE`), and toggling reactions (`POST /api/song/comment-like`).

#### 3. [pages/auth.jsx](pages/auth.jsx)
- **Role**: Account Authentication page.
- **Key Functions & Logic**:
  - Supports classic Email/Password flows (Sign In and Account Creation).
  - Integrates Google OAuth Sign-In via Supabase client.
  - Triggers redirects back to target destination using search parameter `?next=`.

---

### B. Next.js API Routes (`/pages/api`)

#### 1. [pages/api/generate.js](pages/api/generate.js)
- **Role**: Core LLM song lyric and structure generator.
- **Key Functions & Logic**:
  - `truncateAtWordBoundary(text, maxLen)`: Cleans parameters (theme <= 100, scripture <= 500, rawSongText <= 4000) at word boundaries to avoid broken words in prompts.
  - Rotates up to 4 Groq API keys to prevent rate limit limits.
  - Builds dynamic prompts based on emotional mode mappings and instrumentation profiles.
  - Executes **Scripture Translation Rule**: translating the verse references into first-person testimonies or prayers rather than direct literal quotes.
  - Validates and parses Groq Llama-3.3-70b-versatile JSON output, flat-mapping sections into chords/lyric line maps.

#### 2. [pages/api/stems.js](pages/api/stems.js)
- **Role**: Proxies requests for Suno AI full-mix generation.

#### 3. [pages/api/melody.js](pages/api/melody.js)
- **Role**: Proxies backing track generation requests.

#### 4. [pages/api/song/stems-split.js](pages/api/song/stems-split.js)
- **Role**: Handles audio stem separation and packaging.
- **Key Functions & Logic**:
  - Performs authentication and song ownership verification.
  - Deducts 3 credits for stem separation.
  - If a `REPLICATE_API_TOKEN` is found, submits song's Suno `audio_url` to Replicate's `cjwbw/demucs` model, polling until success, and downloading individual stems (`vocals`, `drums`, `bass`, `accompaniment`).
  - Gracefully falls back to local backing track MIDI and full mix MP3 if the token is missing, writing a `readme.txt` into the ZIP explaining configuration options.
  - Uses `jszip` to bundle tracks and downloads them dynamically as a ZIP.

#### 5. [pages/api/song/comments.js](pages/api/song/comments.js)
- **Role**: CRUD operations for comments.
- **Key Functions & Logic**:
  - `GET`: Reads comments for a `songId` joining user profiles and including like states.
  - `POST`: Validates content (using Zod) and saves a new comment.
  - `DELETE`: Verifies user ownership and deletes comment.

#### 6. [pages/api/song/comment-like.js](pages/api/song/comment-like.js)
- **Role**: Toggles hearts/reactions on song comments.

---

### C. Shared React Components (`/components`)

#### 1. [components/Player.jsx](components/Player.jsx)
- **Role**: Main choir rehearsal dashboard.
- **Key Functions & Logic**:
  - `isOwner`: Checks if the logged-in user owns the song: `!song.user_id || (user && String(user.id) === String(song.user_id))`.
  - `handleTogglePublish`: Guarded to prevent non-owners from toggling the publication status.
  - Synchronizes active playback chord indices with lyrics scroll timeline.
  - Controls local synthesis trigger and dispatches asynchronous cloud synthesis requests.
  - Integrates "Download Multitrack Stems (.zip)" inside the downloads panel, requesting `POST /api/song/stems-split` and saving the resulting file.

#### 2. [components/ProfileModal.jsx](components/ProfileModal.jsx)
- **Role**: User Profile Settings management modal.
- **Key Functions & Logic**:
  - Captures display name and avatar URL edits.
  - Communicates with Supabase database profiles update handler.
  - Provides instant success feedback and closes modal automatically.

#### 3. [components/StemRow.jsx](components/StemRow.jsx)
- **Role**: Individual track mixer strip.
- **Key Functions & Logic**:
  - Renders volume sliders, mute buttons, and solo buttons.

#### 4. [components/tabs/RehearseTab.jsx](components/tabs/RehearseTab.jsx)
- **Role**: Rehearsal Hub / Practice Room UI.
- **Key Functions & Logic**:
  - Lists and searches popular Christian Classics.
  - Lists and searches preexisting library songs.
  - Clicking on classics bypasses AI credits and loads preset chords/lyrics instantly into the Choir Desk.
  - Clicking library songs opens the Choir Desk dynamic practice workstation.

---

### D. Utility Services (`/lib`)

#### 1. [lib/songService.js](lib/songService.js)
- **Role**: Primary data-management orchestrator.
- **Key Functions & Logic**:
  - `saveSong(song)`: Always saves locally in IndexedDB first. Checks user ownership `song.user_id === user.id` before dispatching updates/saves to Supabase.
  - `getProfile(userId)`: Queries the `profiles` table to pull user display names and avatars.
  - `updateProfile(userId, displayName, avatarUrl)`: Saves profile edits to the database.

#### 2. [lib/constants/popularSongs.js](lib/constants/popularSongs.js)
- **Role**: Static database of popular Christian songs (chords, lyrics structure) loaded instantly to bypass AI generation and route directly to dynamic workstations.

#### 2. [lib/useGospelAudio.js](lib/useGospelAudio.js)
- **Role**: Audio player context hook and Web Audio synthesizer engine.
- **Key Functions & Logic**:
  - Schedules hihats, kicks, snares, and log drums via precise `AudioContext` timers.
  - Integrates `loadBackingTrack` to feed MP3 audio buffers into the gain pipeline, muting local synthesizer channels when a backing track is active.
  - Exposes playback hooks: `play`, `pause`, `stop`, `volumes`, and client-side WAV/MIDI file renders.

#### 3. [lib/indexedDb.js](lib/indexedDb.js)
- **Role**: Database configuration and CRUD handlers for local IndexedDB stores.

---

### E. Python Backend Component (`/backend`)

#### 1. [backend/main.py](backend/main.py)
- **Role**: REST API entrypoint (FastAPI) and task manager.
- **Key Functions & Logic**:
  - Configures CORS rules and output file directory mappings.
  - `generate_melody()`: CPU-bound thread pool executor generating MIDI files.
  - `generate_stems()`: Queues asynchronous jobs to compose Suno tracks.

#### 2. [backend/music_theory.py](backend/music_theory.py)
- **Role**: Mathematical music theory structures.
- **Key Functions & Logic**:
  - Note mapping, octave frequency offsets, close voicings, scale models, and walking bass generators.

#### 3. [backend/midi_generator.py](backend/midi_generator.py)
- **Role**: Symbolic MIDI file binary creation engine.

#### 4. [backend/apiframe_adapter.py](backend/apiframe_adapter.py)
- **Role**: APIFrame client adapter.
- **Key Functions & Logic**:
  - Submits payload configurations to `/v2/music/generate`, rotating API keys, and polling jobs.

#### 5. [backend/usage_counter.py](backend/usage_counter.py)
- **Role**: Monthly credit guardrail checking usage counters against quota configurations.
