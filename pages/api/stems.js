// pages/api/stems.js
// Proxies choir stem requests to the SelahAI Python FastAPI backend.
// The Python backend synthesizes all 4 voice parts (soprano/alto/tenor/lead)
// using pure-CPU additive synthesis — no cloud GPU required.

const PYTHON_BACKEND_URL = process.env.SELAH_BACKEND_URL || "http://localhost:8000";
const STEM_POLL_INTERVAL_MS = 3000;
const STEM_POLL_TIMEOUT_MS  = 180000; // 3 minutes max

export const config = {
  api: {
    responseLimit: false,
    bodyParser: { sizeLimit: "4mb" },
  },
};

/**
 * Polls the Python backend task status endpoint until the stems are ready
 * or the timeout is exceeded.
 * @param {string} taskId
 * @returns {Promise<{stems: Record<string, string>}>}
 */
async function pollStemTaskUntilReady(taskId) {
  const statusUrl = `${PYTHON_BACKEND_URL}/api/v1/stems/${taskId}`;
  const deadline = Date.now() + STEM_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, STEM_POLL_INTERVAL_MS));

    const statusResponse = await fetch(statusUrl);
    if (!statusResponse.ok) {
      throw new Error(`Backend status check failed: HTTP ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();

    if (statusData.status === "ready") {
      return statusData.stems;
    }

    if (statusData.status === "error") {
      throw new Error(`Backend synthesis error: ${statusData.error || "unknown"}`);
    }

    // status === "processing" — keep polling
    console.log(`[Stems] Task ${taskId} still processing...`);
  }

  throw new Error(`Stem synthesis timed out after ${STEM_POLL_TIMEOUT_MS / 1000}s`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { lyrics, genre, musicKey, chords, title } = req.body;

  // ─── Resolve chord list ────────────────────────────────────────────────────
  // Use chords from the request body if present, otherwise build from key
  const resolvedChords = Array.isArray(chords) && chords.length > 0
    ? chords
    : buildGospelChords(musicKey || "G");

  const songTitle = title || "Selah Song";

  console.log(
    `[Stems] Requesting choir synthesis — key: ${musicKey}, genre: ${genre}, chords: ${resolvedChords.join(", ")}`
  );

  try {
    // ── Step 1: Submit the synthesis job to the Python backend ────────────────
    const submitResponse = await fetch(`${PYTHON_BACKEND_URL}/api/v1/stems`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:  songTitle,
        key:    musicKey || "G",
        genre:  genre    || "Contemporary",
        chords: resolvedChords,
        lyrics: Array.isArray(lyrics) ? lyrics : [],
      }),
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text().catch(() => "(no body)");
      throw new Error(`Backend submit failed: HTTP ${submitResponse.status} — ${errorBody}`);
    }

    const submitData = await submitResponse.json();
    const taskId = submitData.task_id;

    if (!taskId) {
      throw new Error("Backend did not return a task_id");
    }

    console.log(`[Stems] Job accepted — task_id: ${taskId}`);

    // ── Step 2: Poll until ready ──────────────────────────────────────────────
    const stemRelativeUrls = await pollStemTaskUntilReady(taskId);

    // ── Step 3: Convert relative backend URLs to absolute ─────────────────────
    const stems = {};
    for (const [voice, relativeUrl] of Object.entries(stemRelativeUrls)) {
      stems[voice] = `${PYTHON_BACKEND_URL}${relativeUrl}`;
    }

    console.log(`[Stems] All 4 stems ready — task_id: ${taskId}`);
    return res.status(200).json({ stems, task_id: taskId, source: "python_backend" });

  } catch (err) {
    console.error("[Stems] Backend error:", err.message);

    // ── Fallback: signal the frontend to use its built-in Web Audio synth ─────
    return res.status(503).json({
      error:    "backend_unavailable",
      message:  `Python backend unreachable — ${err.message}. Using local Web Audio synthesis.`,
      fallback: "web_audio",
    });
  }
}

// Builds a gospel I-IV-V-vi chord progression for a given root key
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
