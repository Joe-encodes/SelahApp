// pages/api/melody.js
// Proxies MIDI backing-track generation to the SelahAI Python FastAPI backend.
// Returns a MIDI file URL that the frontend or browser can download directly.

const PYTHON_BACKEND_URL = process.env.SELAH_BACKEND_URL || "http://localhost:8000";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: { sizeLimit: "1mb" },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { chords, genre, musicKey, barsPerChord } = req.body;

  const resolvedChords = Array.isArray(chords) && chords.length > 0
    ? chords
    : buildGospelChords(musicKey || "G");

  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/melody`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chords:         resolvedChords,
        genre:          genre         || "Contemporary",
        key:            musicKey      || "G",
        bars_per_chord: barsPerChord  || 1,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(no body)");
      throw new Error(`Backend error: HTTP ${response.status} — ${errorBody}`);
    }

    const data = await response.json();

    // Return the MIDI download URL as an absolute URL
    return res.status(200).json({
      midi_url:  `${PYTHON_BACKEND_URL}${data.midi_url}`,
      task_id:   data.task_id,
      bpm:       data.bpm,
      chords:    data.chords,
      status:    data.status,
    });

  } catch (err) {
    console.error("[Melody] Backend error:", err.message);
    return res.status(503).json({
      error:   "backend_unavailable",
      message: `Python backend unreachable: ${err.message}`,
    });
  }
}

function buildGospelChords(root) {
  const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const idx = NOTES.indexOf(root);
  if (idx === -1) return [root, "F", "G", "Am"];
  return [
    NOTES[idx],
    NOTES[(idx + 5) % 12],
    NOTES[(idx + 7) % 12],
    NOTES[(idx + 9) % 12] + "m",
  ];
}
