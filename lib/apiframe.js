const APIFRAME_BASE_URL = "https://api.apiframe.ai/v2";

export function getApiKeys() {
  const keys = [];
  const primaryKey = process.env.APIFRAME_API_KEY || "";
  if (primaryKey) {
    keys.push(...primaryKey.split(",").map((k) => k.trim()).filter(Boolean));
  }

  // Check numbered environment variables (e.g. APIFRAME_API_KEY2, APIFRAME_API_KEY3)
  const numberedKeys = [];
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith("APIFRAME_API_KEY")) {
      const suffix = key.slice("APIFRAME_API_KEY".length);
      if (/^\d+$/.test(suffix)) {
        numberedKeys.push({ index: parseInt(suffix, 10), val: process.env[key] });
      }
    }
  });

  numberedKeys.sort((a, b) => a.index - b.index);
  numberedKeys.forEach(({ val }) => {
    if (val) {
      keys.push(...val.split(",").map((k) => k.trim()).filter(Boolean));
    }
  });

  return keys;
}

export function parseJobId(compoundJobId) {
  if (compoundJobId && compoundJobId.includes(":")) {
    const [actualJobId, apiKey] = compoundJobId.split(":", 2);
    return { jobId: actualJobId, apiKey };
  }
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error("No APIFrame API keys configured in environment.");
  }
  return { jobId: compoundJobId, apiKey: keys[0] };
}

export async function submitSong({ lyrics, stylePrompt, vocalGender, instrumentalOnly }) {
  if (!lyrics) throw new Error("Lyrics must not be empty");
  if (lyrics.length > 5000) throw new Error(`Lyrics too long: ${lyrics.length} chars (max 5000)`);
  if (stylePrompt.length > 1000) throw new Error(`Style prompt too long: ${stylePrompt.length} chars (max 1000)`);

  const payload = {
    prompt: lyrics,
    model: "suno",
    sunoParams: {
      custom_mode: true,
      model_version: "V4_5PLUS",
      style: stylePrompt,
      instrumental: instrumentalOnly || false,
    },
  };

  if (vocalGender === "m" || vocalGender === "f") {
    payload.sunoParams.vocal_gender = vocalGender;
  }

  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error("APIFRAME_API_KEY must be set and contain at least one valid key.");
  }

  let lastError = null;
  for (const apiKey of keys) {
    if (!apiKey.startsWith("afk_")) {
      console.warn(`[apiframe] API Key starting characters are invalid. Key: ${apiKey.substring(0, 10)}...`);
    }
    try {
      const response = await fetch(`${APIFRAME_BASE_URL}/music/generate`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const jobId = data.jobId;
      if (!jobId) {
        throw new Error("jobId not found in API response");
      }
      return `${jobId}:${apiKey}`;
    } catch (exc) {
      console.warn(`[apiframe] Submission failed for key ${apiKey.substring(0, 10)}...: ${exc.message}`);
      lastError = exc;
    }
  }

  throw new Error(`All APIFrame keys failed for submission. Last error: ${lastError ? lastError.message : "unknown"}`);
}

export async function pollSong(compoundJobId) {
  const { jobId, apiKey } = parseJobId(compoundJobId);

  const response = await fetch(`${APIFRAME_BASE_URL}/jobs/${jobId}`, {
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`apiframe poll failed HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const status = data.status || "";

  if (status === "FAILED") {
    throw new Error(`apiframe job ${jobId} failed: ${JSON.stringify(data)}`);
  }

  if (status === "COMPLETED") {
    const tracks = data.result?.tracks || [];
    if (tracks.length === 0) {
      throw new Error(`apiframe job ${jobId} completed but returned no tracks.`);
    }
    return {
      status: "complete",
      audio_url: tracks[0].audioUrl,
      audio_title: tracks[0].title || "Selah Song",
      tracks: tracks.map((track) => ({
        audio_url: track.audioUrl,
        image_url: track.imageUrl,
        title: track.title,
        duration_sec: track.duration,
      })),
    };
  }

  return { status: "pending" };
}
