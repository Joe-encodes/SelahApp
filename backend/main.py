import os
import uuid
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict

# Local modules
from music_theory import (
    get_satb_for_chord,
    build_gospel_progression,
    get_bpm_for_genre,
)
from synth_engine import render_voice_stem_wav
from midi_generator import generate_gospel_midi

app = FastAPI(
    title="SelahAI Audio Synthesis Service",
    description="Real CPU-based gospel music generation: MIDI backing tracks + synthesized choir stems.",
    version="2.0.0"
)

# Allow the Next.js frontend to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Thread pool for heavy CPU synthesis (avoids blocking the FastAPI event loop)
_executor = ThreadPoolExecutor(max_workers=4)

# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class MelodyRequest(BaseModel):
    chords: List[str]
    genre: str
    bpm: Optional[int] = None
    key: str
    bars_per_chord: Optional[int] = 1

class StemsRequest(BaseModel):
    title: str
    key: str
    genre: str
    chords: List[str]
    lyrics: List[dict]  # {part: str, line: str}

class StemStatusResponse(BaseModel):
    status: str
    task_id: str
    stems: Optional[Dict[str, str]] = None
    error: Optional[str] = None

# ─── In-memory task store (MVP; replace with Redis in production) ─────────────
_stem_tasks: Dict[str, dict] = {}

# ─── /api/v1/melody — Real MIDI Generation ────────────────────────────────────

