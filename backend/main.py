import os
import uuid
import asyncio
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(
    title="SelahAI Audio Synthesis Service",
    description="Backend microservice hosting symbolic melody generation and ACE-Step vocal stem synthesis models.",
    version="1.0.0"
)

# Output directory for rendered audio files and stems
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class MelodyRequest(BaseModel):
    chords: List[str]
    genre: str
    bpm: int
    key: str

class StemsRequest(BaseModel):
    title: str
    key: str
    genre: str
    lyrics: List[dict]  # Expects list of {"part": "Chorus", "line": "..."}

# ─── Symbolic / Melody Generation Endpoint ───────────────────────────────────

@app.post("/api/v1/melody", status_code=201)
async def generate_melody(request: MelodyRequest):
    """
    Accepts chords and genre parameters to generate symbolic MIDI and synthesized backing audio tracks.
    Runs on CPU using lightweight synthesis libraries like PyTheory/MIDIUtil.
    """
    try:
        task_id = str(uuid.uuid4())
        midi_path = os.path.join(OUTPUT_DIR, f"{task_id}.mid")
        audio_path = os.path.join(OUTPUT_DIR, f"{task_id}.wav")
        
        # TODO: Integrate PyTheory / MIDIUtil to generate note sequences
        # Example MIDI writing:
        # from midiutil import MIDIFile
        # midi = MIDIFile(1)
        # midi.addTempo(track=0, time=0, tempo=request.bpm)
        # ... write notes for request.chords mapped via theory ...
        # with open(midi_path, "wb") as f:
        #     midi.writeFile(f)
        
        # Simulate local synthesis write-out for prototyping
        with open(audio_path, "wb") as f:
            f.write(b"RIFF....WAVEfmt....data....")  # Dummy WAV header/file
            
        return {
            "task_id": task_id,
            "midi_url": f"/api/v1/downloads/{task_id}.mid",
            "audio_url": f"/api/v1/downloads/{task_id}.wav"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Melody generation failed: {str(e)}")

# ─── GPU-Accelerated Voice Synthesis Endpoint (ACE-Step) ────────────────────

async def run_acestep_inference(task_id: str, lyrics: List[dict], key: str, genre: str):
    """
    Simulates loading PyTorch model weights and running heavy voice synthesis.
    Runs asynchronously in a background task to prevent blocking the event loop.
    """
    print(f"Starting ACE-Step synthesis for task {task_id} on device: CUDA")
    # Simulate GPU inference latency (e.g. 15 seconds)
    await asyncio.sleep(15)
    
    # Write empty stub stems matching expected outputs
    for stem_name in ["soprano", "alto", "tenor", "lead"]:
        stem_path = os.path.join(OUTPUT_DIR, f"{task_id}_{stem_name}.mp3")
        with open(stem_path, "wb") as f:
            f.write(b"MPEG...")  # Dummy MP3 payload
            
    print(f"ACE-Step vocal synthesis completed for task {task_id}")

@app.post("/api/v1/stems", status_code=202)
async def generate_stems(request: StemsRequest, background_tasks: BackgroundTasks):
    """
    Triggers the GPU-heavy ACE-Step vocal model pipeline.
    Returns immediately with a task ID and stem download URLs.
    Synthesis runs asynchronously on the GPU.
    """
    task_id = str(uuid.uuid4())
    
    # Offload the heavy model synthesis to background task pipeline
    background_tasks.add_task(
        run_acestep_inference,
        task_id=task_id,
        lyrics=request.lyrics,
        key=request.key,
        genre=request.genre
    )
    
    return {
        "status": "processing",
        "task_id": task_id,
        "stems": {
            "soprano": f"/api/v1/downloads/{task_id}_soprano.mp3",
            "alto": f"/api/v1/downloads/{task_id}_alto.mp3",
            "tenor": f"/api/v1/downloads/{task_id}_tenor.mp3",
            "lead": f"/api/v1/downloads/{task_id}_lead.mp3"
        }
    }

# ─── File Download Route ─────────────────────────────────────────────────────

@app.get("/api/v1/downloads/{file_name}")
async def download_file(file_name: str):
    """
    Serves generated MIDI, WAV backing tracks, or MP3 voice stems.
    """
    file_path = os.path.join(OUTPUT_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Requested audio asset not found.")
        
    media_type = "audio/mpeg" if file_name.endswith(".mp3") else "audio/wav" if file_name.endswith(".wav") else "audio/midi"
    return FileResponse(file_path, media_type=media_type, filename=file_name)
