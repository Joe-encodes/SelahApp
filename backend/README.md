# SelahAI Audio Synthesis Service (FastAPI Backend)

This is the FastAPI backend microservice designed to handle GPU-intensive vocal synthesis (ACE-Step) and CPU-based symbolic melody synthesis.

## 🚀 Local Setup & Run

### 1. Install Dependencies
Make sure you have Python 3.10+ installed. Navigate to the `backend` directory and run:
```bash
pip install -r requirements.txt
```

### 2. Start the Server
Start the development server with Uvicorn:
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The API docs will be available interactively at: `http://127.0.0.1:8000/docs`

## 📡 API Endpoints

### 1. Generate Backing Track / Melody (CPU-first)
*   **Endpoint:** `POST /api/v1/melody`
*   **Body:**
    ```json
    {
      "chords": ["C", "F", "G", "Am"],
      "genre": "Contemporary",
      "bpm": 72,
      "key": "C"
    }
    ```

### 2. Generate Vocal Harmony Stems (GPU-heavy / Background Task)
*   **Endpoint:** `POST /api/v1/stems`
*   **Body:**
    ```json
    {
      "title": "Praise Song",
      "key": "C",
      "genre": "Contemporary",
      "lyrics": [
        {"part": "Verse 1", "line": "Lord we lift our hearts"},
        {"part": "Chorus", "line": "Hallelujah to the King"}
      ]
    }
    ```
*   **Response:** Returns a `task_id` and download URLs immediately while processing the audio asynchronously on the host machine.