@app.post("/api/v1/melody", status_code=201)
async def generate_melody(request: MelodyRequest):
    """
    Generates a gospel MIDI backing track from a chord list.
    Returns download URLs for the MIDI file.
    Runs on CPU via MIDIUtil. No GPU required.
    """
    try:
        bpm = request.bpm or get_bpm_for_genre(request.genre)
        task_id = str(uuid.uuid4())
        midi_path = os.path.join(OUTPUT_DIR, f"{task_id}.mid")

        # Run MIDI generation in thread to avoid blocking event loop
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            _executor,
            lambda: generate_gospel_midi(
                chords=request.chords,
                genre=request.genre,
                bpm=bpm,
                bars_per_chord=request.bars_per_chord,
                output_path=midi_path,
            )
        )

        file_size = os.path.getsize(midi_path)
        return {
            "task_id":   task_id,
            "bpm":       bpm,
            "chords":    request.chords,
            "midi_url":  f"/api/v1/downloads/{task_id}.mid",
            "file_size": file_size,
            "status":    "ready",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Melody generation failed: {exc}")


# ─── /api/v1/stems — Real CPU Choir Voice Synthesis ──────────────────────────

def _synthesize_stems_sync(task_id: str, chords: List[str], key: str, genre: str) -> dict:
    """
    Blocking function that synthesizes all 4 choir voice stems using our
    pure-Python additive synthesis engine. Runs in a thread pool.
    Returns a dict of {voice_name: file_path}.
    """
    bpm = get_bpm_for_genre(genre)
    voice_midi_map: Dict[str, List[int]] = {
        "soprano": [], "alto": [], "tenor": [], "lead": []
    }

    # Assign a MIDI note per chord per voice
    for chord_name in chords:
        satb = get_satb_for_chord(chord_name)
        for voice in voice_midi_map:
            voice_midi_map[voice].append(satb[voice])

    output_paths = {}
    for voice_name, midi_notes in voice_midi_map.items():
        stem_path = os.path.join(OUTPUT_DIR, f"{task_id}_{voice_name}.wav")
        render_voice_stem_wav(
            midi_notes_per_chord=midi_notes,
            voice_type=voice_name,
            bpm=bpm,
            output_path=stem_path,
        )
        output_paths[voice_name] = stem_path

    return output_paths


@app.post("/api/v1/stems", status_code=202)
async def generate_stems(request: StemsRequest, background_tasks: BackgroundTasks):
    """
    Triggers choir stem synthesis for all 4 voice parts (Soprano, Alto, Tenor, Lead).
    Returns immediately with a task_id. The stems are synthesized in the background.
    Poll /api/v1/stems/{task_id} for status.
    """
    task_id = str(uuid.uuid4())
    _stem_tasks[task_id] = {"status": "processing", "stems": None, "error": None}

    async def _run_synthesis():
        try:
            loop = asyncio.get_event_loop()
            output_paths = await loop.run_in_executor(
                _executor,
                lambda: _synthesize_stems_sync(
                    task_id=task_id,
                    chords=request.chords,
                    key=request.key,
                    genre=request.genre,
                )
            )
            stems_urls = {
                voice: f"/api/v1/downloads/{task_id}_{voice}.wav"
                for voice in output_paths
            }
            _stem_tasks[task_id]["status"] = "ready"
            _stem_tasks[task_id]["stems"]  = stems_urls
        except Exception as exc:
            _stem_tasks[task_id]["status"] = "error"
            _stem_tasks[task_id]["error"]  = str(exc)

    background_tasks.add_task(_run_synthesis)

    return {
        "status":  "processing",
        "task_id": task_id,
        "message": "Choir synthesis started. Poll /api/v1/stems/{task_id} for ready status.",
    }


@app.get("/api/v1/stems/{task_id}", response_model=StemStatusResponse)
async def get_stem_status(task_id: str):
    """Checks the synthesis status for a previously submitted stems task."""
    if task_id not in _stem_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    task = _stem_tasks[task_id]
    return StemStatusResponse(
        status=task["status"],
        task_id=task_id,
        stems=task.get("stems"),
        error=task.get("error"),
    )


# ─── /api/v1/generate-song — Convenience: full song in one call ───────────────

@app.post("/api/v1/generate-song", status_code=201)
async def generate_full_song(request: StemsRequest):
    """
    Convenience endpoint that generates MIDI backing + choir stems in one call.
    Blocks until everything is ready (use for short progressions only).
    """
    bpm = get_bpm_for_genre(request.genre)
    task_id = str(uuid.uuid4())
    midi_path = os.path.join(OUTPUT_DIR, f"{task_id}.mid")

    loop = asyncio.get_event_loop()

    # 1. MIDI backing track
    await loop.run_in_executor(
        _executor,
        lambda: generate_gospel_midi(
            chords=request.chords,
            genre=request.genre,
            bpm=bpm,
            bars_per_chord=1,
            output_path=midi_path,
        )
    )

    # 2. Choir voice stems
    output_paths = await loop.run_in_executor(
        _executor,
        lambda: _synthesize_stems_sync(
            task_id=task_id,
            chords=request.chords,
            key=request.key,
            genre=request.genre,
        )
    )

    stems_urls = {
        voice: f"/api/v1/downloads/{task_id}_{voice}.wav"
        for voice in output_paths
    }

    return {
        "task_id":  task_id,
        "status":   "ready",
        "bpm":      bpm,
        "midi_url": f"/api/v1/downloads/{task_id}.mid",
        "stems":    stems_urls,
    }


# ─── /api/v1/downloads/{file_name} — File Serving ────────────────────────────

@app.get("/api/v1/downloads/{file_name}")
async def download_file(file_name: str):
    """Serves generated MIDI, WAV backing tracks, or WAV choir stems."""
    # Sanitize: only allow filenames without path traversal
    if ".." in file_name or "/" in file_name or "\\" in file_name:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    file_path = os.path.join(OUTPUT_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found. May still be processing.")

    if file_name.endswith(".mid"):
        media_type = "audio/midi"
    elif file_name.endswith(".wav"):
        media_type = "audio/wav"
    else:
        media_type = "application/octet-stream"

    return FileResponse(file_path, media_type=media_type, filename=file_name)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {
        "status":   "ok",
        "service":  "SelahAI Audio Synthesis Service v2.0",
        "features": ["midi_generation", "choir_stem_synthesis_cpu", "gospel_theory"],
    }
